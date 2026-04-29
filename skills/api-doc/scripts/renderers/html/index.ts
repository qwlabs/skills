// renderers/html-renderer.ts
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { render, preloadRenders } from "./loader";
import type {
  ParsedApiDoc,
  ApiOperation,
  ApiParameter,
  ApiType,
  ApiProperty,
  ApiConstraints,
} from "../../adapters/types";
import type { Renderer, RendererContext } from "../types";

export const htmlRenderer: Renderer = {
  name: "html",
  async render(doc: ParsedApiDoc, ctx: RendererContext): Promise<string> {
    await preloadRenders();
    const template = loadTemplate(ctx.templateDir);
    const styles = loadStyles(ctx.templateDir);
    const scripts = loadScripts(ctx.templateDir);
    const title = escapeHtml(doc.title);
    const sidebarContent = generateSidebar(doc);
    const apiContent = generateMainContent(doc, ctx.version);

    return template
      .replace("{{styles}}", styles)
      .replace("{{scripts}}", scripts)
      .replace(/\{\{title\}\}/g, title)
      .replace(/\{\{sidebar_content\}\}/g, sidebarContent)
      .replace(/\{\{api_content\}\}/g, apiContent)
      .replace(/\{\{version\}\}/g, escapeHtml(ctx.version));
  },
};

function loadTemplate(templateDir: string): string {
  const p = join(templateDir, "template.html");
  if (existsSync(p)) return readFileSync(p, "utf-8");
  throw new Error("Template not found: " + p);
}

function loadStyles(templateDir: string): string {
  const p = join(templateDir, "styles.css");
  if (existsSync(p)) return readFileSync(p, "utf-8");
  throw new Error("Styles not found: " + p);
}

function loadScripts(templateDir: string): string {
  const p = join(templateDir, "scripts.js");
  if (existsSync(p)) return readFileSync(p, "utf-8");
  throw new Error("Scripts not found: " + p);
}

function escapeHtml(text: string): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ---- Sidebar ----

function generateSidebar(doc: ParsedApiDoc): string {
  let html = "";

  // Header snippet links
  for (const snippet of doc.headerSnippets) {
    const anchorId = `snippet-header-${slugify(snippet.name)}`;
    html += `<li class="toc-group"><a href="#${anchorId}" class="toc-group-title">${escapeHtml(snippet.name)}</a></li>\n`;
  }

  for (const group of doc.groups) {
    html += `<li class="toc-group"><div class="toc-group-title">${escapeHtml(group.name)}</div></li>\n`;
    for (const op of group.operations) {
      html += `<li class="toc-item"><a href="#${op.id}" class="toc-link">${escapeHtml(op.name)}</a></li>\n`;
    }
  }

  // Footer snippet links
  for (const snippet of doc.footerSnippets) {
    const anchorId = `snippet-footer-${slugify(snippet.name)}`;
    html += `<li class="toc-group"><a href="#${anchorId}" class="toc-group-title">${escapeHtml(snippet.name)}</a></li>\n`;
  }

  return html;
}

function slugify(text: string): string {
  return text.replace(/[^a-zA-Z0-9一-鿿-]/g, "-");
}

// ---- Main Content ----

function generateMainContent(doc: ParsedApiDoc, version: string): string {
  let html = "";

  // Header markdown snippets
  for (const snippet of doc.headerSnippets) {
    const anchorId = `snippet-header-${slugify(snippet.name)}`;
    html += `<section class="api-section" id="${anchorId}"><div class="api-title">${escapeHtml(snippet.name)}</div><div class="markdown-section">${simpleMarkdownToHtml(snippet.content)}</div></section>\n`;
  }

  // API sections by group
  for (const group of doc.groups) {
    for (const op of group.operations) {
      html += generateOperationSection(op);
    }
  }

  // Footer markdown snippets
  for (const snippet of doc.footerSnippets) {
    const anchorId = `snippet-footer-${slugify(snippet.name)}`;
    html += `<section class="api-section" id="${anchorId}"><div class="api-title">${escapeHtml(snippet.name)}</div><div class="markdown-section">${simpleMarkdownToHtml(snippet.content)}</div></section>\n`;
  }

  html += `<footer class="doc-footer">文档版本: ${escapeHtml(version)}</footer>\n`;
  return html;
}

