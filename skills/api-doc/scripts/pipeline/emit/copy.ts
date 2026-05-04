import { RenderResult, RenderOptions } from './base';

export function copy(value: any, options?: RenderOptions): RenderResult {
  const escaped = String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
  return {
    html: `<div class="copy-block" data-value="${escaped}">
  <code class="inline-code">${escaped}</code>
  <button class="copy-btn" onclick="navigator.clipboard.writeText(this.parentElement.dataset.value)" title="复制">📋</button>
</div>`
  };
}
