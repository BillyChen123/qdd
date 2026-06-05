## Theme

Tighten QDD's apply-time execution contract so reusable outputs are reviewed and recorded before closure, study outputs converge into one canonical packaging surface, and long-running analysis tasks are treated as normal execution rather than premature failure.

## Initial Question

How should QDD make `qdd-apply` explicitly responsible for promotion-candidate review, final study-output packaging, and patient handling of long-running analysis work, so `qdd-close` receives a clean reusable surface instead of guessing from scattered files or impatient execution drift?

## Mode

`human`

Humans still own study boundaries, closure judgment, and final review of protocol changes. Agents may tighten apply/close contracts, add light runtime state, and restructure output conventions, but must not introduce a heavyweight run engine or a hidden planner to solve what should remain a simple study-execution protocol.

## Scope

### In Scope

- Make `qdd-apply` explicitly responsible for promotion review before a task is considered complete.
- Distinguish between:
  - no promotion-worthy outputs
  - promotion review not yet performed
- Tighten study output packaging so final reusable materials land in one canonical study-level structure instead of remaining spread across task-local folders.
- Allow task or skill workspaces during execution, but require final packaging back into the canonical study output surface before task completion or closure.
- Strengthen `qdd-close` so it trusts explicit apply-produced candidate state and refuses to silently guess from an unreviewed output tree.
- Add a first-pass patience contract for long-running tasks such as clustering, UMAP, integration, or large h5ad processing.
- Prefer prompt and protocol changes first, with only the minimal runtime state needed to make the contract auditable.

### Out Of Scope

- Building a full job scheduler, run queue, or heartbeat daemon.
- Designing a general-purpose workflow engine for arbitrary long-running commands.
- Expanding downstream domain skills in this slice.
- Replacing the current artifact registry model with a new storage system.
- Letting `qdd-close` scan the whole study output tree and infer reusable artifacts heuristically.

## Evidence Standard

This change is successful when:

- completed tasks can no longer silently skip promotion review,
- `qdd-close` can distinguish “no candidates” from “apply never reviewed candidates,”
- study outputs converge into a stable canonical structure for data/code/figures/tables/reports,
- temporary task or skill workspaces are allowed but are not treated as final study truth,
- and apply-time prompts treat slow clustering, UMAP, integration, and similar steps as normal long-running work unless there is real evidence of failure.

## Shared Context

- The current runtime already supports `artifact-candidates.yaml` and candidate-driven promotion, but the HGSOC benchmark case showed that apply does not enforce candidate review strongly enough, so close often receives an empty list.
- The current study output layout creates canonical directories, but neither the protocol nor prompts require task-local outputs to be packaged back into that final structure.
- The user prefers a lightweight contract: allow scratch directories during execution, but require a final unified study-level output surface.
- The user also prefers the first patience fix to stay simple: longer waits and clearer rules about when to keep waiting versus when to declare a blocker, rather than adding a heavy runtime controller immediately.
