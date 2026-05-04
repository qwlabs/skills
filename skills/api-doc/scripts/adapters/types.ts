// adapters/types.ts
// Adapter interface + all shared types

export interface Adapter {
  readonly name: string;
  detect(inputDir: string): boolean;
  parse(inputDir: string): Promise<ParsedApiDoc>;
}

export interface ParsedApiDoc {
  title: string;
  version: string;
  description?: string;
  baseUrl?: string;
  headerSnippets: MarkdownSnippet[];
  footerSnippets: MarkdownSnippet[];
  groups: ApiGroup[];
}

export interface MarkdownSnippet {
  name: string;
  content: string;
}

export interface ApiGroup {
  name: string;
  operations: ApiOperation[];
}

export interface ApiOperation {
  id: string;
  name: string;
  verb: string;
  path: string;
  group: string;
  parameters: ApiParameter[];
  body?: ApiBody;
  responses: ApiResponse[];
  versionTags: VersionTag[];
  curlCommand?: string;
  examples: ApiExample[];
}

export interface ApiExample {
  name: string;
  request?: string;
  response: string;
  curlCommand?: string;
}

export interface ApiParameter {
  name: string;
  type: ApiType;
  location: "header" | "query" | "path" | "cookie";
  doc?: string;
  example?: unknown;
  required: boolean;
  defaultValue?: unknown;
  constraints: ApiConstraints;
}

export interface ApiBody {
  type: ApiType;
  contentType: string;
  doc?: string;
}

export interface ApiResponse {
  statusCode: string;
  type?: ApiType;
  description?: string;
  isError: boolean;
}

export type ApiType =
  | { kind: "string" }
  | { kind: "number" }
  | { kind: "boolean" }
  | { kind: "integer" }
  | { kind: "float" }
  | { kind: "datetime" }
  | { kind: "uuid" }
  | { kind: "any" }
  | { kind: "enum"; name?: string; members: { name: string; value?: string | number; doc?: string }[] }
  | { kind: "union"; variants: ApiType[] }
  | { kind: "array"; elementType: ApiType }
  | { kind: "object"; name?: string; properties: ApiProperty[] }
  | { kind: "scalar"; name: string; baseType: ApiType };

export interface ApiProperty {
  name: string;
  type: ApiType;
  doc?: string;
  example?: unknown;
  required: boolean;
  defaultValue?: unknown;
  fixedValue?: unknown;
  conditionalRequired?: string;
  conditionalOptional?: string;
  constraints: ApiConstraints;
  versionTags: VersionTag[];
}

export interface ApiConstraints {
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
}

export interface VersionTag {
  type: "added" | "removed";
  version: string;
}
