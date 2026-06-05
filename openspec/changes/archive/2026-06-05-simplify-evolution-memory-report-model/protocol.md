## Filesystem Contract

This slice keeps the current QDD scaffold and only tightens the project-state surfaces.

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

Protocol rules for this change:

- `contract.yaml` stays the stable project contract
- `evolution.yaml` is the only structured project evolution truth source
- `context/resources.md` stays the stable shared context surface
- `context/memory/STUDY-XXX.md` becomes the only default study narrative report
- `research-map.html` is derived output only and must never be edited as truth
- no separate `boundaries.yaml`
- no default study report file outside `context/memory/`

## Identifiers And Metadata

Study, task, and artifact identifiers stay unchanged:

- `STUDY-XXX`
- `TASK-XXX`
- `ART-XXX`

`evolution.yaml` should be reduced to this sparse structure:

```yaml
studies:
  - id: STUDY-001
    question: Which tumor-associated T-cell program is most reproducibly linked to response?
    kind: pivot
    resolves: [B001]
    opens: [B002, B003]
    candidates:
      - Compare responder and non-responder enrichment within CD8 sublineages
      - Validate the same signal in blood-derived T-cell compartments
    ts: 2026-06-05T10:00:00Z

boundaries:
  - id: B001
    text: Dataset-level response labels must be harmonized before cross-sample comparison
    state: resolved
  - id: B002
    text: Tumor and blood T-cell states may not be directly comparable without compartment control
    state: open
```

Field rules:

- `question` is the actual question the closed study addressed
- `kind` is one of `refinement | confirmation | pivot | dissolution`
- `resolves` lists boundary IDs resolved by this study
- `opens` lists newly exposed or newly created boundary IDs
- `candidates` is a short list of 1-3 candidate next questions
- `ts` is the close-time timestamp
- `boundaries[]` is the current project boundary set
- boundary items only require:
  - `id`
  - `text`
  - `state`
- boundary `state` stays intentionally light: `open | resolved`

Removed from the structured truth source:

- `question_before`
- `question_after`
- narrative evidence summaries
- long-form reflections
- duplicate report metadata

Those belong in `context/memory/STUDY-XXX.md`.

## Status JSON

`qdd status --json` should expose:

- contract theme and mode
- current active question:
  - latest `studies[].question` if any study has been closed
  - otherwise `contract.initial_question`
- open boundary summary derived from `evolution.yaml`
- recent memory files under `context/memory/`
- active study/task snapshot

Status must not depend on removed evolution fields or a second report surface.

## Instructions JSON

`qdd instructions ... --json` should reflect the new read/write contract.

`qdd-propose` and `qdd-explore` should read:

- `contract.yaml`
- `context/resources.md`
- `evolution.yaml`
- recent `context/memory/*.md`

`qdd-apply` should keep reading study/task contracts and producing evidence in study outputs.

`qdd-close` should write and/or update:

- `evolution.yaml`
- `context/memory/STUDY-XXX.md`
- `research-map.html`
- artifact promotion surfaces when applicable

The instructions surface should stop implying that agents need:

- `question_before`
- `question_after`
- a separate study report file
- a separate boundary-governance truth file

## Agent Usage Rules

- Keep `evolution.yaml` sparse and machine-stable
- Put narrative history, artifact pointers, reused materials, used skills, ad hoc scripts, and next-study reasoning into `context/memory/STUDY-XXX.md`
- Treat `candidates` as suggestions, not mandatory follow-ups
- Keep the research map fully derived from `evolution.yaml`
- Do not resurrect report duplication through prompts or runtime defaults
