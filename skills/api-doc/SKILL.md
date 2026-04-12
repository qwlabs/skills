---
name: api-doc
description: >
  Convert API documentation from Markdown to beautiful HTML.
  Supports multi-file input, global metadata inheritance, JSON Schema
  for parameter definitions, and version timestamps. Use when users want
  to generate API documentation from markdown files.
triggers:
  - "生成API文档"
  - "生成HTML"
  - "markdown转html"
  - "api doc"
  - "接口文档"
---

# API Documentation Generator

## Quick Start

```bash
bun run .opencode/skills/api-doc/scripts/converter.ts <input> <output-html>
```

Where `<input>` can be:
- A **single markdown file**: `./docs/api.md`
- A **directory** with multiple API files (recommended for large projects)

## Directory Structure (Recommended)

```
docs/api/
├── index.md              # Entry file (overall description + global metadata)
├── user/                 # Auto-derived group name from directory
│   ├── list.md          # User list API
│   └── create.md        # Create user API
└── order/
    ├── list.md           # Order list API
    └── detail.md         # Order detail API
```

**Key features:**
- Group names are auto-derived from directory structure (like Vue file-based routing)
- Global metadata is defined in `index.md`, individual APIs can override specific fields
- No need to repeat common metadata (provider, protocol, path) in every API file

## index.md - Global Metadata Defaults

Define common metadata **with values** in `index.md`. These become defaults for all APIs:

```markdown
---
metadata:
  provider:  { value: WMS, render: text, title: 提供方 }
  protocol:  { value: HTTP, render: badge, title: 接口协议 }
  path:      { value: /api, render: code, title: 请求路径 }
  method:    { value: GET, render: tag, title: 请求方法 }
---

### 整体说明
- 整体描述...
```

## API File Format (Minimal)

Most APIs only need `title` and `metadata: {}` (empty). They automatically inherit all values from `index.md`:

```markdown
---
title: 创建入库单
metadata:
---

## 应用场景
- 业务系统需要对仓储进行入库时请求

## 请求前置条件
- 无

## 请求后结果
- 库存量增加

## 请求参数
```yaml
type: object
properties:
  code:
    type: string
    description: 入库单编码
required: [code]
```

## 请求示例
```json
{
  "code": "IN202401010001"
}
```

## 响应参数
```yaml
type: object
properties:
  code:
    type: integer
    description: 状态码
  data:
    type: object
    description: 数据对象
```

## 响应示例
```json
{
  "code": 200,
  "message": "success",
  "data": {}
}
```

## Override Global Defaults

If an API differs from global defaults, provide only the changed fields:

```markdown
---
title: 创建用户
metadata:
  method: POST    # Simple value → uses global render config
---
```

Or override render style too with full object:

```markdown
---
title: WebSocket接口
metadata:
  method: { value: WS, render: badge }  # Override value AND render
---
```

## Metadata Format

Each metadata field supports `value`, `render`, and optional `title`:

```yaml
metadata:
  fieldName: { value: xxx, render: text, title: 显示标题 }
```

| Render Type | Description |
|-------------|-------------|
| `text` | Plain text (default) |
| `badge` | Colored badge |
| `tag` | Colored tag (method colors: GET=green, POST=blue, PUT=orange, DELETE=red) |
| `code` | Inline code style |
| `link` | Clickable link |
| `copy` | Copyable code block |

## Output Features

- Sidebar grouped by API category (from directory structure)
- Complete metadata display with custom titles
- Parameter tables with type, required, description, constraints
- JSON Schema constraints (enum, pattern, maximum, etc.)
- Request/response examples with syntax highlighting
- **Version timestamp** in footer: `v1.0.0-YYYYMMDD-HHMMSS`
- Responsive design with sidebar toggle

## Dependencies

- Node.js built-in modules: `fs`, `path`
