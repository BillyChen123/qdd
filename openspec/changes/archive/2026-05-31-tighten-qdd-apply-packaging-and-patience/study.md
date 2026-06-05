## Question

How should QDD ensure that study execution produces one clean study-level output surface, one explicit promotion-review state per completed task, and a more patient interpretation of long-running analysis work before a study enters closure?

## Hypothesis / Expectation

If QDD moves candidate review and final packaging firmly into `qdd-apply`, leaves `qdd-close` responsible only for explicit promotion judgment, and teaches apply-time prompts to wait longer before treating heavy analysis as failure, then study closure will become more reliable without introducing a heavyweight runtime system.

## Inputs

- The HGSOC benchmark case where:
  - `artifact-candidates.yaml` stayed empty
  - study output remained spread across task-local folders
  - heavy clustering/UMAP-style work was treated as suspicious too early
- Current `qdd-apply` and `qdd-close` prompts
- Current study output layout and promotion runtime

## Evidence Plan

- A protocol contract that makes apply-time promotion review and output packaging explicit
- A concrete packaging target for canonical study outputs plus scratch space
- A clear patience contract for long-running work
- An implementation checklist that updates prompts, runtime state, and validation consistently

## Blockers

- The current runtime does not clearly distinguish “no candidate exists” from “candidate review never happened.”
- The current study output layout exists, but final packaging into it is not enforced before task completion.
- Long-running-task behavior currently lives mostly in agent heuristics rather than in a QDD-specific execution rule.

## Exit Signal

This study is ready to move into apply when the change artifacts make these implementation targets explicit:

- completed tasks cannot silently skip promotion review
- canonical study output packaging is defined and enforceable
- long-running task patience is treated as part of the apply contract rather than free-form agent behavior
