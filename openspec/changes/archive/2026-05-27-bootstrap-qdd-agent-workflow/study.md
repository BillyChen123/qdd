## Question

How should QDD project its implemented CLI into installed prompts or commands so an agent can operate the current workflow with low manual friction and without losing QDD's research identity?

## Hypothesis / Expectation

If QDD adds a thin bootstrap layer now, installed directly by `qdd init`, using a single-file instruction shape plus four QDD-native workflow wrappers, then one real dogfood study can be run with much less manual prompt assembly while keeping the core CLI unchanged.

## Inputs

- Existing QDD CLI implementation in `src/`
- `openspec/specs/qdd-agent-foundation/spec.md`
- `openspec/specs/qdd-research-orchestration/spec.md`
- Prompt design guidance in `docs/01-development-prototype.md`
- Current progress and usage notes in `docs/02-code-prototype-map.md`

## Evidence Plan

- Define what installed prompt or command files should be generated and where
- Define how they reference the current CLI and truth sources
- Keep QDD identity separate from OpenSpec workflow identity
- Ensure the generated loop is `qdd-propose -> qdd-explore -> qdd-apply -> qdd-close`
- Ensure project initialization is handled by `qdd init` rather than by a bootstrap conversation
- Ensure study planning remains human-owned while task generation remains agent-owned

## Blockers

- The exact tool-specific projection surface still needs choosing: Codex global prompts only versus Codex plus project-local command projections such as Claude Code
- The study template may need stronger sections for resource fit, evidence plan, and starter tasks if the installed `qdd-explore` workflow is to converge reliably

## Exit Signal

This study is complete when the bootstrap layer is specified clearly enough that implementation can proceed as a thin wrapper over the existing CLI, installed by `qdd init`, with four QDD-native workflow surfaces and no separate project wrapper.
