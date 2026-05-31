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
        │   ├── SKILL.md
        │   ├── parameters.yaml
        │   └── scripts/
        │       └── scrna_preprocess_qc.py
        ├── sc-batch-integration/
        │   ├── SKILL.md
        │   ├── parameters.yaml
        │   └── scripts/
        │       └── scrna_integration.py
        ├── sc-clustering/
        │   ├── SKILL.md
        │   ├── parameters.yaml
        │   └── scripts/
        │       └── scrna_clustering.py
        └── sc-marker-annotation/
            ├── SKILL.md
            ├── parameters.yaml
            └── scripts/
                └── scrna_marker_annotation.py
```

Rules:

- Planning skills live under `brain/*`
- Executor problem-level skills live under domain trees such as `singlecell/scrna/*`
- Each skill lives at `domain-skills/<category...>/<skill-name>/`
- Each skill root must contain `SKILL.md`
- Executor skills should normally contain:
  - `SKILL.md`: when to use the skill, output contract, execution notes
  - `parameters.yaml`: CLI surface, defaults, and output contract
  - `scripts/*.py`: directly runnable entry scripts
- Keep one clear entry script per skill, named by function such as `scrna_integration.py`, not generic names like `run.py`
- `references/` and `tests/` are optional; add them only when they materially improve reliability
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
