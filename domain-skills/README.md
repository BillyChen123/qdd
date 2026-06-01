# Domain Skills

`domain-skills/` is the central source tree for reusable domain skills maintained in this QDD repository.

Recommended layout:

```text
domain-skills/
├── brain/
│   └── singlecell/
│       ├── scrna-planning/
│       │   └── SKILL.md
│       └── scatac-planning/
│           └── SKILL.md
│       └── public-data-planning/
│           └── SKILL.md
└── singlecell/
    ├── scrna/
    │   ├── sc-preprocess-qc/
    │   │   ├── SKILL.md
    │   │   ├── parameters.yaml
    │   │   └── scripts/
    │   │       └── scrna_preprocess_qc.py
    │   ├── sc-batch-integration/
    │   │   ├── SKILL.md
    │   │   ├── parameters.yaml
    │   │   └── scripts/
    │   │       └── scrna_integration.py
    │   ├── sc-clustering/
    │   │   ├── SKILL.md
    │   │   ├── parameters.yaml
    │   │   └── scripts/
    │   │       └── scrna_clustering.py
    │   └── sc-marker-annotation/
    │       ├── SKILL.md
    │       ├── parameters.yaml
    │       └── scripts/
    │           └── scrna_marker_annotation.py
    └── scatac/
        ├── scatac-preprocess-lsi/
        │   ├── SKILL.md
        │   ├── parameters.yaml
        │   └── scripts/
        │       └── scatac_preprocess_lsi.py
        ├── scatac-batch-latent/
        │   ├── SKILL.md
        │   ├── parameters.yaml
        │   └── scripts/
        │       └── scatac_batch_latent.py
        ├── scatac-annotation-geneactivity/
        │   ├── SKILL.md
        │   ├── parameters.yaml
        │   └── scripts/
        │       └── scatac_annotation_geneactivity.py
        └── scatac-dar/
            ├── SKILL.md
            ├── parameters.yaml
            └── scripts/
                └── scatac_dar.py
    └── public-data/
        └── cellxgene-discover/
            ├── SKILL.md
            ├── parameters.yaml
            └── scripts/
                └── cellxgene_discover.py
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
- `qdd init` records this tree as the central domain-skill source for the target project
- `qdd init --refresh-bootstrap` refreshes local QDD workflow assets and the skill catalog, not per-project copies of every domain skill
- Executor-facing problem-level skills must declare controlled frontmatter fields:
  - `domain`
  - `stage`
  - `tags`

Task files should reference the stable skill IDs, for example:

- `singlecell/scrna/sc-preprocess-qc`
- `singlecell/scrna/sc-batch-integration`
- `singlecell/scrna/sc-clustering`
- `singlecell/scrna/sc-marker-annotation`
- `singlecell/scatac/scatac-preprocess-lsi`
- `singlecell/scatac/scatac-batch-latent`
- `singlecell/scatac/scatac-annotation-geneactivity`
- `singlecell/scatac/scatac-dar`
- `singlecell/public-data/cellxgene-discover`

Do not use `qdd/*` workflow skills or `brain/*` planning skills in task `skills:`.
