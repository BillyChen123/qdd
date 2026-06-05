## 1. Lifecycle Contract

- [x] 1.1 Rewrite `qdd-propose` so the default output is a small complete first-pass task graph for one bounded hypothesis rather than one starter task
- [x] 1.2 Tighten shared instructions and workflow wording so `qdd-explore` is optional discussion, not the default post-apply return path
- [x] 1.3 Tighten `qdd-apply` guidance so ordinary within-study continuation stays inside apply and only true study-level replanning returns to explore
- [x] 1.4 Tighten `qdd-close` semantics so explicit refinement-style closure is allowed when the question has advanced enough

## 2. Artifact Provenance And Closure

- [x] 2.1 Tighten `artifact-candidates.yaml` guidance so promoted outputs include `task_id` whenever one task is the clear producer
- [x] 2.2 Update runtime promotion behavior and related validation so task-level provenance is preserved in the reusable artifact registry
- [x] 2.3 Verify that closure-time promotion actually runs before final `question_delta` write in the refined close flow

## 3. Prompt And Bootstrap Refresh

- [x] 3.1 Update prompt sources for `qdd-propose`, `qdd-apply`, and `qdd-close` so they encode the same lifecycle contract
- [x] 3.2 Refresh generated `.claude`, `.codex`, and `.qdd` bootstrap assets from the revised prompt sources
- [x] 3.3 Verify that refreshed projects no longer carry the old one-starter-task default in the installed surfaces

## 4. Runtime Commenting And Tests

- [x] 4.1 Add clear Chinese comments to the core runtime files that implement lifecycle, evidence promotion, bootstrap projection, and local-skill handling
- [x] 4.2 Update or add tests for multi-task first-pass proposal behavior, closure eligibility after question refinement, and task-level artifact provenance
- [x] 4.3 Dogfood the refined flow on a realistic study path and verify that planning, execution, promotion, and closure remain auditable
