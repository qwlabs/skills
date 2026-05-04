# api-doc 开发指南

面向 skill 开发者和 AI 助手。如需了解使用方法，参见 [SKILL.md](../SKILL.md)；如需了解 TypeSpec 编写方式，参见 [guide.md](guide.md)。

## 统一 Stage Pipeline

```
Input → Stage Pipeline → Output
```

所有处理步骤（解析、增强、结构构建、资源加载、格式输出）统一为 Stage，通过 `StageContext` 共享数据。

```typescript
interface Stage {
  readonly name: string;
  process(ctx: StageContext): void | Promise<void>;
}

interface StageContext {
  doc: ParsedApiDoc;      // 解析后的 API 文档
  model: DocumentModel;   // 累积的文档模型
  config: StageConfig;    // 运行时配置
}
```

### Pipeline 阶段

| # | 阶段 | 职责 | requires | provides |
|---|------|------|----------|----------|
| 1 | typespec-parse | 编译 .tsp 文件，填充 ParsedApiDoc | — | `doc.api`, `model.meta` |
| 2 | snippet-inject | 加载 header/footer Markdown 片段 | `doc.api` | `doc.snippets` |
| 3 | curl-generate | 为 operation 和 example 生成 cURL 命令 | `doc.api` | `doc.curl` |
| 4 | sidebar-build | 构建侧边栏导航结构 | `doc.api`, `doc.snippets` | `model.sidebar` |
| 5 | section-build | 构建内容段落列表（snippet/operation/footer） | `doc.api`, `doc.snippets`, `doc.curl` | `model.sections` |
| 6 | asset-load | 加载 CSS/JS/hljs 等资源 | — | `model.assets` |
| 7 | html-emit | 将 DocumentModel 序列化为 HTML | `model.sidebar`, `model.sections`, `model.assets`, `model.meta` | `model.output` |

Runner 根据 `requires`/`provides` 构建有向无环图（DAG），自动拓扑排序并并发执行无依赖冲突的 stage。

### DocumentModel

```typescript
interface DocumentModel {
  meta: { title: string; version: string };
  sidebar: SidebarEntry[];
  sections: ContentSection[];
  assets: DocumentAssets;
}
```

`ContentSection` 使用可辨识联合（discriminated union），将结构信息保留到最终输出阶段：
- `{ kind: "snippet" }` — Markdown 片段（存储原始 markdown 内容）
- `{ kind: "operation" }` — API 操作（直接引用 ApiOperation 对象）
- `{ kind: "footer" }` — 页脚版本信息

### 添加新输出格式

只需替换最后的 emit 阶段，前面的阶段完全复用：

```typescript
// 例如添加 Markdown 输出：
import { typespecParse } from "./pipeline/stages/typespec-parse";
import { snippetInject } from "./pipeline/stages/snippet-inject";
import { curlGenerate } from "./pipeline/stages/curl-generate";
import { sidebarBuild } from "./pipeline/stages/sidebar-build";
import { sectionBuild } from "./pipeline/stages/section-build";
import { mdEmit } from "./pipeline/emit/md-emit";

const stages = [typespecParse, snippetInject, curlGenerate, sidebarBuild, sectionBuild, mdEmit];
```

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
    ├── index.ts          # CLI 入口：参数解析 → pipeline 编排 → 写文件
    └── pipeline/
        ├── types.ts      # 全部类型定义（Stage/ParsedApiDoc/DocumentModel 等）
        ├── runner.ts     # runPipeline() 编排函数
        ├── stages/
        │   ├── typespec-parse.ts    # TypeSpec 编译与解析
        │   ├── snippet-inject.ts    # Markdown 片段注入
        │   ├── curl-generate.ts     # cURL 命令生成
        │   ├── sidebar-build.ts     # 侧边栏结构构建
        │   ├── section-build.ts     # 内容段落构建
        │   └── asset-load.ts        # 资源加载
        └── emit/
            ├── html-emit.ts        # HTML 序列化主逻辑
            ├── html-helpers.ts     # escapeHtml, formatType, markdown 转换等
            ├── html-props.ts       # 参数/属性表格渲染
            ├── html-examples.ts    # 示例区块渲染
            ├── loader.ts           # 渲染插件注册表
            ├── base.ts             # RenderFn 接口
            └── *.ts                # 渲染插件（badge, tag, code, link, copy, text）
    ├── templates/
    │   ├── template.html # HTML 骨架（{{title}} 等占位符）
    │   ├── styles.css    # CSS（内联到输出）
    │   ├── scripts.js    # JS（内联到输出）
    │   └── vendor/       # highlight.js 库
    └── themes/
        └── light.css     # light 主题 CSS 变量覆盖
```

## 核心类型（pipeline/types.ts）

```typescript
ParsedApiDoc    // 根文档：title, version, groups, headerSnippets, footerSnippets
ApiGroup        // 分组：name, operations[]
ApiOperation    // 接口：verb, path, parameters[], body?, responses[], examples[], versionTags[], curlCommand?
ApiParameter    // 参数：name, type, location, doc, example, required, defaultValue, constraints
ApiBody         // 请求体：type, contentType, doc
ApiResponse     // 响应：statusCode, type?, description, isError
ApiType         // 类型系统：string | number | boolean | integer | float | datetime | uuid | enum | union | array | object | scalar | any
ApiProperty     // 对象属性：name, type, doc, example, required, defaultValue, fixedValue, conditionalRequired, conditionalOptional, constraints, versionTags
ApiConstraints  // 约束：minimum, maximum, minLength, maxLength, pattern
VersionTag      // 版本标签：type ("added" | "removed"), version
ApiExample      // 示例：name, request?, response, curlCommand?
MarkdownSnippet // 片段：name, content

