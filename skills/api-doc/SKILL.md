---
name: api-doc
description: >
  当需要从 TypeSpec (.tsp) 文件生成单文件 HTML API 文档时使用此 skill。
  支持自动生成 curl 示例、参数表格、版本标签、Markdown 片段注入。
  触发词：生成 API 文档、生成接口文档、api doc、typespec doc、生成 HTML 文档。
---

# api-doc

从 TypeSpec 定义生成单文件、自包含的 HTML API 文档。

## 安装

**必须使用 bun，禁止使用 npm。**

```bash
cd skills/api-doc
bun install
```

依赖：`@typespec/compiler`、`@typespec/http`（已配置 npmmirror 源）。

验证安装：

```bash
bun run scripts/index.ts --help
```

## 使用

### 基本命令

```bash
bun run scripts/index.ts <input-dir> [output] [--adapter <name>] [--theme <name>] [--theme-file <path>]
```

- `<input-dir>` — 包含 `.tsp` 文件的目录（必填）
- `[output]` — 输出文件路径（可选）
  - 未指定时自动输出至输入目录的父目录，文件名格式：`<目录名>-<revision>.html`
  - 例如输入 `./tms`，输出 `./tms-1.0.0-2026050114.html`

### Revision 格式

Revision 由版本号 + 时间戳组成：

```
${version}-YYYYMMDDHH
```

例如：`1.0.0-2026050114`

版本号来源（优先级从高到低）：
1. 输入目录中的 `api-doc.json` 配置文件中的 `version` 字段
2. TypeSpec `@service` 中的 `version` 字段（注意：TypeSpec 官方 `@service` 不支持 `version` 参数，请使用配置文件方式）

配置文件方式（推荐）：

```json
// api-doc.json（放在输入目录中）
{ "version": "1.0.0" }
```

未定义版本号时 revision 只包含时间戳：`2026050114`

### 选项

| 选项 | 说明 |
|------|------|
| `--adapter <name>` | 强制指定适配器（默认自动检测） |
| `--theme <name>` | 使用预设主题（当前可用：`light`） |
| `--theme-file <path>` | 使用自定义 CSS 主题文件 |

### 示例

```bash
# 默认输出：输出至输入目录父目录，自动命名
bun run scripts/index.ts ./samples/tms

# 指定输出路径
bun run scripts/index.ts ./samples/tms ./output.html

# 使用 light 主题
bun run scripts/index.ts ./samples/tms --theme light

# 使用自定义主题
bun run scripts/index.ts ./samples/tms ./output.html --theme-file ./my-theme.css
```

## 输入目录结构

```
my-api/
├── index.tsp              # 入口文件：import 其他 .tsp、定义 service 和公共 model
├── 用户管理.tsp            # 根目录文件：文件名 = 分组名
├── 订单管理.tsp            # 根目录文件：文件名 = 分组名
└── 物流/                   # 子目录：目录名 = 分组名
    ├── 运单查询.tsp        # 文件名 = 接口名
    └── 运单创建.tsp        # 文件名 = 接口名
```

入口文件自动检测顺序：`index.tsp` → `main.tsp` → 第一个 `.tsp` 文件。

### 入口文件模板

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

### 分组文件模板

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

分组规则（优先级从高到低）：
1. operation 所在 namespace 上的 `@doc` 装饰器
2. 根目录文件：使用文件名（去掉 `.tsp` 后缀，`index`/`main` 归入"默认"）
3. 子目录文件：使用直接父目录名

接口名规则（优先级从高到低）：
1. operation 上的 `@doc` 装饰器
2. 文件名（去掉 `.tsp` 后缀，`index`/`main` 回退到 operation 名）
3. operation 名

多文件合并分组：在多个 `.tsp` 文件的 namespace 上声明相同的 `@doc` 值，即可将它们归入同一分组：

```typespec
// 转运A.tsp
@doc("转运")
namespace TMS;

// 转运B.tsp
@doc("转运")
namespace TMS;
```

以上两个文件的 operation 会合并显示在"转运"分组下。

## TypeSpec 语法特性

### 核心 Decorator 速查

