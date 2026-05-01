# api-doc 架构说明

面向 skill 开发者。如需了解使用方法，参见 [SKILL.md](SKILL.md)。

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
├── ARCHITECTURE.md       # 本文件：开发者文档
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
    │   └── scripts.js    # JS（内联到输出）
    └── themes/
        └── light.css     # light 主题 CSS 变量覆盖
```

## 核心类型（adapters/types.ts）

```typescript
ParsedApiDoc    // 根文档：title, version, groups, headerSnippets, footerSnippets
ApiGroup        // 分组：name, operations[]
ApiOperation    // 接口：verb, path, parameters[], body?, responses[], examples[], versionTags[]
ApiParameter    // 参数：name, type, location, doc, required, constraints
ApiBody         // 请求体：type, contentType
ApiResponse     // 响应：statusCode, type?, isError
ApiType         // 类型系统：string | number | boolean | enum | union | array | object | scalar | any
ApiProperty     // 对象属性：name, type, doc, required, constraints, fixedValue, defaultValue, conditionalRequired
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

1. `findMainFile()` — 按优先级查找入口文件
2. `compile(NodeHost, mainFile)` — 调用 TypeSpec 编译器
3. `getAllHttpServices()` — 提取 HTTP 服务
4. 分组策略：取 operation 所在 namespace 最后一段；无 namespace 时用文件名
5. `resolveType()` — 递归解析类型系统（支持 Model、Enum、Union、Array、Scalar、继承）
6. `extractDocExamples()` — 从 `@opExample` decorator 提取示例数据
7. `extractDocRequired()` — 从 `@docRequired` decorator 提取条件必填说明
7. `collectInheritedProperties()` — 按 base chain 收集继承属性

### cURL 生成（curl-pipeline.ts）

- 为每个 operation 生成带占位符的 cURL（`{string}`, `{token}`, `{baseUrl}`）
- 为每个 example 生成带实际数据的 cURL

### HTML 渲染（renderers/html/index.ts）

- 插件系统：text、badge、tag、code、link、copy
- 内置简易 Markdown → HTML 转换器
- 模板变量：`{{title}}`, `{{styles}}`, `{{scripts}}`, `{{sidebar_content}}`, `{{api_content}}`, `{{version}}`

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
