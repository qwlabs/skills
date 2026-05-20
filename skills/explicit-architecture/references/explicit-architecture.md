# Explicit Architecture 核心理论摘要

本文档提炼自 Herberto Graça 的三篇系列文章，作为 `explicit-architecture` skill 的理论基础。

**参考文献：**
1. [DDD, Hexagonal, Onion, Clean, CQRS, … How I put it all together](https://herbertograca.com/2017/11/16/explicit-architecture-01-ddd-hexagonal-onion-clean-cqrs-how-i-put-it-all-together)
2. [More than concentric layers](https://herbertograca.com/2018/07/07/more-than-concentric-layers/)
3. [Reflecting architecture and domain in code](https://herbertograca.com/2019/06/05/reflecting-architecture-and-domain-in-code/)

---

## 1. 核心概念定义

### 1.1 Application Core（应用核心）

Application Core 是系统中最重要的代码——它是业务逻辑的载体，独立于外部工具和交付机制。多个 UI（Web、Mobile、CLI、API）共享同一个 Application Core。

Application Core 由内到外分为两层：
- **Domain Layer**：纯业务逻辑，不依赖任何外部概念
- **Application Layer**：用例编排，协调 Domain 对象完成业务流程

### 1.2 Tools（工具）

Application Core 之外的一切：数据库引擎、搜索引擎、消息队列、第三方 API、Web 服务器、CLI 控制台。

工具分两类：
- **Delivery Mechanisms**（驱动方）：告诉应用做什么——Web 服务器、CLI
- **Driven Tools**（被驱动方）：被应用告诉做什么——数据库、搜索引擎

### 1.3 Adapters（适配器）

连接工具和 Application Core 的代码。分为：
- **Primary / Driving Adapters**（驱动适配器）：包装 Port，将外部输入翻译为 Application Core 调用。例如 Controller、Console Command
- **Secondary / Driven Adapters**（被驱动适配器）：实现 Port 接口，将 Application Core 的需求翻译为工具调用。例如 MySQL Repository 实现、SMS 客户端实现

### 1.4 Ports（端口）

Port 是 Application Core 定义接口规范的地方。它是工具使用 Application Core 或被 Application Core 使用的契约。

- Port 属于 Application Core（接口在内层）
- Adapter 属于外部（实现在外层）
- **关键规则**：Port 必须按照 Application Core 的需求设计，而不是模仿工具的 API

### 1.5 Components（组件）

Component 是按业务子域（bounded context）划分的粗粒度代码隔离单元。例如 Billing、Account、Catalog。

- 每个 Component 包含独立的 Domain Layer 和 Application Layer
- Infrastructure 和 UI 可以跨 Component 共享
- Component 之间通过 Application Event 解耦，不直接引用彼此的类
- Component 的划分遵循 "Package by Component" 而非 "Package by Layer"

### 1.6 Shared Kernel（共享内核）

多个 Component 之间共享的代码，包含：
- Application Event 和 Domain Event 的定义
- 跨 Component 使用的数据类型（Entity ID、Value Object、Enum）
- 不能包含复杂的 Entity 对象（序列化问题）

Shared Kernel 独立于任何 Component，Component 依赖 Shared Kernel 但彼此不直接依赖。

---

## 2. 分层规则

```
┌─────────────────────────────────────────────┐
│  User Interface (Primary Adapters)           │
│  ┌─────────────────────────────────────────┐ │
│  │  Application Layer                       │ │
│  │  ┌─────────────────────────────────────┐ │ │
│  │  │  Domain Layer                        │ │ │
│  │  │  (Domain Model + Domain Services)    │ │ │
│  │  └─────────────────────────────────────┘ │ │
│  └─────────────────────────────────────────┘ │
│  Infrastructure (Secondary Adapters)         │
└─────────────────────────────────────────────┘
```

### Domain Layer

最内层。包含纯业务逻辑，完全不感知外部世界。

| 类型 | 职责 | 示例 |
|------|------|------|
| Entity | 包含数据和行为的业务对象 | `Invoice`, `Order` |
| Value Object | 无唯一标识的不可变值 | `Money`, `Address` |
| Domain Service | 跨 Entity 的领域逻辑 | `PricingService` |
| Domain Event | 状态变更事件 | `OrderPlaced`, `PaymentReceived` |
| Enum | 领域枚举 | `OrderStatus`, `PaymentMethod` |

### Application Layer

编排用例流程。知道 "做什么" 但不知道 "怎么做"。

| 类型 | 职责 | 示例 |
|------|------|------|
| Application Service | 展开用例：获取 Entity → 触发逻辑 → 持久化 | `OrderService` |
| Command Handler | 接收 Command 并执行用例逻辑 | `PlaceOrderHandler` |
| Query Handler | 接收 Query 并返回只读数据 | `GetOrderHandler` |
| Port (Interface) | 定义对外部工具的抽象 | `OrderRepository`, `PaymentGateway` |
| Application Event | 用例完成后的副作用事件 | `OrderConfirmedEvent` |

典型的 Application Service 流程：
1. 通过 Repository 获取 Entity
2. 调用 Entity 的 Domain 方法
3. 通过 Repository 持久化变更
4. 触发 Application Event（通知其他 Component）

### User Interface Layer

Primary Adapters，接收外部输入并翻译为 Application Core 调用。

| 类型 | 职责 |
|------|------|
| REST Controller | HTTP 请求 → Command/Query 或 Application Service 调用 |
| CLI Command | 命令行输入 → Application Service 调用 |
| Event Listener | 外部消息 → Application Service 调用 |

### Infrastructure Layer

Secondary Adapters，实现 Port 接口，对接具体工具。

| 类型 | 职责 |
|------|------|
| Persistence Adapter | 实现 Repository 接口（JPA、JDBC、MongoDB） |
| Messaging Adapter | 实现消息发送/接收接口（Kafka、RabbitMQ） |
| External API Adapter | 实现外部服务接口（HTTP client） |

---

## 3. 依赖规则

**核心约束：依赖方向必须向内（从外层指向内层）。**

```
Infrastructure ──depends on──→ Application ──depends on──→ Domain
      UI ──depends on──→ Application ──depends on──→ Domain
```

具体规则：
1. Domain Layer **不能** import Application、Infrastructure、UI 的任何类
2. Application Layer **不能** import Infrastructure、UI 的任何类
3. Application Layer 可以 import Domain Layer 的类
4. Infrastructure 和 UI 可以 import Application Layer 的类（通过 Port 接口）
5. Adapter 依赖具体的工具库和 Port 接口，但 Application Core 只依赖 Port 接口

这意味着：
- Repository 接口定义在 Application Layer（Port）
- Repository 实现在 Infrastructure Layer（Adapter）
- Application Service 依赖的是 Repository 接口，不知道具体实现
- Controller 依赖 Application Service 接口或 Command/Query Bus

---

## 4. 组件交互模式

### 4.1 Component 间通信

Component 之间不能直接调用。通信方式：

1. **Application Event**：Component A 触发事件 → Event Dispatcher → Component B 的 Listener 响应
2. **Shared Kernel**：共享的事件定义和 DTO，放在独立的包中
3. **Discovery Service**（分布式场景）：通过 HTTP + 服务发现间接调用

### 4.2 数据获取规则

- Component 只能修改自己拥有的数据
- Component 可以读取其他 Component 的数据（只读）
- 共享数据库时：通过 Query 对象直接读取
- 独立数据库时：通过 Domain Event 同步数据副本

### 4.3 事件流向

```
Component A (Domain Event) → Shared Kernel → Component B (Application Event Handler)
```

Domain Event 在 Component 内部触发，通过 Shared Kernel 中的事件定义传递给其他 Component。

---

## 5. 架构分层 vs 宏观结构

Graça 提出两个维度的代码组织：

### 维度一：同心层（纵向切分）

按技术职责分层——Domain、Application、Infrastructure、UI。依赖方向向内。

### 维度二：Component（横向切分）

按业务子域分模块——Billing、Account、Catalog。Component 之间通过事件解耦。

**两个维度交叉**：每个 Component 内部有自己的 Domain 和 Application 层。Infrastructure 和 UI 可以跨 Component。

### 额外的宏观层次（在同心层之下）

1. **Shared Kernel**：Component 间共享代码
2. **Language Extensions**：对编程语言的扩展（如自定义 UUID 类）
3. **Programming Language**：语言本身

---

## 6. 在代码中反映架构

### 命名约定

类名应同时传达领域含义和架构角色：
- `InvoiceRepository` — 领域是 Invoice，角色是 Repository
- `PlaceOrderHandler` — 用例是 PlaceOrder，角色是 Handler
- 不需要在类名后缀中重复显而易见的信息（如 `InvoiceEntity`）

### 目录结构反映架构

源码根目录的三个顶层文件夹对应三种代码类型：
- `ui/` — User Interface
- `core/` — Application Core
- `infrastructure/` — Infrastructure

在 `core/` 内部：
- `core/{component}/domain/` — Domain Layer
- `core/{component}/application/` — Application Layer
- `core/sharedkernel/` — Shared Kernel
- `core/port/` — Port 定义

### 架构可测试性

使用 Deptrac（PHP）或 ArchUnit（Java）等工具，可以在 CI 中自动检测依赖方向违规。这确保架构规则不会被无意中破坏。
