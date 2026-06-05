## Filesystem Contract

This slice hardens the meaning of the study output surface and the reusable artifact surface.

```text
project-root/
├── studies/
│   └── STUDY-XXX/
│       ├── study.md
│       ├── tasks/
│       │   └── TASK-XXX.md
│       └── output/
│           ├── data/
│           ├── code/
│           ├── figures/
│           ├── tables/
│           ├── reports/
│           ├── tmp/
│           └── artifact-candidates.yaml
├── artifacts/
│   ├── data/
│   ├── code/
│   ├── figures/
│   ├── tables/
│   ├── reports/
│   └── index.yaml
└── .qdd/
```

Rules:

- `studies/STUDY-XXX/output/{data,code,figures,tables,reports}/` is the canonical final study output surface.
- `studies/STUDY-XXX/output/tmp/` is scratch space only.
- Final truth must not remain only in `tmp/`.
- If a task produces a reusable processed h5ad, the final kept copy belongs in `output/data/`.
- If a task is supported by one main executed script, the study must keep that script in `output/code/`.
- If a task conclusion depends on visual inspection, the key figure(s) must be kept in `output/figures/`.
- Reusable tabular outputs belong in `output/tables/`.
- `artifact-candidates.yaml` is the only promotion source. Close must not guess candidates by scanning arbitrary directories.
- Candidate paths must point to canonical study output locations, not to `output/tmp/` or task-private scratch paths.
- After promotion, reusable truth belongs in canonical `artifacts/*` locations.
- Study-local readability must be preserved after promotion, for example through a symlink, copied pointer file, or another explicit back-link mechanism chosen by implementation.

## Identifiers And Metadata

Identifiers remain:

- study IDs: `STUDY-XXX`
- task IDs: `TASK-XXX`
- artifact IDs: `ART-XXX`

Artifact-type expectations in this slice:

- valid artifact types must include `data`, `code`, `figure`, `table`, and `report`
- `table` is first-class and should not be forced into `data`

Candidate metadata rules:

- candidate `path` must resolve under the study's canonical output surface
- candidate `path` must not resolve into `output/tmp/`
- when one task clearly produced the output, candidate metadata should keep `task_id` so task-level provenance survives promotion

Close-time semantics:

- `qdd close-study` should run preflight checks first
- if preflight fails, close stops with explicit errors
- if preflight passes, close executes directly without an extra human confirmation barrier

## Status JSON

`qdd status --json` should stay light but expose enough lifecycle state to make close behavior understandable.

At minimum, status should be able to report:

- which completed tasks still have pending promotion review
- whether artifact candidates include invalid scratch paths
- whether non-canonical final outputs remain outside `output/{data,code,figures,tables,reports,tmp}`
- whether close would block on preflight

No separate lifecycle database is introduced.

## Instructions JSON

`qdd instructions ... --json` remains the machine-facing gateway.

This slice tightens two command surfaces:

- `qdd-apply` instructions should require:
  - package final outputs into canonical study output directories before the task is treated as done
  - keep scratch-only intermediates under `output/tmp/`
  - record promotion-worthy outputs in `artifact-candidates.yaml`
  - ensure the final kept h5ad/script/figure/table surface is reviewable
- `qdd-close` instructions should require:
  - reject candidates that still point to `tmp/`
  - auto-promote explicit candidates into canonical `artifacts/*` locations
  - preserve study-local back-links after promotion
  - clean heavy scratch leftovers after successful close
  - proceed directly after preflight instead of asking for an extra manual confirmation

## Agent Usage Rules

- `qdd-apply` owns packaging outputs into one clean study-level final surface.
- `qdd-apply` should not leave the only copy of final truth in `output/tmp/`.
- `qdd-close` owns explicit promotion, canonicalization, and scratch cleanup.
- `qdd-close` must never infer reusable artifacts from scratch directories.
- Promote only what `artifact-candidates.yaml` explicitly names.
- Treat the absence of a manual confirmation gate as permission to finish closure once all preflight conditions are satisfied.
