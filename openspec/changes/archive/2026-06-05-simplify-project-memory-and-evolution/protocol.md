## Filesystem Contract

This slice keeps the current QDD project layout and simplifies only the project-state surfaces.

```text
project-root/
├── contract.yaml
├── evolution.yaml
├── research-map.html
├── context/
│   ├── resources.md
│   └── memory/
│       ├── STUDY-001.md
│       └── STUDY-002.md
├── studies/
│   └── STUDY-XXX/
│       ├── study.md
│       ├── tasks/
│       │   └── TASK-XXX.md
│       └── output/
├── artifacts/
│   └── index.yaml
└── .qdd/
```

Rules for this slice:

- `contract.yaml` stays the stable project contract.
- `evolution.yaml` becomes the only structured truth source for project question evolution and current boundaries.
- `context/resources.md` stays the stable shared context surface.
- `context/memory/STUDY-XXX.md` is required at close time for every closed study.
- `research-map.html` is derived from `evolution.yaml` and must never be treated as a truth source.
- `boundaries.yaml` and study-local `boundary-updates.yaml` stop being required protocol files.

## Identifiers And Metadata

Study, task, and artifact IDs stay unchanged:

- `STUDY-XXX`
- `TASK-XXX`
- `ART-XXX`

`evolution.yaml` becomes a thin event-plus-map file:

```yaml
studies:
  - id: STUDY-001
    question: ...
    kind: refinement
    resolves: [B001]
    opens: [B002]
    candidates:
      - ...
    ts: 2026-06-05T10:00:00Z

boundaries:
  - id: B001
    text: ...
    state: resolved
  - id: B002
    text: ...
    state: open
    deps: [B003]
```

Field rules:

- `question` is the actual question this study worked on.
- `kind` is one of `refinement | confirmation | pivot | dissolution`.
- `resolves` lists boundary IDs closed by this study.
- `opens` lists newly created or newly exposed boundary IDs.
- `candidates` is a short list of possible next questions, not an authoritative next step.
- `boundaries` is the current project boundary map, not a second event log.
- `deps` is optional and should be written only when the dependency is scientifically meaningful.
- boundary `state` is intentionally light: `open | resolved`.

## Status JSON

`qdd status --json` should expose the lighter project state directly:

- current contract theme and mode
- current question:
  - latest study `question` if any studies exist
  - otherwise `contract.initial_question`
- active study/task summary
- open boundary summary derived from `evolution.yaml`
- recent memory files available under `context/memory/`

Status should stop depending on a separate boundary-score surface.

## Instructions JSON

`qdd instructions ... --json` remains the machine-facing contract.

This slice changes what each workflow reads and writes:

- `qdd-propose` and `qdd-explore` should read:
  - `contract.yaml`
  - `context/resources.md`
  - `evolution.yaml`
  - recent `context/memory/*.md`
- `qdd-apply` should continue to read study/task contracts and write outputs/evidence.
- `qdd-close` should write:
  - `evolution.yaml`
  - `context/memory/STUDY-XXX.md`
  - `research-map.html`
  - promoted artifacts and updated `context/resources.md` when appropriate

The instructions surface should stop requiring:

- `qdd boundaries --json`
- `qdd boundaries score ...`
- study-local `boundary-updates.yaml`

## Agent Usage Rules

- Keep `evolution.yaml` sparse and machine-friendly.
- Put study narrative, evidence pointers, reflections, and reusable lessons into `context/memory/STUDY-XXX.md`, not into `evolution.yaml`.
- Treat `candidates` as suggestions only. Human propose remains the highest semantic authority.
- Use the boundary map to visualize unresolved research space, not to run a heavy planning score loop.
- Derive the project graph from `evolution.yaml`; do not introduce a second hidden map store.
