---
name: explicit-architecture
description: >
  当需要为 Java/Quarkus 后端项目创建、移动或重命名代码文件时使用此 skill。
  基于 Explicit Architecture（Herberto Graça）理论，帮助确定文件放置位置，
  解释依赖方向规则，检测架构偏离。触发词：explicit architecture、文件放在哪、
  代码架构、架构分层、依赖方向、hexagonal、onion architecture、clean architecture。
---

# explicit-architecture

基于 Explicit Architecture 的后端代码定位与架构合规 skill。用于 Java / Quarkus 项目。

## 能力

- **文件定位**：给定类名或职责描述，确定正确的包/目录位置
- **依赖方向指导**：解释为什么某个类应该在某层，以及它能依赖什么
- **架构偏离检测**：通过 ArchUnit 规则自动验证项目结构合规性（见 references/archunit-rules.md）

## 核心架构规则

```
依赖方向（箭头 = 依赖）：

UI ──depends on──→ Application ──depends on──→ Domain
Infrastructure ──depends on──→ Application ──depends on──→ Domain
```

**内层不能 import 外层的任何类。**

### 四层职责

| 层 | 能做什么 | 不能做什么 |
|----|---------|-----------|
| **Domain** | 纯业务逻辑：Entity、Value Object、Domain Service、Domain Event | import Application/Infrastructure/UI 的类 |
| **Application** | 用例编排：获取 Entity → 调用 Domain 方法 → 持久化 → 发事件 | import Infrastructure/UI 的类 |
| **Infrastructure** | 实现 Port 接口：数据库、消息队列、外部 API | 被 Domain 直接 import |
| **UI** | 接收请求 → 调用 Application Port → 返回响应 | 直接操作 Domain Entity 或调用 Infrastructure |

### Component 划分

Component = 业务子域（bounded context），如 `billing`、`account`、`catalog`。

- 每个 Component 有独立的 `domain/` 和 `application/`
- Infrastructure 和 UI 跨 Component 共享
- Component 间通过 Event 解耦，不直接引用

## 定位决策树

当需要创建或移动 Java 文件时，按以下逻辑确定位置：

```
1. 包含业务规则或领域概念？
   ├─ Entity / Value Object → {component}/domain/model/
   ├─ 跨 Entity 的领域逻辑 → {component}/domain/service/
   └─ Domain Event → {component}/domain/event/

2. 编排用例流程？
   ├─ Command / Query Handler → {component}/application/handler/
   ├─ Application Service → {component}/application/service/
   └─ Port 接口（Repository / 外部服务抽象）→ {component}/application/port/out/

3. 实现 Port 接口（对接外部工具）？
   ├─ 数据库 → infrastructure/persistence/jpa/
   ├─ 消息队列 → infrastructure/messaging/
   └─ 外部 API → infrastructure/client/

4. 接收外部请求？
   ├─ REST endpoint → ui/rest/{component}/
   └─ CLI command → ui/cli/

5. 多个 Component 共享？
   └─ sharedkernel/{event|dto|valueobject}/
```

## Quarkus 特有约定

| 类型 | 位置 | 注意事项 |
|------|------|---------|
| `@Path` Resource | `ui/rest/{component}/` | 命名以 `Resource` 结尾 |
| Panache Entity | `infrastructure/persistence/jpa/entity/` | 不是 Domain Entity，需要 Mapper 转换 |
| `@ConfigMapping` | `infrastructure/config/` | 基础设施配置 |
| `@Scheduled` Job | `ui/scheduler/` | 是另一种 Primary Adapter |
| Health Check | `infrastructure/health/` | 运维工具，不属于 Core |
| CDI Producer | `infrastructure/config/` | 依赖注入配置 |

### Panache Entity vs Domain Entity

- **Domain Entity**（`{component}/domain/model/`）：包含业务逻辑，不依赖任何框架
- **Panache Entity**（`infrastructure/persistence/jpa/entity/`）：继承 `PanacheEntity`，纯粹做 ORM 映射

两者通过 Mapper/Converter 转换，互不引用。

## 参考文档

| 文档 | 内容 |
|------|------|
| [Explicit Architecture 理论](references/explicit-architecture.md) | 核心概念、分层规则、依赖规则、组件交互模式 |
| [Quarkus 目录映射](references/quarkus-directory-mapping.md) | 完整目录结构示例、测试目录约定、Port 方向约定 |
| [ArchUnit 规则模板](references/archunit-rules.md) | 可复制的 ArchitectureTest.java、12 条检测规则、已知限制 |
