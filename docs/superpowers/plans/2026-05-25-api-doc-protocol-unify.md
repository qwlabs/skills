# api-doc 协议统一重构 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 消除 api-doc 中 HTTP/MQ 的代码重复，建立可扩展的协议抽象层。

**Architecture:** 引入 `ProtocolKind` 类型，将 `SidebarEntry` 合并为统一的 `doc-link`，合并 `renderOperation`/`renderMessage` 为配置驱动的 `renderDocCard`，CSS 统一 class 名消除重复样式。

**Tech Stack:** TypeScript, TypeSpec, HTML/CSS

---

### Task 1: 类型层 — 新增 ProtocolKind，改造 SidebarEntry

**Files:**
- Modify: `skills/api-doc/scripts/pipeline/types.ts:139-145`

- [ ] **Step 1: 在 types.ts 中新增 ProtocolKind 类型并修改 SidebarEntry**

在 `types.ts` 的 `// --- Document Model ---` 区域前新增：

```typescript
export type ProtocolKind = "http" | "mq";
```

将 `SidebarEntry`（139-145 行）从：

```typescript
export interface SidebarEntry {
  kind: "group-title" | "operation-link" | "snippet-link" | "message-link";
  label: string;
  anchorId?: string;
  tag?: string;
  deprecated?: DeprecationDetails;
}
```

改为：

```typescript
export interface SidebarEntry {
  kind: "group-title" | "doc-link" | "snippet-link";
  label: string;
  anchorId?: string;
  protocol: ProtocolKind;
  deprecated?: DeprecationDetails;
}
```

- [ ] **Step 2: 修改 sidebar-build.ts 适配新 SidebarEntry**

**Files:**
- Modify: `skills/api-doc/scripts/pipeline/stages/sidebar-build.ts:17-21`

将 17-21 行从：

```typescript
for (const op of group.operations) {
  entries.push({ kind: "operation-link", label: op.name, anchorId: op.id, tag: "HTTP", deprecated: op.deprecated });
}
for (const msg of group.messages) {
  entries.push({ kind: "message-link", label: msg.name, anchorId: msg.id, tag: "MQ", deprecated: msg.deprecated });
}
```

改为：

```typescript
for (const op of group.operations) {
  entries.push({ kind: "doc-link", label: op.name, anchorId: op.id, protocol: "http", deprecated: op.deprecated });
}
for (const msg of group.messages) {
  entries.push({ kind: "doc-link", label: msg.name, anchorId: msg.id, protocol: "mq", deprecated: msg.deprecated });
}
```

- [ ] **Step 3: 编译验证**

Run: `cd /Volumes/dlp/workspace/skills/skills/api-doc && npx tsc --noEmit 2>&1 | head -30`

预期：`html-emit.ts` 中引用旧 `SidebarEntry` 字段的地方会报类型错误。这是预期的，在 Task 2 中修复。

- [ ] **Step 4: Commit**

```bash
cd /Volumes/dlp/workspace/skills
git add skills/api-doc/scripts/pipeline/types.ts skills/api-doc/scripts/pipeline/stages/sidebar-build.ts
git commit -m "refactor(api-doc): add ProtocolKind type and unify SidebarEntry"
```

---

### Task 2: 渲染层 — 合并 renderSidebar 的 switch case

**Files:**
- Modify: `skills/api-doc/scripts/pipeline/emit/html-emit.ts:37-68`

- [ ] **Step 1: 合并 renderSidebar 中的 operation-link 和 message-link**

将 `renderSidebar` 函数（37-68 行）中 `operation-link` 和 `message-link` 两个 case 替换为单一的 `doc-link` case：

原代码 44-61 行（两个 case）替换为：

```typescript
      case "doc-link": {
        const tagClass = `toc-tag-${entry.protocol}`;
        const tagHtml = `<span class="toc-tag ${tagClass}">${escapeHtml(entry.protocol === "http" ? "HTTP" : "MQ")}</span>`;
        const linkClass = entry.deprecated ? "toc-link deprecated" : "toc-link";
        const badge = entry.deprecated ? '<span class="deprecated-inline-badge">已废弃</span>' : "";
        html += `<li class="toc-item"><a href="#${entry.anchorId}" class="${linkClass}">${escapeHtml(entry.label)}${tagHtml}${badge}</a></li>\n`;
        break;
      }
```

注意：最终 tagHtml 的内容应从 PROTOCOL_META 配置驱动而非 if-else，但 `renderSidebar` 这里只需要 label，等 Task 3 引入 PROTOCOL_META 后再改为查表。此处先用简单的三目表达式。

