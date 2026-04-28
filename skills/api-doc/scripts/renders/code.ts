import { RenderResult, RenderOptions } from './base.js';

export function code(value: any, options?: RenderOptions): RenderResult {
  const escaped = String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
  return {
    html: `<code class="inline-code">${escaped}</code>`
  };
}
