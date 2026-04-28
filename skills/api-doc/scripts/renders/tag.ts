import { RenderResult, RenderOptions } from './base.js';

const DEFAULT_COLORS: Record<string, string> = {
  GET: '#4CAF50',
  POST: '#2196F3',
  PUT: '#FF9800',
  DELETE: '#F44336',
  PATCH: '#9C27B0'
};

export function tag(value: any, options?: RenderOptions & { colors?: Record<string, string> }): RenderResult {
  const escaped = String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
  const colorMap = { ...DEFAULT_COLORS, ...options?.colors };
  const color = colorMap[value.toUpperCase()] ?? '#666666';
  
  return {
    html: `<span class="tag" style="background-color:${color};color:#fff;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600">${escaped}</span>`
  };
}
