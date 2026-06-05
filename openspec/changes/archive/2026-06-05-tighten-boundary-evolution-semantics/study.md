## Question

How should QDD align `evolution.yaml` and `boundaries.yaml` so the current working question and the current frontier graph stay semantically correct during propose, explore, and close?

## Hypothesis / Expectation

If QDD treats `evolution` as the history of the current working question, treats `boundaries` as the current unresolved frontier around that question, and tightens close-time ordering plus planning prompts around that model, then boundary scoring will stay meaningful and study transitions will better match real research pivots.

## Inputs

- Existing QDD runtime:
  - `src/runtime/lifecycle.ts`
  - `src/runtime/boundaries.ts`
  - `src/runtime/status.ts`
  - `src/runtime/instructions.ts`
- Existing workflow prompts:
  - `src/runtime/bootstrap-prompts/qdd-propose.md`
  - `src/runtime/bootstrap-prompts/qdd-explore.md`
  - `src/runtime/bootstrap-prompts/qdd-close.md`
- Existing project spec:
  - `openspec/specs/qdd-research-orchestration/spec.md`
- User feedback from iterative benchmark runs:
  - boundaries drift toward workflow-step chains
  - close can leave boundary state stale if updates are not applied
  - propose / explore do not surface score output clearly enough

## Evidence Plan

This study should produce:

- one explicit semantic contract for `theme / evolution / boundaries / score`
- one implementation that keeps `question_before` aligned with the project current question rather than the study-local slice
- one close path that persists boundary updates before final question-delta write, while preserving question-first reasoning
- prompt and instruction updates that force score visibility and current-frontier framing
- smoke coverage proving the corrected behavior

## Blockers

- Over-tightening could turn the protocol into a heavy planner model instead of a light research loop.
- Runtime persistence order and reasoning order are not identical, so the documentation must distinguish them cleanly.
- Existing studies may already contain workflow-like boundaries, so the first slice should improve prompts and validation surfaces rather than inventing an expensive migration layer.

## Exit Signal

This study is ready to close when:

- `evolution` clearly owns the current working question history,
- `boundaries` clearly own the current unresolved frontier,
- `qdd-close` no longer leaves project boundary state stale,
- propose / explore visibly report score output,
- and the implementation is backed by smoke tests rather than prompt text alone.
