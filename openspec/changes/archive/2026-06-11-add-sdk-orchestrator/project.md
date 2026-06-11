## Theme

SDK-backed QDD auto-mode orchestration: a runtime orchestrator uses Claude SDK sessions to connect multiple role-specific agents while the QDD filesystem remains the durable handoff layer.

## Initial Question

How should QDD provide auto-mode research orchestration through a runtime orchestrator plus Claude SDK sessions, so Thesis Manager, Study Brain, Executor, and Thesis Manager close can run as separate agents without relying on prompt-level nested `/fork`?

## Mode

`auto`

This change implements auto mode as runtime-owned orchestration. The runtime chooses phases, creates isolated Claude SDK sessions, passes each session the matching bootstrap prompt and `qdd instructions --json`, rereads filesystem state after every phase, and decides whether to continue or stop.

Command and skill packaging is intentionally secondary. Once the runtime path works, `qdd auto` or agent skills can become thin launchers over the runtime instead of carrying orchestration logic themselves.

## Scope

### In Scope

- Runtime-owned phase graph: `start -> propose -> apply -> close -> propose|stop`
- Claude SDK-backed isolated agent sessions for each phase
- Use existing bootstrap prompts as role system prompts
- Use existing `qdd instructions --json` as the per-target instruction context
- Filesystem-only handoff through QDD-managed project, study, task, artifact, memory, and evolution files
- Runtime controls for model, max iterations, max turns per agent, dry run, JSON output, and terminal reason reporting
- Removing or neutralizing prompt-level "Auto Mode: Fork Next Agent" blocks
- Treating command/skill surfaces as follow-up thin wrappers over the runtime

### Out Of Scope

- Prompt-native nested `/fork` as the core orchestrator
- Encoding the phase graph inside workflow skills
- Parallel study execution
- A TUI, daemon, or remote job queue
- Redesigning QDD's research object model or managed file contracts
- General agent command/skill packaging before the SDK runtime is validated

## Evidence Standard

This change is successful when:

- `openspec status --change add-sdk-orchestrator` reports the change apply-ready under `qdd-bootstrap`
- Dry-run auto mode can sequence at least two full research cycles without SDK calls
- A real initialized QDD project can run at least two SDK-managed cycles when Claude credentials are available
- Each role session starts from bootstrap prompt plus `qdd instructions --json`, not a previous chat transcript
- The runtime, not prompt text, decides phase transitions and termination
- Human and assist prompts no longer contain active self-forking orchestration behavior

## Shared Context

- Existing implementation starting points include `src/runtime/orchestrator.ts`, `src/runtime/agent-runner.ts`, and `src/commands/auto.ts`
- `package.json` already includes `@anthropic-ai/sdk`
- QDD's existing filesystem protocol remains the communication bus
- Existing bootstrap prompts under `src/runtime/bootstrap-prompts/` remain role guidance, not orchestration scripts
- The earlier fork-chain proposal is superseded by this SDK runtime plan
