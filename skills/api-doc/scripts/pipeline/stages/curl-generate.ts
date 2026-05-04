// pipeline/stages/curl-generate.ts
import type { ApiOperation, ApiType, ApiExample, Stage, StageContext } from "../types";

export const curlGenerate: Stage = {
  name: "curl-generate",
  process(ctx: StageContext): void {
    for (const group of ctx.doc.groups) {
      for (const op of group.operations) {
        op.curlCommand = generateCurl(op, ctx.doc.baseUrl);
        for (const ex of op.examples) {
          ex.curlCommand = generateExampleCurl(op, ex, ctx.doc.baseUrl);
        }
      }
    }
  },
};

function generateCurl(operation: ApiOperation, baseUrl?: string): string {
  const url = buildUrl(operation, baseUrl);
  const method = operation.verb.toUpperCase();
  const headers = buildHeaders(operation.parameters);
  headers.push("Content-Type: application/json");
  const bodyArg = buildBodyArg(operation.body);
  const parts = [`curl -X ${method} '${url}'`];
  for (const h of headers) {
    parts.push(`  -H '${h}'`);
  }
  if (bodyArg) {
    parts.push(`  -d '${bodyArg}'`);
  }
  return parts.join(" \\\n");
}

function buildUrl(operation: ApiOperation, baseUrl?: string): string {
  const base = baseUrl || "{baseUrl}";
  let path = operation.path;
  for (const param of operation.parameters) {
    if (param.location === "path") {
      const value = param.example ?? `{${param.name}}`;
      path = path.replace(`{${param.name}}`, String(value));
    }
  }
  const queryParams = operation.parameters.filter((p) => p.location === "query");
  if (queryParams.length > 0) {
    const qs = queryParams
      .map((p) => {
        const val = p.example ?? generatePlaceholder(p.type);
        return `${p.name}=${encodeURIComponent(String(val))}`;
      })
      .join("&");
    path += `?${qs}`;
  }
  return `${base}${path}`;
}

function buildHeaders(parameters: ApiOperation["parameters"]): string[] {
  return parameters
    .filter((p) => p.location === "header")
    .map((p) => {
      if (p.name.toLowerCase() === "authorization") {
        return "Authorization: Bearer {token}";
      }
      const value = p.example ?? generatePlaceholder(p.type);
      return `${capitalizeHeader(p.name)}: ${value}`;
    });
}

function buildBodyArg(body: ApiOperation["body"]): string | null {
  if (!body) return null;
  const json = generatePlaceholder(body.type, true);
  return JSON.stringify(json, null, 2);
}

function generatePlaceholder(type: ApiType, useExample = false): unknown {
  switch (type.kind) {
    case "string":
      return "{string}";
    case "number":
    case "float":
      return 0;
    case "integer":
      return 0;
    case "boolean":
      return true;
    case "datetime":
      return "2024-01-01T00:00:00Z";
    case "uuid":
      return "00000000-0000-0000-0000-000000000000";
    case "enum":
      return type.members[0]?.value ?? type.members[0]?.name ?? "{enum}";
    case "union":
      if (type.variants.length > 0) return generatePlaceholder(type.variants[0], useExample);
      return null;
    case "array":
      return [];
    case "object": {
      const obj: Record<string, unknown> = {};
      for (const prop of type.properties) {
        obj[prop.name] =
          useExample && prop.example !== undefined
            ? prop.example
            : generatePlaceholder(prop.type, useExample);
      }
      return obj;
    }
    case "scalar":
      return generatePlaceholder(type.baseType, useExample);
    default:
      return null;
  }
}

function capitalizeHeader(name: string): string {
  return name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join("-");
}

function generateExampleCurl(operation: ApiOperation, example: ApiExample, baseUrl?: string): string | undefined {
  if (!example.request) return undefined;
  const url = buildUrl(operation, baseUrl);
  const method = operation.verb.toUpperCase();
  const headers = buildHeaders(operation.parameters);
  headers.push("Content-Type: application/json");
  const parts = [`curl -X ${method} '${url}'`];
  for (const h of headers) {
    parts.push(`  -H '${h}'`);
  }
  parts.push(`  -d '${example.request}'`);
  return parts.join(" \\\n");
}
