---
name: api-doc
description: >
  Generate single-file HTML API documentation from TypeSpec definitions.
  Supports auto-generated curl examples from @example decorators,
  parameter tables with constraints, and version tags. Use when users want
  to generate API documentation from TypeSpec (.tsp) files.
triggers:
  - "生成API文档"
  - "生成HTML"
  - "api doc"
  - "接口文档"
  - "typespec doc"
---

# API Documentation Generator

Generates single-file HTML API documentation from TypeSpec definitions.

## Quick Start

```bash
bun run skills/api-doc/scripts/converter.ts <input-dir> <output.html>
```

## Input: TypeSpec Directory

```
my-api/
├── main.tsp         # Shared models, service definition, imports
├── 用户管理.tsp      # 一个文件 = 一个分组（文件名即分组名）
└── 订单管理.tsp
```

`main.tsp` must import all group `.tsp` files explicitly:

```typespec
import "@typespec/http";
import "./用户管理.tsp";
import "./订单管理.tsp";

using TypeSpec.Http;

@doc("My API Service")
@service(#{title: "My API"})
@route("/api")
namespace MyAPI;

model ApiResponse<T> {
  code: int32;
  message: string;
  data?: T;
}

model Error {
  code: int32;
  message: string;
}
```

## Group File Format

Each group file defines models and operations within a sub-namespace. The namespace suffix becomes the group name in the sidebar:

```typespec
namespace MyAPI.用户管理;

using TypeSpec.Http;

model CreateUserRequest {
  @doc("用户名")
  name: string;

  @doc("邮箱")
  email: string;
}

model User {
  id: string;
  name: string;
  email: string;
}

@doc("创建用户")
@route("/users")
@post
op createUser(
  @header authorization: string,
  @body body: CreateUserRequest
): ApiResponse<User> | Error;

@doc("查询用户列表")
@route("/users")
@get
op listUsers(
  @header authorization: string,
  @query page?: int32,
  @query pageSize?: int32
): ApiResponse<User[]> | Error;
```

## Key Decorators

| Decorator | Purpose |
|-----------|---------|
| `@doc("...")` | Description text |
| `@service(#{title: "..."})` | Service name |
| `@route("/...")` | API path (on namespace or operation) |
| `@get/@post/@put/@delete/@patch` | HTTP method |
| `@header/@query/@path/@body` | Parameter location |
| `@minValue(n)/@maxValue(n)` | Numeric constraints |
| `@minLength(n)/@maxLength(n)` | String length constraints |
| `@pattern("...")` | Regex pattern constraint |

## Output Features

- Single self-contained HTML file
- Dark sidebar with grouped navigation
- Parameter tables with type, constraints, required status
- Auto-generated curl examples for each operation
- Syntax highlighting (highlight.js)
- Responsive design with sidebar toggle
- Version timestamp in footer
- Plugin-based render system (`scripts/renders/`)

## Dependencies

- `@typespec/compiler` (TypeScript TypeSpec compiler)
- `@typespec/http` (HTTP decorators library)
