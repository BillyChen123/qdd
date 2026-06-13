## Filesystem Contract

Keep the existing QDD file layout. Do not introduce a new managed decision file in this change.

The thesis decision is represented through the existing closure surfaces:

```text
evolution.yaml
context/memory/STUDY-XXX.md
research-map.html
```

`evolution.yaml` remains the runtime-consumed source:

```yaml
studies:
  - id: STUDY-XXX
    question: ...
    kind: refinement | confirmation | pivot | dissolution
    resolves: []
    opens: []
    candidates:
      - "Question? Expected signal: ... Strategy: ..."
    ts: ...
boundaries:
  - id: BXXX
    text: ...
    state: open | resolved
```

The richer thesis reasoning belongs in `context/memory/STUDY-XXX.md`, not in a new YAML file.

## Identifiers And Metadata

Add a separate thesis skill namespace:

```text
domain-skills/thesis/frontier-planning/SKILL.md
```

Skill namespace semantics:

- `thesis/*` skills are role-level planning skills for `thesis-manager`.
- `brain/*` skills are study-level planning skills for `study-brain`.
- problem-level executor skills remain task-local and catalogued by domain/stage/tags.
- `thesis/*` must not appear in task frontmatter `skills:`.

Lightweight thesis decision fields:

```yaml
decision: continue | stop | needs-human
change_type: refinement | confirmation | pivot | dissolution
summary: string
open_boundaries:
  - string
next_candidates:
  - question: string
    expected_signal: string
    strategy: serial-deepen | evidence-fanout | explore-then-synthesize | validation | robustness | pivot
stop_reason: string
```

This structure is a reasoning contract for the thesis skill and close prompt. The current implementation may serialize it into `evolution.yaml` and memory rather than adding a new managed file.

## Status JSON

`qdd status --json` should remain lightweight.

No new top-level status field is required for the first implementation. Existing fields remain sufficient:

- `question_state.last_kind`
- `question_state.next_candidates`
- `question_state.open_boundary_ids`
- study lifecycle lists
- close preflight state

If the implementation adds a small derived field later, it should be read-only and derived from `evolution.yaml`, not a new truth source.

## Instructions JSON

`qdd instructions` should expose thesis skills only to thesis-manager surfaces:

- `qdd instructions PROJECT --command qdd-start --json`
- `qdd instructions STUDY-XXX --command qdd-close --json`

`qdd instructions STUDY-XXX --command qdd-propose --json` remains study-brain oriented.

`qdd instructions TASK-XXX --command qdd-apply --json` must continue to reject thesis and brain planning skills in task skill lists.

## Agent Usage Rules

Thesis-manager usage:

- read the whole project state, recent memory, and current study outputs before deciding continuation
- use `thesis/frontier-planning` to choose `decision`, `change_type`, open boundaries, and 1-3 next candidates
- in auto mode, prefer `continue` or `stop`; use `needs-human` only for contradictory state, unsafe action, or missing essential judgment
- every next candidate must include an expected signal in the candidate text or memory so the next study can be judged

Runtime usage:

- do not infer scientific continuation independently when a valid thesis decision is present
- continue when the thesis decision is `continue` and there is at least one executable next candidate or open boundary
- stop when the thesis decision is `stop` and no phase lifecycle work remains
- treat `needs-human` as a non-terminal blocked/attention state in auto mode
- still enforce invalid-state, phase-incomplete, missing-auth, agent-failed, and max-iteration stops

Study-brain usage:

- read thesis next candidates as soft direction
- turn one candidate into a bounded study and concrete tasks
- preserve the candidate's expected signal in the study evidence plan

Executor usage:

- execute task-local skills only
- do not reinterpret thesis strategy during apply
