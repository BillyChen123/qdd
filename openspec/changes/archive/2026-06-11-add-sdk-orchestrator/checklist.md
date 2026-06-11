## 1. Runtime Contract

- [x] 1.1 Confirm the auto-mode contract uses runtime orchestration plus Claude SDK sessions, not prompt-level `/fork`.
- [x] 1.2 Define the phase graph for `start -> propose -> apply -> close -> propose|stop`.
- [x] 1.3 Define runtime options for model, max iterations, max turns per agent, dry run, and JSON output.
- [x] 1.4 Define terminal reasons from structured QDD state.

## 2. Agent Runner

- [x] 2.1 Harden the Claude SDK runner so each phase uses a fresh isolated message session.
- [x] 2.2 Feed each session the role bootstrap prompt plus formatted `qdd instructions --json` context.
- [x] 2.3 Keep the tool surface minimal and project-root scoped: read, write, and bounded shell execution.
- [x] 2.4 Return structured run results including turns, tool calls, final message, normal completion, and failure reason.

## 3. Orchestrator

- [x] 3.1 Compute the initial phase from QDD status for empty, active, blocked, close-ready, and closed project states.
- [x] 3.2 Create or align study scaffolds before invoking `qdd-propose` when the next study does not exist yet.
- [x] 3.3 Re-read status after every agent session and advance only from persisted filesystem state.
- [x] 3.4 Stop with a resumable error when a phase finishes without the files required for the next phase.
- [x] 3.5 Implement dry-run output that exercises the phase graph without mutating project state.

## 4. Prompt And Skill Boundary

- [x] 4.1 Remove or neutralize "Auto Mode: Fork Next Agent" blocks from bootstrap prompts.
- [x] 4.2 Keep bootstrap prompts focused on single-role workflow guidance.
- [x] 4.3 Treat existing `qdd-auto` skills as non-core until the runtime is validated.
- [x] 4.4 Document the later packaging path: generic agent command or skill invokes the runtime instead of encoding orchestration itself.

## 5. Entry Surface

- [x] 5.1 Keep `qdd auto` as a thin launcher over `runAuto` if a CLI entry already exists.
- [x] 5.2 Ensure CLI errors are clear when Claude SDK authentication or model configuration is missing.
- [x] 5.3 Ensure command output reports current phase, target, completed sessions, terminal reason, and resumable failure state.

## 6. Verification

- [x] 6.1 Add unit tests for phase selection and transition logic.
- [x] 6.2 Add unit tests for termination conditions.
- [x] 6.3 Add a dry-run test that verifies two-cycle sequencing without SDK calls.
- [x] 6.4 Run `pnpm build`.
- [x] 6.5 Run the available test suite.
- [ ] 6.6 Manually validate one initialized QDD project through at least two SDK-managed research cycles when credentials are available.

Manual SDK validation remains open because it requires live Claude credentials and a real auto-mode run against an initialized QDD project.
