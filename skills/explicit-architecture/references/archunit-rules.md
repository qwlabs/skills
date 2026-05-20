# ArchUnit 规则模板

可直接复制为 Java 测试类，用于在 CI 中自动检测 Explicit Architecture 违规。

---

## Maven 依赖

```xml
<dependency>
    <groupId>com.tngtech.archunit</groupId>
    <artifactId>archunit-junit5</artifactId>
    <version>1.3.0</version>
    <scope>test</scope>
</dependency>
```

## Gradle 依赖

```groovy
testImplementation 'com.tngtech.archunit:archunit-junit5:1.3.0'
```

---

## ArchitectureTest.java

```java
package com.acme.architecture;

import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.*;
import static com.tngtech.archunit.library.dependencies.SlicesRuleDefinition.slices;

/**
 * Explicit Architecture 规则检测。
 *
 * 使用方法：
 * 1. 修改 BASE_PACKAGE 为你的项目根包
 * 2. 根据实际 Component 名称调整 COMPONENT_NAMES
 * 3. 运行：mvn test -Dtest=ArchitectureTest
 */
class ArchitectureTest {

    // ===== 修改此处 =====
    private static final String BASE_PACKAGE = "com.acme";
    private static final String[] COMPONENT_NAMES = {"billing", "account", "catalog"};
    // ===================

    private static final String DOMAIN = "..domain..";
    private static final String APPLICATION = "..application..";
    private static final String INFRASTRUCTURE = "infrastructure..";
    private static final String UI = "ui..";
    private static final String SHARED_KERNEL = "sharedkernel..";

    private static JavaClasses classes;

    @BeforeAll
    static void importClasses() {
        classes = new ClassFileImporter()
                .importPackages(BASE_PACKAGE);
    }

    // ==========================================
    // 规则 1：分层依赖方向——Domain 不能依赖外层
    // ==========================================

    @Test
    void domain_should_not_depend_on_application() {
        noClasses()
                .that().resideInAPackage(DOMAIN)
                .should().dependOnClassesThat()
                .resideInAPackage(APPLICATION)
                .check(classes);
    }

    @Test
    void domain_should_not_depend_on_infrastructure() {
        noClasses()
                .that().resideInAPackage(DOMAIN)
                .should().dependOnClassesThat()
                .resideInAPackage(INFRASTRUCTURE)
                .check(classes);
    }

    @Test
    void domain_should_not_depend_on_ui() {
        noClasses()
                .that().resideInAPackage(DOMAIN)
                .should().dependOnClassesThat()
                .resideInAPackage(UI)
                .check(classes);
    }

    // ==========================================
    // 规则 2：分层依赖方向——Application 不能依赖外层
    // ==========================================

    @Test
    void application_should_not_depend_on_infrastructure() {
        noClasses()
                .that().resideInAPackage(APPLICATION)
                .should().dependOnClassesThat()
                .resideInAPackage(INFRASTRUCTURE)
                .check(classes);
    }

    @Test
    void application_should_not_depend_on_ui() {
        noClasses()
                .that().resideInAPackage(APPLICATION)
                .should().dependOnClassesThat()
                .resideInAPackage(UI)
                .check(classes);
    }

    // ==========================================
    // 规则 3：Domain 类不应使用框架注解
    // ==========================================

    @Test
    void domain_should_not_use_framework_annotations() {
        noClasses()
                .that().resideInAPackage(DOMAIN)
                .should().notBeAnnotatedWith("javax.enterprise.context.ApplicationScoped")
                .andShould().notBeAnnotatedWith("javax.persistence.Entity")
                .andShould().notBeAnnotatedWith("io.quarkus.hibernate.orm.panache.PanacheEntity")
                .check(classes);
    }

    // ==========================================
    // 规则 4：Repository 接口应在 Application Layer
    // ==========================================

    @Test
    void repository_interfaces_should_be_in_application_port_out() {
        allInterfaces()
                .that().haveSimpleNameEndingWith("Repository")
                .and().doNotResideInAPackage(INFRASTRUCTURE)
                .should().resideInAPackage("..application.port.out..")
                .check(classes);
    }

    // ==========================================
    // 规则 5：Infrastructure 中的 Repository 实现必须实现 Port 接口
    // ==========================================

    @Test
    void infrastructure_repositories_should_implement_port() {
        allClasses()
                .that().resideInAPackage(INFRASTRUCTURE)
                .and().haveSimpleNameEndingWith("Repository")
                .should().implement(resideInAPackage("..application.port.out.."))
                .check(classes);
    }

    // ==========================================
    // 规则 6：REST Resource 应在 UI 层
    // ==========================================

    @Test
    void rest_resources_should_be_in_ui_layer() {
        allClasses()
                .that().areAnnotatedWith("javax.ws.rs.Path")
                .or().areAnnotatedWith("jakarta.ws.rs.Path")
                .should().resideInAPackage(UI)
                .check(classes);
    }

    // ==========================================
    // 规则 7：Shared Kernel 不依赖任何 Component
    // ==========================================

    @Test
    void shared_kernel_should_not_depend_on_components() {
        for (String component : COMPONENT_NAMES) {
            noClasses()
                    .that().resideInAPackage(SHARED_KERNEL)
                    .should().dependOnClassesThat()
                    .resideInAPackage(".." + component + "..")
                    .check(classes);
        }
    }

    // ==========================================
    // 规则 8：Component 之间不应直接依赖
    // ==========================================

    @Test
    void components_should_not_depend_on_each_other() {
        for (int i = 0; i < COMPONENT_NAMES.length; i++) {
            for (int j = 0; j < COMPONENT_NAMES.length; j++) {
                if (i != j) {
                    noClasses()
                            .that().resideInAPackage(".." + COMPONENT_NAMES[i] + ".domain..")
                            .should().dependOnClassesThat()
                            .resideInAPackage(".." + COMPONENT_NAMES[j] + "..")
                            .check(classes);
                }
            }
        }
    }

    // ==========================================
    // 规则 9：命名约定——Controller 用 Resource 后缀
    // ==========================================

    @Test
    void ui_rest_classes_should_be_named_resource() {
        allClasses()
                .that().resideInAPackage("..ui.rest..")
                .and().areAnnotatedWith("javax.ws.rs.Path")
                .or().areAnnotatedWith("jakarta.ws.rs.Path")
                .should().haveSimpleNameEndingWith("Resource")
                .check(classes);
    }
}
```

