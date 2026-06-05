## Filesystem Contract

This slice keeps the existing QDD layout and adds one explicit promotion manifest inside each study output area.

```text
project-root/
├── studies/
│   └── STUDY-XXX/
│       ├── study.md
│       ├── tasks/
│       └── output/
│           ├── code/
│           ├── figures/
│           ├── tables/
│           ├── reports/
│           └── artifact-candidates.yaml
├── artifacts/
│   └── index.yaml
└── .qdd/
```

Rules for this slice:

- `studies/STUDY-XXX/output/` remains the primary write location for study-local evidence.
- `code/`, `figures/`, `tables/`, and `reports/` are conventions, not a second storage system.
- `artifact-candidates.yaml` is the explicit list of outputs eligible for promotion into the reusable artifact registry.
- `artifacts/index.yaml` continues to track only promoted artifacts, not every local output.

## Identifiers And Metadata

This slice keeps existing identifiers:

- Study IDs: `STUDY-XXX`
- Task IDs: `TASK-XXX`
- Artifact IDs: `ART-XXX`

It adds a minimal artifact-candidate record with fields that are explicit enough for closure-time promotion:

```yaml
artifact_candidates:
  - path: studies/STUDY-001/output/code/kc_alox12b_state.py
    type: code
    task_id: TASK-002
    reusable: true
    scope: study
    description: Main analysis script for the KC ALOX12B state judgment.
    schema: python-script
```

Notes:

- `path` is the unique key for deduplication within a study.
- `task_id` is optional but preferred when the candidate came from one task.
- Final `ART-XXX` assignment still happens only through artifact registration.

## Status JSON

The first slice does not need a new top-level `qdd status --json` schema.

Required behavior is simpler:

- closure-time promotion must update the existing artifact count through normal artifact registration,
- study and task execution should remain visible through existing status fields,
- and higher-level project status should not be expanded just to support evidence packaging.

If a later slice needs promotion visibility, it can add candidate counts then.

## Instructions JSON

`qdd instructions <id> --json` should continue to be the main execution boundary API, but this slice requires updated path guidance.

Study-level write bounds should include:

- `studies/STUDY-XXX/study.md`
- `studies/STUDY-XXX/output/`
- `studies/STUDY-XXX/output/artifact-candidates.yaml`
- `artifacts/index.yaml` during closure

Task-level write bounds should include:

- `studies/STUDY-XXX/tasks/TASK-XXX.md`
- `studies/STUDY-XXX/output/`
- `studies/STUDY-XXX/output/artifact-candidates.yaml`

Task and study rules should explicitly tell agents:

- preserve the executable script for non-trivial analyses,
- save key figures when the claim depends on visual evidence,
- keep ordinary study-local outputs out of the artifact registry unless they were explicitly marked for promotion.

## Agent Usage Rules

- `qdd-apply` should package evidence as it works, not wait until the end to remember what mattered.
- When a task performs substantive analysis, the agent should leave a readable script in `output/code/` unless the work was purely file inspection.
- When a study conclusion depends on visual inspection, the agent should save at least one figure in `output/figures/` or state clearly why no figure was needed.
- `artifact-candidates.yaml` should be updated only for outputs worth promoting across sessions or across studies.
- `qdd-close` should read `artifact-candidates.yaml`, register any missing entries, and only then finalize closure.
- `qdd-close` should not guess by scanning all output files or promote files solely by extension.
- This slice keeps promotion explicit and local to the study; it does not introduce a new project-level artifact planner.
