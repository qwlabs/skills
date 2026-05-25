# api-doc 协议统一重构设计

## 背景

api-doc 原本只支持 HTTP，后来增加了 MQ (RocketMQ) 支持。MQ 的加入通过在多个文件中复制 HTTP 的逻辑并做少量修改实现，导致大量代码重复和不对称的命名。未来还计划支持 gRPC、WebSocket、Kafka 等更多协议类型。

## 坏味道清单

| # | 坏味道 | 位置 | 影响 |
|---|--------|------|------|
| 1 | `renderSidebar` 中 operation-link 和 message-link 逻辑重复 | html-emit.ts:40-61 | 新增协议需复制第三遍 |
| 2 | `renderOperation` 和 `renderMessage` 卡片结构大量重复 | html-emit.ts:91-213 | 新增协议需复制第三遍 |
| 3 | `.toc-message-link` 与 `.toc-link` 样式完全重复 | styles.css:126-130 | 维护两份一样的样式 |
| 4 | tag 颜色硬编码在渲染函数中 | html-emit.ts:96,178 | 绕过了 tag.ts 的统一系统 |
| 5 | `SidebarEntry.tag` 是松散字符串，无类型约束 | types.ts:144 | protocol 和 kind 之间的隐式耦合容易漏改 |
| 6 | CSS class 命名不对称（HTTP 为默认，MQ 为特例） | styles.css | 新增协议时命名困难 |

## 方案：协议感知的统一抽象

### 1. 类型层

新增 `ProtocolKind` 联合类型：

```typescript
export type ProtocolKind = "http" | "mq";
```

改造 `SidebarEntry`，合并 `operation-link` 和 `message-link` 为 `doc-link`：

```typescript
export interface SidebarEntry {
  kind: "group-title" | "doc-link" | "snippet-link";
  label: string;
  anchorId?: string;
  protocol: ProtocolKind;
  deprecated?: DeprecationDetails;
}
```

`ContentSection` 保持 discriminated union 不变（`operation` 和 `message` 数据结构差异大）。

`ApiGroup` 的 `operations` 和 `messages` 字段也保持不变。

### 2. 渲染层

#### 协议元数据配置

```typescript
const PROTOCOL_META: Record<ProtocolKind, {
  sectionClass: string;
  tagLabel: string;
  tagColor: string;
}> = {
  http: { sectionClass: "doc-card", tagLabel: "HTTP", tagColor: "var(--doc-tag-post)" },
  mq:   { sectionClass: "doc-card", tagLabel: "MQ",   tagColor: "var(--doc-tag-mq)" },
};
```

#### 卡片渲染合并

`renderOperation` 和 `renderMessage` 合并为 `renderDocCard(data, protocol)`。

统一骨架：
1. section 容器 (meta.sectionClass)
2. 标题 + tag 标签 (meta.tagLabel, meta.tagColor)
3. deprecated banner（共享）
4. 元数据区域 — http: Method+Path，mq: Topic
5. version tags（共享）
6. 参数/消息结构表格（共享 table 渲染，section-title 不同）
7. examples（共享）
8. 错误响应（仅 http）

```typescript
case "operation": html += renderDocCard(section.op, "http"); break;
case "message":   html += renderDocCard(section.msg, "mq");  break;
```

#### 侧边栏渲染合并

`renderSidebar` 中 operation-link 和 message-link 合并为 doc-link 单一 case，CSS class 通过 `data-protocol` 属性区分。

### 3. CSS 层

| 之前 | 之后 | 原因 |
|------|------|------|
| `.api-section` + `.message-section` | `.doc-card` | 样式完全一样 |
| `.toc-link` + `.toc-message-link` | `.toc-link` | 样式完全一样 |
| `.toc-link-deprecated` + `.toc-message-link-deprecated` | `.toc-link.deprecated` | 样式完全一样 |
| `.meta-block-mq-topic` | `.meta-block-wide`（已有） | 定义完全重复 |
| `.mq-badge` | 删除 | 与 `.toc-tag-mq` 功能重复 |

侧边栏 HTML 输出改为 `<a class="toc-link" data-protocol="mq">`。

## 改动文件清单

| 文件 | 改动内容 |
|------|----------|
| `scripts/pipeline/types.ts` | 新增 `ProtocolKind`，修改 `SidebarEntry` |
| `scripts/pipeline/stages/sidebar-build.ts` | `operation-link`/`message-link` → `doc-link` + `protocol` |
| `scripts/pipeline/emit/html-emit.ts` | 合并 sidebar 渲染 case，合并 `renderOperation`/`renderMessage` 为 `renderDocCard` |
| `scripts/templates/styles.css` | 删除重复样式，统一 class 名 |
| `scripts/templates/scripts.js` | IntersectionObserver 选择器适配新 class 名 |

## 不改动的部分

- `ContentSection` 类型 — 保持 operation/message discriminated union
- `ApiGroup` 类型 — 保持 operations/messages 分开
- `ApiOperation` / `MessageDefinition` 接口 — 字段差异大，不合并
- `typespec-parse.ts` — 解析逻辑与渲染无关，不动
- `section-build.ts` — 构建逻辑不变
