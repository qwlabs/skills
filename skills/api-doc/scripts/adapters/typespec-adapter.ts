// adapters/typespec-adapter.ts
// Wraps the TypeSpec parser logic as an Adapter implementation.

import { join } from "path";
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
import { existsSync, readdirSync } from "fs";
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
    return parseTypeSpecDir(inputDir);
  },
};

async function parseTypeSpecDir(inputDir: string): Promise<ParsedApiDoc> {
  const mainFile = findMainFile(inputDir);
  const program = await compile(NodeHost, mainFile);

  if (program.hasError()) {
    const errors = program.diagnostics
      .map((d) => {
        const msg = typeof d.message === "string" ? d.message : d.message?.toString() || String(d.message);
        return msg;
      })
      .join("\n");
    throw new Error(`TypeSpec compilation failed:\n${errors}`);
  }

  const [services, diags] = getAllHttpServices(program);
  if (diags.length > 0) {
    for (const d of diags) {
      const msg = typeof d.message === "string" ? d.message : d.message?.toString() || "";
      console.warn(`Warning: ${msg}`);
    }
  }

  const service = services[0];
  if (!service) {
    throw new Error("No HTTP service found in TypeSpec files");
  }

  const serviceNs = service.namespace;
  const title = serviceNs.name || "API";
  const version = getServiceVersion(serviceNs) || "1.0.0";

  // Build a map: operation → source file basename (without .tsp) for grouping
  const opSourceFile = buildOpSourceFile(service.operations);

  const operationMap = groupOperationsByFile(service.operations, opSourceFile);

  const groups: ApiGroup[] = [];
  for (const [groupName, httpOps] of operationMap) {
    const ops: ApiOperationType[] = [];
    for (const httpOp of httpOps) {
      ops.push(extractOperation(program, httpOp, groupName));
    }
    groups.push({ name: groupName, operations: ops });
  }

  return { title, version, groups, headerSnippets: [], footerSnippets: [] };
}

function findMainFile(inputDir: string): string {
  for (const name of ["main.tsp", "client.tsp", "index.tsp"]) {
    const p = join(inputDir, name);
    if (existsSync(p)) return p;
  }
  const entries = readdirSync(inputDir);
  const tsp = entries.find((e: string) => e.endsWith(".tsp"));
  if (tsp) return join(inputDir, tsp);
  throw new Error(`No .tsp files found in ${inputDir}`);
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

function buildOpSourceFile(
  httpOps: HttpOperation[]
): Map<TspOperation, string> {
  const map = new Map<TspOperation, string>();

  for (const httpOp of httpOps) {
    const op = httpOp.operation;
    const node = op.node as any;
    const filePath: string | undefined = node?.parent?.file?.path;
    if (filePath) {
      const basename = filePath.split("/").pop() || "";
      const groupName = basename.replace(/\.tsp$/, "");
      map.set(op, groupName === "index" || groupName === "main" ? "默认" : groupName);
    } else {
      map.set(op, "默认");
    }
  }

  return map;
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
  group: string
): ApiOperationType {
  const op = httpOp.operation;
  const name = getDoc(program, op) || op.name;
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
  };
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
    case "Numeric":
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
      for (const [propName, prop] of type.properties) {
        properties.push({
          name: propName,
          type: resolveType(program, prop.type),
          doc: getDoc(program, prop) || undefined,
          example: getExampleValue(prop),
          required: !prop.optional,
          defaultValue: prop.defaultValue !== undefined ? getDefaultValue(prop.defaultValue) : undefined,
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

function resolveScalarBase(scalarName: string): ApiType {
  const name = scalarName.toLowerCase();
  if (name === "int32" || name === "int64" || name === "integer" || name === "safeint" || name === "int128" || name === "uint8" || name === "uint16" || name === "uint32" || name === "uint64")
    return { kind: "integer" };
  if (name === "float" || name === "double" || name === "decimal" || name === "decimal128" || name === "numeric")
    return { kind: "float" };
  if (name === "boolean") return { kind: "boolean" };
  if (name === "string") return { kind: "string" };
  if (
    name === "utcdatetime" ||
    name === "offsetdatetime" ||
    name === "datetime"
  )
    return { kind: "datetime" };
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
