## Theme

Tighten QDD so one proposed study is planned as one executable first-pass hypothesis package, closed studies can carry forward refined questions even when the original claim is not fully proven, and reusable evidence stays traceable back to the producing task.

## Initial Question

How should QDD plan one bounded research hypothesis as a complete first-pass task graph up front, execute that graph without silently re-entering explore mode, close the study when the question has been meaningfully updated, and promote reusable outputs with task-level provenance?

## Mode

`human`

Humans still decide the hypothesis boundary, approve closure judgment, and review prompt and runtime changes. Agents may plan the full first-pass task graph, maintain promotion candidates, and draft implementation details, but must not silently redefine the study contract mid-execution.

## Scope

### In Scope

- Make `qdd-propose` plan one bounded hypothesis as a complete first-pass task graph rather than defaulting to one starter task.
- Keep front-loaded audit, feasibility, metadata, and execution-preparation work inside the same study when they serve the same hypothesis.
- Tighten `qdd-apply` so it executes the declared study task graph and does not treat `qdd-explore` as the default post-task return path.
- Allow `qdd-close` to close a study when the question has been materially updated, even if the original claim was only partially proven, as long as the closure judgment is explicit.
- Require artifact promotion candidates to carry task-level provenance when they originate from one task.
- Tighten prompts so `propose`, `apply`, and `close` use the same lifecycle contract.
- Add clear Chinese code comments to the core TypeScript runtime files that implement this workflow, so the user can audit the logic directly.

### Out Of Scope

- Introducing a separate project-level `qdd-project` command family in this slice.
- Turning exploratory preparation work into a mandatory standalone study type.
- Adding a new planner database, run engine, or thread-control system.
- Auto-creating next studies during closure.
- Redesigning the whole artifact registry beyond the provenance and closure behaviors needed here.

## Evidence Standard

This change is successful when:

- `qdd-propose` consistently plans a complete first-pass task graph for one bounded hypothesis,
- `qdd-apply` can execute that graph without needing to bounce back to `qdd-explore` for ordinary within-study continuation,
- `qdd-close` can explicitly close a study as `refinement`, `confirmation`, `pivot`, or `dissolution` even when the original claim was not fully proven,
- promoted artifacts are registered from the explicit candidate list with task-level provenance when available,
- and the relevant runtime files are commented clearly enough that the user can read and audit the logic by hand.

## Shared Context

- The user wants QDD to decompose research into bounded hypotheses that can be advanced in one pass, not into execution loops that repeatedly re-open planning by default.
- The current HGSOC benchmark case showed the main mismatch: propose created only one starter task, apply performed more work than the task graph declared, and closure semantics then became awkward.
- The repository already has artifact-candidate promotion support in runtime, but prompt behavior still makes closure too conservative for “question updated, evidence sufficient to refine” cases.
- The repository already supports task skill declaration and local skill validation; this slice does not redefine that contract, but it must keep prompt behavior aligned with it.
- The user also wants core runtime files such as `lifecycle.ts`, `evidence.ts`, `bootstrap.ts`, and `local-skills.ts` annotated clearly in Chinese for manual review.
