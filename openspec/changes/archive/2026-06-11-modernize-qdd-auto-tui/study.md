## Question

Can `qdd auto` render a modern minimalist multi-agent console with a fixed header, semantic phase body, and sticky footer while preserving the existing QDD auto runtime contract?

## Hypothesis / Expectation

The current event-driven renderer can be refactored into a small screen model and renderer without changing orchestration. `tui-home.ts` can provide the bear logo art, while `src/ui/auto-stream.ts` continues to own runtime event formatting, synchronized output, spinners, and fallback behavior.

## Inputs

- User-provided design language: Claude Code-style density, soft semantic colors, state-driven typography, three vertical zones, and two-row sticky footer.
- Existing renderer: `src/ui/auto-stream.ts`.
- Existing command surface: `src/commands/auto.ts`.
- Runtime event source: `src/runtime/orchestrator.ts`.
- Logo source: `tui-home.ts` `getBearArt(status, density)`.
- Terminal UI guidance: batch writes where possible, avoid unnecessary clear/redraw, use semantic colors, keep output robust in non-TTY contexts.

## Evidence Plan

- Produce a renderer implementation plan that maps existing auto events to header/body/footer display state.
- Add or update tests for:
  - phase label rendering for Thesis Manager, Study Brain, and Executor
  - completed/active/pending row prefixes
  - tree indentation for nested logs
  - sticky footer rows in TTY rendering
  - append-only fallback in non-TTY or `NO_COLOR`
  - unchanged JSON output path
- Capture a representative dry-run or fixture output that demonstrates the requested layout.

## Blockers

- Existing tests and package scripts need to be inspected during implementation to choose the correct snapshot or unit-test style.
- Terminal dimensions may constrain exact header/footer alignment; the implementation should choose a deterministic truncation strategy instead of requiring a fixed width.
- Some orchestrator roles may not map one-to-one to the three visual phase names; mapping must remain display-only and conservative.

## Exit Signal

The study can close when the renderer has a clear implementation checklist, the QDD runtime contract remains unchanged, and the evidence plan is sufficient for an implementation pass to verify the new visual style.
