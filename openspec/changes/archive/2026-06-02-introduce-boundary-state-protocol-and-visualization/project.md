## Theme

Add a project-level boundary-state protocol to QDD so question evolution is represented as explicit, machine-readable state rather than only as free-text study summaries.

## Initial Question

How should QDD introduce a stable `boundaries.yaml` truth source, a narrow CLI update surface, and a project-local HTML visualization so that study closure updates project question state without collapsing QDD into task planning?

## Mode

`human`

Humans still own the project theme, boundary weights, and final closure judgment. Agents may initialize and update boundary state through QDD CLI entrypoints, but must not freely edit project question state outside the controlled `qdd boundaries` interface or treat task graphs as the project's primary planning object.

## Scope

### In Scope

- Add a project-level `boundaries.yaml` file as the current boundary-state truth source beside `contract.yaml` and `evolution.yaml`.
- Define one minimal boundary object with stable IDs, dependency links, weight, and lifecycle status.
- Scaffold the default boundary file during `qdd init`.
- Add a read surface such as `qdd boundaries --json` for planning and inspection.
- Add one controlled write surface such as `qdd boundaries apply --file <updates.yaml>` for boundary-state mutation.
- Tighten `qdd-start` so it seeds the first real project boundary state through the CLI rather than by direct file editing.
- Tighten `qdd-close` so it updates project boundary state through the CLI before finalizing `question_delta`.
- Extend study planning so `study.md` records which project boundaries the study is trying to compress.
- Add a professional first-pass HTML renderer for the boundary graph and its study-level evolution, written into the project directory rather than an artifact subtree.

### Out Of Scope

- Building a general-purpose graph editor or a large runtime planner around boundaries.
- Reframing QDD as a task dependency engine or forward-planned workflow graph.
- Letting `qdd-propose`, `qdd-explore`, or `qdd-apply` mutate project boundary state directly.
- Designing proposal quality scoring formulas beyond the protocol inputs needed to support that work later.
- Adding a browser app, server, or heavy visualization stack beyond one generated HTML report.

## Evidence Standard

This change is successful when:

- initialized projects contain a readable `boundaries.yaml` scaffold,
- `qdd-start` and `qdd-close` are the only workflow prompts authorized to mutate project boundary state,
- `qdd-propose` can read current boundaries and record explicit `target_boundaries` in the study contract,
- boundary updates happen through one controlled CLI apply surface instead of ad hoc YAML edits,
- the project can render an HTML boundary view that shows current boundaries, dependencies, study targeting, and boundary updates over time,
- and the resulting protocol stays question-centered rather than drifting into a task planner.

## Shared Context

- QDD already has `contract.yaml` for project scope and `evolution.yaml` for question history, but it lacks a current-state layer for open boundaries and their dependencies.
- The user wants question evolution to be objectively computable later, which requires a project-owned state representation rather than agent-only reasoning in prompts.
- The user explicitly does not want a task graph to become the project's main semantic object; study tasks remain local execution structure, while project boundaries remain the durable research state.
- The desired authority model is narrow: `qdd init` scaffolds the file, `qdd-start` seeds the first real boundary set, `qdd-close` applies later updates, and other workflows only read.
- The user also wants a project-local visualization output so each study can be inspected as a change to the boundary landscape, not just as a standalone result bundle.
