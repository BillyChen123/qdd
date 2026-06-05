## Theme

Bootstrap a QDD-native prompt and command layer on top of the now-complete core CLI so `qdd init` can install usable study-facing workflows with minimal manual setup.

## Initial Question

How should QDD project its existing CLI and filesystem protocol into installed prompts or commands so an agent can reliably run the current research loop without inheriting OpenSpec's software workflow identity?

## Mode

`human`.

This slice is for human-mode bootstrap, not assist mode or auto mode. Humans still decide research direction at the study level, while agents may generate tasks, execute work inside a study boundary, and write project carry-forward context during closure.

## Scope

### In Scope

- Make `qdd init` install the prompt/bootstrap layer directly rather than relying on an agent to scaffold it later.
- Generate QDD-native bootstrap assets for the current CLI workflow.
- Keep the workflow identity explicitly QDD-native rather than `opsx`-derived.
- Reuse only workflow-agnostic bootstrap patterns from OpenSpec-style agent infrastructure.
- Project the current CLI loop into four study-facing command/prompt surfaces: `qdd-propose`, `qdd-explore`, `qdd-apply`, and `qdd-close`.
- Support Codex global prompts and project-local command projections such as Claude Code.
- Prefer a single-file instruction design aligned with `docs/01-development-prototype.md`.
- Bind the bootstrap content to the existing implemented commands: `init`, `status`, `instructions`, `add-study`, `add-task`, `register-artifact`, `close-study`, `validate`, `artifacts:list`, and `context`.
- Keep project-level semantics embedded in the four-step loop rather than introducing a separate `qdd-project` wrapper in this slice.

### Out Of Scope

- Adding new core lifecycle commands.
- Building a dedicated project-management wrapper such as `qdd-project` in this slice.
- Implementing assist-mode next-study proposal logic.
- Implementing learned-rule auto-updates, quality scoring, or project-manager intelligence.
- Building SDK auto mode or TUI support.
- Reworking the existing QDD filesystem layout again.

## Evidence Standard

This change is successful when a fresh QDD project can install or refresh bootstrap instructions that:

- tell the agent how to use the current QDD CLI correctly,
- identify the current command surfaces and truth sources,
- preserve QDD naming and workflow identity,
- reduce manual prompt handoff enough for one real dogfood study,
- and let `qdd init` deliver a ready-to-use bootstrap layer without a second setup conversation.

## Shared Context

- The current QDD CLI already implements the manual research loop and the non-core validation/inspection commands.
- `openspec/specs/qdd-agent-foundation/spec.md` already defines the boundary: reuse infrastructure, not OpenSpec workflow semantics.
- `docs/01-development-prototype.md` strongly prefers a single-file prompt design with quick reference, workflow, validation checklist, and advanced notes.
- The existing `.qdd/instructions.md` already uses that structure, but it is not yet projected into installed tool-specific bootstrap assets.
- The user wants the study-facing loop to mirror the OpenSpec four-step feel while remaining research-native: propose, explore, apply, close.
- `qdd-explore` should be stricter than OpenSpec explore: it may discuss options, but it must stay anchored to the active study question and converge to a resource-supported plan.
