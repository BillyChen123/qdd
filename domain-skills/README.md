# Domain Skills

`domain-skills/` is the central source tree for reusable domain skills maintained in this QDD repository.

Recommended layout:

```text
domain-skills/
├── genomics/
│   ├── scanpy-core-workflow/
│   │   └── SKILL.md
│   └── scanpy-marker-annotation/
│       └── SKILL.md
├── plot/
│   ├── scanpy-embedding-panels/
│   │   └── SKILL.md
│   ├── scanpy-expression-panels/
│   │   └── SKILL.md
│   └── plotting-ggplot/
│       ├── SKILL.md
│       └── scripts/
└── env/
    └── fix-cache-layout/
        └── SKILL.md
```

Rules:

- Each skill lives at `domain-skills/<category>/<skill-name>/`
- Each skill root must contain `SKILL.md`
- Extra files such as `scripts/`, `references/`, or templates may live inside the same skill directory
- `qdd init` copies every skill here into the target project's `.codex/skills/` and `.claude/skills/`
- `qdd init --refresh-bootstrap` re-syncs those projected copies from this source tree

Task files should reference the projected skill IDs, for example:

- `genomics/scanpy-core-workflow`
- `genomics/scanpy-marker-annotation`
- `plot/scanpy-embedding-panels`
- `plot/scanpy-expression-panels`
- `env/fix-cache-layout`

Do not use `qdd/*` workflow skills in task `skills:`.
