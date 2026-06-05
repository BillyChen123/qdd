## Question

How should QDD represent, update, and visualize project-level question boundaries so that each study can act on a current boundary state without turning QDD into a task-planning system?

## Hypothesis / Expectation

If QDD adds one explicit `boundaries.yaml` current-state layer, one narrow CLI mutation surface, one study-level `target_boundaries` contract, and one project-local HTML renderer, then question evolution becomes auditable and eventually scoreable without requiring a heavy planner or hidden runtime store.

## Inputs

- Existing QDD project truth sources:
  - `contract.yaml`
  - `evolution.yaml`
  - `context/resources.md`
- Existing workflow semantics for:
  - `qdd-start`
  - `qdd-propose`
  - `qdd-close`
- Existing runtime and instructions surfaces in `src/runtime/` and `src/commands/`
- User requirements:
  - boundary state is a QDD core protocol, not a skill
  - only controlled CLI operations should mutate boundary state
  - the visualization output should live at project root, not under an artifact report subtree

## Evidence Plan

This study should produce:

- a minimal filesystem contract for `boundaries.yaml`
- a minimal machine interface contract for reading, applying, and rendering boundary state
- a clear authority model showing which workflows may read or write boundary state
- a study contract change that records `target_boundaries`
- a closure contract that records and applies structured boundary updates
- an implementation plan that keeps the first slice light and implementation-ready

## Blockers

- The slice could drift into a general workflow planner if task graphs are allowed to replace project boundary state.
- The mutation surface could become too broad if raw boundary editing is exposed to every workflow.
- The visualization could become misleading if it only reads current state and ignores study targeting or closure-time updates.
- The protocol may stay too vague to implement if boundary IDs, statuses, and update actions are not fixed early.

## Exit Signal

This study is ready to move into closure when:

- the boundary object shape is fixed and minimal,
- the writer authority is explicit (`qdd-start` and `qdd-close` only),
- the `qdd boundaries` interface is concrete enough to implement,
- the `study.md` targeting contract is clear,
- and the render path is specific enough to generate a project-local HTML view of boundary state and study evolution.
