# Quarkus 项目目录映射

本文档定义 Java / Quarkus 项目中 Explicit Architecture 的完整目录结构映射。

---

## 标准目录结构

```
src/main/java/com/acme/
├── sharedkernel/                          # Shared Kernel
│   ├── event/                             # 跨 Component 共享的事件定义
│   │   └── OrderPlacedEvent.java
│   ├── dto/                               # 跨 Component 共享的 DTO
│   │   └── OrderSummaryDto.java
│   └── valueobject/                       # 跨 Component 共享的值对象
│       └── Money.java
│
├── billing/                               # Component: billing（按业务子域）
│   ├── domain/                            # Domain Layer
│   │   ├── model/                         # Entity + Value Object
│   │   │   ├── Invoice.java               #   Entity
│   │   │   ├── InvoiceLine.java           #   Value Object
│   │   │   └── InvoiceStatus.java         #   Enum
│   │   ├── service/                       # Domain Service
│   │   │   └── PricingService.java
│   │   └── event/                         # Domain Event
│   │       └── InvoicePaidEvent.java
│   │
│   └── application/                       # Application Layer
│       ├── handler/                       # Command / Query Handler
│       │   ├── CreateInvoiceHandler.java
│       │   └── GetInvoiceHandler.java
│       ├── service/                       # Application Service
│       │   └── BillingService.java
│       └── port/                          # Port 接口（Application Core 对外抽象）
│           ├── out/                       #   Output Port（被驱动）
│           │   ├── InvoiceRepository.java
│           │   └── NotificationSender.java
│           └── in/                        #   Input Port（驱动）
│               └── BillingUseCase.java
│
├── account/                               # Component: account
│   ├── domain/
│   │   ├── model/
│   │   │   └── User.java
│   │   └── event/
│   │       └── UserRegisteredEvent.java
│   └── application/
│       ├── handler/
│       │   └── RegisterUserHandler.java
│       └── port/
│           └── out/
│               └── UserRepository.java
│
├── infrastructure/                        # Infrastructure Layer（跨 Component 共享）
│   ├── persistence/                       # 数据库适配器
│   │   ├── jpa/                           #   JPA 实现
│   │   │   ├── JpaInvoiceRepository.java  #     实现 billing.application.port.out.InvoiceRepository
│   │   │   ├── PanacheUserRepository.java #     实现 account.application.port.out.UserRepository
│   │   │   └── entity/                    #     JPA Entity（映射专用，非 Domain Entity）
│   │   │       ├── InvoicePanacheEntity.java
│   │   │       └── UserPanacheEntity.java
│   │   └── mongo/                         #   MongoDB 实现（如需切换）
│   │       └── MongoInvoiceRepository.java
│   ├── messaging/                         # 消息队列适配器
│   │   ├── kafka/
│   │   │   └── KafkaNotificationSender.java  # 实现 NotificationSender Port
│   │   └── KafkaEventPublisher.java
│   ├── client/                            # 外部 API 适配器
│   │   └── PaymentGatewayClient.java
│   └── config/                            # 基础设施配置
│       └── PersistenceConfig.java
│
└── ui/                                    # User Interface Layer
    ├── rest/                              # REST API（Primary Adapter）
    │   ├── billing/
    │   │   └── InvoiceResource.java       #   Quarkus: @Path + @REST
    │   └── account/
    │       └── UserResource.java
    └── cli/                               # CLI（如有）
        └── MaintenanceCommand.java        #   Quarkus: @Command
```

---

## 测试目录约定

```
src/test/java/com/acme/
├── billing/
│   ├── domain/
│   │   └── model/
│   │       └── InvoiceTest.java           # Domain 单元测试（纯逻辑，无框架）
│   └── application/
│       └── handler/
│           └── CreateInvoiceHandlerTest.java
├── infrastructure/
│   └── persistence/
│       └── jpa/
│           └── JpaInvoiceRepositoryTest.java  # 集成测试（@QuarkusTest）
├── ui/
│   └── rest/
│       └── billing/
│           └── InvoiceResourceTest.java        # 端到端测试（@QuarkusTest + RESTassured）
└── architecture/
    └── ArchitectureTest.java                   # ArchUnit 架构规则测试
```

规则：
- 测试类的包路径与被测类一致
- Domain 测试不使用 `@QuarkusTest`，纯 JUnit 5
- Infrastructure 和 UI 测试使用 `@QuarkusTest`
- ArchUnit 测试放在独立的 `architecture/` 包中

---

## Quarkus 特有类型的放置位置

| Quarkus 类型 | 放置位置 | 说明 |
|---|---|---|
| `@Path` / `@REST` Resource | `ui/rest/{component}/` | REST endpoint，是 Primary Adapter |
| `@Command` CLI | `ui/cli/` | CLI 入口，是 Primary Adapter |
| Panache Entity (`PanacheEntity`) | `infrastructure/persistence/jpa/entity/` | 是 ORM 映射对象，不是 Domain Entity |
| `@ApplicationScoped` Bean | 取决于其架构角色 | CDI bean 本身不代表分层，看它实现的接口 |
| `@ConfigMapping` | `infrastructure/config/` | 基础设施配置 |
| Health Check (`HealthCheck`) | `infrastructure/health/` | 运维工具，不属于 Application Core |
| Metrics (`@Counted`, `@Timed`) | 附着在对应的方法上 | 不需要单独的类 |
| `@QuarkusTest` | `src/test/` 对应包 | 仅用于 Infrastructure/UI 集成测试 |
| CDI Producer | `infrastructure/config/` | 依赖注入配置，属于基础设施 |
| `@Scheduled` Job | `ui/scheduler/` | 定时任务，是另一种 Primary Adapter |

### Panache Entity vs Domain Entity

关键区分：
- **Domain Entity**：在 `{component}/domain/model/` 中，包含业务逻辑，不依赖任何框架
- **Panache Entity**：在 `infrastructure/persistence/jpa/entity/` 中，继承 `PanacheEntity`，纯粹做 ORM 映射

两者之间通过 Mapper/Converter 转换。Domain Entity 不引用 Panache Entity。

---

## Port 接口的方向约定

```
application/port/
├── in/          # Input Port：定义 Application Core 暴露给外部的能力
│   └── BillingUseCase.java         # 接口，由 Application Service 实现
└── out/         # Output Port：定义 Application Core 对外部工具的需求
    ├── InvoiceRepository.java      # 接口，由 Infrastructure Adapter 实现
    └── NotificationSender.java     # 接口，由 Infrastructure Adapter 实现
```

- `in/` 端口由 UI 层调用，Application Service 实现
- `out/` 端口由 Application Service 调用，Infrastructure Adapter 实现

---

## 依赖关系总结

```
ui/rest/billing/InvoiceResource.java
  └── depends on → billing/application/port/in/BillingUseCase.java
                    └── implemented by → billing/application/service/BillingService.java
                                          └── depends on → billing/domain/model/Invoice.java
                                          └── depends on → billing/application/port/out/InvoiceRepository.java
                                                            └── implemented by → infrastructure/persistence/jpa/JpaInvoiceRepository.java
```

每条依赖链都从外向内，绝不反向。
