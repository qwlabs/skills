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
  ApiExample,
} from "../../adapters/types";
import type { Renderer, RendererContext } from "../types";

export const htmlRenderer: Renderer = {
  name: "html",
  async render(doc: ParsedApiDoc, ctx: RendererContext): Promise<string> {
    await preloadRenders();
    const template = loadTemplate(ctx.templateDir);
    let styles = loadStyles(ctx.templateDir);
    if (ctx.themeCSS) {
      styles = styles + "\n" + ctx.themeCSS;
    }
    const scripts = loadScripts(ctx.templateDir);
    const title = escapeHtml(doc.title);
    const sidebarContent = generateSidebar(doc);
    const apiContent = generateMainContent(doc, ctx.version);
    const hljsCSS = inlineFile(ctx.templateDir, "vendor", "atom-one-dark.min.css");
    const hljsBundle = [
      inlineFile(ctx.templateDir, "vendor", "highlight.min.js"),
      inlineFile(ctx.templateDir, "vendor", "json.min.js"),
      inlineFile(ctx.templateDir, "vendor", "bash.min.js"),
    ].join("\n");

    return template
      .replace("{{hljs_theme}}", hljsCSS)
      .replace("{{hljs}}", hljsBundle)
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

function inlineFile(templateDir: string, ...segments: string[]): string {
  const p = join(templateDir, ...segments);
  if (existsSync(p)) return readFileSync(p, "utf-8");
  console.warn("Warning: vendor file not found: " + p);
  return "";
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

  html += buildFooterBadge(version);
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

  // Request parameters (header, query, path, cookie)
  if (op.parameters.length > 0) {
    html +=
      '<div class="section"><div class="section-title">请求参数</div>\n';
    html +=
      '<table class="param-table"><thead><tr><th>字段名</th><th>类型</th><th>位置</th><th>说明</th><th>必填</th><th>约束</th></tr></thead><tbody>\n';
    for (const param of op.parameters) {
      html += generateParameterRow(param);
    }
    html += "</tbody></table></div>";
  }

  // Request body
  if (op.body && op.body.type.kind === "object") {
    html += '<div class="section"><div class="section-title">请求参数</div>\n';
    html +=
      '<table class="param-table"><thead><tr><th>字段名</th><th>类型</th><th>约束</th><th>说明</th></tr></thead><tbody>\n';
    html += generatePropertyRows(op.body.type.properties, 0);
    html += "</tbody></table></div>";
  }

  // Response parameters
  for (const resp of op.responses) {
    if (!resp.isError && resp.type && resp.type.kind === "object") {
      html +=
        '<div class="section"><div class="section-title">返回参数</div>\n';
      html +=
        '<table class="param-table"><thead><tr><th>字段名</th><th>类型</th><th>约束</th><th>说明</th></tr></thead><tbody>\n';
      html += generatePropertyRows(resp.type.properties, 0);
      html += "</tbody></table></div>";
      break;
    }
  }

  // Examples
  if (op.examples.length > 0) {
    html += generateExampleSection(op.id, op.examples);
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
  const docHtml = escapeHtml(param.doc || "") + formatEnumDoc(param.type);

  return (
    `<tr>` +
    `<td class="field-name-cell"><code class="field-name">${escapeHtml(param.name)}</code></td>` +
    `<td><span class="field-type">${escapeHtml(typeDisplay)}</span></td>` +
    `<td>${escapeHtml(param.location)}</td>` +
    `<td>${docHtml}</td>` +
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

    // Build constraints: each category on its own line with distinct visual style
    const constraintHtml = formatConstraintsHtml(prop.required, prop.constraints, prop.defaultValue, prop.fixedValue, prop.conditionalRequired, prop.conditionalOptional);

    let versionHtml = "";
    for (const vt of prop.versionTags) {
      const label =
        vt.type === "added" ? `+${vt.version}` : `-${vt.version}`;
      versionHtml += ` ${render("badge", label)}`;
    }

    const docHtml = escapeHtml(prop.doc || "") + formatEnumDoc(prop.type);

    html +=
      `<tr>` +
      `<td class="field-name-cell ${indentClass}"><code class="field-name">${escapeHtml(prop.name)}</code>${versionHtml}</td>` +
      `<td><span class="field-type">${escapeHtml(typeDisplay)}</span></td>` +
      `<td class="constraint-cell">${constraintHtml}</td>` +
      `<td>${docHtml}</td>` +
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

function formatEnumDoc(type: ApiType): string {
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

function formatConstraintsHtml(required: boolean, c: ApiConstraints, defaultValue?: unknown, fixedValue?: unknown, conditionalRequired?: string, conditionalOptional?: string): string {
  const lines: string[] = [];

  // Required status: mutually exclusive — fixed value > conditional required > conditional optional > required/optional
  if (fixedValue !== undefined) {
    lines.push(`<span class="constraint-tag constraint-fixed">固定值</span> <code>${escapeHtml(String(fixedValue))}</code>`);
  } else if (conditionalRequired) {
    lines.push(`<span class="constraint-tag constraint-conditional">条件必填</span> ${escapeHtml(conditionalRequired)}`);
  } else if (conditionalOptional) {
    lines.push(`<span class="constraint-tag constraint-optional-conditional">条件选填</span> ${escapeHtml(conditionalOptional)}`);
  } else if (required) {
    lines.push('<span class="constraint-tag constraint-required">必填</span>');
  } else {
    lines.push('<span class="constraint-tag constraint-optional">选填</span>');
  }

  // Range constraints: combine min/max into range expression
  const cAny = c as Record<string, unknown>;
  if (cAny.minimum !== undefined || cAny.maximum !== undefined) {
    const min = cAny.minimum !== undefined ? String(cAny.minimum) : "";
    const max = cAny.maximum !== undefined ? String(cAny.maximum) : "";
    const expr = min && max ? `[${min}, ${max}]` : min ? `≥ ${min}` : `≤ ${max}`;
    lines.push(`<span class="constraint-item">值域 ${expr}</span>`);
  }
  if (cAny.minLength !== undefined || cAny.maxLength !== undefined) {
    const min = cAny.minLength !== undefined ? String(cAny.minLength) : "";
    const max = cAny.maxLength !== undefined ? String(cAny.maxLength) : "";
    const expr = min && max ? `[${min}, ${max}]` : min ? `≥ ${min}` : `≤ ${max}`;
    lines.push(`<span class="constraint-item">长度 ${expr}</span>`);
  }

  // Pattern
  if (cAny.pattern !== undefined) {
    lines.push(`<span class="constraint-item">格式 /${cAny.pattern}/</span>`);
  }

  // Default value (only shown if no fixed value)
  if (fixedValue === undefined && defaultValue !== undefined) {
    lines.push(`<span class="constraint-item">默认 <code>${escapeHtml(String(defaultValue))}</code></span>`);
  }

  return lines.join("<br>");
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

function generateExampleSection(opId: string, examples: ApiExample[]): string {
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

function buildFooterBadge(version: string): string {
  const v = escapeHtml(version);
  return `<footer class="doc-footer"><span class="footer-badge"><span class="footer-badge-label"><svg viewBox="0 0 16 16" width="12" height="12"><path fill="currentColor" d="M1 7.775V2.75C1 1.784 1.784 1 2.75 1h5.025c.464 0 .91.184 1.238.513l6.25 6.25a1.75 1.75 0 010 2.474l-5.026 5.026a1.75 1.75 0 01-2.474 0l-6.25-6.25A1.75 1.75 0 011 7.775zm1.5 0c0 .066.026.13.073.177l6.25 6.25a.25.25 0 00.354 0l5.025-5.025a.25.25 0 000-.354l-6.25-6.25a.25.25 0 00-.177-.073H2.75a.25.25 0 00-.25.25zM6 5a1 1 0 11-2 0 1 1 0 012 0"/></svg></span><span class="footer-badge-value">${v}</span></span></footer>\n`;
}
