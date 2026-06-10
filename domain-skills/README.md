# Domain Skills

`domain-skills/` is the central source tree for reusable domain skills maintained in this QDD repository.

Recommended layout:

```text
domain-skills/
├── brain/
│   ├── public-data/
│   │   ├── public-data-planning/
│   │       └── SKILL.md
│   │   └── reference-planning/
│   │       └── SKILL.md
│   ├── spatial/
│   │   └── spatial-planning/
│   │       └── SKILL.md
│   └── singlecell/
│       ├── scrna-planning/
│       │   └── SKILL.md
│       └── scatac-planning/
│           └── SKILL.md
├── public-data/
│   ├── cellxgene-discover/
│   │   ├── SKILL.md
│   │   ├── parameters.yaml
│   │   └── scripts/
│   │       └── cellxgene_discover.py
│   ├── cellmarker-fetch/
│   │   └── ...
│   ├── geo-candidate-capture/
│   │   └── ...
│   ├── lrdb-fetch/
│   │   └── ...
│   └── pubmed-evidence-capture/
│       └── ...
├── singlecell/
│   ├── scrna/
│   │   ├── sc-preprocess-qc/
│   │   ├── sc-batch-integration/
│   │   ├── sc-clustering/
│   │   ├── sc-marker-annotation/
│   │   └── sc-cell-communication/
│   └── scatac/
│       ├── scatac-preprocess-lsi/
│       ├── scatac-batch-latent/
│       ├── scatac-annotation-geneactivity/
│       └── scatac-dar/
└── spatial/
    ├── spatial-preprocess-qc/
    ├── spatial-batch-integration/
    ├── spatial-clustering/
    ├── spatial-marker-annotation/
    └── spatial-neighborhood-analysis/
```

This tree is illustrative, not exhaustive. New executor skills should extend the same domain-rooted structure instead of creating new top-level taxonomies.

Rules:

- Planning skills live under `brain/*`
- Executor problem-level skills live under domain trees such as `singlecell/scrna/*`, `spatial/*`, or `public-data/*`
- Not every `public-data/*` skill uses `public_data_request.yaml`; dataset acquisition and lighter public-data capture tasks are intentionally separate
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
- `singlecell/scrna/sc-cell-communication`
- `singlecell/scatac/scatac-preprocess-lsi`
- `singlecell/scatac/scatac-batch-latent`
- `singlecell/scatac/scatac-annotation-geneactivity`
- `singlecell/scatac/scatac-dar`
- `spatial/spatial-batch-integration`
- `spatial/spatial-clustering`
- `spatial/spatial-marker-annotation`
- `public-data/cellxgene-discover`
- `public-data/cellmarker-fetch`
- `public-data/geo-candidate-capture`
- `public-data/lrdb-fetch`
- `public-data/pubmed-evidence-capture`

Do not use `qdd/*` workflow skills or `brain/*` planning skills in task `skills:`.
