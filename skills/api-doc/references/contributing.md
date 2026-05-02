# api-doc 开发指南

面向 skill 开发者和 AI 助手。如需了解使用方法，参见 [SKILL.md](../SKILL.md)；如需了解 TypeSpec 编写方式，参见 [guide.md](guide.md)。

## 三层流水线

```
Input → Adapter.parse() → Pipeline.process() → Renderer.render() → Output
```

| 层 | 职责 | 当前实现 |
|----|------|----------|
| Adapter | 解析输入格式 → `ParsedApiDoc` | typespec-adapter |
| Pipeline | 中间处理，变换 `ParsedApiDoc` | snippet-pipeline, curl-pipeline |
| Renderer | 输出渲染 | html-renderer |

## 目录结构

```
api-doc/
├── SKILL.md              # 使用者文档
├── references/
│   ├── guide.md          # TypeSpec 编写指南
│   └── contributing.md   # 本文件：开发者文档
├── package.json          # 依赖与脚本
├── tsconfig.json
├── bunfig.toml           # bun 配置（npmmirror 源）
├── samples/tms/          # 示例 TypeSpec 项目
└── scripts/
    ├── index.ts          # CLI 入口：参数解析 → 流水线编排 → 写文件
    ├── adapters/
    │   ├── types.ts      # Adapter 接口 + 全部共享类型定义
    │   └── typespec-adapter.ts  # TypeSpec 编译与解析
    ├── pipelines/
    │   ├── types.ts      # Pipeline 接口
    │   ├── snippet-pipeline.ts  # Markdown 片段注入
    │   └── curl-pipeline.ts     # cURL 命令生成
    ├── renderers/
    │   ├── types.ts      # Renderer 接口
    │   └── html/
    │       ├── index.ts      # HTML 渲染主逻辑
    │       ├── loader.ts     # 插件加载器
    │       ├── registry.json # 插件注册表
    │       └── *.ts          # 渲染插件（badge, tag, code, link, copy, text）
    ├── templates/
    │   ├── template.html # HTML 骨架（{{title}} 等占位符）
    │   ├── styles.css    # CSS（内联到输出）
    │   ├── scripts.js    # JS（内联到输出）
    │   └── vendor/       # highlight.js 库
    └── themes/
        └── light.css     # light 主题 CSS 变量覆盖
```

## 核心类型（adapters/types.ts）

```typescript
ParsedApiDoc    // 根文档：title, version, groups, headerSnippets, footerSnippets
ApiGroup        // 分组：name, operations[]
ApiOperation    // 接口：verb, path, parameters[], body?, responses[], examples[], versionTags[], curlCommand?
ApiParameter    // 参数：name, type, location, doc, example, required, defaultValue, constraints
ApiBody         // 请求体：type, contentType, doc
ApiResponse     // 响应：statusCode, type?, description, isError
ApiType         // 类型系统：string | number | boolean | integer | float | datetime | uuid | enum | union | array | object | scalar | any
ApiProperty     // 对象属性：name, type, doc, example, required, defaultValue, fixedValue, conditionalRequired, constraints, versionTags
ApiConstraints  // 约束：minimum, maximum, minLength, maxLength, pattern
VersionTag      // 版本标签：type ("added" | "removed"), version
ApiExample      // 示例：name, request?, response, curlCommand?
MarkdownSnippet // 片段：name, content
```

## 扩展点

### 添加新适配器

1. 在 `adapters/` 下创建文件，实现 `Adapter` 接口：
   ```typescript
   interface Adapter {
     readonly name: string;
     detect(inputDir: string): boolean;
     parse(inputDir: string): Promise<ParsedApiDoc>;
   }
   ```
2. 在 `index.ts` 的 `adapters` 数组中注册

### 添加新 Pipeline

1. 在 `pipelines/` 下创建文件，实现 `Pipeline` 接口：
   ```typescript
   interface Pipeline {
     readonly name: string;
     process(doc: ParsedApiDoc, ctx: PipelineContext): ParsedApiDoc;
   }
   ```
2. 在 `index.ts` 的 `pipelines` 数组中注册

### 添加新渲染插件

1. 在 `renderers/html/` 下创建文件，实现 render 函数：
   ```typescript
   export function render(value: unknown): string
   ```
2. 在 `registry.json` 中注册

### 添加新主题

在 `themes/` 下创建 CSS 文件，通过 CSS 变量覆盖默认值。可用变量参见 `templates/styles.css` 中的 `:root` 定义。

使用方式：`--theme <name>`（不带 `.css` 后缀）或 `--theme-file <path>` 指定自定义路径。

## 关键实现细节

### TypeSpec 解析流程（typespec-adapter.ts）

1. `findMainFile()` — 按优先级查找入口文件（index.tsp → main.tsp → 第一个 .tsp）
2. `compile(NodeHost, mainFile)` — 调用 TypeSpec 编译器
3. `getAllHttpServices()` — 提取 HTTP 服务
4. `buildOpSourceFile()` — 构建操作到源文件的映射（namespace @doc > 路径推导）
5. `groupOperationsByFile()` — 分组：@doc(namespace) > 子目录用父目录名 / 根目录用文件名 > "默认"
6. `extractOperation()` — 提取接口：@doc(operation) > 文件名（去 .tsp）> op.name
7. `resolveType()` — 递归解析类型系统（支持 Model、Enum、Union、Array、Scalar、继承、模板声明 → any）
8. `resolveScalarBase()` — Scalar 基础类型映射（int32/int64 → integer, float/double → float, datetime → datetime, uuid → uuid）
9. `extractDocExamples()` — 从 `@opExample` 提取示例数据，包含 EnumMember/EnumValue 深拷贝处理（`deepCloneValue()`）
10. `extractRequiredIf()` — 从 AST 节点提取 `@requiredIf` 条件必填说明（非标准 TypeSpec decorator，通过 AST 解析）
11. `collectInheritedProperties()` — 按 base chain 收集继承属性，子类属性覆盖父类
12. `getExampleValue()` — 从 `@example` decorator 提取示例值

### cURL 生成（curl-pipeline.ts）

- `generateCurl()` — 为每个 operation 生成带占位符的 cURL（`{string}`, `{token}`, `{baseUrl}`）
- `generateExampleCurl()` — 为每个 example 生成带实际数据的 cURL
- `generatePlaceholder()` — 为每种 ApiType 生成示例值

### HTML 渲染（renderers/html/index.ts）

- 插件系统：text、badge、tag、code、link、copy
- 内置简易 Markdown → HTML 转换器（支持标题、表格、代码块、列表、链接、加粗、斜体）
- 模板变量：`{{title}}`, `{{hljs_theme}}`, `{{hljs}}`, `{{styles}}`, `{{scripts}}`, `{{sidebar_content}}`, `{{api_content}}`, `{{version}}`

## 构建与调试

```bash
# 安装依赖
bun install

# 生成示例文档
bun run scripts/index.ts samples/tms output.html

# 指定主题
bun run scripts/index.ts samples/tms output.html --theme light
```

无构建步骤，直接通过 `bun run` 执行 TypeScript。
