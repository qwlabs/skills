import { RenderResult, RenderOptions } from './base.js';

export function text(value: any, options?: RenderOptions): RenderResult {
  const escaped = options?.escape !== false 
    ? String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    : String(value);
  return { html: escaped };
}
