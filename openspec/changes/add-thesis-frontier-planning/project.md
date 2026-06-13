## Theme

Add a thesis-level planning layer for QDD auto mode so project-level research direction, continuation, and stopping decisions are made by a thesis-manager skill instead of hidden runtime heuristics.

## Initial Question

How should QDD let the thesis manager decide whether the project should continue, stop, or escalate, while keeping the runtime gate light and executable?

## Mode

`auto`

The thesis manager owns research judgment at `qdd-start` and `qdd-close`. The runtime owns only phase execution, schema validation, and safety checks. In auto mode, `needs-human` is exceptional and should be used only when the thesis decision is contradictory, unsafe, or not judgeable from persisted evidence.

## Scope

### In Scope

- Introduce a separate `thesis/*` skill namespace, distinct from `brain/*` and executor skills.
- Add a first thesis skill: `thesis/frontier-planning`.
- Give `thesis-manager` a default role skill for frontier planning.
- Define a lightweight thesis decision format:
  - `decision`
  - `change_type`
  - `summary`
  - `open_boundaries`
  - `next_candidates`
  - `stop_reason`
- Preserve `expected_signal` as the key field inside each next candidate.
- Make runtime consume the thesis decision for continue/stop behavior, while keeping validation and phase-completion checks.
- Keep `qdd-propose` and study-brain responsible for turning a next candidate into a concrete study/task graph.

### Out Of Scope

- New heavy project-management schema.
- Full run-resume manifests or Claude conversation replay.
- New `qdd steer` command.
- Replacing `qdd-propose` or study-brain planning.
- Letting thesis skills appear in task `skills:`.
- Broad literature-agent implementation or web-search automation inside this change.

## Evidence Standard

This change is successful when:

- `qdd instructions PROJECT --command qdd-start --json` and `qdd instructions STUDY-XXX --command qdd-close --json` can expose the thesis frontier skill to the thesis-manager role.
- `qdd-apply` and task instructions reject `thesis/*` as task skills.
- `qdd-close` guidance tells the thesis manager to produce a lightweight decision with at most 1-3 next candidates.
- Auto continuation is driven by the persisted thesis decision rather than independent runtime research heuristics.
- Runtime still refuses malformed, contradictory, or non-executable decisions.
- Existing study-brain and executor skill behavior remains unchanged.

## Shared Context

Current role wiring:

- `qdd-start` -> `thesis-manager`
- `qdd-propose` -> `study-brain`
- `qdd-explore` -> `study-brain`
- `qdd-apply` -> `executor`
- `qdd-close` -> `thesis-manager`

Current gap:

- `thesis-manager` has no role-level skills.
- `study-brain` has `brain/*` planning skills.
- executor task skills are selected per task.

The new thesis layer should sit above study-brain:

```text
thesis/frontier-planning
  -> decide project continuation and next candidates
brain/*
  -> plan one bounded study from a selected candidate
executor skills
  -> execute one task and produce evidence
```
