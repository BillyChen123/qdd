## Filesystem Contract

This slice keeps the current QDD layout and adds one read-only proposal scoring surface over the existing boundary state.

```text
project-root/
├── contract.yaml
├── boundaries.yaml
├── evolution.yaml
├── context/
│   └── resources.md
├── studies/
│   └── STUDY-XXX/
│       ├── study.md
│       ├── tasks/
│       │   └── TASK-XXX.md
│       └── output/
│           ├── artifact-candidates.yaml
│           ├── boundary-updates.yaml
│           ├── code/
│           ├── data/
│           ├── figures/
│           ├── reports/
│           └── tables/
├── artifacts/
│   ├── index.yaml
│   ├── code/
│   ├── data/
│   ├── figures/
│   └── reports/
└── .qdd/
    ├── instructions.md
    └── bootstrap.yaml
```

Rules for this slice:

- `boundaries.yaml` remains the only project question-state truth source used for scoring.
- `study.md` remains the current-study contract and keeps `target_boundaries`.
- The score surface is derived data; it must not write or cache hidden proposal state.
- `qdd-propose` and `qdd-explore` may read scoring output but may not mutate project boundary state.
- Human-mode proposal flow may preserve a larger long-range target in prose, but the actual current study contract must still bind to executable target boundaries.

## Identifiers And Metadata

Identifiers retained in this slice:

- workflow commands: `qdd-start`, `qdd-propose`, `qdd-explore`, `qdd-apply`, `qdd-close`
- boundary IDs: `B001`, `B002`, ...
- boundary statuses: `open`, `narrowed`, `resolved`, `dissolved`

No new persisted boundary fields are added.

Structural definitions used by the score surface:

- `active boundary`
  - any boundary whose status is `open` or `narrowed`
- `target set`
  - the boundaries requested by `--targets` or read from `study.md`
- `active ancestor closure`
  - the target set plus all active upstream dependencies required by those targets
- `frontier`
  - the members of the active ancestor closure that have no active ancestors inside that same closure
- `reachable active mass`
  - the active boundary mass reachable downstream from the frontier, including the frontier itself

`narrowed` semantics in this slice:

- `narrowed` remains active for legality and reachability calculations.
- If a narrowed boundary is less important than before, that reduction should already be reflected in its updated `weight`.
- The score surface must not apply a hard-coded extra multiplier such as `0.5` to narrowed boundaries.

## Score JSON

This slice adds:

```text
qdd boundaries score --targets B001,B002 --json
qdd boundaries score --study STUDY-001 --json
```

Required output fields:

- `mode`
  - `targets` or `study`
- `target_boundaries`
  - the requested current-study target set
- `legal`
  - whether the target set can stand as one current study without missing active ancestors
- `missing_active_ancestors`
  - active dependencies not included in the requested target set
- `suggested_frontier`
  - the frontier boundaries that should define the current study when the request is too large
- `closure`
  - active ancestor closure IDs
- `frontier`
  - executable frontier IDs
- `closure_size`
- `frontier_size`
- `closure_mass`
  - sum of weights over the active ancestor closure
- `frontier_mass`
  - sum of weights over the frontier
- `reachable_active_mass`
  - sum of weights over active boundaries reachable from the frontier, including the frontier
- `active_project_mass`
  - sum of weights over all active project boundaries
- `quality_score`
  - `frontier_mass / closure_mass`, or `1` when closure and frontier are identical
- `priority_score`
  - `reachable_active_mass / active_project_mass`
- `notes`
  - short machine-readable flags such as `needs-frontier-downshift` or `wide-frontier`

Interpretation rules:

- `quality_score` measures readiness of the requested study as a single closeable slice.
- `priority_score` measures how much active project boundary mass this frontier could unlock relative to the current whole project.
- `frontier_size` is a burden indicator, not the main denominator of the score.
- A legal target set may still be broad if `frontier_size` is large; that should guide discussion in `qdd-explore`.

## Instructions JSON

`qdd instructions <id> --json` remains the machine-facing contract.

This slice tightens workflow usage:

- `STUDY-XXX` with `--command qdd-propose`
  - must inspect current boundary state before finalizing `target_boundaries`
  - should call `qdd boundaries score` on the intended target set
  - in `human` mode, should preserve the user's long-range goal and explicitly explain any frontier downshift recommendation
  - in `auto` mode, may directly use `suggested_frontier` as the current study target set
- `STUDY-XXX` with `--command qdd-explore`
  - should call `qdd boundaries score --study <id> --json`
  - should use legality, missing ancestors, quality score, priority score, and frontier breadth to discuss reshaping the study
- `qdd-apply` and `qdd-close`
  - do not need to call the score surface in the normal path for this slice

No new persistent instruction target is introduced.

## Agent Usage Rules

- Distinguish the user's long-range scientific target from the current executable study.
- Do not respond to a multi-layer target by merely adding more tasks inside one study.
- If unresolved active ancestors remain, treat that as a study-sizing problem first, not a task-writing problem.
- Use `quality_score` to judge whether the current target is structurally ready for one study.
- Use `priority_score` to judge whether the proposed frontier matters enough relative to the rest of the project.
- Use `frontier_size` as a warning that the current frontier may still be too wide even when it is legal.
- Keep the score surface deterministic and explainable from `boundaries.yaml`; avoid hidden LLM-only grading logic.