- [ ] **Step 2: 补充 import ProtocolKind**

在 html-emit.ts 第 5 行的 import 中加入 `ProtocolKind`：

```typescript
import type { DagStage, StageContext, SidebarEntry, ContentSection, ProtocolKind } from "../types";
```

- [ ] **Step 3: 编译验证**

Run: `cd /Volumes/dlp/workspace/skills/skills/api-doc && npx tsc --noEmit 2>&1 | head -30`

预期：`renderSidebar` 相关的类型错误消失。`renderSections` 不受影响。

- [ ] **Step 4: Commit**

```bash
cd /Volumes/dlp/workspace/skills
git add skills/api-doc/scripts/pipeline/emit/html-emit.ts
git commit -m "refactor(api-doc): unify sidebar rendering for all protocol types"
```

---

### Task 3: 渲染层 — 合并 renderOperation 和 renderMessage 为 renderDocCard

**Files:**
- Modify: `skills/api-doc/scripts/pipeline/emit/html-emit.ts:91-213`

- [ ] **Step 1: 在 html-emit.ts 文件顶部（import 之后，htmlEmit 之前）添加 PROTOCOL_META 配置**

```typescript
const PROTOCOL_META: Record<ProtocolKind, {
  tagLabel: string;
  tagColor: string;
}> = {
  http: { tagLabel: "HTTP", tagColor: "var(--doc-tag-post)" },
  mq:   { tagLabel: "MQ",   tagColor: "var(--doc-tag-mq)" },
};
```

- [ ] **Step 2: 在 PROTOCOL_META 之后添加辅助函数 hasField**

这个辅助用于统一判断 ApiOperation 和 MessageDefinition 的共有字段（两者都有 id, name, deprecated, versionTags, examples）：

```typescript
function renderDeprecatedBanner(msg: string): string {
  return `<div class="deprecated-banner"><span class="deprecated-banner-icon">⚠</span><div class="deprecated-banner-content"><div class="deprecated-banner-title">${escapeHtml(msg)}</div></div></div>\n`;
}
```

- [ ] **Step 3: 将 renderOperation（91-170 行）和 renderMessage（173-213 行）替换为 renderDocCard**

删除 `renderOperation` 和 `renderMessage` 两个函数，替换为：

```typescript
function renderDocCard(data: ApiOperation | MessageDefinition, protocol: ProtocolKind): string {
  const meta = PROTOCOL_META[protocol];
  let html = "";

  html += `<section class="doc-card" id="${data.id}">\n`;
  html += `<div class="api-title">${escapeHtml(data.name)}<span class="api-title-tag" style="background-color:${meta.tagColor}">${meta.tagLabel}</span></div>\n`;

  if (data.deprecated) {
    html += renderDeprecatedBanner(protocol === "http" ? "此接口已废弃" : "此消息已废弃");
    html += `<div class="deprecated-banner-message">${escapeHtml(data.deprecated.message)}</div></div></div>\n`;
  }

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
```

- [ ] **Step 4: 更新 renderSections 中的调用**

在 `renderSections` 函数（70-89 行）中，将：

```typescript
case "operation":
  html += renderOperation(section.op);
  break;
case "message":
  html += renderMessage(section.msg);
  break;
```

改为：

```typescript
case "operation":
  html += renderDocCard(section.op, "http");
  break;
case "message":
  html += renderDocCard(section.msg, "mq");
  break;
```

- [ ] **Step 5: 补充 MessageDefinition import**

html-emit.ts 第 6 行已有 `ApiOperation` 的 import，在同一行加入 `MessageDefinition`：

```typescript
import type { ApiOperation, MessageDefinition } from "../types";
```

- [ ] **Step 6: 编译验证**

Run: `cd /Volumes/dlp/workspace/skills/skills/api-doc && npx tsc --noEmit`

预期：PASS，零错误。

- [ ] **Step 7: 端到端构建验证**

Run: `cd /Volumes/dlp/workspace/skills/skills/api-doc && npx tsx scripts/index.ts build samples/tms -o /tmp/api-doc-test`

预期：HTML 文件成功生成在 `/tmp/api-doc-test`。

- [ ] **Step 8: Commit**

```bash
cd /Volumes/dlp/workspace/skills
git add skills/api-doc/scripts/pipeline/emit/html-emit.ts
git commit -m "refactor(api-doc): unify renderOperation/renderMessage into renderDocCard"
```

---

### Task 4: CSS 层统一

**Files:**
- Modify: `skills/api-doc/scripts/templates/styles.css`