| Decorator | 作用 | 示例 |
|-----------|------|------|
| `@doc("...")` | 描述文本，渲染为标题/说明 | `@doc("创建用户")` |
| `@service(#{title: "..."})` | 服务名称，显示在侧边栏顶部 | `@service(#{title: "TMS"})` |
| `@route("/...")` | API 路径 | `@route("/users/:id")` |
| `@get` `@post` `@put` `@delete` `@patch` | HTTP 方法，渲染为彩色标签 | `@post` |
| `@header` `@query` `@path` `@body` | 参数位置 | `@header authorization: string` |
| `@minValue(n)` / `@maxValue(n)` | 数值范围约束 | `@minValue(0)` |
| `@minLength(n)` / `@maxLength(n)` | 字符串长度约束 | `@minLength(6)` |
| `@pattern("...")` | 正则约束 | `@pattern("^[A-Z]")` |
| `@added("v2")` / `@removed("v3")` | 版本标签，渲染为徽章 | `@added("2.0")` |
| `@requiredIf("...")` | 条件必填说明，渲染为标签 | `@requiredIf("当 email 存在时必填")` |

### 添加示例（@opExample）

`@opExample` 为接口添加可交互的请求/响应示例，渲染为选项卡（请求数据 / 返回数据 / cURL）：

```typespec
@opExample(#{
  parameters: #{
    body: #{
      outType: "json",
      apiName: "create_user",
      data: #{ name: "张三", age: 25 }
    }
  },
  returnType: #{
    code: 200,
    message: "success",
    data: #{ id: 1, name: "张三" }
  }
}, #{
  title: "成功响应"    // 示例标题，显示为选项卡名
})
@post
op createUser(@body body: Request): Response;
```

- 同一接口可添加多个 `@opExample`，每个渲染为一个选项卡
- `parameters.body` — 请求数据
- `returnType` — 响应数据
- cURL 命令根据请求参数自动生成
- 纯错误示例可省略 `parameters`

### 模型继承与嵌套

```typespec
// 继承：子模型包含父模型所有字段
model CreateRequest extends BaseRequest {
  @doc("用户名")
  name: string;
}

// 嵌套对象：渲染为缩进的子表格
model Order {
  @doc("收货地址")
  address: {
    city: string;
    street: string;
  };
}

// 数组类型
model ListResponse {
  items: User[];
}
```

### 枚举与联合类型

```typespec
// 枚举：渲染为 enum (YES, NO)
enum YesNo {
  YES,
  NO,
}

// 联合类型：渲染为 "200" | "404"
model Status {
  code: 200 | 404 | 500;
}
```

### 固定值字段

字符串字面量类型自动标记为"固定值"：

```typespec
model Request {
  outType: "json";  // 渲染为：固定值 "json"
  apiName: "specific_api_name";  // 渲染为：固定值 "specific_api_name"
}
```

### 条件必填字段

使用 `@requiredIf` 标记在某些条件下必填的字段：

```typespec
model PaymentRequest {
  @doc("支付类型")
  type: "credit" | "debit" | "cash";

  @doc("信用卡号")
  @requiredIf("当 type 为 credit 时必填")
  creditCard?: string;

  @doc("邮箱验证状态")
  @requiredIf("当 email 存在时必填")
  emailVerified?: boolean;
}
```

渲染效果：
- 有 `@requiredIf` 的字段显示 `条件必填` 标签 + 条件描述（与 `必填`/`选填`/`固定值` 互斥，只显示一种）
- 支持两种场景：值依赖（某字段为特定值时必填）和存在依赖（某字段存在时必填）

### Markdown 片段

在输入目录中放置 `.md` 文件，可注入自定义内容：

- `header_1_概述.md`、`header_2_认证.md` — 渲染在 API 文档之前
- `footer_1_变更记录.md` — 渲染在 API 文档之后

命名规则：`{position}_{index}_{name}.md` 或 `{position}_{name}.md`

- `position` — `header` 或 `footer`
- `index` — 数字前缀，控制排序顺序（可选）
- `name` — 片段标题，显示为文档中的标题

示例：

```
my-api/
├── header_概述.md           → 无数字前缀，按默认顺序
├── header_1_认证.md         → 排在最前
├── header_2_错误码.md       → 排在第二
├── footer_1_变更记录.md
└── footer_常见问题.md
```

支持表格、代码块、列表等 Markdown 语法。

## 输出特性

生成的 HTML 文件特性：
- 单文件自包含（CSS/JS 内联，无外部依赖）
- 深色侧边栏 + 分组导航
- 参数表格（类型、约束、必填状态）
- 自动生成 cURL 示例
- 语法高亮（highlight.js）
- 响应式布局，侧边栏可折叠
- 复制按钮

## TypeSpec 文档

- [TypeSpec 官方文档](https://typespec.io/docs)
- [TypeSpec HTTP 库](https://typespec.io/docs/libraries/http)
- [TypeSpec 语言参考](https://typespec.io/docs/language-basics)

## 开发者指南

如需修改或扩展此 skill，参见 [ARCHITECTURE.md](ARCHITECTURE.md)。
