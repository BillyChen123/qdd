## Task Goal

Replace the current boundary-centered project-state loop with a lighter evolution-plus-memory loop that still supports closure, carry-forward context, and derived visualization.

## Study Link

This task implements the bounded study defined in `study.md`: simplify project memory and evolution semantics without redesigning the rest of QDD.

## Method

Update QDD in one coordinated slice:

- redefine the project-state types and defaults around the new `evolution.yaml`
- remove `boundaries.yaml` from the required runtime and validation path
- make `qdd-close` append the simplified study event, refresh the current boundary map, and write `context/memory/STUDY-XXX.md`
- replace the old boundary-graph render path with a derived `research-map.html`
- retune prompts and instructions so planning reads contract/resources/evolution/memory instead of score-driven boundary state

## Expected Outputs

- updated types/defaults/store/validation for the new `evolution.yaml`
- updated lifecycle/status/instructions behavior
- new close-time memory writer
- new or rewritten graph renderer
- updated workflow prompts
- smoke coverage for init, close, status, and instructions under the new protocol

## Run Contract

Each implementation run should record:

- which protocol files were changed
- whether old boundary commands/files were removed, deprecated, or left as compatibility shims
- one concrete example of the new `evolution.yaml`
- one concrete example of the generated `context/memory/STUDY-XXX.md`
- one verification result for `research-map.html`

## Failure / Blocker Conditions

- The new `evolution.yaml` still requires duplicate narrative fields to be understandable.
- `memory` becomes the only place where essential project state lives.
- The graph renderer still depends on a second structured truth source.
- The change leaves prompts and tests half on the old boundary-score model and half on the new model.
