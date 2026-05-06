---
name: api-doc
description: >
  当需要从 TypeSpec (.tsp) 文件生成单文件 HTML API 文档时使用此 skill。
  支持自动生成 curl 示例、参数表格、版本标签、Markdown 片段注入。
  触发词：生成 API 文档、生成接口文档、api doc、typespec doc、生成 HTML 文档。
---

# api-doc

从 TypeSpec 定义生成单文件、自包含的 HTML API 文档。

## 能力

- 从 TypeSpec (.tsp) 文件解析 API 定义
- 自动生成 cURL 示例
- 参数表格（类型、约束、必填状态）
- 版本标签（`@added` / `@removed`）
- 条件必填字段（`@requiredIf`）
- 条件选填字段（`@optionalIf`）
- 枚举成员说明（enum `@doc` 自动渲染）
- 交互式请求/响应示例（`@opExample`）
- Markdown 片段注入（header / footer）
- 语法高亮（highlight.js）
- 主题支持（内置 light 主题，支持自定义 CSS）

## 安装

**必须使用 bun，禁止使用 npm。**

```bash
bun install
```

验证安装：

```bash
bun run scripts/index.ts --help
```

## 使用

```bash
bun run scripts/index.ts <input-dir> [output] [--theme <name>] [--theme-file <path>]
```

- `<input-dir>` — 包含 `.tsp` 文件的目录（必填）
- `[output]` — 输出文件路径（可选，默认 `<input-dir>/../<dirName>-<revision>.html`）

### 选项

| 选项 | 说明 |
|------|------|
| `--theme <name>` | 使用预设主题（当前可用：`light`） |
| `--theme-file <path>` | 使用自定义 CSS 主题文件 |

### 示例

```bash
# 默认输出
bun run scripts/index.ts ./samples/tms

# 指定输出路径
bun run scripts/index.ts ./samples/tms ./output.html

# 使用 light 主题
bun run scripts/index.ts ./samples/tms --theme light
```

## 参考文档

| 文档 | 内容 |
|------|------|
| [编写指南](references/guide.md) | 输入目录结构、版本配置、分组规则、Decorator 速查、模型定义、Markdown 片段 |
| [开发指南](references/contributing.md) | Stage Pipeline、核心类型、扩展点、开发者指南 |
