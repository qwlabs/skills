// pipeline/emit/html-helpers.ts
import type { ApiType, ApiConstraints } from "../types";

export function escapeHtml(text: string): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function slugify(text: string): string {
  return text.replace(/[^a-zA-Z0-9一-鿿-]/g, "-");
}

export function formatType(type: ApiType): string {
  switch (type.kind) {
    case "string":
      return "string";
    case "number":
      return "number";
    case "integer":
      return "number";
    case "float":
      return "number";
    case "boolean":
      return "boolean";
    case "datetime":
      return "datetime";
    case "uuid":
      return "uuid";
    case "any":
      return "any";
    case "enum":
      return "enum";
    case "union":
      return type.variants.map(formatType).join(" | ");
    case "array":
      return `${formatType(type.elementType)}[]`;
    case "object":
      return type.name || "object";
    case "scalar":
      return type.name;
  }
}

export function formatEnumDoc(type: ApiType): string {
  if (type.kind !== "enum" || type.members.length === 0) return "";
  const hasAnyDoc = type.members.some((m) => m.doc);
  if (!hasAnyDoc) {
    return `<br><span class="enum-members">${escapeHtml(type.members.map((m) => m.name).join(", "))}</span>`;
  }
  const items = type.members.map((m) =>
    m.doc ? `${escapeHtml(m.name)}(${escapeHtml(m.doc)})` : escapeHtml(m.name)
  );
  return `<br><span class="enum-members">${items.join("、")}</span>`;
}

export function formatConstraints(c: ApiConstraints): string {
  const parts: string[] = [];
  if (c.minimum !== undefined) parts.push(`最小值: ${c.minimum}`);
  if (c.maximum !== undefined) parts.push(`最大值: ${c.maximum}`);
  if (c.minLength !== undefined) parts.push(`最小长度: ${c.minLength}`);
  if (c.maxLength !== undefined) parts.push(`最大长度: ${c.maxLength}`);
  if (c.pattern !== undefined) parts.push(`格式: ${c.pattern}`);
  return parts.join(" | ");
}

export function simpleMarkdownToHtml(md: string): string {
  let html = escapeHtml(md);

  // Code blocks: ```lang\n...\n```
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, _lang, code) => {
    return `\x00PRE\x00${code.trim()}\x00/PRE\x00`;
  });

  // Inline code: `...`
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Tables: | header | ... | \n | --- | ... | \n | cell | ... |
  html = html.replace(
    /^(\|.+\|)\n(\|[\s:|-]+\|)\n((?:\|.+\|\n?)*)/gm,
    (_match, headerRow, _sep, bodyBlock) => {
      const headers = parseTableRow(headerRow);
      const bodyRows = bodyBlock.trim().split("\n");
      let table = '<table class="md-table"><thead><tr>';
      for (const h of headers) {
        table += `<th>${h.trim()}</th>`;
      }
      table += '</tr></thead><tbody>';
      for (const row of bodyRows) {
        if (!row.trim()) continue;
        const cells = parseTableRow(row);
        table += '<tr>';
        for (const c of cells) {
          table += `<td>${c.trim()}</td>`;
        }
        table += '</tr>';
      }
      table += '</tbody></table>';
      return `\x00TABLE\x00${table}\x00/TABLE\x00`;
    }
  );

  // Headers
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");

  // Bold: **...**
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

  // Italic: *...*
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");

  // Unordered lists: - item
  html = html.replace(/^- (.+)$/gm, "<li>$1</li>");
  html = html.replace(/(<li>[\s\S]*?<\/li>)/g, (match) => {
    if (!match.startsWith("<ul>")) return `<ul>${match}</ul>`;
    return match;
  });
  // Merge consecutive <ul> blocks
  html = html.replace(/<\/ul>\n<ul>/g, "\n");

  // Ordered lists: 1. item
  html = html.replace(/^\d+\. (.+)$/gm, "<li>$1</li>");

  // Links: [text](url)
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank">$1</a>'
  );

  // Paragraphs: double newline
  html = html.replace(/\n\n/g, "</p><p>");

  // Single newline to <br>
  html = html.replace(/\n/g, "<br>");

  // Wrap in paragraph
  html = `<p>${html}</p>`;

  // Restore preserved blocks (tables, pre)
  html = html.replace(/\x00TABLE\x00/g, "");
  html = html.replace(/\x00\/TABLE\x00/g, "");
  html = html.replace(/\x00PRE\x00/g, "<pre><code>");
  html = html.replace(/\x00\/PRE\x00/g, "</code></pre>");

  // Clean up empty paragraphs around block elements
  html = html.replace(/<p>\s*(<h[1-6]>)/g, "$1");
  html = html.replace(/(<\/h[1-6]>)\s*<\/p>/g, "$1");
  html = html.replace(/<p>\s*(<pre>)/g, "$1");
  html = html.replace(/(<\/pre>)\s*<\/p>/g, "$1");
  html = html.replace(/<p>\s*(<ul>)/g, "$1");
  html = html.replace(/(<\/ul>)\s*<\/p>/g, "$1");
  html = html.replace(/<p>\s*(<table)/g, "$1");
  html = html.replace(/(<\/table>)\s*<\/p>/g, "$1");
  html = html.replace(/<p>\s*<\/p>/g, "");

  return html;
}

function parseTableRow(row: string): string[] {
  return row.split("|").slice(1, -1);
}

export function buildFooterBadge(version: string): string {
  const v = escapeHtml(version);
  return `<footer class="doc-footer"><span class="footer-badge"><span class="footer-badge-label"><svg viewBox="0 0 16 16" width="12" height="12"><path fill="currentColor" d="M1 7.775V2.75C1 1.784 1.784 1 2.75 1h5.025c.464 0 .91.184 1.238.513l6.25 6.25a1.75 1.75 0 010 2.474l-5.026 5.026a1.75 1.75 0 01-2.474 0l-6.25-6.25A1.75 1.75 0 011 7.775zm1.5 0c0 .066.026.13.073.177l6.25 6.25a.25.25 0 00.354 0l5.025-5.025a.25.25 0 000-.354l-6.25-6.25a.25.25 0 00-.177-.073H2.75a.25.25 0 00-.25.25zM6 5a1 1 0 11-2 0 1 1 0 012 0"/></svg></span><span class="footer-badge-value">${v}</span></span></footer>\n`;
}
