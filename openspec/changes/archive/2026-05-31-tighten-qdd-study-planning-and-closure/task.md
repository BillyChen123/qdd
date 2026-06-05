## Task Goal

Implement a stricter QDD lifecycle where `qdd-propose` writes a complete first-pass task graph, `qdd-apply` executes that graph without defaulting back to explore, `qdd-close` can close a meaningfully updated question, and promoted artifacts keep task-level provenance when available.

## Study Link

This task implements the study decision that one bounded hypothesis may include preparation and main-analysis tasks together, but must still be fully planned up front and cleanly closed once the question has advanced enough.

## Method

- Rewrite `qdd-propose` prompts and related guidance so the default is a small complete first-pass task graph rather than one starter task.
- Tighten `qdd-apply` prompts and runtime expectations so within-study continuation stays inside apply unless the study contract itself is under question.
- Tighten `qdd-close` prompts and closure/runtime semantics so refinement-style closure is allowed when the study has produced enough evidence to update the question explicitly.
- Strengthen artifact-candidate guidance and runtime handling so promoted outputs carry `task_id` and task-level scope whenever one task is the clear producer.
- Refresh `.qdd/instructions.md` and related bootstrap surfaces so all workflow documents express the same lifecycle contract.
- Add clear Chinese comments to the core runtime files that implement lifecycle, evidence promotion, bootstrap projection, and local-skill handling.

## Expected Outputs

- Updated `qdd-propose`, `qdd-apply`, and `qdd-close` prompt sources and regenerated tool-facing assets
- Updated lifecycle and evidence runtime behavior for closure semantics and task-level artifact provenance
- Updated shared instructions and validation wording that match the new lifecycle
- Updated tests or smoke coverage for multi-task proposal defaults, closure eligibility, and task-level artifact promotion
- Chinese explanatory comments in the core TypeScript runtime files most relevant to this workflow

## Run Contract

Each implementation run should record:

- which lifecycle rules were changed between `propose`, `explore`, `apply`, and `close`
- whether `qdd-propose` now plans a full first-pass task graph
- whether `qdd-apply` still requires `qdd-explore` only for true study-level replanning rather than ordinary continuation
- how `qdd-close` now distinguishes “not enough evidence to say anything” from “enough evidence to refine the question”
- which artifact-candidate fields are required or preferred for task-level provenance
- which runtime files received Chinese comments and what those comments explain
- which generated bootstrap surfaces and tests were refreshed

## Failure / Blocker Conditions

- The change still lets `qdd-propose` default to one vague starter task for a non-atomic study.
- `qdd-apply` still needs undeclared follow-up tasks as part of the normal execution path.
- `qdd-close` still refuses to close studies that have clearly updated the question but not fully confirmed the original claim.
- Artifact promotion still loses the producing task even when one task is clearly responsible for the output.
- Comments become line noise rather than clarifying the runtime logic for human review.
- The slice expands into a new project-level planner or a separate study-orchestration engine.
