## Question

Can QDD auto safely run long but bounded scientific commands without producing uninspectable logs, leaking binary artifacts into model context, or leaving child processes running after timeout?

## Hypothesis / Expectation

The current auto runtime can be made reliable enough for P0 use by hardening synchronous tool execution rather than introducing a full job system. The expected result is a safer runtime that supports long preset timeouts up to 1 hour, kills timed-out command trees correctly, and keeps logs small enough to inspect.

## Inputs

- Current `src/runtime/agent-runner.ts` bash/read/write tool implementation.
- Current `src/ui/auto-stream.ts` auto renderer and run log writer.
- Current `src/commands/auto.ts` max-turn handling.
- The observed UC anti-TNF auto run where `.h5ad` binary content inflated a log to hundreds of MB and a timed-out shell pipeline left scientific Python work outside the intended control boundary.

## Evidence Plan

- Add or update tests showing binary and oversized reads return safe metadata rather than raw file contents.
- Add or update tests showing bash timeout terminates child processes spawned by the command.
- Add or update tests showing stdout/stderr and auto log tool-result blocks are truncated with explicit truncation markers.
- Add or update tests showing timeout presets are accepted and mapped to bounded synchronous durations.
- Add or update tests or command behavior showing auto defaults to unlimited turns unless overridden.

## Blockers

- Cross-platform process-group termination differs between Unix-like systems and Windows. The implementation may focus on the current Unix-like target but should fail safely elsewhere.
- Exact timeout preset CLI/API spelling must be chosen during implementation and kept simple.
- Existing tests may assume raw read behavior for arbitrary files; those tests must be updated without weakening managed file validation.

## Exit Signal

The study can close when `npm run build` and `npm test` pass, and the runtime can no longer reproduce the three observed P0 failures: binary `.h5ad` log pollution, child process survival after timeout, and unbounded tool output logging.