DocumentModel   // 中间文档：meta, sidebar, sections, assets
SidebarEntry    // 侧边栏：group-title | operation-link | snippet-link
ContentSection  // 内容段：snippet | operation | footer
Stage           // 统一阶段接口
StageContext    // 阶段上下文：doc + model + config
```

## 扩展点

### 添加新输入格式

1. 在 `pipeline/stages/` 下创建新的解析 Stage（如 `openapi-parse.ts`）
2. 在 `index.ts` 中替换 `typespecParse` 为新 Stage

### DataKey 契约

Stage 间通过 `DataKey` 声明数据依赖。可用的 key：

| DataKey | 含义 | 生产者 | 消费者 |
|---------|------|--------|--------|
| `doc.api` | ParsedApiDoc 核心数据 | typespec-parse | snippet-inject, curl-generate, sidebar-build, section-build |
| `doc.snippets` | header/footer Markdown 片段 | snippet-inject | sidebar-build, section-build |
| `doc.curl` | cURL 命令 | curl-generate | section-build |
| `model.meta` | 文档元信息 | typespec-parse | html-emit |
| `model.sidebar` | 侧边栏结构 | sidebar-build | html-emit |
| `model.sections` | 内容段落 | section-build | html-emit |
| `model.assets` | CSS/JS/hljs 资源 | asset-load | html-emit |
| `model.output` | 最终输出 | html-emit | (pipeline 返回值) |

### 添加新 Stage

1. 在 `pipeline/stages/` 下创建文件，实现 `DagStage` 接口：
   ```typescript
   interface DagStage extends Stage {
     readonly requires: readonly DataKey[];  // 此 stage 需要的数据
     readonly provides: readonly DataKey[];  // 此 stage 产出的数据
   }
   ```
2. 声明 `requires`（读哪些数据）和 `provides`（写哪些数据），Runner 会自动推断执行顺序和并发机会
3. 在 `index.ts` 的 `stages` 数组中添加（顺序无关，DAG 决定执行顺序）

### 添加新输出格式

1. 在 `pipeline/emit/` 下创建新的 emit 阶段
2. 读取 `model.sidebar`、`model.sections`，按目标格式序列化
3. 将结果写入 `model.assets.finalOutput`

### 添加新渲染插件

1. 在 `pipeline/emit/` 下创建文件，实现 `RenderFn` 接口（参见 `base.ts`）
2. 在 `loader.ts` 的 `renderMap` 中注册

### 添加新主题

在 `themes/` 下创建 CSS 文件，通过 CSS 变量覆盖默认值。可用变量参见 `templates/styles.css` 中的 `:root` 定义。

使用方式：`--theme <name>`（不带 `.css` 后缀）或 `--theme-file <path>` 指定自定义路径。

## 关键实现细节

### TypeSpec 解析流程（stages/typespec-parse.ts）

1. `findMainFile()` — 按优先级查找入口文件（index.tsp → main.tsp → 第一个 .tsp）
2. `compile(NodeHost, mainFile)` — 调用 TypeSpec 编译器
3. `getAllHttpServices()` — 提取 HTTP 服务
4. `buildOpSourceFile()` — 构建操作到源文件的映射（namespace @doc > 路径推导）
5. `groupOperationsByFile()` — 分组：@doc(namespace) > 子目录用父目录名 / 根目录用文件名 > "默认"
6. `extractOperation()` — 提取接口：@doc(operation) > 文件名（去 .tsp）> op.name
7. `resolveType()` — 递归解析类型系统（支持 Model、Enum、Union、Array、Scalar、继承、模板声明 → any）
8. `resolveScalarBase()` — Scalar 基础类型映射（int32/int64 → integer, float/double → float, datetime → datetime, uuid → uuid）
9. `extractDocExamples()` — 从 `@opExample` 提取示例数据，包含 EnumMember/EnumValue 深拷贝处理（`deepCloneValue()`）
10. `extractRequiredIf()` — 从 AST 节点提取 `@requiredIf` 条件必填说明
11. `extractOptionalIf()` — 从 AST 节点提取 `@optionalIf` 条件选填说明
12. `collectInheritedProperties()` — 按 base chain 收集继承属性，子类属性覆盖父类

### HTML 渲染（emit/html-emit.ts）

- 读取 `DocumentModel` 的 sidebar 和 sections
- 对每个 `ContentSection` 按类型分发渲染
- 辅助函数拆分到 `html-helpers.ts`、`html-props.ts`、`html-examples.ts`
- 内置简易 Markdown → HTML 转换器（支持标题、表格、代码块、列表、链接、加粗、斜体）
- 模板变量：`{{title}}`, `{{hljs_theme}}`, `{{hljs}}`, `{{styles}}`, `{{scripts}}`, `{{sidebar_content}}`, `{{api_content}}`
- `{{version}}` 由 `index.ts` 在 pipeline 完成后替换为含时间戳的 revision（如 `2026050418`），不经过 Stage 处理

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
