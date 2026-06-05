## Filesystem Contract

This slice keeps the current QDD project layout but tightens the lifecycle contract carried through that layout.

```text
project-root/
├── contract.yaml
├── evolution.yaml
├── context/
├── data/
├── studies/
│   └── STUDY-XXX/
│       ├── study.md
│       ├── tasks/
│       │   └── TASK-XXX.md
│       └── output/
│           ├── code/
│           ├── figures/
│           ├── tables/
│           ├── reports/
│           └── artifact-candidates.yaml
├── artifacts/
│   └── index.yaml
├── .qdd/
│   ├── instructions.md
│   └── bootstrap.yaml
├── .codex/
│   └── skills/
└── .claude/
    ├── commands/
    └── skills/
```

Rules for this slice:

- One `study.md` still represents one bounded hypothesis-level research unit.
- A study may contain preparation, feasibility, metadata, and main-analysis tasks, as long as they all serve the same bounded hypothesis.
- `qdd-propose` must plan the complete first-pass task graph for the study rather than writing only one starter task by default.
- `qdd-apply` executes the declared task graph; it must not silently rely on undeclared follow-up tasks as part of the normal happy path.
- `qdd-explore` is an optional discussion surface, not a required lifecycle hop after every apply pass.
- `qdd-close` may close a study when the question has been materially updated and the closure judgment is explicit, even if the original claim was only partially proven.
- `artifact-candidates.yaml` remains the only promotion boundary for reusable study outputs.

## Identifiers And Metadata

Identifiers retained in this slice:

- modes: `human`, `assist`, `auto`
- workflow surfaces: `qdd-start`, `qdd-propose`, `qdd-explore`, `qdd-apply`, `qdd-close`
- study IDs: `STUDY-XXX`
- task IDs: `TASK-XXX`
- artifact IDs: `ART-XXX`
- question delta types: `refinement`, `confirmation`, `pivot`, `dissolution`

Metadata rules tightened by this slice:

- A proposed study should normally begin with a small first-pass task graph, typically `2-4` tasks, unless the study is genuinely atomic.
- `study.md` remains the bounded hypothesis contract; task decomposition belongs under `tasks/`, not in ad hoc execution notes.
- `task.md` frontmatter `skills:` and body `## Skills` must remain identical, and `qdd-propose` is the default writer of the initial skill list.
- `artifact-candidates.yaml` entries should include `task_id` whenever one task is the primary producer of that output.
- Candidate `scope` may remain `study` or `task`, but provenance should prefer the most specific real producer.
- `artifacts/index.yaml` entries must remain traceable back to the producing study and, when available, the producing task.

Minimal artifact-candidate example for this slice:

```yaml
artifact_candidates:
  - path: studies/STUDY-001/output/code/trm_axis_comparison.py
    type: code
    task_id: TASK-002
    reusable: true
    scope: task
    description: Main paired comparison script for the TRM-axis judgment.
    schema: python-script
```

## Status JSON

`qdd status --json` does not need a new top-level schema, but the lifecycle meaning becomes stricter:

- a study with only one starter task should not be treated as fully planned if the declared evidence plan clearly requires more first-pass tasks,
- a study may be `blocked` or `completed` and still be eligible for closure if its closure judgment is explicit,
- task graph completeness is a planning concern owned by `qdd-propose` and reflected in study/task records, not an invisible chat-only decision.

No new status object is required in this slice.

## Instructions JSON

`qdd instructions <id> --json` remains the main machine-facing execution boundary.

This slice clarifies how it should be used:

- `PROJECT` instructions remain the onboarding and shared-context boundary.
- `STUDY-XXX` instructions should authorize execution of the declared study task graph and expose the study-local promotion boundary at `artifact-candidates.yaml`.
- `TASK-XXX` instructions should continue to expose read paths, write paths, and required local skills for one declared task.
- `qdd-apply` should consume those study/task instructions as the approved execution surface; it should not need `qdd-explore` just to continue along the already-declared study graph.
- `qdd-close` should use the same instructions plus validation state to decide whether the study is closeable and which candidates should be promoted.

No new instructions target is required.

## Agent Usage Rules

- `qdd-propose` must write the first-pass study task graph up front and avoid the old “one starter task unless proven otherwise” default.
- `qdd-explore` is for discussing or reshaping the study when the hypothesis boundary, evidence plan, or execution path is under question; it is not the default continuation after ordinary task completion.
- `qdd-apply` executes the declared task graph, updates task and study state, and records study-local evidence. It should only return to `qdd-explore` when the study contract itself is under question.
- `qdd-close` is responsible for deciding whether the study is closeable, registering missing reusable candidates, writing `question_delta`, and carrying forward stable context.
- A study may close as `refinement` when it has narrowed or re-specified the question enough to justify the next hypothesis, even if the original claim was not fully confirmed.
- Agents must keep artifact promotion explicit and candidate-driven; do not guess by scanning the whole output tree.
- Agents must prefer task-level provenance for promoted outputs whenever one task is the clear producer.
- Code comments added in this slice are explanatory runtime guidance for humans, not a new truth source or protocol layer.
