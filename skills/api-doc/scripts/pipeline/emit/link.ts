import { RenderResult, RenderOptions } from './base';

export function link(value: any, options?: RenderOptions & { href?: string; target?: string }): RenderResult {
  const text = String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
  const href = options?.href ?? text;
  const target = options?.target ?? '_blank';
  
  return {
    html: `<a href="${href}" target="${target}" class="link">${text}</a>`
  };
}
