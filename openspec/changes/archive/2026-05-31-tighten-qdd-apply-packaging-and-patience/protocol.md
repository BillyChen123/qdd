## Filesystem Contract

This slice keeps the current QDD layout but tightens the apply-time and close-time meaning of the study output surface.

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
│   └── index.yaml
└── .qdd/
```

Rules for this slice:

- `studies/STUDY-XXX/output/` remains the study-local truth surface.
- `output/data`, `code`, `figures`, `tables`, and `reports` are the canonical final packaging surface.
- `output/tmp/` is the allowed scratch surface for task-local or skill-local workspaces during execution.
- Task or skill execution may create temporary nested directories under `output/tmp/`, but those directories are not final study truth.
- Before a task is considered complete, its final reusable materials must be packaged back into the canonical study output surface.
- `artifact-candidates.yaml` remains the explicit promotion boundary.
- `qdd-close` must not guess reusable artifacts by scanning arbitrary output directories.

## Identifiers And Metadata

Identifiers unchanged in this slice:

- workflow surfaces: `qdd-start`, `qdd-propose`, `qdd-explore`, `qdd-apply`, `qdd-close`
- study IDs: `STUDY-XXX`
- task IDs: `TASK-XXX`
- artifact IDs: `ART-XXX`

New task-level execution metadata should stay minimal.

Add one explicit task promotion-review state:

- `promotion_status: pending | none | candidate-recorded | registered`

Semantics:

- `pending` - apply has not yet reviewed whether this task produced promotion-worthy outputs
- `none` - apply reviewed outputs and decided nothing should be promoted
- `candidate-recorded` - apply recorded one or more explicit entries in `artifact-candidates.yaml`
- `registered` - outputs were directly registered during apply and task provenance was preserved

Rules:

- completed tasks must not remain at `promotion_status: pending`
- empty `artifact-candidates.yaml` is valid only when the producing completed tasks have already moved to `none`
- `qdd-close` may trust an empty candidate list only when no completed task remains `pending`

## Status JSON

`qdd status --json` does not need a brand-new top-level schema, but its task view should become strong enough to expose:

- task completion state
- task promotion-review state
- whether the study output surface still contains unpackaged non-canonical top-level directories

No full run-state engine is introduced.

## Instructions JSON

`qdd instructions ... --json` remains the machine-facing contract.

This slice tightens the returned rules:

- `qdd-apply` instructions should require:
  - execute task
  - package final outputs into canonical study dirs
  - review promotion-worthiness
  - update `promotion_status`
- `qdd-close` instructions should require:
  - verify no completed task remains `promotion_status: pending`
  - verify reusable materials were reviewed before trusting an empty candidate list
  - refuse blind output-tree guessing

Long-running execution rules should also appear in apply-facing instructions:

- slow clustering, UMAP, integration, and large h5ad processing are not blockers by default
- absence of immediate output is not enough to justify a fallback
- real failure requires stronger evidence such as process exit, stable non-progress over a longer window, or explicit runtime error

## Agent Usage Rules

- `qdd-apply` owns promotion review for each completed task.
- `qdd-close` owns final promotion judgment, not initial candidate discovery.
- Skills may create temporary working directories under `output/tmp/`, but apply must package final materials into canonical dirs before marking the task complete.
- Canonical study outputs should preserve provenance through filenames, reports, and candidate metadata rather than through ad hoc top-level task folders.
- The first patience fix should be prompt-driven: wait longer, inspect progress, and only switch strategies when there is real evidence of failure.
