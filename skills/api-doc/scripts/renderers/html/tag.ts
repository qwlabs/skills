import { RenderResult, RenderOptions } from './base';

const TAG_VAR_MAP: Record<string, string> = {
  GET: 'var(--doc-tag-get)',
  POST: 'var(--doc-tag-post)',
  PUT: 'var(--doc-tag-put)',
  DELETE: 'var(--doc-tag-delete)',
  PATCH: 'var(--doc-tag-patch)',
};

export function tag(value: any, options?: RenderOptions & { colors?: Record<string, string> }): RenderResult {
  const escaped = String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const colorMap = { ...TAG_VAR_MAP, ...options?.colors };
  const color = colorMap[value.toUpperCase()] ?? 'var(--doc-tag-default)';

  return {
    html: `<span class="tag" style="background-color:${color};color:var(--doc-tag-text);padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600">${escaped}</span>`
  };
}
