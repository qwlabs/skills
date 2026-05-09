// pipeline/types.ts
// Unified Stage Pipeline — 全部类型定义

// --- API 数据模型 ---

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

export interface DeprecationDetails {
  message: string;
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
  deprecated?: DeprecationDetails;
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

// --- Document Model ---

export interface DocumentModel {
  meta: { title: string; version: string };
  sidebar: SidebarEntry[];
  sections: ContentSection[];
  assets: DocumentAssets;
}

export interface SidebarEntry {
  kind: "group-title" | "operation-link" | "snippet-link";
  label: string;
  anchorId?: string;
  deprecated?: DeprecationDetails;
}

export type ContentSection =
  | { kind: "snippet"; anchorId: string; title: string; content: string }
  | { kind: "operation"; op: ApiOperation }
  | { kind: "footer"; version: string };

export interface DocumentAssets {
  styles: string;
  scripts: string;
  hljsThemeCSS: string;
  hljsBundle: string;
  finalOutput: string;
}

// --- DAG Stage Interface ---

export type DataKey =
  | "doc.api"            // ParsedApiDoc 的核心数据 (groups, title, version...)
  | "doc.snippets"       // headerSnippets + footerSnippets
  | "doc.curl"           // operations[].curlCommand + examples[].curlCommand
  | "model.sidebar"      // model.sidebar
  | "model.sections"     // model.sections
  | "model.meta"         // model.meta
  | "model.assets"       // model.assets (styles, scripts, hljs, finalOutput)
  | "model.output";      // model.assets.finalOutput

export interface DagStage extends Stage {
  readonly requires: readonly DataKey[];
  readonly provides: readonly DataKey[];
}

// --- Stage Interface ---

export interface Stage {
  readonly name: string;
  process(ctx: StageContext): void | Promise<void>;
}

export interface StageContext {
  doc: ParsedApiDoc;
  model: DocumentModel;
  config: StageConfig;
}

export interface StageConfig {
  inputDir: string;
  templateDir: string;
  themeCSS?: string;
  version: string;
}
