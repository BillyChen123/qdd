## Question Before

How should QDD handle long-running scientific commands in auto mode without immediately building a full job system?

## Question After

QDD should first harden synchronous tool execution: unlimited auto turns by default, bounded timeout presets up to 1 hour, reliable process-group termination, binary/large read guards, and bounded tool-result logging. A background job system remains a later capability.

## Change Type

refinement

## Change Driver

Observed runtime evidence showed that current failures are caused by P0 safety gaps in synchronous tool execution rather than only by missing background job orchestration.

## Open Boundaries

- Whether a future job mode should use detached spawn, nohup-compatible execution, tmux, Slurm, or another runner.
- Whether domain skills should add checkpointing or progress files for very large tasks.
- Whether Scanorama should be discouraged above a dataset-size threshold in agent guidance.
- Whether visualization steps such as full UMAP should be split into separate long-running jobs in a later change.

## Evidence Summary

The motivating run showed three separable failure modes: a binary `.h5ad` read polluted the auto log, bash timeout did not reliably control descendant Python work, and large command output made logs hard to inspect. The selected P0 plan addresses these directly without expanding runtime scope into a job scheduler.

## Recommended Next Step

Implement `task.md` as the next apply step. After the P0 hardening lands and tests pass, evaluate a thin `qdd job start/status/tail/cancel` proposal separately.
