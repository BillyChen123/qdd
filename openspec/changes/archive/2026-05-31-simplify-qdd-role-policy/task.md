## Task Goal

Implement the minimum runtime, scaffold, and validation changes needed to replace the current layer-heavy policy with a thinner command-to-role policy while preserving `thesis-manager` authority for start and close workflows.

## Study Link

This task supports the study decision that QDD should keep only the role abstractions that materially affect planning, execution, and closure, rather than carrying a more elaborate layer model that mostly feeds prompts and validation.

## Method

- Replace the current policy schema shape with a simpler `commands` and `roles` model.
- Update policy parsing and normalization logic in runtime to resolve command roles and role default skills.
- Remove instruction-time dependence on `decision_layer`, layer-owned required skills, and layer-owned optional execution skills.
- Keep planning defaults available through `study-brain` role defaults.
- Keep closure semantics explicit by resolving `qdd-close` to `thesis-manager`.
- Update bootstrap assets, prompt-facing guidance, and validation rules to match the simplified contract.
- Update tests so they assert the new role mapping and do not depend on the old layer semantics.

## Expected Outputs

- Updated `.qdd/layer-policy.yaml` scaffold shape
- Updated runtime policy parser and instruction builder
- Updated validation rules for the simplified policy
- Updated bootstrap defaults and prompt references
- Updated tests and prototype documentation where they mention the old policy model

## Run Contract

Each implementation run should record:

- the old policy shape being replaced,
- the new `commands -> role` and `roles -> default_skills` shape,
- where `qdd-start`, `qdd-propose`, `qdd-explore`, `qdd-apply`, and `qdd-close` resolve,
- how executor instructions stay task-local,
- how `thesis-manager` remains the closure authority,
- and what tests lock the new semantics in place.

## Failure / Blocker Conditions

- The runtime still depends on `decision_layer` or other stale layer-policy semantics.
- Executor-time instructions still receive policy-owned execution bundles by default.
- `qdd-close` no longer reads as a `thesis-manager` responsibility.
- Bootstrap and tests drift so that the written policy contract no longer matches the executable runtime.
