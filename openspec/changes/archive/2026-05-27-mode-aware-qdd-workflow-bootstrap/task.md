## Task Goal

Encode and validate mode-aware bootstrap behavior, workflow-boundary realignment, long-form prompt generation, and task-scaffold cleanup while keeping the current QDD CLI surface unchanged.

## Study Link

This task implements the study decision that `qdd-propose` writes the first-pass `study + initial task`, `qdd-explore` refines those artifacts through discussion, and `qdd-apply` executes the approved current `study/task` set.

## Method

- revise the shared instructions source in `src/runtime/defaults.ts`
- move workflow prompt source out of `src/runtime/bootstrap.ts` string arrays into external Markdown source files
- rewrite `qdd-propose` so it directly creates a complete first-pass `study` and corresponding initial `task`
- rewrite `qdd-explore` with OpenSpec-style stance, entry cases, examples, and confirmation-gated artifact modification behavior
- rewrite `qdd-apply` and `qdd-close` as guidance-heavy execution and closure skills rather than terse help text
- replace the fixed task checklist with a weaker task-specific scaffold in the runtime template
- regenerate tool-specific assets through `qdd init` refresh behavior
- update tests so the generated text locks the intended mode and workflow boundaries

## Expected Outputs

- updated `.qdd/instructions.md` template
- external prompt source files for the four workflow surfaces
- updated generated `qdd-propose`, `qdd-explore`, `qdd-apply`, and `qdd-close` assets for Claude and Codex
- updated `study/task` template behavior and task checklist scaffold
- updated verification coverage for the revised bootstrap contract

## Run Contract

Each implementation run should record:

- which mode rules were changed
- which workflow boundaries were reassigned between `propose`, `explore`, `apply`, and `close`
- where the new prompt source files live
- which generated assets were refreshed
- whether `human` and `assist` remain confirmation-gated in `explore`
- whether `propose` now creates the first-pass `study + initial task`
- whether `apply` is clearly execution-centric around the approved `study/task` set
- command and test evidence for regeneration and verification

## Failure / Blocker Conditions

- the intended mode behavior requires new persisted runtime state
- `assist` and `auto` remain too ambiguous to encode consistently
- the rewritten prompts still behave like short help text instead of executable skills
- the workflow guidance becomes over-templated instead of guidance-heavy
- refreshed generated assets diverge across tool targets in ways that change workflow semantics
- the change starts pulling in artifact-index or context-onboarding redesign that belongs to a separate slice
