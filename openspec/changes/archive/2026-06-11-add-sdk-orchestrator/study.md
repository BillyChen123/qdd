## Question

Can QDD's auto research loop be run by a runtime orchestrator that connects separate Claude SDK agent sessions through filesystem state, while preserving the same QDD role instructions used in human and assist modes?

## Hypothesis / Expectation

If the runtime owns phase transitions and each phase runs as an isolated SDK session, then QDD can execute the Thesis Manager -> Study Brain -> Executor -> Thesis Manager loop without nested `/fork`, with better resumability, clearer limits, and a cleaner path to later command/skill packaging.

## Inputs

- Existing QDD CLI status and instructions services
- Existing role bootstrap prompts
- Existing runtime scaffolding in `src/runtime/orchestrator.ts`
- Existing Claude SDK runner scaffolding in `src/runtime/agent-runner.ts`
- Existing `qdd auto` command scaffolding in `src/commands/auto.ts`
- Existing project files and managed file contracts

## Evidence Plan

This study should produce:

- A clear runtime phase graph and terminal condition contract
- A Claude SDK agent-session contract for role isolation
- A task plan that removes prompt-level fork orchestration from the core path
- Verification requirements for dry-run sequencing, state-based resume, and two full SDK-managed cycles
- A clear boundary that command/skill packaging comes after runtime validation

## Blockers

- Claude SDK credentials may not be available in every development environment
- Existing fork prompt blocks may already be present and need to be removed or made inert
- Phase detection may be ambiguous when project files are partially written by a failed agent session
- Shell tooling inside SDK sessions needs tighter scope and timeout boundaries before broad use

## Exit Signal

This study is ready to apply when:

- The runtime owns phase transitions and termination in the proposal artifacts
- The SDK session boundary is explicit
- The command/skill packaging boundary is deferred and thin
- The checklist is implementation-ready under the project-standard `qdd-bootstrap` structure
