## 1. Boundary And Current Renderer

- [x] 1.1 Inspect `src/ui/auto-stream.ts` event handlers and list the existing fields that feed current console state.
- [x] 1.2 Inspect current tests and package scripts to choose the smallest useful renderer test surface.
- [x] 1.3 Confirm `qdd auto --json` bypasses interactive rendering and record the expected unchanged path.

## 2. Screen Model And Logo

- [x] 2.1 Add a small display model or helper set for header metadata, phase rows, current proposal, current action, status label, and elapsed timer.
- [x] 2.2 Reuse `getBearArt` from `tui-home.ts` for the header logo and select compact/full density from terminal width.
- [x] 2.3 Resolve header version metadata from existing package or CLI metadata instead of hard-coding a fake version.

## 3. Phase Body Rendering

- [x] 3.1 Map existing auto phase roles to display-only aliases: Thesis Manager, Study Brain, and Executor.
- [x] 3.2 Render phase titles with soft semantic colors: coral for Thesis Manager, violet for Study Brain, and mint/cyan for Executor.
- [x] 3.3 Render completed rows with `✔` and dim styling, active rows with spinner or `▶` and bold styling, and pending rows with `○` or `░`.
- [x] 3.4 Render nested notes and tool details with `├─`, `└─`, `│`, and `⌙` indentation.

## 4. Header Footer Layout

- [x] 4.1 Render a fixed top header with bear logo, QDD auto branding, version, uptime, global status, and a subtle divider.
- [x] 4.2 Render a two-row sticky footer in TTY mode: `PROPOSE` row for the current question/hypothesis and status row for command/sub-action plus timer.
- [x] 4.3 Ensure footer label styling uses reverse/high-contrast blocks without heavy full-screen background colors.
- [x] 4.4 Add deterministic truncation and width handling so long prompts, commands, and Chinese text do not break alignment.

## 5. Compatibility And Terminal Safety

- [x] 5.1 Preserve append-only readable output for non-TTY, CI, and `NO_COLOR` contexts.
- [x] 5.2 Keep synchronized output batching and avoid unnecessary full clears during spinner updates.
- [x] 5.3 Restore terminal state on completion, failure, and interruption.
- [x] 5.4 Preserve final result, error detail, log path, and next-step guidance visibility after the sticky footer exits.

## 6. Validation

- [x] 6.1 Add focused tests for header/body/footer structure and phase typography using fixed terminal width fixtures.
- [x] 6.2 Add tests or assertions proving JSON mode contains no ANSI or TUI-only layout fields.
- [x] 6.3 Add tests or fixtures for non-TTY fallback output.
- [x] 6.4 Run the relevant test suite and TypeScript build, then record any limitations or skipped checks.
