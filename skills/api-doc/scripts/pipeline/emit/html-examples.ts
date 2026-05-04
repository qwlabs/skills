// pipeline/emit/html-examples.ts
import type { ApiExample } from "../types";
import { escapeHtml } from "./html-helpers";

export function generateExampleSection(opId: string, examples: ApiExample[]): string {
  let html = '<div class="example-section">\n';
  html += '<div class="example-section-title">示例</div>\n';

  // Example tabs
  html += '<div class="example-tabs">\n';
  for (let i = 0; i < examples.length; i++) {
    const ex = examples[i];
    const cls = i === 0 ? ' class="example-tab active"' : ' class="example-tab"';
    html += `<button${cls} onclick="switchExampleTab(this, 'ex-${opId}-${i}')">${escapeHtml(ex.name)}</button>\n`;
  }
  html += '</div>\n';

  // Example panes
  for (let i = 0; i < examples.length; i++) {
    const ex = examples[i];
    const paneCls = i === 0 ? ' class="example-pane active"' : ' class="example-pane"';
    html += `<div${paneCls} id="ex-${opId}-${i}">\n`;
    html += '<div class="example-card">\n';
    html += '<div class="example-card-header">\n';
    const hasRequest = ex.request != null && ex.request !== undefined;
    const hasCurl = !!ex.curlCommand;
    if (hasRequest) {
      const firstTabActive = ' class="example-card-tab tab-request active"';
      const resCls = ' class="example-card-tab tab-response"';
      const curlCls = hasCurl ? ' class="example-card-tab tab-curl"' : '';
      html += `<button${firstTabActive} onclick="switchCardTab(this, 'req-${opId}-${i}')">请求数据</button>\n`;
      html += `<button${resCls} onclick="switchCardTab(this, 'res-${opId}-${i}')">返回数据</button>\n`;
      if (hasCurl) {
        html += `<button${curlCls} onclick="switchCardTab(this, 'curl-${opId}-${i}')">cURL</button>\n`;
      }
    } else {
      const resCls = ' class="example-card-tab tab-response active"';
      const curlCls = hasCurl ? ' class="example-card-tab tab-curl"' : '';
      html += `<button${resCls} onclick="switchCardTab(this, 'res-${opId}-${i}')">返回数据</button>\n`;
      if (hasCurl) {
        html += `<button${curlCls} onclick="switchCardTab(this, 'curl-${opId}-${i}')">cURL</button>\n`;
      }
    }
    html += '</div>\n';

    html += '<div class="example-card-body">\n';

    // Request content
    if (hasRequest) {
      const reqContentCls = i === 0 ? ' class="example-card-content active"' : ' class="example-card-content"';
      html += `<div${reqContentCls} id="req-${opId}-${i}">\n`;
      html += `<pre><code class="language-json">${escapeHtml(ex.request!)}</code></pre>\n`;
      html += '</div>\n';
    }

    // Response content
    const resContentCls = hasRequest ? ' class="example-card-content"' : ' class="example-card-content active"';
    html += `<div${resContentCls} id="res-${opId}-${i}">\n`;
    html += `<pre><code class="language-json">${escapeHtml(ex.response)}</code></pre>\n`;
    html += '</div>\n';

    // cURL content
    if (hasCurl) {
      const curlContentCls = ' class="example-card-content"';
      html += `<div${curlContentCls} id="curl-${opId}-${i}">\n`;
      html += `<pre><code class="language-bash">${escapeHtml(ex.curlCommand!)}</code></pre>\n`;
      html += '</div>\n';
    }

    html += '<button class="example-copy-btn" onclick="copyCard(this)">复制</button>\n';
    html += '</div>\n'; // example-card-body
    html += '</div>\n'; // example-card
    html += '</div>\n'; // example-pane
  }

  html += '</div>\n'; // example-section
  return html;
}
