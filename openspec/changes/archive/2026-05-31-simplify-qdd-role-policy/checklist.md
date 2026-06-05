## 1. Policy Contract

- [x] 1.1 Replace the current layer-oriented `.qdd/layer-policy.yaml` scaffold with a `commands -> role` and `roles -> default_skills` contract
- [x] 1.2 Update runtime policy parsing and normalization to support the simplified contract
- [x] 1.3 Remove stale `decision_layer` and layer-owned execution-default assumptions from the runtime types where possible

## 2. Instructions And Prompts

- [x] 2.1 Update `qdd instructions` generation to resolve command roles from the simplified policy
- [x] 2.2 Keep `study-brain` planning defaults available for `qdd-propose` and `qdd-explore`
- [x] 2.3 Ensure `qdd-apply` remains task-skill-driven rather than policy-execution-driven
- [x] 2.4 Ensure `qdd-start` and `qdd-close` both resolve to `thesis-manager`

## 3. Validation And Bootstrap

- [x] 3.1 Update validation logic so it checks the simplified role-policy shape instead of the old layer semantics
- [x] 3.2 Update bootstrap defaults, generated scaffold files, and any docs that describe the policy surface
- [x] 3.3 Update prototype maps or runtime comments where they still describe the old layer-oriented policy

## 4. Verification

- [x] 4.1 Update or add tests for simplified role resolution and task-local executor skill behavior
- [x] 4.2 Verify `qdd-close` still exposes the expected closure authority semantics under `thesis-manager`
- [x] 4.3 Run build and smoke coverage for the updated runtime contract
