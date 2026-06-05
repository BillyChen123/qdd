## Question

How should QDD encode mode-aware bootstrap behavior so `qdd-propose` directly writes a first-pass `study + initial task`, `qdd-explore` becomes a discussion-first refinement step, and `qdd-apply` executes the current approved `study/task` set with OpenSpec-quality long-form prompts?

## Hypothesis / Expectation

If QDD treats `contract.yaml.mode` as the authority signal, separates artifact templates from workflow guidance, externalizes long-form prompt source into Markdown, and weakens the default task checklist scaffold, then the workflow will feel predictable and executable without adding new CLI state or a separate planner runtime.

## Inputs

- existing QDD CLI and runtime in `src/`
- current bootstrap generator in `src/runtime/bootstrap.ts`
- current shared protocol text in `src/runtime/defaults.ts`
- generated bootstrap outputs under `.claude/`, `.codex/`, and `.qdd/`
- current task scaffold builder in `src/runtime/lifecycle.ts`
- OpenSpec reference skills: `openspec-propose`, `openspec-explore`, and `openspec-apply-change`
- prior specs in `openspec/specs/qdd-agent-foundation/spec.md` and `openspec/specs/qdd-research-orchestration/spec.md`
- dogfood feedback from `tmp/test_qdd/`

## Evidence Plan

- an explicit per-mode contract for `qdd-propose`, `qdd-explore`, `qdd-apply`, and `qdd-close`
- a clarified boundary where `study.md` and `task.md` are template-constrained but the workflow prompts remain guidance-heavy
- external Markdown prompt source for the four workflow surfaces
- tightened `.qdd/instructions.md` language that matches the same contract
- regenerated Claude and Codex bootstrap assets that follow the revised behavior
- an updated default task checklist scaffold that does not lock every new task into the same generic list
- tests or verification steps that lock the intended wording and role boundaries

## Blockers

- `assist` must remain meaningfully distinct without silently becoming `auto`
- `auto` should be able to skip a separate planning stop without weakening study bounds
- the slice must keep `explore` and `apply` guidance-rich without turning them into rigid output templates
- the slice must stay within bootstrap behavior and avoid becoming a larger project-level redesign

## Exit Signal

This study is ready to close when the mode contract is explicit enough to implement, the propose/explore/apply/close boundaries are stable, the prompt/template split is clear, and the resulting work can be executed without reopening artifact-registry or context-onboarding debates.
