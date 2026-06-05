## Question Before

QDD now has a working CLI and validation/inspection layer, but users still need manual prompt handoff because there is no QDD-native bootstrap layer that `qdd init` can install for real study execution.

## Question After

QDD should add a thin bootstrap layer that `qdd init` can install directly, projecting the current CLI and protocol into `qdd-propose`, `qdd-explore`, `qdd-apply`, and `qdd-close` so one real human-mode study can be run with less setup and without compromising QDD's identity.

## Change Type

refinement

## Change Driver

The main remaining friction is no longer missing core CLI functionality; it is the lack of a stable, QDD-native installed entrypoint. The bootstrap layer should therefore be the next thin slice.

## Open Boundaries

- How much tool-specific customization is worth shipping in the first bootstrap slice
- Whether `.qdd/instructions.md` alone remains the base source or whether a separate prompt template file should become primary
- Whether Claude Code should receive project-local command files in the first slice or follow after Codex proves the bootstrap shape

## Evidence Summary

This change focuses the next step on a bootstrap layer that packages the already-implemented QDD protocol for installed prompts or commands, rather than adding more core commands or a separate project wrapper.

## Recommended Next Step

Implement `qdd init`-driven bootstrap installation for the four `qdd-*` workflow surfaces, then dogfood one real study through that loop before moving on to higher-level assist-mode planning.
