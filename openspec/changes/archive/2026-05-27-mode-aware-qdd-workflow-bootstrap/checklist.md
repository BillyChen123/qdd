## 1. Workflow Boundary And Mode Contract

- [x] 1.1 Encode `human`, `assist`, and `auto` authority rules in `.qdd/instructions.md`
- [x] 1.2 Reassign responsibility so `qdd-propose` writes the first-pass `study + initial task`, `qdd-explore` refines after discussion, `qdd-apply` executes the approved `study/task` set, and `qdd-close` handles closure and extraction

## 2. Long-Form Bootstrap Surfaces

- [x] 2.1 Externalize workflow prompt source into repo-local Markdown files loaded by the bootstrap generator
- [x] 2.2 Rewrite `qdd-propose` prompts and skills so they directly generate one complete `study` and corresponding initial `task` from the QDD templates
- [x] 2.3 Rewrite `qdd-explore` prompts and skills so `human` and `assist` are discussion-first, OpenSpec-like in stance/examples, and confirmation-gated before modifying artifacts
- [x] 2.4 Rewrite `qdd-apply` and `qdd-close` as guidance-heavy execution and closure workflows rather than terse help text

## 3. Template And Scaffold Quality

- [x] 3.1 Keep template constraints explicit for `study.md` and `task.md` without turning other workflow prompts into rigid output templates
- [x] 3.2 Replace the fixed default task checklist with a weaker task-specific scaffold

## 4. Validation

- [x] 4.1 Refresh generated bootstrap assets through `qdd init` bootstrap regeneration
- [x] 4.2 Add or update tests that lock the intended mode-aware wording, workflow boundaries, and task scaffold behavior
- [x] 4.3 Verify this slice stays within bootstrap behavior and does not pull in artifact-index or context-onboarding redesign
