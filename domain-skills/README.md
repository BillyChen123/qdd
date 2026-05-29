# Domain Skills

`domain-skills/` is the central source tree for reusable domain skills maintained in this QDD repository.

Recommended layout:

```text
domain-skills/
├── brain/
│   └── study-planning-core/
│       └── SKILL.md
└── singlecell/
    └── scrna/
        ├── sc-preprocess-qc/
        │   └── SKILL.md
        ├── sc-batch-integration/
        │   └── SKILL.md
        ├── sc-clustering/
        │   └── SKILL.md
        └── sc-marker-annotation/
            └── SKILL.md
```

Rules:

- Planning skills live under `brain/*`
- Executor problem-level skills live under domain trees such as `singlecell/scrna/*`
- Each skill lives at `domain-skills/<category...>/<skill-name>/`
- Each skill root must contain `SKILL.md`
- Extra files such as `scripts/`, `references/`, or templates may live inside the same skill directory
- `qdd init` copies every skill here into the target project's `.codex/skills/` and `.claude/skills/`
- `qdd init --refresh-bootstrap` re-syncs those projected copies from this source tree
- Executor-facing problem-level skills must declare controlled frontmatter fields:
  - `domain`
  - `stage`
  - `tags`

Task files should reference the projected skill IDs, for example:

- `singlecell/scrna/sc-preprocess-qc`
- `singlecell/scrna/sc-batch-integration`
- `singlecell/scrna/sc-clustering`
- `singlecell/scrna/sc-marker-annotation`

Do not use `qdd/*` workflow skills or `brain/*` planning skills in task `skills:`.
