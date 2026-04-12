import { RenderResult, RenderOptions } from './base.js';

export function badge(value: any, options?: RenderOptions): RenderResult {
  const escaped = String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
  const color = options?.backgroundColor ?? '#667eea';
  const textColor = options?.textColor ?? '#ffffff';
  
  return {
    html: `<span class="badge" style="background-color:${color};color:${textColor}">${escaped}</span>`
  };
}