- [ ] **Step 1: 统一卡片容器 class**

将 `.api-section`（27 行）的 class 名改为 `.doc-card`：

```css
.doc-card{background:var(--doc-section-bg);border-radius:8px;box-shadow:0 2px 8px var(--doc-section-shadow);margin-bottom:30px;overflow:hidden}
```

删除 `.message-section`（124 行），它与 `.api-section` 完全一样。

- [ ] **Step 2: 统一侧边栏链接样式**

删除以下重复规则（126-130 行）：
```css
.toc-message-link{...}
.toc-message-link:hover{...}
.toc-message-link.active{...}
```

将 `.toc-link-deprecated`（121 行）和 `.toc-message-link-deprecated`（129 行）合并为：

```css
.toc-link.deprecated{color:var(--doc-text-muted)!important;text-decoration:line-through!important}
```

- [ ] **Step 3: 删除冗余样式**

- 删除 `.meta-block-mq-topic`（125 行），复用已有的 `.meta-block-wide`（84 行）
- 删除 `.mq-badge`（130 行），与 `.toc-tag-mq` 功能重复

- [ ] **Step 4: 编译和构建验证**

Run: `cd /Volumes/dlp/workspace/skills/skills/api-doc && npx tsc --noEmit && npx tsx scripts/index.ts build samples/tms -o /tmp/api-doc-test`

预期：PASS。

- [ ] **Step 5: Commit**

```bash
cd /Volumes/dlp/workspace/skills
git add skills/api-doc/scripts/templates/styles.css
git commit -m "refactor(api-doc): unify CSS classes, remove duplicate styles"
```

---

### Task 5: JS 层适配新 class 名

**Files:**
- Modify: `skills/api-doc/scripts/templates/scripts.js`

- [ ] **Step 1: 更新 IntersectionObserver 选择器**

将 39 行的：

```javascript
document.querySelectorAll('.api-section,.message-section').forEach(s=>observer.observe(s));
```

改为：

```javascript
document.querySelectorAll('.doc-card').forEach(s=>observer.observe(s));
```

- [ ] **Step 2: 更新侧边栏链接选择器**

将 21、24、33、34 行中的 `.toc-message-link` 引用替换为 `.toc-link`。

21 行改为：
```javascript
document.querySelectorAll('.toc-link').forEach(l=>l.classList.remove('active'));
```

24 行改为：
```javascript
document.querySelectorAll('.toc-link').forEach(l=>{
```

33 行改为：
```javascript
document.querySelectorAll('.toc-link').forEach(l=>l.classList.remove('active'));
```

34 行改为：
```javascript
const activeLink=document.querySelector('.toc-link[href="#'+id+'"]');
```

- [ ] **Step 3: 构建并验证最终输出**

Run: `cd /Volumes/dlp/workspace/skills/skills/api-doc && npx tsx scripts/index.ts build samples/tms -o /tmp/api-doc-test-final`

打开生成的 HTML 文件，验证：
- 侧边栏 HTTP/MQ 链接均可点击并正常滚动
- 点击后高亮状态正确
- 滚动时 IntersectionObserver 正确激活对应链接
- HTTP 卡片显示方法和路径
- MQ 卡片显示 Topic
- deprecated 标记正常显示

- [ ] **Step 4: Commit**

```bash
cd /Volumes/dlp/workspace/skills
git add skills/api-doc/scripts/templates/scripts.js
git commit -m "refactor(api-doc): update JS selectors for unified class names"
```

---

### Task 6: 端到端验证与清理

- [ ] **Step 1: 最终构建验证**

Run: `cd /Volumes/dlp/workspace/skills/skills/api-doc && npx tsx scripts/index.ts build samples/tms -o /tmp/api-doc-final`

- [ ] **Step 2: 检查生成的 HTML**

Run: `cat /tmp/api-doc-final/*.html | grep -c 'doc-card'`

预期：大于 0（HTTP 和 MQ 卡片都使用 `doc-card` class）。

Run: `cat /tmp/api-doc-final/*.html | grep -c 'api-section\|message-section\|toc-message-link'`

预期：0（旧 class 名不应再出现）。

Run: `cat /tmp/api-doc-final/*.html | grep -c 'data-protocol'`

预期：0（sidebar 中使用 `toc-tag-http`/`toc-tag-mq` class 区分，不需要 data-protocol 属性）。

- [ ] **Step 3: Commit（如有残留改动）**

```bash
cd /Volumes/dlp/workspace/skills
git add -A skills/api-doc
git diff --cached --stat
git commit -m "chore(api-doc): final cleanup after protocol unification"
```
