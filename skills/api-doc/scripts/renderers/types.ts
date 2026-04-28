// renderers/types.ts
import type { ParsedApiDoc } from "../adapters/types";

export interface Renderer {
  readonly name: string;
  render(doc: ParsedApiDoc, ctx: RendererContext): Promise<string>;
}

export interface RendererContext {
  version: string;
  templateDir: string;
}
