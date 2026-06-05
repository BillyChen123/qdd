## Filesystem Contract

This slice adds one planning skill and one executor branch under the existing central domain-skill library.

```text
qdd-root/
├── domain-skills/
│   ├── brain/
│   │   └── singlecell/
│   │       ├── scrna-planning/
│   │       ├── scatac-planning/
│   │       └── public-data-planning/
│   │           └── SKILL.md
│   └── singlecell/
│       ├── scrna/
│       ├── scatac/
│       └── public-data/
│           └── cellxgene-discover/
│               ├── SKILL.md
│               ├── parameters.yaml
│               └── scripts/
│                   └── cellxgene_discover.py
└── ...
```

Each study that uses this path may create one thin handoff file:

```text
project-root/
└── studies/
    └── STUDY-XXX/
        └── output/
            ├── public_data_request.yaml
            ├── data/
            ├── code/
            ├── figures/
            ├── tables/
            ├── reports/
            └── tmp/
```

Downloaded datasets should land under the normal reusable data surface:

```text
project-root/
└── artifacts/
    └── data/
        └── <selected-cellxgene-file>.h5ad
```

Rules for this slice:

- `domain-skills/` at the QDD root remains the single source of truth for both planning and executor skill content.
- `public_data_request.yaml` is the only required planning-to-apply handoff file for this slice.
- Planning may show candidate tables in the conversation, but should not create a second persisted candidate registry by default.
- Downloaded files should be registered back into `context/resources.md` and may later be promoted into study artifacts when they become evidence-bearing inputs.
- If a study can proceed entirely from local resources, it should not create a public-data handoff file or public-data task at all.
- If a study needs external public data but no acceptable CELLxGENE target is found, that failure should remain a study/task blocker, not a global apply failure for unrelated work.

## Identifiers And Metadata

New skill IDs introduced here:

- planning-only:
  - `brain/singlecell/public-data-planning`
- executor problem-level:
  - `singlecell/public-data/cellxgene-discover`

The new executor skill must expose machine-readable frontmatter in `SKILL.md`:

- `domain: singlecell`
- `stage: acquisition`
- controlled `tags`, including at least:
  - `public-data`
  - `dataset-search`
  - `dataset-download`
  - `cellxgene`

`public_data_request.yaml` should stay thin and human-editable. The minimum contract is:

```yaml
source: cellxgene
modality: scrna
goal: validation

query:
  organism: Homo sapiens
  tissue: ovary
  disease: ovarian cancer
  state: TRM
  cell_type:
  max_results: 5

selected:
  - dataset_id: 00000000-0000-0000-0000-000000000000
    alias: cellxgene_validation_01

selection_note: matched ovary cancer validation cohort
```

Rules:

- `query` records what planning decided to search.
- `selected` records what `qdd-apply` is allowed to download.
- `selection_note` stays short and optional, but gives minimal provenance for why the final target was chosen.
- The file must not grow into a large nested candidate manifest.
- The selected set should stay small by default:
  - normally one dataset,
  - at most two when the study explicitly needs both a primary target and one external validation or reference target.

## Status JSON

`qdd status --json` does not need a new top-level object in this slice.

Its meaning tightens in three places:

- if a study depends on external public data, the study output may include `public_data_request.yaml` as a normal output file,
- a study is still considered planning-complete only when any required public-data selection has already been written into `selected`,
- and downloaded `CELLxGENE` files remain ordinary project resources or artifacts rather than a separate public-data lifecycle type.

If no public-data task is required for the study, the absence of `public_data_request.yaml` should be treated as normal.
If a public-data task was required but no acceptable dataset was found, that unresolved state should appear as a study/task blocker rather than a generic project failure.

No new persistent runtime registry is introduced.

## Instructions JSON

`qdd instructions ... --json` remains the machine-facing contract.

For this slice, it should be able to support:

- `qdd-propose` and `qdd-explore` reading:
  - `brain/singlecell/public-data-planning`
  - `context/resources.md`
  - the central skill catalog entry for `singlecell/public-data/cellxgene-discover`
- `qdd-apply` reading:
  - task-local `singlecell/public-data/cellxgene-discover`
  - `studies/STUDY-XXX/output/public_data_request.yaml`
  - standard study output and artifact paths

The executor search path should at minimum be able to surface:

- `dataset_id`
- `dataset_title`
- `collection_name`
- `collection_doi` or citation metadata when available
- dataset cell count
- matched structured fields such as organism, tissue, disease, and cell type

Article abstracts or richer collection summaries may be used later when available, but they are not a required protocol dependency for this first slice.

This slice does not add a new instruction type. It relies on the existing workflow surfaces plus one new planning skill, one new executor skill, and one thin handoff file.

## Agent Usage Rules

- Use `brain/singlecell/public-data-planning` only during `qdd-propose` and `qdd-explore`.
- The planning skill must decide whether external public data is needed before any executor search is invoked.
- When public data is needed, planning should:
  - structure the search request,
  - call the executor skill's search path,
  - show the short candidate table in the conversation,
  - and write only the final `selected` dataset targets into `public_data_request.yaml`.
- If no acceptable public dataset is found, planning should either:
  - avoid creating a public-data task when the study can proceed locally, or
  - record a bounded blocker when external data is genuinely required.
- In `human` and `assist` mode, final selection requires explicit user confirmation unless the user has already made the target unambiguous.
- In `auto` mode, planning may finalize a small selected set directly, but `qdd-apply` still owns the actual download.
- `qdd-apply` must not reopen broad search. It may only download what is already listed under `selected`.
