## Theme

Make QDD bootstrap mode-aware and workflow-correct so installed prompts and skills honor `human`, `assist`, and `auto` boundaries, keep `study` and `task` as the only template-constrained artifacts, and follow OpenSpec-quality guidance without expanding the current CLI.

## Initial Question

How should QDD project its existing CLI into long-form prompts and skills so `qdd-propose` directly writes a complete first-pass `study` plus initial `task`, `qdd-explore` becomes a discussion-first refinement step, and `qdd-apply` executes the current approved `study/task` set under mode-aware authority boundaries?

## Mode

`human`.

This proposal is decided in human mode. The implementation must define behavior for `human`, `assist`, and `auto`, but any protocol change in this slice remains human-approved before implementation.

## Scope

### In Scope

- Use `contract.yaml.mode` as the authority signal for installed QDD workflow behavior.
- Make `qdd-propose` directly create or refresh one complete `study.md` and its corresponding initial `task` record using the QDD templates.
- Redefine `qdd-explore` so `human` and `assist` default to discussion, questions, options, and recommendations over the existing `study/task` set before any edits.
- Require explicit user confirmation before `qdd-explore` in `human` or `assist` mode modifies `study.md` or `task` files.
- Reframe `qdd-apply` as execution of the current approved `study/task` set, with structural reconsideration sent back to `qdd-explore` rather than treated as the default behavior of `apply`.
- Let `auto` mode skip a separate planning stop when the study is already actionable, while still respecting study bounds and QDD truth sources.
- Rewrite generated `qdd-propose`, `qdd-explore`, `qdd-apply`, and `qdd-close` commands and skills as long-form prompts closer to OpenSpec style: stance, cases, examples, guardrails, and execution guidance rather than terse help text.
- Move workflow prompt source out of `src/runtime/bootstrap.ts` string arrays into external Markdown source files loaded by the bootstrap generator.
- Keep templates explicit for `study.md` and `task.md`, and replace the fixed default task checklist with a weaker task-specific scaffold.

### Out Of Scope

- Simplifying `artifacts/index.yaml` or changing artifact registration policy.
- Adding new context-seeding or onboarding commands.
- Adding project-level next-study recommendation commands.
- Adding planner state, thread control, or new lifecycle files.
- Forcing rigid output templates for `qdd-explore`, `qdd-apply`, or `qdd-close` responses.
- Changing the current study/task/artifact filesystem layout.

## Evidence Standard

This slice is successful when a fresh `qdd init` or `qdd init --refresh-bootstrap` installs workflow assets that:

- clearly differentiate `human`, `assist`, and `auto` behavior,
- make `qdd-propose` directly create a complete first-pass `study` and initial `task`,
- keep `qdd-explore` discussion-first and non-mutating by default in `human` and `assist`,
- keep `qdd-apply` execution-centric around the current approved `study/task` set,
- make generated prompts and skills long-form enough to encode stance, cases, examples, and guardrails,
- stop creating new tasks with the same fixed generic checklist body,
- and remain QDD-native rather than drifting into OpenSpec software-delivery language.

## Shared Context

- The current QDD CLI already provides `init`, `status`, `instructions`, `add-study`, `add-task`, `register-artifact`, `close-study`, `validate`, `artifacts:list`, and `context`.
- Current bootstrap assets are installed by `qdd init`, but all four workflow prompts are still too thin and read more like CLI help text than executable agent skills.
- Dogfooding in `tmp/test_qdd/` exposed the main mismatch: the user wants `qdd-explore` to behave like a planning and confirmation stage in human mode, not an immediate file-mutating step.
- Earlier discussion refined the workflow boundary: `qdd-propose` should write the first-pass `study + initial task`, `qdd-explore` should discuss and optimize those artifacts, `qdd-apply` should execute the approved set, and `qdd-close` should close the study and extract stable outputs.
- The current default task checklist is not prompt-generated; it is hardcoded in the runtime scaffold, which is why every new task starts with the same generic lines.
- OpenSpec skills show the boundary QDD should copy: templates constrain the generated artifacts, while long-form workflow prompts mainly guide how the agent thinks, investigates, questions assumptions, reports progress, and pauses.
