## Filesystem Contract

This change hardens runtime behavior without changing the QDD project layout.

Runtime logs remain under:

- `.qdd/runs/<auto-run-id>.log`

No new background job directory is introduced in this change. If a command is too long for synchronous execution, the agent should choose a smaller analysis, a faster method, or a future job-mode workflow.

## Identifiers And Metadata

Bash tool execution should report enough metadata to distinguish slow work from runtime failure:

- `pid`: spawned shell process ID when available
- `pgid`: process group ID when available or equivalent cleanup target
- `started_at`
- `ended_at`
- `elapsed_ms`
- `timeout_ms`
- `timed_out`
- `exit_code`
- `signal`
- `stdout_truncated`
- `stderr_truncated`

Read tool execution should report safe metadata instead of raw content when a target is binary or too large:

- `path`
- `size_bytes`
- `mtime`
- `reason`: `binary` or `too_large`
- `hint`: short guidance to inspect the file through domain-aware scripts instead of direct text read

## Status JSON

This change does not alter `qdd status --json`.

Runtime failures caused by command timeout should become more interpretable through tool result metadata and auto logs. A timed-out bash tool must be explicitly marked as timed out instead of appearing as an ambiguous generic failure.

## Instructions JSON

This change does not alter `qdd instructions <id> --json`.

Agent-facing runtime instructions should continue to allow bash/read/write tools, but runtime behavior must enforce these safety rules regardless of agent compliance:

- binary and oversized reads are blocked or summarized
- bash output is bounded
- timeout cleanup targets the whole command process group
- timeout presets are enforced by the orchestrator

## Agent Usage Rules

Agents may request a timeout class for bash commands, but the orchestrator is the authority that maps that class to milliseconds and applies the maximum allowed synchronous runtime.

Agents should use short timeouts for inspection, normal timeouts for ordinary CLI work, and long timeouts only for expected heavy scientific tools. Commands that plausibly exceed the longest synchronous timeout should be redesigned, sampled, replaced with a faster method, or deferred to a future job-mode capability.

Agents must not directly `read` large binary scientific artifacts such as `.h5ad`, `.h5`, `.rds`, `.loom`, `.parquet`, compressed archives, model checkpoints, or image files. They should inspect such files through concise metadata commands or domain-aware scripts that print summaries.
