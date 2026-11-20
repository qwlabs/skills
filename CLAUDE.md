# CLAUDE.md

- 与用户对话、提交信息、文档用中文；回复简洁——结论先行，不铺垫、不复述问题。
- 编程相关术语一律保持英文原文，不硬翻译；无贴切译名的直接用原文。哪些词算编程术语由模型自行判断，不作枚举。

## 行为准则
- 先思考再编码 — 不确定就问，有多种理解就全部列出
- 简洁优先 — 不做推测性设计，用最少的代码解决问题
- 外科手术式修改 — 只碰该碰的，不顺手改善相邻代码
- 目标驱动 — 定义可验证的成功标准，循环直到通过

<!-- CODEGRAPH_START -->
## CodeGraph

In repositories indexed by CodeGraph (a `.codegraph/` directory exists at the repo root), reach for it BEFORE grep/find or reading files when you need to understand or locate code:

- **MCP tool** (when available): `codegraph_explore` answers most code questions in one call — the relevant symbols' verbatim source plus the call paths between them, including dynamic-dispatch hops grep can't follow. Name a file or symbol in the query to read its current line-numbered source. If it's listed but deferred, load it by name via tool search.
- **Shell** (always works): `codegraph explore "<symbol names or question>"` prints the same output.

If there is no `.codegraph/` directory, skip CodeGraph entirely — indexing is the user's decision.
<!-- CODEGRAPH_END -->

## Agent skills

### Issue tracker

Issues 跟踪在 GitHub Issues（qwlabs/skills），经 gh CLI 读写。See `docs/agents/issue-tracker.md`.

### Triage labels

沿用五个默认 triage 标签（needs-triage、needs-info、ready-for-agent、ready-for-human、wontfix）。See `docs/agents/triage-labels.md`.

### Domain docs

Single-context：根目录 `GLOSSARY.md` + `docs/adr/`（按需懒创建）。See `docs/agents/domain.md`.
