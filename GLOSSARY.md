# Skills 仓库

qwlabs/skills：内部 Claude skills 集合。各 skill 的领域术语按分组沉淀于此；当前覆盖 api-doc。

## Language

### api-doc — 输入与文档结构

**入口文件**:
TypeSpec 编译的起点，自动按 `index.tsp` → `main.tsp` → 第一个 `.tsp` 的顺序检测。
_Avoid_: 主文件、main file

**分组**:
输出文档中接口与消息的归类单位，侧边栏按它组织。命名优先级：namespace 上的 `@doc` > 根目录文件名（去 `.tsp`）> 子目录的直接父目录名；根目录 `index`/`main` 文件归入「默认」分组。
多文件声明相同 namespace `@doc` 时合并为同一分组；HTTP 接口与消息同目录时亦合并。
_Avoid_: 分类、类别、模块

**接口**:
一个 HTTP operation 在文档中的呈现单位（卡片）。接口名统一取所在文件名（去 `.tsp`）；operation 名与 operation 上的 `@doc`（用作描述）不参与命名。
_Avoid_: 端点、API、操作

**消息**:
以 `@topic` 标记的 model，表示一条 RocketMQ 消息；标题取所在文件名，一条消息一个 `.tsp` 文件。
_Avoid_: 事件、Event、MQ Event

**Topic**:
消息的路由名称，由 `@topic("...")` 指定，渲染为消息卡片的 MQ 标识。
_Avoid_: 事件名、eventName

**Markdown 片段**:
放在输入目录中的 `.md` 文件，按 `{position}_{index}_{name}.md` 命名（`header`/`footer`），注入为 API 文档前/后的自定义内容。
_Avoid_: 附录、附加文档

### api-doc — 版本

**Version**:
语义化版本号。来源优先级：`api-doc.json` 的 `version` 字段 > TypeSpec `@service` 的 `version`。
_Avoid_: build 号

**Revision**:
输出版本标识，格式 `${version}-YYYYMMDDHH`（如 `1.0.0-2026050114`）；默认输出文件名为 `<dirName>-<revision>.html`。未定义 Version 时仅含时间戳。
_Avoid_: 版本号（那是 Version）

**版本标签**:
字段或接口的生命周期徽章，由 `@added("...")` / `@removed("...")` 声明。
_Avoid_: 修订标记

### api-doc — 字段语义

**固定值**:
字符串字面量类型的字段，值恒等于该字面量，渲染为「固定值 "xxx"」。
_Avoid_: 默认值、常量

**条件必填/条件选填**:
由 `@requiredIf("...")` / `@optionalIf("...")` 声明的字段语义，渲染为对应标签 + 条件描述；与 必填/选填/固定值 互斥，只显示一种。
_Avoid_: —

**扩展属性**:
model 中的 `... Record<unknown>` spread，表示「除已声明字段外允许任意额外键」。仅当 model 既有显式字段又有 spread 时渲染为 `... | any` 占位行；纯 `Record<T>` 退化为 `T[]`。
_Avoid_: 额外字段、任意字段

### api-doc — 示例

**接口示例**:
`@opExample` 声明的 operation 请求-响应对，渲染为选项卡（请求数据/返回数据/cURL）；cURL 由请求参数自动生成，同一接口可多个。
_Avoid_: —

**消息示例**:
TypeSpec 标准库 `@example` 声明的单个数据值示例，适用于 model/消息，渲染为单 JSON 面板。与接口示例的区别：描述单个数据值，而非请求-响应对。
_Avoid_: —
