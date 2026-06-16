## Theme

Harden QDD auto runtime behavior for long-running scientific tools without introducing a full background job system in this change.

## Initial Question

How should QDD make `qdd auto` safer and more predictable when an agent runs large single-cell or spatial commands that may produce binary outputs, huge logs, or child processes that outlive the shell wrapper?

## Mode

auto-assisted implementation planning. Runtime behavior is defined by QDD code and tests; agents may choose timeout classes and shell commands, but the orchestrator remains the final authority for tool safety, process cleanup, and log limits.

## Scope

### In Scope

- Make `qdd auto` default to unlimited agent turns unless the user explicitly sets a turn cap.
- Replace shell-only timeout termination with reliable process-group cleanup for bash tools.
- Add safe handling for binary and large file reads so `.h5ad`, `.h5`, archives, and other binary outputs do not enter model context or auto logs.
- Cap tool result logging and stored stdout/stderr so logs remain inspectable.
- Replace the fixed 10-minute hard cap with a small timeout preset model, with the longest synchronous preset capped at 1 hour.
- Preserve lightweight runtime semantics; this change does not implement background jobs.

### Out Of Scope

- A full `qdd job start/status/tail/cancel` background job system.
- Slurm, systemd, tmux, nohup, or queue-manager integration.
- Algorithmic rewrites of Scanorama, UMAP, scVI, or domain-skill biological logic.
- GPU acceleration implementation for Scanorama; Scanorama remains CPU-oriented unless its upstream API changes.

## Evidence Standard

The change is acceptable when tests and manual inspection show that timed-out bash commands do not leave child processes behind, binary reads return metadata rather than raw payloads, large tool outputs are truncated in logs and model results, and auto mode still permits long scientific commands through explicit timeout presets.

## Shared Context

The motivating run was an auto UC anti-TNF project where a Scanorama integration wrote outputs after roughly 9 hours, but QDD did not receive a tool result until much later. The same run produced a roughly 260 MB auto log because a binary `.h5ad` file was read and logged as text. Current runtime code caps bash timeout at 10 minutes, accumulates stdout/stderr without bounds, reads arbitrary files as UTF-8, and logs complete tool results.