---

## 规则覆盖清单

| # | 检查项 | 规则 |
|---|--------|------|
| 1 | Domain 不依赖 Application | `domain → application` 禁止 |
| 2 | Domain 不依赖 Infrastructure | `domain → infrastructure` 禁止 |
| 3 | Domain 不依赖 UI | `domain → ui` 禁止 |
| 4 | Application 不依赖 Infrastructure | `application → infrastructure` 禁止 |
| 5 | Application 不依赖 UI | `application → ui` 禁止 |
| 6 | Domain 不使用框架注解 | 禁止 `@Entity`, `@ApplicationScoped` 等 |
| 7 | Repository 接口在 Application Port | `*Repository` 接口在 `application.port.out` |
| 8 | Infrastructure Repository 实现 Port | Infrastructure 中的 Repository 必须实现 Port |
| 9 | REST Resource 在 UI 层 | `@Path` 注解的类在 `ui` 包中 |
| 10 | Shared Kernel 独立 | Shared Kernel 不依赖任何 Component |
| 11 | Component 间无直接依赖 | Component 的 domain 不依赖其他 Component |
| 12 | REST 类命名约定 | `@Path` 类以 `Resource` 结尾 |

---

## 已知限制

1. **CDI 动态解析不在检测范围内**。ArchUnit 检测编译时依赖（import），但 CDI 的 `@Inject` + `Instance<T>` 可能导致运行时依赖绕过检测。v1 只覆盖编译时依赖。
2. **Panache Entity 继承链**。Panache 的 `PanacheEntity` 基类可能引入对 Infrastructure 层的传递依赖。建议 Domain Entity 不继承 Panache Entity，而是在 Infrastructure 中创建独立的映射类。
3. **单模块项目**。以上规则适用于单模块 Quarkus 项目。多模块项目的跨模块依赖检测需要额外配置 ArchUnit 的模块导入。
