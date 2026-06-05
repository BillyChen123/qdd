## Task Goal

Define and implement a minimal QDD-native bootstrap workflow for the current CLI.

## Study Link

This task supports reducing manual handoff friction between the QDD CLI and agent execution in human mode while keeping bootstrap installation deterministic.

## Method

- Reuse only workflow-agnostic bootstrap patterns.
- Keep one primary protocol guide with quick reference, workflow, validation checklist, and advanced notes.
- Make `qdd init` install or refresh bootstrap assets directly.
- Generate or refresh installed `qdd-propose`, `qdd-explore`, `qdd-apply`, and `qdd-close` surfaces that point to the implemented QDD commands.
- Preserve QDD naming and avoid presenting the workflow as renamed OpenSpec lifecycle steps.
- Keep project-level semantics embedded in `qdd-propose` and `qdd-close` rather than introducing a dedicated `qdd-project` wrapper.

## Expected Outputs

- `qdd init` bootstrap installation behavior defined and implemented
- Codex-compatible QDD bootstrap assets
- Claude Code-compatible QDD bootstrap assets or an explicitly documented project-local command projection surface
- mapping from installed `qdd-*` commands/prompts to current QDD CLI commands
- tests or smoke checks showing that generated bootstrap assets mention the right commands and files
- docs updates describing how to use the bootstrap layer in a real project

## Run Contract

Each implementation attempt should:

- treat `qdd init` as the installation entrypoint for scaffold plus bootstrap assets
- install or refresh bootstrap assets into tool-compatible locations
- inspect the generated files to ensure they mention the implemented CLI, not hypothetical commands
- verify that the bootstrap assets preserve QDD identity and current filesystem truth sources
- verify that `qdd-explore` remains structured and study-anchored rather than free-form brainstorming
- avoid changing core runtime semantics while adjusting bootstrap content

## Failure / Blocker Conditions

- If the bootstrap workflow requires reworking the QDD runtime again, the slice has drifted too far
- If Codex and Claude Code need fundamentally different research semantics rather than just formatting/projection differences, stop and decide that explicitly
- If the generated assets still read like renamed `opsx` commands, the slice is not acceptable
- If the installed workflow cannot express the four-step loop without inventing a separate project wrapper, the slice is not acceptable
