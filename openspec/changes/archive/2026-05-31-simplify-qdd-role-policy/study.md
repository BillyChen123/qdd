## Question

How should QDD simplify its role policy so planning remains `study-brain`, execution remains task-local `executor`, and closure remains `thesis-manager`, without carrying the current layer-heavy policy model forward?

## Hypothesis / Expectation

If QDD replaces layer-oriented policy with a thinner `command -> role -> default_skills` contract, then the runtime will become easier to understand, the prompt surface will stay expressive enough for planning, and closure authority can remain clearly project-minded through `thesis-manager` without reintroducing heavy orchestration semantics.

## Inputs

- Current `.qdd/layer-policy.yaml` scaffold and runtime parser
- Current instruction generation in `src/runtime/instructions.ts`
- Current validation logic in `src/runtime/inspection.ts`
- Current defaults and bootstrap assets under `src/runtime/defaults.ts`
- Existing smoke tests that assert layer-policy behavior
- User decision to keep `thesis-manager` semantics for `qdd-close`

## Evidence Plan

- A simplified editable policy shape that a human can read quickly.
- Runtime role resolution that no longer depends on `project/study/task` policy layers.
- Clear instruction semantics for:
  - `qdd-start`
  - `qdd-propose`
  - `qdd-explore`
  - `qdd-apply`
  - `qdd-close`
- Validation rules that match the new policy shape instead of the old layer semantics.
- Updated bootstrap and tests proving that the lighter policy still supports the needed prompts.

## Blockers

- If old `decision_layer` assumptions stay embedded in prompts or tests, the policy simplification will become partial and confusing.
- If executor defaults remain policy-owned, the simplification will not actually reduce runtime ambiguity.
- If `qdd-close` loses the `thesis-manager` authority semantics, the closure workflow will become weaker rather than clearer.

## Exit Signal

This study is ready to close when:

- the simplified policy contract is explicit,
- runtime instructions resolve the correct role for every command,
- `qdd-apply` clearly depends on task-local skills rather than policy-owned execution bundles,
- and `qdd-close` still clearly behaves as `thesis-manager` for artifact and context judgment.
