// pipeline/emit/html-emit.ts
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { render } from "./loader";
import type { DagStage, StageContext, SidebarEntry, ContentSection, ProtocolKind } from "../types";
import type { ApiOperation, MessageDefinition } from "../types";
import { escapeHtml, simpleMarkdownToHtml, buildFooterBadge } from "./html-helpers";
import { generateParameterRow, generatePropertyRows } from "./html-props";
import { generateExampleSection } from "./html-examples";

const PROTOCOL_META: Record<ProtocolKind, {
  tagLabel: string;
  tagColor: string;
}> = {
  http: { tagLabel: "HTTP", tagColor: "var(--doc-tag-post)" },
  mq:   { tagLabel: "MQ",   tagColor: "var(--doc-tag-mq)" },
};

function renderDeprecatedBanner(msg: string): string {
  return `<div class="deprecated-banner"><span class="deprecated-banner-icon">⚠</span><div class="deprecated-banner-content"><div class="deprecated-banner-title">${msg}</div></div></div>\n`;
}

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
      case "doc-link": {
        const tagClass = `toc-tag-${entry.protocol}`;
        const tagLabel = entry.protocol === "http" ? "HTTP" : "MQ";
        const tagHtml = `<span class="toc-tag ${tagClass}">${tagLabel}</span>`;
        const linkClass = entry.deprecated ? "toc-link deprecated" : "toc-link";
        const badge = entry.deprecated ? '<span class="deprecated-inline-badge">已废弃</span>' : "";
        html += `<li class="toc-item"><a href="#${entry.anchorId}" class="${linkClass}">${escapeHtml(entry.label)}${tagHtml}${badge}</a></li>\n`;
        break;
      }
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
        html += `<section class="doc-card" id="${section.anchorId}"><div class="api-title">${escapeHtml(section.title)}</div><div class="markdown-section">${simpleMarkdownToHtml(section.content)}</div></section>\n`;
        break;
      case "operation":
        html += renderDocCard(section.op, "http");
        break;
      case "message":
        html += renderDocCard(section.msg, "mq");
        break;
      case "footer":
        html += buildFooterBadge(section.version);
        break;
    }
  }
  return html;
}

function renderDocCard(data: ApiOperation | MessageDefinition, protocol: ProtocolKind): string {
  const meta = PROTOCOL_META[protocol];
  let html = "";

  html += `<section class="doc-card" id="${data.id}">\n`;
  html += `<div class="api-title">${escapeHtml(data.name)}<span class="api-title-tag" style="background-color:${meta.tagColor}">${meta.tagLabel}</span></div>\n`;

  // Metadata
  html += '<div class="meta-section">\n';
  if (protocol === "http") {
    const op = data as ApiOperation;
    html += `<div class="meta-block"><span class="meta-label">方法</span><span class="meta-value">${render("tag", op.verb.toUpperCase())}</span></div>\n`;
    html += `<div class="meta-block"><span class="meta-label">路径</span><span class="meta-value">${render("code", op.path)}</span></div>\n`;
  } else {
    const msg = data as MessageDefinition;
    html += `<div class="meta-block meta-block-wide"><span class="meta-label">Topic</span><span class="meta-value">${render("code", msg.topic)}</span></div>\n`;
  }
  if (data.versionTags.length > 0) {
    for (const vt of data.versionTags) {
      const label = vt.type === "added" ? `Added in ${vt.version}` : `Removed in ${vt.version}`;
      html += `<div class="meta-block"><span class="meta-value">${render("badge", label)}</span></div>\n`;
    }
  }
  html += "</div>\n";

  // Deprecated banner (after meta-section)
  if (data.deprecated) {
    const bannerMsg = protocol === "http" ? "此接口已废弃" : "此消息已废弃";
    html += `<div class="deprecated-banner"><span class="deprecated-banner-icon">⚠</span><div class="deprecated-banner-content"><div class="deprecated-banner-title">${bannerMsg}</div><div class="deprecated-banner-message">${escapeHtml(data.deprecated.message)}</div></div></div>\n`;
  }

  // Description (http only, after meta-section)
  if (protocol === "http") {
    const op = data as ApiOperation;
    if (op.description) {
      html += `<div class="markdown-section">${simpleMarkdownToHtml(op.description)}</div>\n`;
    }
  }

  // Description (message only)
  if (protocol === "mq") {
    const msg = data as MessageDefinition;
    if (msg.description && msg.description !== msg.name) {
      html += `<div class="markdown-section">${simpleMarkdownToHtml(msg.description)}</div>\n`;
    }
  }

  // Parameters / Payload table
  if (protocol === "http") {
    const op = data as ApiOperation;
    if (op.parameters.length > 0) {
      html += '<div class="section"><div class="section-title">请求参数</div>\n';
      html += '<table class="param-table cols-6"><thead><tr><th class="col-field">字段名</th><th class="col-type">类型</th><th class="col-location">位置</th><th class="col-desc">说明</th><th class="col-required">必填</th><th class="col-constraint">约束</th></tr></thead><tbody>\n';
      for (const param of op.parameters) {
        html += generateParameterRow(param);
      }
      html += "</tbody></table></div>";
    }
    if (op.body && op.body.type.kind === "object") {
      html += '<div class="section"><div class="section-title">请求参数</div>\n';
      html += '<table class="param-table cols-4"><thead><tr><th class="col-field">字段名</th><th class="col-type">类型</th><th class="col-constraint">约束</th><th class="col-desc">说明</th></tr></thead><tbody>\n';
      html += generatePropertyRows(op.body.type.properties, 0);
      html += "</tbody></table></div>";
    }
    for (const resp of op.responses) {
      if (!resp.isError && resp.type && resp.type.kind === "object") {
        html += '<div class="section"><div class="section-title">返回参数</div>\n';
        html += '<table class="param-table cols-4"><thead><tr><th class="col-field">字段名</th><th class="col-type">类型</th><th class="col-constraint">约束</th><th class="col-desc">说明</th></tr></thead><tbody>\n';
        html += generatePropertyRows(resp.type.properties, 0);
        html += "</tbody></table></div>";
        break;
      }
    }
  } else {
    const msg = data as MessageDefinition;
    if (msg.payload && msg.payload.kind === "object") {
      html += '<div class="section"><div class="section-title">消息结构</div>\n';
      html += '<table class="param-table cols-4"><thead><tr><th class="col-field">字段名</th><th class="col-type">类型</th><th class="col-constraint">约束</th><th class="col-desc">说明</th></tr></thead><tbody>\n';
      html += generatePropertyRows(msg.payload.properties, 0);
      html += "</tbody></table></div>";
    }
  }

  // Examples
  if (data.examples.length > 0) {
    html += generateExampleSection(data.id, data.examples);
  }

  // Error responses (http only)
  if (protocol === "http") {
    const op = data as ApiOperation;
    const errorResponses = op.responses.filter((r) => r.isError);
    if (errorResponses.length > 0) {
      html += '<div class="section"><div class="section-title">错误响应</div>\n';
      html += '<table class="param-table"><thead><tr><th>状态码</th><th>说明</th></tr></thead><tbody>\n';
      for (const err of errorResponses) {
        html += `<tr><td><span class="field-type">${escapeHtml(err.statusCode)}</span></td><td>${escapeHtml(err.description || "")}</td></tr>\n`;
      }
      html += "</tbody></table></div>";
    }
  }

  html += "</section>\n";
  return html;
}
