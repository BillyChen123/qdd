## Question Before

Can `qdd auto` render a modern minimalist multi-agent console with a fixed header, semantic phase body, and sticky footer while preserving the existing QDD auto runtime contract?

## Question After

The next implementation pass should test whether a lightweight screen model inside the existing renderer can satisfy the requested layout and fallback requirements without changing orchestration or machine-readable output.

## Change Type

refinement

## Change Driver

The user supplied a concrete visual language and explicitly pointed to `tui-home.ts` bear art as the logo source. Inspection showed that `src/ui/auto-stream.ts` already has an event-driven renderer suitable for a display-layer refactor.

## Open Boundaries

- Exact phase alias mapping must be confirmed against the current `AutoPhaseStartEvent` role values during implementation.
- Sticky footer cursor behavior needs TTY-specific testing across small and normal terminal widths.
- The test harness location and snapshot strategy should follow the repository's existing test structure after inspection.
- Version metadata source for the header should be chosen from the package metadata already available to the CLI, not hard-coded.

## Evidence Summary

This planning pass identified the stable boundary: display-only modernization of `qdd auto` interactive output. The QDD object model, run events, JSON mode, instructions JSON, and persisted filesystem protocol remain unchanged. The implementation evidence should come from focused renderer tests and a representative dry-run capture.

## Recommended Next Step

continue. Apply the checklist in this change to implement and validate the TTY renderer update.
