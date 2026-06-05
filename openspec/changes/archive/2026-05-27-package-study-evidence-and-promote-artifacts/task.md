## Task Goal

Implement a minimal, explicit study evidence packaging and artifact-promotion flow inside the current QDD runtime.

## Study Link

This task supports the bounded study of making QDD outputs reproducible and reviewable without changing the larger study lifecycle.

## Method

- Tighten the task scaffold and `qdd-apply` guidance so the agent preserves code and figures when the work actually produces them.
- Add a machine-readable artifact-candidate manifest inside each study output directory.
- Extend closure-time runtime logic to promote missing candidates through the existing artifact registration path.
- Keep the promotion boundary explicit and human-auditable.
- Update docs and tests using the current dogfood workflow as the main check.

## Expected Outputs

- Updated study/task execution guidance for packaged evidence
- Output directory convention for `code`, `figures`, `tables`, and `reports`
- `artifact-candidates.yaml` contract and runtime helpers
- `qdd close-study` promotion behavior for missing reusable outputs
- Tests or smoke checks covering packaged evidence and closure-time promotion
- Docs updates explaining how local evidence differs from promoted artifacts

## Run Contract

Each implementation run should:

- stay within the current study/task/artifact model,
- preserve readable scripts for substantive analyses,
- preserve at least one key figure when the result depends on visual interpretation,
- avoid auto-registering every output file,
- and use the explicit candidate manifest as the only close-time promotion source.

## Failure / Blocker Conditions

- If the change requires a separate run engine or notebook abstraction, the slice is too large.
- If `qdd-close` has to infer artifact importance by blind scanning, the contract is too vague.
- If the solution forces users to register every local output, the registry becomes noisy and the slice fails its main goal.
- If closure-time promotion mutates or relocates large outputs in a surprising way, stop and decide that explicitly.
