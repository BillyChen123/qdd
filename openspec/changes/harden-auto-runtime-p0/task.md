## Task Goal

Implement the P0 runtime hardening slice for `qdd auto` synchronous tool execution.

## Study Link

This task supports the study question in `study.md`: making QDD auto safe enough for long but bounded scientific commands without a full background job system.

## Method

Update the runtime and UI layers in small, testable steps:

1. Change auto turn defaults so `qdd auto` defaults to unlimited turns while still honoring explicit `--max-turns`.
2. Replace bash shell-only timeout cleanup with process-group cleanup for Unix-like systems.
3. Add bounded stdout/stderr accumulation for bash results.
4. Add timeout presets for bash tool calls and map them to bounded durations with a maximum synchronous preset of 1 hour.
5. Add binary and oversized file guards for the read tool.
6. Add truncation for auto log tool-result blocks so logs remain inspectable.
7. Add tests covering process cleanup, output truncation, read guards, timeout preset mapping, and default auto turns.

## Expected Outputs

- Updated runtime code in `src/runtime/agent-runner.ts`.
- Updated auto command handling in `src/commands/auto.ts` if needed for default unlimited turns.
- Updated auto stream logging in `src/ui/auto-stream.ts`.
- Updated or new tests under `test/**`.
- Build and test evidence from `npm run build` and `npm test`.

## Run Contract

Each implementation run must report:

- affected source files
- affected tests
- whether process-group timeout cleanup was tested
- whether binary read protection was tested
- whether log truncation was tested
- commands run for validation

Bash tool results should include explicit runtime metadata after implementation:

- elapsed runtime
- timeout value
- timeout status
- output truncation status
- exit code or signal when available

## Failure / Blocker Conditions

- If process-group cleanup cannot be made reliable on the current platform, the implementation must still prevent unbounded waiting and clearly report the limitation.
- If a test for child-process cleanup is flaky, replace it with a deterministic child process fixture rather than dropping the requirement.
- If a file type cannot be confidently classified as text, the read tool should prefer safe metadata over raw content.
- Do not implement full background job mode in this change.
