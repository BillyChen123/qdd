## 1. Auto Runtime Defaults

- [x] 1.1 Make `qdd auto` default to unlimited turns when the user does not provide `--max-turns`.
- [x] 1.2 Preserve explicit `--max-turns <n>` behavior for bounded debugging runs.
- [x] 1.3 Add or update tests for default unlimited turns and explicit turn caps.

## 2. Bash Timeout Contract

- [x] 2.1 Add a small timeout preset model for bash tool calls, with preset durations for short, normal, and long commands.
- [x] 2.2 Enforce a maximum synchronous bash duration of 1 hour.
- [x] 2.3 Preserve compatibility with existing numeric timeout inputs by mapping them through the orchestrator cap.
- [x] 2.4 Return bash runtime metadata including elapsed time, timeout value, timed-out status, exit code, signal, and truncation flags.

## 3. Process Cleanup

- [x] 3.1 Spawn bash commands in a cleanup boundary that allows killing the whole process group on Unix-like systems.
- [x] 3.2 On timeout, send graceful termination to the process group, then force kill after a short grace interval.
- [x] 3.3 Ensure timeout resolution does not wait indefinitely for orphaned descendants or unclosed pipes.
- [x] 3.4 Add a deterministic test proving a timed-out command does not leave a child process running.

## 4. Read Safety

- [x] 4.1 Detect likely binary files before reading content into model context.
- [x] 4.2 Detect oversized text files and return safe metadata instead of full content.
- [x] 4.3 Treat common scientific and binary extensions such as `.h5ad`, `.h5`, `.rds`, `.loom`, `.parquet`, archives, checkpoints, and images as metadata-only by default.
- [x] 4.4 Add tests for binary file reads, oversized text reads, and ordinary small text reads.

## 5. Output And Log Bounds

- [x] 5.1 Bound bash stdout and stderr accumulation to retained tails with explicit truncation markers.
- [x] 5.2 Bound auto log tool-result blocks so a single tool call cannot inflate `.qdd/runs/*.log` by hundreds of MB.
- [x] 5.3 Keep model-facing tool results concise while preserving enough metadata for debugging.
- [x] 5.4 Add tests for stdout/stderr truncation and log-block truncation.

## 6. Validation

- [x] 6.1 Run `npm run build`.
- [x] 6.2 Run `npm test`.
- [x] 6.3 Run `git diff --check`.
- [x] 6.4 Manually inspect the final diff to confirm no background job system was introduced in this change.
