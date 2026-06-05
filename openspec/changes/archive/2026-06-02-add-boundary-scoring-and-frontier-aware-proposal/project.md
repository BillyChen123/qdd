## Theme

Add a boundary-native scoring surface to QDD so proposal quality can be computed from project question state, while `qdd-propose` and `qdd-explore` stop collapsing large long-range hypotheses into one overloaded study.

## Initial Question

How should QDD score one proposed study directly from `boundaries.yaml`, preserve the user's long-range hypothesis in human mode, and still recommend or enforce a smaller frontier study when the target still depends on unresolved upstream boundaries?

## Mode

`human`

Humans still own the real scientific intent, the final study boundary, and boundary weights. Agents may compute boundary-derived scores, explain why a target is too large for one study, and suggest a tighter frontier study, but must not silently replace the user's long-range goal with a different research question.

## Scope

### In Scope

- Add one CLI scoring surface for proposal-time and explore-time use:
  - `qdd boundaries score --targets <ids> --json`
  - `qdd boundaries score --study <study-id> --json`
- Define a pure structural scoring model based on current boundary state, active ancestor closure, executable frontier, and reachable active mass.
- Report legality, missing active ancestors, suggested frontier boundaries, and scoring outputs that `qdd-propose` and `qdd-explore` can consume directly.
- Tighten `qdd-propose` so large user hypotheses are preserved as long-range targets but the current study is recommended or down-shifted to the executable frontier instead of becoming one overloaded study.
- Tighten `qdd-explore` so it uses the same score surface to discuss whether a proposed study is too large, too wide, or insufficiently ready.
- Keep the current boundary protocol minimal: no new core graph fields beyond `id`, `text`, `depends_on`, `weight`, and `status`.

### Out Of Scope

- Adding a new planner database, project graph editor, or hidden routing engine.
- Replacing human judgment with an LLM-only proposal grader.
- Redefining project boundaries as task graphs or letting task count become the primary truth source for proposal scoring.
- Auto-creating multiple future studies from one large hypothesis in this slice.
- Introducing new persisted fields such as boundary types, layers, probabilities, or special narrowed discounts.

## Evidence Standard

This change is successful when:

- QDD can compute one machine-readable proposal score from existing boundary state alone,
- the score surface can explain when a target is not legal as a single current study because unresolved active ancestors remain,
- `qdd-propose` preserves the user's long-range hypothesis in human mode but recommends a frontier-sized current study,
- `qdd-propose` no longer defaults to “just add more tasks” when the real problem is cross-layer study scope,
- `qdd-explore` can use the same score output to discuss study resizing,
- and the protocol stays light enough to remain auditable from YAML plus CLI output.

## Shared Context

- QDD already has a project-level `boundaries.yaml` truth source, explicit `target_boundaries` on studies, and controlled close-time boundary updates.
- The current gap is proposal sizing: a user can give a real scientific goal that still depends on missing data, missing environment setup, missing preprocessing, or unresolved annotation/integration boundaries, but `qdd-propose` may still turn that into one heavy study.
- The user wants proposal value to be structurally and deterministically computable, not mainly judged by an LLM through soft criteria.
- The user also wants human mode to respect the user's original semantic target, which means the workflow must distinguish a long-range target from the current executable study rather than simply rewriting the question.
- `narrowed` should remain an active boundary state; any reduction in remaining importance should be expressed through the updated `weight`, not through a hard-coded runtime discount.
