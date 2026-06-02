# Domain Docs

How engineering skills should consume domain documentation when working in this repo.

## Per-skill self-contained model

Each skill in `skills/<name>/` is independent with its own domain vocabulary. There is no shared context or terminology across skills.

- Domain terms, usage, and architecture are fully documented in each skill's `SKILL.md`.
- No `CONTEXT.md`, `CONTEXT-MAP.md`, or `docs/adr/` at the project level.
- If a skill grows complex enough to need a separate glossary or decision records, those live inside `skills/<name>/` and are referenced from its `SKILL.md`.

## When working in a skill

- Use the vocabulary defined in that skill's `SKILL.md`. Don't drift to synonyms.
- If the concept you need isn't documented, that's a signal — either you're inventing language the skill doesn't use (reconsider) or there's a real gap (note it).
- If your output contradicts something documented in `SKILL.md`, surface it explicitly rather than silently overriding.

## File structure

```
skills/
└── <name>/
    └── SKILL.md          ← single source of truth for this skill
```

If `SKILL.md` doesn't exist for a skill directory, proceed silently.
