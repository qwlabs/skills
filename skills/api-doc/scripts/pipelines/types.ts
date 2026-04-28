// pipelines/types.ts
import type { ParsedApiDoc } from "../adapters/types";

export interface Pipeline {
  readonly name: string;
  process(doc: ParsedApiDoc, ctx: PipelineContext): ParsedApiDoc;
}

export interface PipelineContext {
  inputDir: string;
  options: Record<string, unknown>;
}
