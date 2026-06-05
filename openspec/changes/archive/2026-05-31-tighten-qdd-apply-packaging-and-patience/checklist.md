## 1. Apply-Owned Promotion Review

- [x] 1.1 Add minimal task-level promotion-review state so completed tasks cannot silently remain unreviewed
- [x] 1.2 Update `qdd-apply` prompts and instructions so candidate review happens before a task is treated as complete
- [x] 1.3 Update `qdd-close` and validation behavior so empty candidate state is only acceptable when completed tasks are no longer promotion-pending

## 2. Canonical Study Output Packaging

- [x] 2.1 Extend the standard study output layout to include a canonical `data/` surface and a scratch `tmp/` surface
- [x] 2.2 Tighten prompts and instructions so task or skill workspaces may exist under `tmp/`, but final outputs must be packaged into canonical study directories
- [x] 2.3 Add validation or closure-time checks for unpackaged non-canonical top-level study output material

## 3. Long-Running Task Patience

- [x] 3.1 Strengthen `qdd-apply` prompts with explicit patience rules for clustering, UMAP, integration, and large h5ad processing
- [x] 3.2 Clarify the difference between normal slow progress, suspicious stagnation, and explicit failure
- [x] 3.3 Keep the first implementation prompt-first and lightweight rather than introducing a heavyweight run engine

## 4. Validation And Consistency

- [x] 4.1 Update tests and smoke coverage for promotion-review state, output packaging expectations, and apply/close rules
- [x] 4.2 Run the relevant build and smoke checks to confirm the tightened apply/close contract stays consistent
