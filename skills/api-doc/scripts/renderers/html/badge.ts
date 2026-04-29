import { RenderResult, RenderOptions } from './base';

export function badge(value: any, options?: RenderOptions): RenderResult {
  const escaped = String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const color = options?.backgroundColor ?? 'var(--doc-badge-bg)';
  const textColor = options?.textColor ?? 'var(--doc-badge-text)';

  return {
    html: `<span class="badge" style="background-color:${color};color:${textColor}">${escaped}</span>`
  };
}
