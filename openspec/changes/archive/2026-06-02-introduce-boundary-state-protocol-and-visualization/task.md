## Task Goal

Implement the minimal protocol, runtime, and prompt changes needed to give QDD an explicit project-level boundary state with controlled mutation and project-local visualization.

## Study Link

This task supports the study decision that QDD needs a durable question-state layer between `contract.yaml` and `evolution.yaml`, while keeping study tasks local and preventing the project from collapsing into a global task planner.

## Method

Implement the change in four coordinated parts:

1. Add the boundary-state core:
   - define `boundaries.yaml` in runtime paths, defaults, and types,
   - define one minimal boundary object and one thin boundary-update file shape,
   - and extend validation and status surfaces to understand boundary state.

2. Add the CLI control surface:
   - add `qdd boundaries --json` as the dedicated inspection path,
   - add `qdd boundaries apply --file <updates.yaml>` as the controlled mutation path,
   - and keep mutation validation inside CLI rather than in prompt prose.

3. Wire boundary state into workflows:
   - make `qdd init` scaffold the boundary file,
   - make `qdd-start` seed the first real boundary set through the CLI,
   - make `qdd-propose` read current boundaries and write `target_boundaries`,
   - and make `qdd-close` write study-local boundary updates before applying them to project state.

4. Add the first visualization slice:
   - read current boundary state, study targeting, and closure-time updates,
   - generate one project-local HTML view at `boundary-graph.html`,
   - and keep the first renderer report-style rather than turning it into a new app.

## Expected Outputs

- New protocol-aware runtime support for:
  - `boundaries.yaml`
  - `studies/STUDY-XXX/output/boundary-updates.yaml`
  - `target_boundaries` in study contracts
- New CLI surfaces:
  - `qdd boundaries --json`
  - `qdd boundaries apply --file <updates.yaml>`
  - `qdd boundaries render --output <path>`
- Updated workflow prompts and instructions for:
  - `qdd-start`
  - `qdd-propose`
  - `qdd-close`
- Validation or smoke coverage proving:
  - only the intended workflows mutate boundary state,
  - study targeting stays explicit,
  - and the renderer can produce a project-local HTML boundary view

## Run Contract

Each implementation run should record:

- which runtime files define or normalize boundary state,
- whether `qdd init` scaffolds `boundaries.yaml`,
- whether `qdd-start` and `qdd-close` mutate state through the CLI instead of raw edits,
- whether `study.md` now records `target_boundaries`,
- whether `evolution.yaml` or closure outputs retain enough information to audit boundary changes,
- whether `boundary-graph.html` is rendered at project root,
- and what test or smoke evidence proves the read / apply / render contract.

## Failure / Blocker Conditions

- Boundary state is still maintained only through free-text prompt behavior or direct YAML editing.
- `qdd-propose`, `qdd-explore`, or `qdd-apply` can mutate project boundary state directly.
- The new protocol is expressed as a task graph rather than as project-level unresolved boundaries.
- The renderer only shows a static snapshot and ignores study targeting or closure-time updates.
- The slice grows into a heavy planner, server, or hidden runtime database instead of staying a thin protocol and CLI contract.