function generateOperationSection(op: ApiOperation): string {
  let html = "";

  html += `<section class="api-section" id="${op.id}">\n`;
  html += `<div class="api-title">${escapeHtml(op.name)}</div>\n`;

  // Metadata: verb + path
  html += '<div class="meta-section">\n';
  html += `<div class="meta-block"><span class="meta-label">方法</span><span class="meta-value">${render("tag", op.verb.toUpperCase())}</span></div>\n`;
  html += `<div class="meta-block"><span class="meta-label">路径</span><span class="meta-value">${render("code", op.path)}</span></div>\n`;
  if (op.versionTags.length > 0) {
    for (const vt of op.versionTags) {
      const label =
        vt.type === "added"
          ? `Added in ${vt.version}`
          : `Removed in ${vt.version}`;
      html += `<div class="meta-block"><span class="meta-value">${render("badge", label)}</span></div>\n`;
    }
  }
  html += "</div>\n";

  // Request parameters (header, query, path, cookie — not body)
  const nonBodyParams = op.parameters.filter(
    (p) => p.location !== "body"
  );
  if (nonBodyParams.length > 0) {
    html +=
      '<div class="section"><div class="section-title">请求参数</div>\n';
    html +=
      '<table class="param-table"><thead><tr><th>字段名</th><th>类型</th><th>位置</th><th>说明</th><th>必填</th><th>约束</th></tr></thead><tbody>\n';
    for (const param of nonBodyParams) {
      html += generateParameterRow(param);
    }
    html += "</tbody></table></div>";
  }

  // Request body
  if (op.body && op.body.type.kind === "object") {
    html += '<div class="section"><div class="section-title">请求体</div>\n';
    html +=
      '<table class="param-table"><thead><tr><th>字段名</th><th>类型</th><th>说明</th><th>必填</th><th>默认值</th><th>约束</th></tr></thead><tbody>\n';
    html += generatePropertyRows(op.body.type.properties, 0);
    html += "</tbody></table></div>";
  }

  // curl example
  if (op.curlCommand) {
    html += '<div class="json-section">\n';
    html += '<div class="json-title">请求示例 (curl)</div>\n';
    html += `<div class="json-block curl-block"><pre><code class="language-bash">${escapeHtml(op.curlCommand)}</code></pre>`;
    html += `<button class="curl-copy-btn" onclick="navigator.clipboard.writeText(this.previousElementSibling.textContent)">复制</button></div>\n`;
    html += "</div>";
  }

  // Response parameters
  for (const resp of op.responses) {
    if (!resp.isError && resp.type && resp.type.kind === "object") {
      html +=
        '<div class="section"><div class="section-title">响应参数</div>\n';
      html +=
        '<table class="param-table"><thead><tr><th>字段名</th><th>类型</th><th>说明</th><th>必填</th><th>默认值</th><th>约束</th></tr></thead><tbody>\n';
      html += generatePropertyRows(resp.type.properties, 0);
      html += "</tbody></table></div>";
      break;
    }
  }

  // Error responses summary
  const errorResponses = op.responses.filter((r) => r.isError);
  if (errorResponses.length > 0) {
    html +=
      '<div class="section"><div class="section-title">错误响应</div>\n';
    html +=
      '<table class="param-table"><thead><tr><th>状态码</th><th>说明</th></tr></thead><tbody>\n';
    for (const err of errorResponses) {
      html += `<tr><td><span class="field-type">${escapeHtml(err.statusCode)}</span></td><td>${escapeHtml(err.description || "")}</td></tr>\n`;
    }
    html += "</tbody></table></div>";
  }

  html += "</section>\n";
  return html;
}

function generateParameterRow(param: ApiParameter): string {
  const typeDisplay = formatType(param.type);
  const requiredBadge = param.required
    ? '<span class="field-required">必填</span>'
    : '<span class="field-optional">选填</span>';
  const constraints = formatConstraints(param.constraints);

  return (
    `<tr>` +
    `<td class="field-name-cell"><code class="field-name">${escapeHtml(param.name)}</code></td>` +
    `<td><span class="field-type">${escapeHtml(typeDisplay)}</span></td>` +
    `<td>${escapeHtml(param.location)}</td>` +
    `<td>${escapeHtml(param.doc || "")}</td>` +
    `<td>${requiredBadge}</td>` +
    `<td>${escapeHtml(constraints)}</td>` +
    `</tr>\n`
  );
}

function generatePropertyRows(properties: ApiProperty[], level: number): string {
  let html = "";
  for (const prop of properties) {
    const indentClass = "field-indent-" + Math.min(level, 4);
    const typeDisplay = formatType(prop.type);
    const requiredBadge = prop.required
      ? '<span class="field-required">必填</span>'
      : '<span class="field-optional">选填</span>';
    const defaultDisplay =
      prop.defaultValue !== undefined ? String(prop.defaultValue) : "";
    const constraints = formatConstraints(prop.constraints);

    let versionHtml = "";
    for (const vt of prop.versionTags) {
      const label =
        vt.type === "added" ? `+${vt.version}` : `-${vt.version}`;
      versionHtml += ` ${render("badge", label)}`;
    }

    html +=
      `<tr>` +
      `<td class="field-name-cell ${indentClass}"><code class="field-name">${escapeHtml(prop.name)}</code>${versionHtml}</td>` +
      `<td><span class="field-type">${escapeHtml(typeDisplay)}</span></td>` +
      `<td>${escapeHtml(prop.doc || "")}</td>` +
      `<td>${requiredBadge}</td>` +
      `<td>${escapeHtml(defaultDisplay)}</td>` +
      `<td>${escapeHtml(constraints)}</td>` +
      `</tr>\n`;

    if (prop.type.kind === "object") {
      html += generatePropertyRows(prop.type.properties, level + 1);
    }
    if (
      prop.type.kind === "array" &&
      prop.type.elementType.kind === "object"
    ) {
      html += generatePropertyRows(prop.type.elementType.properties, level + 1);
    }
  }
  return html;
}

function formatType(type: ApiType): string {
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
      return `enum (${type.members.map((m) => m.name).join(", ")})`;
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

function formatConstraints(c: ApiConstraints): string {
  const parts: string[] = [];
  if (c.minimum !== undefined) parts.push(`最小值: ${c.minimum}`);
  if (c.maximum !== undefined) parts.push(`最大值: ${c.maximum}`);
  if (c.minLength !== undefined) parts.push(`最小长度: ${c.minLength}`);
  if (c.maxLength !== undefined) parts.push(`最大长度: ${c.maxLength}`);
  if (c.pattern !== undefined) parts.push(`格式: ${c.pattern}`);
  return parts.join(" | ");
}

function simpleMarkdownToHtml(md: string): string {
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
