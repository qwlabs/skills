import type { ApiOperation, ApiType } from "./types.js";

export function generateCurl(
  operation: ApiOperation,
  baseUrl?: string
): string {
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

  const queryParams = operation.parameters.filter(
    (p) => p.location === "query"
  );
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

function buildHeaders(
  parameters: ApiOperation["parameters"]
): string[] {
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
  const json = typeToJson(body.type);
  return JSON.stringify(json, null, 2);
}

export function typeToJson(type: ApiType): unknown {
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
      if (type.variants.length > 0) return typeToJson(type.variants[0]);
      return null;
    case "array":
      return [];
    case "object": {
      const obj: Record<string, unknown> = {};
      for (const prop of type.properties) {
        obj[prop.name] =
          prop.example !== undefined
            ? prop.example
            : generatePlaceholder(prop.type);
      }
      return obj;
    }
    case "scalar":
      return generatePlaceholder(type.baseType);
    case "any":
    default:
      return null;
  }
}

export function generatePlaceholder(type: ApiType): unknown {
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
      if (type.variants.length > 0) return generatePlaceholder(type.variants[0]);
      return null;
    case "array":
      return [];
    case "object": {
      const obj: Record<string, unknown> = {};
      for (const prop of type.properties) {
        obj[prop.name] = generatePlaceholder(prop.type);
      }
      return obj;
    }
    case "scalar":
      return generatePlaceholder(type.baseType);
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
