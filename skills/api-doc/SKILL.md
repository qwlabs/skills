---
name: api-doc
description: >
  Generate single-file HTML API documentation from API definition files.
  Supports TypeSpec input with auto-generated curl examples, parameter
  tables, and version tags. Use when users want to generate API
  documentation. Extensible via Adapter/Pipeline/Renderer layers.
triggers:
  - "生成API文档"
  - "生成HTML"
  - "api doc"
  - "接口文档"
  - "typespec doc"
---

# API Documentation Generator

Generates single-file self-contained HTML API documentation.

## Quick Start

```bash
bun start <input-dir> <output.html>
```

Options:
- `--adapter <name>` — force specific input adapter (default: auto-detect)

## Architecture

Three-layer pipeline: **Adapter → Pipeline → Renderer**

```
Input → Adapter.parse() → Pipeline.process() → Renderer.render() → Output
```

### Adapter（输入适配）
Parses input format into `ParsedApiDoc`. Currently supports TypeSpec.

### Pipeline（中间处理）
Transforms `ParsedApiDoc` between parsing and rendering:
- **snippet** — injects header/footer markdown snippets
- **curl** — pre-generates curl commands for each operation

### Renderer（输出渲染）
Converts `ParsedApiDoc` to output format. Currently supports HTML.

## Directory Structure

```
api-doc/
  SKILL.md                 # Skill documentation
  package.json             # Dependencies & scripts
  samples/                 # Sample TypeSpec API
  scripts/                 # Executable code
    index.ts               # CLI entry point
    adapters/              # Input adapters
      types.ts             # Adapter interface + shared types
      typespec-adapter.ts  # TypeSpec adapter
    pipelines/             # Middle processing
      types.ts             # Pipeline interface
      snippet-pipeline.ts  # Snippet injection
      curl-pipeline.ts     # Curl generation
    renderers/             # Output renderers
      types.ts             # Renderer interface
      html/                # HTML renderer
        index.ts           # Main renderer
        loader.ts          # Plugin loader
        registry.json      # Plugin registry
        *.ts               # Render plugins
    templates/             # Template files
      template.html        # HTML structure
      styles.css           # CSS (inlined on output)
      scripts.js           # JS (inlined on output)
```

## Input: TypeSpec

```
my-api/
├── index.tsp         # Shared models, service definition, imports
├── 用户管理.tsp      # 一个文件 = 一个分组
└── 订单管理.tsp
```

`index.tsp` imports group files and defines the service:

```typespec
import "@typespec/http";
import "./用户管理.tsp";

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
```

Each group file defines operations in a sub-namespace:

```typespec
namespace MyAPI.用户管理;

using TypeSpec.Http;

@doc("创建用户")
@route("/users")
@post
op createUser(
  @header authorization: string,
  @body body: CreateUserRequest
): ApiResponse<User> | Error;
```

## Key Decorators

| Decorator | Purpose |
|-----------|---------|
| `@doc("...")` | Description text |
| `@service(#{title: "..."})` | Service name |
| `@route("/...")` | API path |
| `@get/@post/@put/@delete/@patch` | HTTP method |
| `@header/@query/@path/@body` | Parameter location |
| `@minValue(n)/@maxValue(n)` | Numeric constraints |
| `@minLength(n)/@maxLength(n)` | String length constraints |
| `@pattern("...")` | Regex pattern constraint |

## Output Features

- Single self-contained HTML file (CSS/JS inlined)
- Dark sidebar with grouped navigation
- Parameter tables with type, constraints, required status
- Auto-generated curl examples
- Syntax highlighting (highlight.js)
- Responsive design with sidebar toggle

## Dependencies

- `@typespec/compiler` — TypeSpec compiler
- `@typespec/http` — HTTP decorators
