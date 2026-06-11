## Task Goal

Produce implementation evidence that `qdd auto` can render the requested modern minimalist multi-agent TUI while keeping runtime behavior and machine interfaces stable.

## Study Link

Supports the study question in `study.md`: whether the existing auto renderer can be modernized into fixed header, semantic phase body, and sticky footer zones without changing the QDD auto runtime contract.

## Method

1. Inspect the existing `AutoConsoleRenderer` event handlers and identify display state currently spread across fields such as phase counts, spinner text, compact action, model notes, failures, writes, log path, and project root.
2. Introduce a small in-memory screen model or equivalent helpers inside `src/ui/auto-stream.ts` that separate event interpretation from string rendering.
3. Import or otherwise reuse `getBearArt` from `tui-home.ts` for low-height header branding, choosing compact density for narrow terminals.
4. Render the interactive TTY screen as:
   - global header with bear logo, product name, version/uptime/status metadata, and subtle divider
   - center phase area with Thesis Manager, Study Brain, and Executor semantic aliases
   - two-row sticky footer for current proposal/hypothesis and current action/status
5. Preserve append-only non-TTY output and `qdd auto --json` output.
6. Add focused tests around deterministic render helpers and command behavior where practical.

## Expected Outputs

- Updated renderer code in `src/ui/auto-stream.ts`.
- Any necessary export adjustment in `tui-home.ts` or import path wiring, without duplicating bear art.
- Tests under the existing test layout covering structure and fallback behavior.
- A representative fixture, snapshot, or documented captured output showing the requested layout.
- Passing verification from relevant package scripts, at minimum the targeted test suite and TypeScript build if available.

## Run Contract

Each implementation run must record:

- Commands executed and whether they passed.
- Files changed.
- Terminal mode assumptions used for renderer tests, including width and TTY/color flags.
- Any fallback behavior intentionally left unchanged.
- Any deviations from the requested visual language and the reason.

## Failure / Blocker Conditions

- `qdd auto --json` emits ANSI sequences or layout-only fields.
- Non-TTY output becomes unreadable or depends on cursor addressing.
- The renderer changes orchestrator semantics, phase order, stop codes, prompts, persisted statuses, or QDD filesystem state.
- Footer cursor control leaves the terminal in a broken state after completion or failure.
- The bear logo is copied instead of reused from `tui-home.ts`, unless import constraints make reuse impossible and the reason is documented.
