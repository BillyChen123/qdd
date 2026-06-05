## Question

How should one QDD study represent a real research hypothesis so it can be planned as a complete first-pass task graph, executed without implicit mid-study replanning, and closed once the question has been meaningfully updated?

## Hypothesis / Expectation

If QDD treats one study as one bounded hypothesis package, plans the first-pass task graph up front, and lets closure record explicit question refinement even when the original claim is only partially proven, then the workflow will feel more like disciplined research iteration and less like repeated chat-driven plan repair.

## Inputs

- Current workflow prompts in `src/runtime/bootstrap-prompts/qdd-propose.md`, `qdd-apply.md`, and `qdd-close.md`
- Runtime lifecycle and evidence code in `src/runtime/lifecycle.ts` and `src/runtime/evidence.ts`
- Local skill contract in `src/runtime/local-skills.ts`
- Shared instructions generation in `src/runtime/defaults.ts` and `src/runtime/instructions.ts`
- The HGSOC benchmark dogfood case that exposed the mismatch between one starter task, undeclared follow-up work, and closure semantics
- Existing artifact-candidate promotion contract and artifact registry behavior

## Evidence Plan

- A clear lifecycle rule stating that `qdd-propose` plans the complete first-pass task graph for one bounded hypothesis.
- A clarified apply contract that keeps within-study continuation inside `qdd-apply` rather than defaulting to `qdd-explore`.
- A closure rule that allows explicit refinement-style closure when the question has advanced enough, even if the original claim was not fully confirmed.
- A stronger artifact-candidate contract that carries task-level provenance where available.
- Prompt updates, runtime updates, and tests that all encode the same lifecycle meaning.
- Clear Chinese comments in the core runtime files so the user can audit how the behavior is implemented.

## Blockers

- Some hypotheses are genuinely hard to plan in full before execution, so the task-graph rule must stay strict without becoming brittle.
- Closure must distinguish “not enough evidence to say anything” from “enough evidence to refine the question.”
- Older bootstrapped projects may still carry the one-task-default prompt wording until bootstrap assets are refreshed.
- Artifact promotion must stay explicit and selective while becoming more provenance-rich.

## Exit Signal

This study is ready to close when the implementation path is clear enough to make one proposed hypothesis:

- start with a full first-pass task graph,
- continue through apply without hidden task invention,
- close with an explicit refined question when appropriate,
- and promote reusable outputs with task-level provenance and auditable runtime logic.
