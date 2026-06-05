## Filesystem Contract

This slice adds one new domain branch under the existing QDD central skill library.

```text
qdd-root/
├── domain-skills/
│   ├── brain/
│   │   └── singlecell/
│   │       ├── scrna-planning/
│   │       │   └── SKILL.md
│   │       └── scatac-planning/
│   │           └── SKILL.md
│   └── singlecell/
│       ├── scrna/
│       │   └── ...
│       └── scatac/
│           ├── scatac-preprocess-lsi/
│           │   ├── SKILL.md
│           │   ├── parameters.yaml
│           │   └── scripts/
│           ├── scatac-batch-latent/
│           │   ├── SKILL.md
│           │   ├── parameters.yaml
│           │   └── scripts/
│           ├── scatac-annotation-geneactivity/
│           │   ├── SKILL.md
│           │   ├── parameters.yaml
│           │   └── scripts/
│           └── scatac-dar/
│               ├── SKILL.md
│               ├── parameters.yaml
│               └── scripts/
└── ...
```

Project workspace layout does not change for this slice. The new scATAC skills must still produce study-local outputs under:

```text
project-root/
└── studies/
    └── STUDY-XXX/
        └── output/
            ├── data/
            ├── code/
            ├── figures/
            ├── tables/
            ├── reports/
            └── tmp/
```

Rules for this slice:

- `domain-skills/` under the QDD root remains the canonical source of domain knowledge.
- The new scATAC branch follows the same shape and quality bar as the current scRNA branch.
- Brain skills remain planning-only and must never appear in task `skills:`.
- Executor skills remain problem-level skills and must be runnable from their own skill directories.
- The first scATAC slice is `h5ad`-first:
  - matrix-only h5ad is supported,
  - mixed multiome h5ad is supported after repair/splitting,
  - fragment-aware mode may be recognized by planning, but full fragment-native execution is not required in this first slice.

## Identifiers And Metadata

Identifiers unchanged in this slice:

- workflow surfaces: `qdd-start`, `qdd-propose`, `qdd-explore`, `qdd-apply`, `qdd-close`
- study IDs: `STUDY-XXX`
- task IDs: `TASK-XXX`
- artifact IDs: `ART-XXX`

New skill IDs introduced here should follow:

- planning-only:
  - `brain/singlecell/scrna-planning`
  - `brain/singlecell/scatac-planning`
- executor problem-level:
  - `singlecell/scatac/scatac-preprocess-lsi`
  - `singlecell/scatac/scatac-batch-latent`
  - `singlecell/scatac/scatac-annotation-geneactivity`
  - `singlecell/scatac/scatac-dar`

Executor skill metadata must stay machine-readable in `SKILL.md` frontmatter:

- `domain: singlecell`
- controlled `stage`
- controlled `tags`

This slice should extend controlled tags only as needed for scATAC retrieval, for example around:

- peaks / peak-matrix semantics
- multiome repair or mixed-feature inputs
- TF-IDF / LSI representation
- batch diagnosis or correction
- gene-activity-based annotation
- differential accessibility

Task `skills:` remains the canonical task-local executor list. It must not contain:

- `brain/*`
- `qdd/*`
- filesystem paths
- raw method names such as `snapatac2`, `lsi`, or `leiden`

## Status JSON

`qdd status --json` does not need a new top-level shape in this slice.

Its meaning tightens in two places:

- a study that plans scATAC work should still expose ordinary task and output state without inventing a separate ATAC lifecycle,
- and skill validation should treat the new `singlecell/scatac/*` entries as ordinary executor problem-level skills once their metadata is cataloged.

No ATAC-specific runtime state file or side registry is introduced.

## Instructions JSON

`qdd instructions ... --json` remains the machine-facing contract.

For this slice, it should be able to support:

- `qdd-propose` and `qdd-explore` reading:
  - the scATAC planning brain skill
  - the project contract and resources
  - the skill catalog for `singlecell/scatac/*`
- `qdd-apply` reading:
  - task-local scATAC executor skills only
  - study-local output paths and artifact rules

This slice does not add a new instruction type. It relies on the existing workflow surfaces plus new domain skill content and metadata.

## Agent Usage Rules

- `qdd-propose` and `qdd-explore` should use `brain/singlecell/scatac-planning` whenever the study involves scATAC, snATAC, or multiome-ATAC planning.
- The planning skill must force one input-state judgment before task planning:
  - matrix-only h5ad
  - mixed multiome h5ad
  - fragment-aware mode
- The planning skill must force one four-stage review before downstream analysis:
  - Input & QC
  - Representation & Integration
  - Clustering & Annotation
  - Downstream Regulatory Analysis
- `qdd skills suggest` remains the only lightweight retrieval surface for executor skills during planning.
- `qdd-apply` must not invent a new ATAC planning phase; it should execute only the task-local `singlecell/scatac/*` skills already chosen during planning.
- Executor skills should preserve one reusable pre-downstream object as the stable handoff for later tasks, rather than producing ad hoc incompatible ATAC outputs.
