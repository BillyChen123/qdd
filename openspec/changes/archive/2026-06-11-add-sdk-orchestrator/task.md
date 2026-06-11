## Task Goal

Harden QDD auto mode around a runtime orchestrator plus Claude SDK role sessions, and remove the prompt-native nested `/fork` model from the core implementation path.

## Study Link

This task supports the bounded study in `study.md`: prove auto orchestration as runtime-owned multi-session coordination before packaging it as command or skill surfaces for generic agents.

## Method

Implement in dependency order:

1. Confirm the runtime contract and phase graph.
2. Harden the Claude SDK agent runner.
3. Harden the runtime orchestrator around persisted QDD status.
4. Remove or neutralize prompt-level fork orchestration blocks.
5. Keep `qdd auto` or any skills as thin launchers over the runtime.
6. Verify dry-run, status transitions, termination, and a real SDK-managed loop when credentials are available.

## Expected Outputs

- Runtime phase selection and transition logic with test coverage
- Structured agent run result with completion and failure metadata
- Runtime stop reasons for terminal project state, max iteration limit, max-turn exhaustion, and missing required files
- Bootstrap prompts without active self-forking orchestration
- Optional launcher surface that delegates to `runAuto`
- Documentation or task notes making command/skill packaging a follow-up layer

## Run Contract

Each implementation run should record:

- Which phase was being implemented or verified
- Which QDD status shape was used as input
- Whether the run was dry-run or real SDK execution
- The exact command used for build/test verification
- Any missing SDK credentials or model configuration
- Any prompt fork blocks removed or left inert

## Failure / Blocker Conditions

- Runtime cannot determine the next phase from persisted QDD state
- A role session completes without producing required files for the next phase
- Claude SDK auth or model resolution fails without a clear setup error
- Prompt-level fork blocks remain active and can accidentally spawn agents in human or assist mode
- Command/skill packaging starts duplicating orchestration logic instead of delegating to the runtime
