## Task Goal

Define the concrete implementation work needed to make `qdd-apply` own candidate review, final study-output packaging, and patient handling of long-running analysis tasks.

## Study Link

This task supports the study of how QDD should stabilize apply-time execution and prepare cleaner study closure without adding a heavyweight orchestration layer.

## Method

Implement the change in three coordinated parts:

1. Add minimal task-level promotion-review state and closure checks.
2. Tighten the canonical study output structure while preserving a scratch surface for task-local or skill-local work.
3. Strengthen apply-facing prompts and rules for long-running analysis patience.

## Expected Outputs

- Updated protocol/runtime support for explicit task promotion-review state
- Updated study output layout and packaging rules
- Updated `qdd-apply` / `qdd-close` prompts and instruction wording
- Validation coverage for pending promotion review, unpackaged outputs, and patience-oriented apply rules

## Run Contract

Each implementation run should record:

- which prompt and runtime files changed,
- which task/state fields were added or tightened,
- how canonical study output packaging is enforced,
- and what tests or smoke checks verify the new contract.

## Failure / Blocker Conditions

- Apply can still finish a task while leaving promotion review ambiguous.
- Close can still finalize a study when completed tasks remain promotion-unreviewed.
- Canonical study output packaging remains advisory rather than enforceable.
- The long-task patience guidance remains too weak to prevent premature fallback on clustering, UMAP, or similar heavy analysis steps.
