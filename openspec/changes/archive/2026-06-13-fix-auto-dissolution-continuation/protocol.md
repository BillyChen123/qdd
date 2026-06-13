## Filesystem Contract

Keep the existing QDD filesystem surfaces:

```text
evolution.yaml
context/memory/STUDY-XXX.md
studies/STUDY-XXX/study.md
studies/STUDY-XXX/tasks/TASK-XXX.md
studies/STUDY-XXX/output/
artifacts/index.yaml
```

Do not add a new managed decision file for this change.

`evolution.yaml` remains the sparse runtime-consumed source for frontier state:

```yaml
studies:
  - id: STUDY-004
    question: Which epithelial cell state drives the NOTCH repair signal in GSE298464?
    kind: dissolution
    resolves:
      - B002
    opens:
      - B003
    candidates:
      - "Question: Does the diffuse NOTCH activation model reproduce in GSE282122? Expected signal: ... Strategy: validation."
    ts: 2026-06-12T08:46:15.600Z
boundaries:
  - id: B003
    text: ...
    state: open
```

Rich reasoning stays in `context/memory/STUDY-XXX.md`. Candidate strings should keep the lightweight `Question / Expected signal / Strategy` shape introduced by `thesis/frontier-planning`.

## Identifiers And Metadata

No new identifiers are required.

Existing `kind` values keep their current meaning, but their scope must be interpreted precisely:

- `refinement`: study narrowed or sharpened the project frontier.
- `confirmation`: study stabilized the current direction.
- `pivot`: study shifted the frontier to a different but related question.
- `dissolution`: the closed study's current question or hypothesis collapsed.

`dissolution` is not automatically project-terminal. It is project-terminal only when no executable continuation remains.

Executable continuation means at least one of:

- `question_state.next_candidates.length > 0`
- `question_state.open_boundary_ids.length > 0`

For `dissolution`, continuation is valid only when candidates or boundaries imply a clear move away from the dissolved premise, typically:

- `Strategy: validation`
- `Strategy: robustness`
- `Strategy: pivot`
- a dataset feasibility or public-data candidate that can establish whether a validation resource exists

The first implementation does not need a full candidate parser. It can preserve a simple continuation check and use prompt guidance plus tests to ensure candidates include expected signals and strategies.

## Status JSON

Keep `qdd status --json` unchanged.

Runtime should continue to read:

- `question_state.last_kind`
- `question_state.next_candidates`
- `question_state.open_boundary_ids`
- lifecycle lists under `studies`
- task state and close preflight

Expected behavior:

```text
last_kind=dissolution
next_candidates non-empty
-> not terminal; next phase is qdd-propose
```

```text
last_kind=dissolution
next_candidates empty
open_boundary_ids empty
-> terminal; no executable continuation remains
```

```text
last_kind=dissolution
next_candidates empty
open_boundary_ids non-empty
-> not terminal; next phase is qdd-propose so study-brain can plan how to resolve the boundary
```

If later implementation derives a read-only `question_state.frontier_decision`, it must be derived from existing persisted state and not become a new truth source in this change.

## Instructions JSON

`qdd-close` instructions should keep exposing `thesis/frontier-planning` to thesis-manager and should add explicit guidance:

- local-hypothesis dissolution does not require human review if it has an executable pivot, validation, or robustness candidate
- use `needs-human` only for true contradiction, unsafe action, private data decision, or impossible-to-judge state
- when current data cannot support a stable conclusion, choose a next candidate that tests data fitness, validates in a previously discovered dataset, or searches for a better public dataset

`qdd-propose` instructions should add explicit guidance:

- when the previous close event is `dissolution`, do not keep digging in the rejected premise
- preserve the replacement model or boundary in the next study question
- prefer existing candidates and resources recorded in `evolution.yaml`, `context/memory/*.md`, `context/resources.md`, and artifacts before opening broad public-data search
- when the next candidate names a dataset such as `GSE282122`, propose a first task that verifies metadata and label fit before analysis

Task-level instructions remain unchanged except for any existing rule that apply must surface blockers instead of inventing broad replanning.

## Agent Usage Rules

Thesis-manager at close:

- decide whether the study dissolved a local hypothesis or the whole project frontier
- if the whole frontier is terminal, leave no executable candidates
- if a local hypothesis dissolved but useful routes remain, write candidates that explicitly move away from the failed premise
- when the issue is data inadequacy, prefer `validation`, `robustness`, or `pivot` over repeated serial deepening on the same weak data

Study-brain at propose:

- treat the latest candidate as a direction, not a mandate to repeat the previous failed analysis
- turn validation candidates into dataset-fit and analysis tasks
- turn robustness candidates into bounded method-comparison tasks
- turn pivot candidates into a new question that is supported by prior evidence
- if no existing dataset can answer the next question, create a public-data candidate-capture task rather than silently staying local-only

Runtime:

- preserve lifecycle routing before terminal checks
- stop on invalid state, phase incomplete, missing auth, agent failure, or max iterations
- stop when no next candidate and no open boundary remain
- do not stop solely because `last_kind` is `dissolution` when continuation signals exist
- keep auto continuation deterministic and schema-light
