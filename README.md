# Skills

Claude Code skills 合集。每个 skill 是一个独立、自包含的工具，解决特定问题。

## 目录结构

```
skills/<name>/
├── SKILL.md          # 身份与用法（必需）
├── scripts/          # 可执行逻辑（子目录按需组织）
├── templates/        # 输出模板（可选）
├── samples/          # 示例数据（可选）
└── package.json      # 外部依赖（仅需要时添加）
```

## 运行时

**Bun** — 所有 TypeScript 通过 `bun run` 直接执行，无构建步骤。各 skill 如需依赖，在自身目录下维护独立的 `package.json`。

## 添加新 Skill

1. 创建 `skills/<name>/` 目录
2. 添加 `SKILL.md`，包含 front-matter（`name`、`description`、`triggers`）
3. 在 `skills/<name>/scripts/` 下实现逻辑
4. 仅在需要外部依赖时添加 `package.json`

无需修改任何根目录配置文件。各 skill 的具体架构和用法参见其各自的 `SKILL.md`。

## 已有 Skills

| Skill | 说明 |
|-------|------|
| [api-doc](skills/api-doc/SKILL.md) | 从 TypeSpec 定义生成单文件 HTML API 文档 |
