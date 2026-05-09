// pipeline/emit/html-emit.ts
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { render } from "./loader";
import type { DagStage, StageContext, SidebarEntry, ContentSection } from "../types";
import type { ApiOperation } from "../types";
import { escapeHtml, simpleMarkdownToHtml, buildFooterBadge } from "./html-helpers";
import { generateParameterRow, generatePropertyRows } from "./html-props";
import { generateExampleSection } from "./html-examples";

export const htmlEmit: DagStage = {
  name: "html-emit",
  requires: ["model.sidebar", "model.sections", "model.assets", "model.meta"],
  provides: ["model.output"],
  process(ctx: StageContext): void {
    const template = loadTemplate(ctx.config.templateDir);
    const sidebarHtml = renderSidebar(ctx.model.sidebar);
    const contentHtml = renderSections(ctx.model.sections);

    ctx.model.assets.finalOutput = template
      .replace("{{hljs_theme}}", ctx.model.assets.hljsThemeCSS)
      .replace("{{hljs}}", ctx.model.assets.hljsBundle)
      .replace("{{styles}}", ctx.model.assets.styles)
      .replace("{{scripts}}", ctx.model.assets.scripts)
      .replace(/\{\{title\}\}/g, escapeHtml(ctx.model.meta.title))
      .replace(/\{\{sidebar_content\}\}/g, sidebarHtml)
      .replace(/\{\{api_content\}\}/g, contentHtml);
  },
};

function loadTemplate(templateDir: string): string {
  const p = join(templateDir, "template.html");
  if (existsSync(p)) return readFileSync(p, "utf-8");
  throw new Error("Template not found: " + p);
}

function renderSidebar(entries: SidebarEntry[]): string {
  let html = "";
  for (const entry of entries) {
    switch (entry.kind) {
      case "group-title":
        html += `<li class="toc-group"><div class="toc-group-title">${escapeHtml(entry.label)}</div></li>\n`;
        break;
      case "operation-link":
        if (entry.deprecated) {
          html += `<li class="toc-item"><a href="#${entry.anchorId}" class="toc-link toc-link-deprecated">${escapeHtml(entry.label)}<span class="deprecated-inline-badge">已废弃</span></a></li>\n`;
        } else {
          html += `<li class="toc-item"><a href="#${entry.anchorId}" class="toc-link">${escapeHtml(entry.label)}</a></li>\n`;
        }
        break;
      case "snippet-link":
        html += `<li class="toc-group"><a href="#${entry.anchorId}" class="toc-group-title">${escapeHtml(entry.label)}</a></li>\n`;
        break;
    }
  }
  return html;
}

function renderSections(sections: ContentSection[]): string {
  let html = "";
  for (const section of sections) {
    switch (section.kind) {
      case "snippet":
        html += `<section class="api-section" id="${section.anchorId}"><div class="api-title">${escapeHtml(section.title)}</div><div class="markdown-section">${simpleMarkdownToHtml(section.content)}</div></section>\n`;
        break;
      case "operation":
        html += renderOperation(section.op);
        break;
      case "footer":
        html += buildFooterBadge(section.version);
        break;
    }
  }
  return html;
}

function renderOperation(op: ApiOperation): string {
  let html = "";

  const sectionClass = op.deprecated ? "api-section deprecated-section" : "api-section";
  html += `<section class="${sectionClass}" id="${op.id}">\n`;
  html += `<div class="api-title">${escapeHtml(op.name)}</div>\n`;

  if (op.deprecated) {
    html += `<div class="deprecated-banner"><span class="deprecated-banner-icon">⚠</span><div class="deprecated-banner-content"><div class="deprecated-banner-title">此接口已废弃</div><div class="deprecated-banner-message">${escapeHtml(op.deprecated.message)}</div></div></div>\n`;
  }

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
      '<table class="param-table cols-6"><thead><tr><th class="col-field">字段名</th><th class="col-type">类型</th><th class="col-location">位置</th><th class="col-desc">说明</th><th class="col-required">必填</th><th class="col-constraint">约束</th></tr></thead><tbody>\n';
    for (const param of op.parameters) {
      html += generateParameterRow(param);
    }
    html += "</tbody></table></div>";
  }

  // Request body
  if (op.body && op.body.type.kind === "object") {
    html += '<div class="section"><div class="section-title">请求参数</div>\n';
    html +=
      '<table class="param-table cols-4"><thead><tr><th class="col-field">字段名</th><th class="col-type">类型</th><th class="col-constraint">约束</th><th class="col-desc">说明</th></tr></thead><tbody>\n';
    html += generatePropertyRows(op.body.type.properties, 0);
    html += "</tbody></table></div>";
  }

  // Response parameters
  for (const resp of op.responses) {
    if (!resp.isError && resp.type && resp.type.kind === "object") {
      html +=
        '<div class="section"><div class="section-title">返回参数</div>\n';
      html +=
        '<table class="param-table cols-4"><thead><tr><th class="col-field">字段名</th><th class="col-type">类型</th><th class="col-constraint">约束</th><th class="col-desc">说明</th></tr></thead><tbody>\n';
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
