# Input Format Specification - API Documentation

## Directory Structure

```
docs/api/
├── index.md              # Entry file + global metadata defaults
├── user/
│   ├── list.md          # API: just title + body, inherits global metadata
│   └── create.md        # API: can override specific metadata if needed
└── order/
    └── list.md          # API: same pattern
```

**Rules:**
- `index.md` and `README.md` are skipped during file scan (entry points)
- Directories starting with `_` are skipped
- **Group name** is derived from the parent directory name (like Vue file-based routing)
- Files are sorted alphabetically for consistent ordering

---

## index.md - Global Metadata Defaults

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

Define default values AND render style in `index.md`. All APIs inherit these.

---

## API File Format

```markdown
---
title: 接口名称
metadata:    # Empty = inherit all from index.md
---

## 应用场景
- 场景1

## 请求前置条件
- 条件1
```

**No metadata needed!** All values are inherited from `index.md`.

To override a specific field:
```markdown
---
title: 创建用户
metadata:
  method: POST    # Override method only, keep others from index.md
---
```

Or use full object to also override render style:
```markdown
---
title: 特殊接口
metadata:
  method: { value: WS, render: badge, title: 协议 }  # Override value AND render
---
```

## 请求参数 (Schema)
```yaml
type: object
properties:
  fieldName:
    type: string
    description: 字段说明
    default: 默认值
    enum: [A, B, C]
    pattern: "^[A-Z]+$"
    maximum: 100
    minimum: 0
    maxLength: 50
    required: true
required: [fieldName]
```

## 请求示例
```json
{
  "fieldName": "value"
}
```

## 响应参数 (Schema)
```yaml
type: object
properties:
  code:
    type: integer
    description: 状态码
  data:
    type: object
    description: 数据对象
    properties:
      ...
```

## 响应示例
```json
{
  "code": 200,
  "message": "success",
  "data": {}
}
```

The first-level list items after `### 整体说明` define the top-level navigation groups.

---

## JSON Schema Format

### Supported Properties

| Property | Type | Description |
|----------|------|-------------|
| type | string | Data type: `string`, `integer`, `number`, `boolean`, `object`, `array` |
| description | string | Field description |
| default | any | Default value |
| enum | array | Allowed values |
| pattern | string | Regex pattern (for string) |
| maximum | number | Max value (for number) |
| minimum | number | Min value (for number) |
| maxLength | integer | Max string length |
| required | boolean | Whether field is required |
| items | object | For array type, defines item schema |
| properties | object | For object type, defines nested fields |

### Example Schema

```yaml
type: object
properties:
  id:
    type: integer
    description: 用户ID
    required: true
  name:
    type: string
    description: 用户名称
    default: "匿名"
    maxLength: 50
  status:
    type: string
    description: 状态
    enum: [active, inactive]
    default: active
  tags:
    type: array
    description: 标签列表
    items:
      type: string
  profile:
    type: object
    description: 用户档案
    properties:
      age:
        type: integer
        description: 年龄
      email:
        type: string
        description: 邮箱
required: [id]
```

---

## Examples Section

### 请求示例 / 响应示例

Pure JSON (can be auto-generated from Schema):

```json
{
  "id": 1,
  "name": "张三",
  "status": "active",
  "tags": ["vip", "test"],
  "profile": {
    "age": 30,
    "email": "zhang@example.com"
  }
}
```

### 响应示例

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": 1,
    "name": "张三"
  }
}
```

---

## Metadata Fields

### Required

| Field | Pattern | Description |
|-------|---------|-------------|
| 请求路径 | `- 请求路径:` | API endpoint path |
| 请求方法 | `- 请求方法:` | POST, GET, PUT, DELETE |

### Optional

| Field | Pattern | Description |
|-------|---------|-------------|
| 分组 | `- 分组:` | API category (overridden by directory name) |
| 提供方 | `- 提供方:` | System/provider name |
| 接口协议 | `- 接口协议:` | HTTP or HTTPS |
| 应用场景 | `- 应用场景:` + `  - item` | Use cases |
| 请求前置条件 | `- 请求前置条件:` + `  - item` | Pre-conditions |
| 请求后结果 | `- 请求后结果:` + `  - item` | Expected outcomes |

---

## Version Timestamp

The generated HTML includes a version timestamp in the footer:
```
v1.0.0-YYYYMMDD-HHMMSS
```

Example: `v1.0.0-20250412-184530`

---

## AI-Assisted Features

Because the Schema is AI-readable:

1. **Auto-generate examples**: Ask AI to generate valid request/response examples based on the schema
2. **Validate examples**: Check if examples conform to the schema constraints
3. **Expand schemas**: Ask AI to add more constraints (validation rules, enum values, etc.)

---

## File Naming Convention

For best organization:
- Use lowercase names with hyphens: `user-list.md`, `order-create.md`
- Group related APIs in directories: `user/`, `order/`, `inventory/`
- Use `index.md` as the entry point only
