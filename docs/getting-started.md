# Getting Started

面向 Claude Code 和深度使用者的开发指南。人类访客请先看根目录的 `README.md`。

## 项目概述

Claude Code skills 合集。每个 skill 是一个独立、自包含的工具，解决特定问题。

Skills 之间没有共享领域术语，各自独立管理文档。

## 目录结构

```
skills/<name>/
├── SKILL.md          # 身份与用法（必需）
├── scripts/          # 可执行逻辑（子目录按需组织）
├── templates/        # 输出模板（可选）
├── samples/          # 示例数据（可选）
└── package.json      # 外部依赖（仅需要时添加）
```

项目级目录：

```
/
├── CLAUDE.md              # Claude Code 行为指令（精简）
├── README.md              # 项目概览（面向人类访客）
├── docs/
│   ├── getting-started.md # 本文件 — 开发指南
│   └── agents/            # Agent skills 配置
│       ├── domain.md
│       ├── issue-tracker.md
│       └── triage-labels.md
├── skills/                # 项目产物
└── .agents/skills/        # 开发工具箱（meta-skills，不参与 domain 文档体系）
```

## 运行时

**Bun** — 所有 TypeScript 通过 `bun run` 直接执行，无构建步骤。各 skill 如需依赖，在自身目录下维护独立的 `package.json`。

## 添加新 Skill

1. 创建 `skills/<name>/` 目录
2. 添加 `SKILL.md`，包含 front-matter（`name`、`description`、`triggers`）
3. 在 `skills/<name>/scripts/` 下实现逻辑
4. 仅在需要外部依赖时添加 `package.json`
5. 在 `README.md` 的 skill 列表中添加条目

无需修改 CLAUDE.md 或任何其他根目录配置文件。

## 已有 Skills

详见 `README.md` 中的 skill 列表。各 skill 的具体架构和用法参见其各自的 `SKILL.md`。
