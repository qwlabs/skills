// pipeline/stages/typespec-parse.ts
// TypeSpec 解析 Stage — 编译 .tsp 文件并填充 ctx.doc

import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";
import {
  compile,
  NodeHost,
  getDoc,
  getMinValue,
  getMaxValue,
  getMinLength,
  getMaxLength,
  getPattern,
  isTemplateDeclaration,
  getDeprecationDetails,
} from "@typespec/compiler";
import type {
  Program,
  Operation as TspOperation,
  Model,
  ModelProperty,
  Type,
  Namespace,
} from "@typespec/compiler";
import { getAllHttpServices } from "@typespec/http";
import type { HttpOperation } from "@typespec/http";
import { existsSync, readdirSync, readFileSync, mkdirSync, cpSync, rmSync } from "fs";
import type {
  ParsedApiDoc,
  ApiGroup,
  ApiOperation as ApiOperationType,
  ApiParameter,
  ApiBody,
  ApiResponse,
  ApiType,
  ApiProperty,
  ApiConstraints,
  VersionTag,
  DagStage,
  StageContext,
} from "../types";
import { resolveScalarBase, deepCloneValue, isErrorResponse } from "../type-primitives";
import { buildRevision } from "../revision";

export const typespecParse: DagStage = {
  name: "typespec-parse",
  requires: [],
  provides: ["doc.api", "doc.revision"],
  async process(ctx: StageContext): Promise<void> {
    const inputDir = resolve(ctx.config.inputDir);
    const doc = await parseTypeSpecDir(inputDir, ctx.config.now);

    ctx.doc.title = doc.title;
    ctx.doc.version = doc.version;
    ctx.doc.description = doc.description;
    ctx.doc.baseUrl = doc.baseUrl;
    ctx.doc.groups = doc.groups;
    ctx.doc.headerSnippets = doc.headerSnippets;
    ctx.doc.footerSnippets = doc.footerSnippets;
    ctx.doc.revision = doc.revision;
  },
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = resolve(__dirname, "../../..");

async function parseTypeSpecDir(inputDir: string, now: Date): Promise<ParsedApiDoc> {
  const mainFile = findMainFile(inputDir);
  const linkPath = join(inputDir, "node_modules");
  const targetPath = join(SKILL_ROOT, "node_modules");
  let createdLink = false;
  if (!existsSync(linkPath)) {
    mkdirSync(linkPath, { recursive: true });
    for (const entry of readdirSync(targetPath)) {
      cpSync(join(targetPath, entry), join(linkPath, entry), { recursive: true });
    }
    createdLink = true;
  }
  try {
    const program = await compile(NodeHost, mainFile, {
      noEmit: true,
    });

    const errors = program.diagnostics.filter(
      (d) => d.severity === "error" && d.code !== "invalid-ref" && d.code !== "import-not-found"
    );
    if (errors.length > 0) {
      const msgs = errors.map((d) => String(d.message)).join("\n");
      throw new Error(`TypeSpec compilation failed:\n${msgs}`);
    }

    const [services, diags] = getAllHttpServices(program);
  if (diags.length > 0) {
    for (const d of diags) {
      console.warn(`Warning: ${String(d.message)}`);
    }
  }

  const service = services[0];
  if (!service) {
    throw new Error("No HTTP service found in TypeSpec files");
  }

  // 兜底：带 @route 的 HTTP 操作必须归属 @service 标记的 namespace，
  // 否则 getAllHttpServices 会静默丢弃它们，产出没有接口的空文档。
  // 最常见的成因是定义操作的 .tsp 文件漏写了 "namespace <Name>;" 声明。
  const orphanedOps = findOrphanedRouteOps(program);
  if (orphanedOps.length > 0) {
    const list = orphanedOps.map((o) => `${o.name} (in ${o.file})`).join(", ");
    throw new Error(
      `HTTP operation(s) with @route are outside the @service namespace and would be dropped: ${list}.\n` +
        `Likely cause: the .tsp file is missing a "namespace <Name>;" declaration that matches @service. ` +
        `Add it so the operation is collected into the service.`
    );
  }

  const serviceNs = service.namespace;
  const title = getServiceTitle(serviceNs) || serviceNs.name || "API";
  const version = readVersionFromConfig(inputDir) || getServiceVersion(serviceNs) || "";
  const revision = buildRevision(version, now);

  const opSourceFile = buildOpSourceFile(program, service.operations, inputDir);
  const operationMap = groupOperationsByFile(service.operations, opSourceFile);

  const groups: ApiGroup[] = [];
  for (const [groupName, httpOps] of operationMap) {
    const ops: ApiOperationType[] = [];
    for (const httpOp of httpOps) {
      ops.push(extractOperation(program, httpOp, groupName, inputDir));
    }
    groups.push({ name: groupName, operations: ops, messages: [] });
  }

  const messagesByGroup = extractMessagesByFile(program, serviceNs, inputDir);
  for (const [groupName, msgs] of messagesByGroup) {
    const existingGroup = groups.find(g => g.name === groupName);
    if (existingGroup) {
      existingGroup.messages = msgs;
    } else {
      groups.push({ name: groupName, operations: [], messages: msgs });
    }
  }

  return { title, version, revision, groups, headerSnippets: [], footerSnippets: [] };
  } finally {
    if (createdLink) {
      try { rmSync(linkPath, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  }
}

function findMainFile(inputDir: string): string {
  for (const name of ["index.tsp", "main.tsp"]) {
    const p = join(inputDir, name);
    if (existsSync(p)) return p;
  }
  const entries = readdirSync(inputDir);
  const tsp = entries.find((e: string) => e.endsWith(".tsp"));
  if (tsp) return join(inputDir, tsp);
  throw new Error(`No .tsp files found in ${inputDir}`);
}

function getServiceTitle(ns: Namespace): string | undefined {
  for (const dec of ns.decorators) {
    if (dec.definition?.name === "@service") {
      const args = dec.args;
      if (args.length > 0 && args[0].jsValue && typeof args[0].jsValue === "object") {
        return (args[0].jsValue as Record<string, unknown>).title as string;
      }
    }
  }
  return undefined;
}

function getServiceVersion(ns: Namespace): string | undefined {
  for (const dec of ns.decorators) {
    if (dec.definition?.name === "@service") {
      const args = dec.args;
      if (args.length > 0 && args[0].jsValue && typeof args[0].jsValue === "object") {
        return (args[0].jsValue as Record<string, unknown>).version as string;
      }
    }
  }
  return undefined;
}

function readVersionFromConfig(inputDir: string): string | undefined {
  for (const name of ["api-doc.json", "apidoc.json"]) {
    const p = join(inputDir, name);
    if (existsSync(p)) {
      try {
        const config = JSON.parse(readFileSync(p, "utf-8"));
        if (config.version && typeof config.version === "string") return config.version;
      } catch { /* ignore */ }
    }
  }
  return undefined;
}

function buildOpSourceFile(
  program: Program,
  httpOps: HttpOperation[],
  inputDir: string
): Map<TspOperation, string> {
  const map = new Map<TspOperation, string>();

  for (const httpOp of httpOps) {
    const op = httpOp.operation;
    const ns = getOperationNamespace(op);
    if (ns) {
      const doc = getDoc(program, ns);
      if (doc) {
        map.set(op, doc);
        continue;
      }
    }
    const node = op.node as any;
    const filePath: string | undefined = node?.parent?.file?.path;
    if (filePath) {
      map.set(op, deriveGroupNameFromPath(filePath, inputDir));
    } else {
      map.set(op, "默认");
    }
  }

  return map;
}

function deriveGroupNameFromPath(filePath: string, inputDir: string): string {
  // Windows 路径归一化为 posix，避免分隔符混用导致分组/标题错乱。
  const normalizedInput = inputDir.replace(/\\/g, "/").replace(/\/+$/, "");
  const normalizedFile = filePath.replace(/\\/g, "/").replace(/\/+$/, "");

  if (!normalizedFile.startsWith(normalizedInput + "/") && normalizedFile !== normalizedInput) {
    const basename = normalizedFile.split("/").pop() || "";
    const name = basename.replace(/\.tsp$/, "");
    return name === "index" || name === "main" ? "默认" : name;
  }

  const relative = normalizedFile.slice(normalizedInput.length + 1);
  const parts = relative.split("/");

  if (parts.length === 1) {
    const name = parts[0].replace(/\.tsp$/, "");
    return name === "index" || name === "main" ? "默认" : name;
  }

  const parentDir = parts[parts.length - 2];
  return parentDir;
}

function getOperationNamespace(op: TspOperation): Namespace | undefined {
  let current = (op as any).namespace;
  if (current && current.kind === "Namespace") return current;
  return undefined;
}

// 查找游离到全局 namespace、却带 @route 的操作。
// 这类操作不会被 getAllHttpServices 收集，是 .tsp 漏写 namespace 声明的典型症状。
function findOrphanedRouteOps(program: Program): { name: string; file: string }[] {
  const globalNs = program.checker.getGlobalNamespaceType();
  const orphaned: { name: string; file: string }[] = [];
  for (const [name, op] of globalNs.operations) {
    const node = (op as any).node;
    const hasRoute = node?.decorators?.some((dec: any) => {
      const targetName = dec.target?.sv || dec.target?.id?.sv;
      return targetName === "route";
    });
    if (hasRoute) {
      orphaned.push({ name, file: node?.parent?.file?.path ?? "<unknown>" });
    }
  }
  return orphaned;
}

// 从文件路径推导标题：取 basename 去掉 .tsp 后缀。
// index.tsp / main.tsp 这类入口文件回退到 undefined（由调用方继续兜底）。
function deriveTitleFromFilePath(filePath: string): string | undefined {
  const basename = filePath.replace(/\\/g, "/").split("/").pop() || "";
  const name = basename.replace(/\.tsp$/, "");
  if (name === "index" || name === "main") return undefined;
  return name;
}

function groupOperationsByFile(
  httpOps: HttpOperation[],
  opSourceFile: Map<any, string>
): Map<string, HttpOperation[]> {
  const groups = new Map<string, HttpOperation[]>();

  for (const httpOp of httpOps) {
    const groupName = opSourceFile.get(httpOp.operation) || "默认";
    if (!groups.has(groupName)) {
      groups.set(groupName, []);
    }
    groups.get(groupName)!.push(httpOp);
  }

  return groups;
}

function extractOperation(
  program: Program,
  httpOp: HttpOperation,
  group: string,
  inputDir: string
): ApiOperationType {
  const op = httpOp.operation;
  const name = deriveOpNameFromPath(op, inputDir) || op.name;
  const description = getDoc(program, op) ?? undefined;
  const verb = httpOp.verb;
  const path = httpOp.path;
  const id = `${group}-${op.name}`.replace(/[^\-a-zA-Z0-9一-鿿]/g, "-");

  const parameters: ApiParameter[] = [];
  for (const param of httpOp.parameters.parameters) {
    parameters.push({
      name: param.name,
      type: resolveType(program, param.param.type),
      location: param.type as ApiParameter["location"],
      doc: getDoc(program, param.param) || undefined,
      example: getExampleValue(param.param),
      required: !param.param.optional,
      defaultValue:
        param.param.defaultValue !== undefined
          ? getDefaultValue(param.param.defaultValue)
          : undefined,
      constraints: extractConstraints(program, param.param),
    });
  }

  let body: ApiBody | undefined;
  if (httpOp.parameters.body) {
    const bodyType = httpOp.parameters.body.type;
    body = {
      type: resolveType(program, bodyType),
      contentType: httpOp.parameters.body.contentTypes?.[0] || "application/json",
    };
  }

  const responses: ApiResponse[] = [];
  for (const resp of httpOp.responses) {
    const statusCode = String(resp.statusCodes);
    let respType: ApiType | undefined;

    for (const content of resp.responses) {
      if (content.body) {
        respType = resolveType(program, content.body.type);
      }
    }

    responses.push({
      statusCode,
      type: respType,
      description: resp.description || undefined,
      isError: isErrorResponse(statusCode),
    });
  }

  const versionTags = extractVersionTags(op);
  const examples = extractDocExamples(op);
  const deprecation = getDeprecationDetails(program, op) ?? undefined;

  return {
    id,
    name,
    description,
    verb,
    path,
    group,
    parameters,
    body,
    responses,
    versionTags,
    examples,
    deprecated: deprecation,
  };
}

function deriveOpNameFromPath(op: TspOperation, inputDir: string): string | undefined {
  const node = op.node as any;
  const filePath: string | undefined = node?.parent?.file?.path;
  if (!filePath) return undefined;

  const basename = filePath.replace(/\\/g, "/").split("/").pop() || "";
  const name = basename.replace(/\.tsp$/, "");
  if (name === "index" || name === "main") return undefined;
  return name;
}

function getDefaultValue(val: any): unknown {
  if (val && typeof val === "object" && "value" in val) {
    return (val as any).value;
  }
  return val;
}

function resolveType(program: Program, type: Type): ApiType {
  switch (type.kind) {
    case "String":
      return { kind: "string" };
    case "Number":
      return { kind: "number" };
    case "Boolean":
      return { kind: "boolean" };
    case "Model": {
      if (isTemplateDeclaration(type)) {
        return { kind: "any" };
      }
      const properties: ApiProperty[] = [];
      const allProps = collectInheritedProperties(type);
      for (const [propName, prop] of allProps) {
        let fixedValue: unknown;
        let resolvedType: ApiType;
        if (prop.type.kind === "String") {
          fixedValue = prop.type.value;
          resolvedType = { kind: "string" };
        } else {
          fixedValue = undefined;
          resolvedType = resolveType(program, prop.type);
        }
        properties.push({
          name: propName,
          type: resolvedType,
          doc: getDoc(program, prop) || undefined,
          example: getExampleValue(prop),
          required: !prop.optional,
          defaultValue: fixedValue !== undefined ? undefined : (prop.defaultValue !== undefined ? getDefaultValue(prop.defaultValue) : undefined),
          fixedValue,
          conditionalRequired: extractRequiredIf(prop),
          conditionalOptional: extractOptionalIf(prop),
          constraints: extractConstraints(program, prop),
          versionTags: extractVersionTags(prop),
        });
      }
      // indexer 来自 `... Record<T>` 之类的 spread：无显式属性时退化为数组，
      // 否则保留显式字段并追加一行扩展占位（`...`），表示还允许任意额外键。
      if (type.indexer) {
        if (properties.length === 0) {
          return {
            kind: "array",
            elementType: resolveType(program, type.indexer.value),
          };
        }
        properties.push({
          name: "...",
          type: { kind: "any" },
          required: false,
          constraints: {},
          versionTags: [],
        });
      }
      return { kind: "object", name: type.name, properties };
    }
    case "Enum": {
      const members: { name: string; value?: string | number; doc?: string }[] = [];
      for (const [memberName, member] of type.members) {
        members.push({
          name: memberName,
          value: member.value as string | number | undefined,
          doc: getDoc(program, member) || undefined,
        });
      }
      return { kind: "enum", name: type.name, members };
    }
    case "Union": {
      const variants: ApiType[] = [];
      for (const [, variant] of type.variants) {
        variants.push(resolveType(program, variant.type));
      }
      return { kind: "union", variants };
    }
    case "Scalar": {
      const scalarBase = resolveScalarBase(type.name);
      return { kind: "scalar", name: type.name, baseType: scalarBase };
    }
    case "Intrinsic": {
      if (type.name === "unknown" || type.name === "null" || type.name === "never" || type.name === "void") {
        return { kind: "any" };
      }
      return { kind: "any" };
    }
    case "TemplateParameter":
      return { kind: "any" };
    default:
      return { kind: "any" };
  }
}

function collectInheritedProperties(model: Model): Map<string, ModelProperty> {
  const props = new Map<string, ModelProperty>();
  if (model.baseModel) {
    for (const [name, prop] of collectInheritedProperties(model.baseModel)) {
      props.set(name, prop);
    }
  }
  for (const [name, prop] of model.properties) {
    props.set(name, prop);
  }
  return props;
}

function getExampleValue(target: Type): unknown {
  for (const dec of (target as any).decorators || []) {
    if (dec.definition?.name === "@example" && dec.args.length > 0) {
      return dec.args[0].jsValue;
    }
  }
  return undefined;
}

function extractConstraints(program: Program, target: Type): ApiConstraints {
  const constraints: ApiConstraints = {};
  const min = getMinValue(program, target);
  const max = getMaxValue(program, target);
  const minLen = getMinLength(program, target);
  const maxLen = getMaxLength(program, target);
  const pat = getPattern(program, target);
  if (min !== undefined) constraints.minimum = min;
  if (max !== undefined) constraints.maximum = max;
  if (minLen !== undefined) constraints.minLength = minLen;
  if (maxLen !== undefined) constraints.maxLength = maxLen;
  if (pat !== undefined) constraints.pattern = pat;
  return constraints;
}

function extractRequiredIf(target: Type): string | undefined {
  const node = (target as any).node;
  if (node?.decorators) {
    for (const dec of node.decorators) {
      if (dec.target?.sv === "requiredIf" && dec.arguments?.length > 0) {
        return String(dec.arguments[0].value);
      }
    }
  }
  return undefined;
}

function extractOptionalIf(target: Type): string | undefined {
  const node = (target as any).node;
  if (node?.decorators) {
    for (const dec of node.decorators) {
      if (dec.target?.sv === "optionalIf" && dec.arguments?.length > 0) {
        return String(dec.arguments[0].value);
      }
    }
  }
  return undefined;
}

function extractVersionTags(target: Type): VersionTag[] {
  const tags: VersionTag[] = [];
  for (const dec of (target as any).decorators || []) {
    const name = dec.definition?.name;
    if (name === "@added" && dec.args.length > 0) {
      tags.push({ type: "added", version: String(dec.args[0].jsValue) });
    } else if (name === "@removed" && dec.args.length > 0) {
      tags.push({ type: "removed", version: String(dec.args[0].jsValue) });
    }
  }
  return tags;
}

function extractDocExamples(target: Type): import("../types").ApiExample[] {
  const examples: import("../types").ApiExample[] = [];
  for (const dec of (target as any).decorators || []) {
    const decName = dec.definition?.name;
    if (decName === "@opExample" && dec.args.length >= 1) {
      const example = dec.args[0].jsValue as Record<string, unknown>;
      const options = dec.args[1]?.jsValue as Record<string, unknown> | undefined;
      const name = String(options?.title || "示例");
      const params = example.parameters as Record<string, unknown> | undefined;
      const reqData = params?.body || params;
      const request = reqData ? JSON.stringify(deepCloneValue(reqData), null, 2) : undefined;
      const resRaw = example.returnType;
      const response = resRaw ? JSON.stringify(deepCloneValue(resRaw), null, 2) : "{}";
      examples.push({ name, request, response });
    }
  }
  return examples;
}

// 从标准 @example 装饰器提取示例值，用于 model / message。
// 与 @opExample 不同：@example 是单个数据值（非 parameters/returnType），
// 整体作为示例 JSON 渲染（只填 response，不填 request/curlCommand）。
function extractExampleDecorator(target: Type): import("../types").ApiExample[] {
  const examples: import("../types").ApiExample[] = [];
  for (const dec of (target as any).decorators || []) {
    const decName = dec.definition?.name;
    if (decName === "@example" && dec.args.length >= 1) {
      const value = dec.args[0].jsValue;
      const options = dec.args[1]?.jsValue as Record<string, unknown> | undefined;
      const name = String(options?.title || options?.description || "示例");
      const response = value !== undefined ? JSON.stringify(deepCloneValue(value), null, 2) : "{}";
      examples.push({ name, response });
    }
  }
  return examples;
}

function extractMessagesByFile(
  program: Program,
  serviceNs: Namespace,
  inputDir: string
): Map<string, import("../types").MessageDefinition[]> {
  const result = new Map<string, import("../types").MessageDefinition[]>();

  // 收集所有 model（包括全局和 service 命名空间）
  const allModels = new Map<string, Model>();
  for (const [name, m] of serviceNs.models) {
    allModels.set(name, m);
  }
  const globalNs = program.checker.getGlobalNamespaceType();
  for (const [name, m] of globalNs.models) {
    if (!allModels.has(name)) {
      allModels.set(name, m);
    }
  }

  for (const [name, model] of allModels) {
    const topic = getTopicDecorator(model);
    if (topic === undefined) continue;

    const node = (model as any).node;
    const filePath: string | undefined = node?.parent?.file?.path;
    const groupName = filePath
      ? deriveGroupNameFromPath(filePath, inputDir)
      : "默认";

    // 标题统一取文件名（去 .tsp），与 HTTP 接口一致；@doc 仅作为描述。
    const title = filePath ? deriveTitleFromFilePath(filePath) : name;
    const description = getDoc(program, model) || undefined;
    const versionTags = extractVersionTags(model as any);
    const deprecation = getDeprecationDetails(program, model as any) ?? undefined;
    const payload = resolveType(program, model);
    const examples = extractExampleDecorator(model as any);

    // 锚点 id 保持用 model 名（比文件名更稳定，且同文件多消息不冲突）。
    const id = `msg-${groupName}-${name}`.replace(/[^\-a-zA-Z0-9一-鿿]/g, "-");

    if (!result.has(groupName)) {
      result.set(groupName, []);
    }
    result.get(groupName)!.push({
      id,
      name: title,
      topic,
      description,
      payload: payload.kind === "object" ? payload : undefined,
      examples,
      versionTags,
      deprecated: deprecation,
    });
  }

  return result;
}

function getTopicDecorator(model: Model): string | undefined {
  // TypeSpec compiler does not register unknown decorators on model.decorators,
  // so we read from the AST node directly.
  const node = (model as any).node;
  if (node?.decorators) {
    for (const dec of node.decorators) {
      const targetName = dec.target?.sv || dec.target?.id?.sv;
      if (targetName === "topic" && dec.arguments?.length > 0) {
        return String(dec.arguments[0].value);
      }
    }
  }
  return undefined;
}
