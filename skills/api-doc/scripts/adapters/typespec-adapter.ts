// adapters/typespec-adapter.ts
// Wraps the TypeSpec parser logic as an Adapter implementation.

import { join, resolve } from "path";
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
} from "@typespec/compiler";
import type {
  Program,
  Operation as TspOperation,
  Model,
  ModelProperty,
  Type,
  Enum as TspEnum,
  Union as TspUnion,
  Namespace,
  DecoratorApplication,
} from "@typespec/compiler";
import { getAllHttpServices } from "@typespec/http";
import type { HttpOperation } from "@typespec/http";
import { existsSync, readdirSync, readFileSync } from "fs";
import type {
  Adapter,
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
} from "./types";

export const typespecAdapter: Adapter = {
  name: "typespec",

  detect(inputDir: string): boolean {
    const entries = readdirSync(inputDir);
    return entries.some((e: string) => e.endsWith(".tsp"));
  },

  async parse(inputDir: string): Promise<ParsedApiDoc> {
    return parseTypeSpecDir(resolve(inputDir));
  },
};

async function parseTypeSpecDir(inputDir: string): Promise<ParsedApiDoc> {
  const mainFile = findMainFile(inputDir);
  const program = await compile(NodeHost, mainFile, {
    noEmit: true,
  });

  // Filter out unknown decorator errors (e.g. @docRequired) — only treat other errors as fatal
  const errors = program.diagnostics.filter(
    (d) => d.severity === "error" && d.code !== "invalid-ref"
  );
  if (errors.length > 0) {
      const msgs = errors
        .map((d) => String(d.message))
        .join("\n");
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

  const serviceNs = service.namespace;
  const title = getServiceTitle(serviceNs) || serviceNs.name || "API";
  const version = readVersionFromConfig(inputDir) || getServiceVersion(serviceNs) || "";

  // Build a map: operation → source file basename (without .tsp) for grouping
  const opSourceFile = buildOpSourceFile(program, service.operations, inputDir);

  const operationMap = groupOperationsByFile(service.operations, opSourceFile);

  const groups: ApiGroup[] = [];
  for (const [groupName, httpOps] of operationMap) {
    const ops: ApiOperationType[] = [];
    for (const httpOp of httpOps) {
      ops.push(extractOperation(program, httpOp, groupName, inputDir));
    }
    groups.push({ name: groupName, operations: ops });
  }

  return { title, version, groups, headerSnippets: [], footerSnippets: [] };
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

    // 优先使用 operation 所在 namespace 上 @doc("...") 作为分组名
    const ns = getOperationNamespace(op);
    if (ns) {
      const doc = getDoc(program, ns);
      if (doc) {
        map.set(op, doc);
        continue;
      }
    }

    // 回退到路径推导
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
  const normalizedInput = inputDir.replace(/\/+$/, "");
  const normalizedFile = filePath.replace(/\/+$/, "");

  // 计算相对路径
  if (!normalizedFile.startsWith(normalizedInput + "/") && normalizedFile !== normalizedInput) {
    // 文件不在 inputDir 下（理论上不该发生），用文件名兜底
    const basename = normalizedFile.split("/").pop() || "";
    const name = basename.replace(/\.tsp$/, "");
    return name === "index" || name === "main" ? "默认" : name;
  }

  const relative = normalizedFile.slice(normalizedInput.length + 1);
  const parts = relative.split("/");

  // parts.length === 1 → 根目录文件，用文件名
  // parts.length >= 2 → 子目录文件，用直接父目录名（倒数第二个部分）
  if (parts.length === 1) {
    const name = parts[0].replace(/\.tsp$/, "");
    return name === "index" || name === "main" ? "默认" : name;
  }

  // 子目录文件：用直接父目录名
  const parentDir = parts[parts.length - 2];
  return parentDir;
}

function getOperationNamespace(op: TspOperation): Namespace | undefined {
  let current = (op as any).namespace;
  if (current && current.kind === "Namespace") return current;
  return undefined;
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
  const name = getDoc(program, op) || deriveOpNameFromPath(op, inputDir) || op.name;
  const verb = httpOp.verb;
  const path = httpOp.path;
  const id = `${group}-${op.name}`.replace(/[^a-zA-Z0-9一-鿿-]/g, "-");

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

  return {
    id,
    name,
    verb,
    path,
    group,
    parameters,
    body,
    responses,
    versionTags,
    examples,
  };
}

function deriveOpNameFromPath(op: TspOperation, inputDir: string): string | undefined {
  const node = op.node as any;
  const filePath: string | undefined = node?.parent?.file?.path;
  if (!filePath) return undefined;

  const basename = filePath.split("/").pop() || "";
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
      if (type.indexer) {
        return {
          kind: "array",
          elementType: resolveType(program, type.indexer.value),
        };
      }
      const properties: ApiProperty[] = [];
      // Collect properties from base models first, then own properties
      const allProps = collectInheritedProperties(type);
      for (const [propName, prop] of allProps) {
        // String literal type = fixed value (e.g. outType: "json")
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
          constraints: extractConstraints(program, prop),
          versionTags: extractVersionTags(prop),
        });
      }
      return { kind: "object", name: type.name, properties };
    }
    case "Enum": {
      const members: { name: string; value?: string | number }[] = [];
      for (const [memberName, member] of type.members) {
        members.push({
          name: memberName,
          value: member.value as string | number | undefined,
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
  // Walk base chain first so own properties override
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

const INTEGER_TYPES = new Set(["int32", "int64", "integer", "safeint", "int128", "uint8", "uint16", "uint32", "uint64"]);
const FLOAT_TYPES = new Set(["float", "double", "decimal", "decimal128", "numeric"]);
const DATETIME_TYPES = new Set(["utcdatetime", "offsetdatetime", "datetime"]);

function resolveScalarBase(scalarName: string): ApiType {
  const name = scalarName.toLowerCase();
  if (INTEGER_TYPES.has(name)) return { kind: "integer" };
  if (FLOAT_TYPES.has(name)) return { kind: "float" };
  if (name === "boolean") return { kind: "boolean" };
  if (name === "string") return { kind: "string" };
  if (DATETIME_TYPES.has(name)) return { kind: "datetime" };
  if (name === "uuid" || name === "guid") return { kind: "uuid" };
  return { kind: "any" };
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

function isErrorResponse(statusCode: string): boolean {
  const code = parseInt(statusCode, 10);
  return !isNaN(code) && code >= 400;
}

function extractDocExamples(target: Type): import("./types").ApiExample[] {
  const examples: import("./types").ApiExample[] = [];
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

function deepCloneValue(val: unknown, seen: Set<unknown> = new Set()): unknown {
  if (val === null || val === undefined) return val;
  if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") return val;
  if (typeof val !== "object") return String(val);
  if (seen.has(val)) return undefined;
  seen.add(val);
  const obj = val as Record<string, unknown>;
  // TypeSpec EnumMember → use its name
  if (obj.kind === "EnumMember" && typeof obj.name === "string") return obj.name;
  // TypeSpec EnumValue wrapper { value: EnumMember } → unwrap to member name
  if (obj.valueKind === "EnumValue" && obj.value && typeof (obj.value as any).name === "string") {
    return (obj.value as any).name;
  }
  if (Array.isArray(val)) {
    return val.map((item) => deepCloneValue(item, seen));
  }
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    result[k] = deepCloneValue(v, seen);
  }
  return result;
}
