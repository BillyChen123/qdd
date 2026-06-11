## Theme

Modern minimalist multi-agent terminal UI for the QDD auto research loop.

## Initial Question

How should `qdd auto` present thesis management, study reasoning, and execution progress in a cleaner Claude Code-style console without changing QDD's research semantics?

## Mode

assist. The human defines the target visual language and reusable bear logo requirement. The agent may design and implement the console rendering details, but must preserve the existing auto orchestration authority boundaries and machine-readable behavior.

## Scope

### In Scope

- Refresh the interactive `qdd auto` console output in `src/ui/auto-stream.ts`.
- Keep `src/commands/auto.ts` JSON mode stable and non-TUI.
- Reuse the bear ASCII art exported from `tui-home.ts` for the global header logo.
- Present a fixed top header, multi-phase center content, and two-row sticky footer for TTY output.
- Use semantic phase styling for Thesis Manager, Study Brain, and Executor phases.
- Use state-driven typography for completed, active, pending, and nested log lines.
- Preserve synchronized output and graceful degradation for non-TTY or `NO_COLOR` terminals.

### Out Of Scope

- Changing the QDD project, study, task, run, artifact, closure, or evolution object model.
- Changing the orchestrator's phase ordering, stop codes, agent prompts, or file protocol.
- Adding a new software proposal/spec workflow on top of QDD artifacts.
- Rebranding QDD as PanRank or changing command names.
- Introducing heavyweight terminal UI frameworks unless existing rendering cannot satisfy the footer/header contract.

## Evidence Standard

Support comes from focused renderer tests or snapshot-style assertions that verify header/body/footer structure, phase labels, status typography, non-TTY fallback, and JSON-mode isolation. Manual evidence should include a short captured sample of `qdd auto --dry-run` or an equivalent renderer fixture showing the target layout.

## Shared Context

- Runtime code: `src/commands/auto.ts`, `src/runtime/orchestrator.ts`, and `src/ui/auto-stream.ts`.
- Reusable logo source: `tui-home.ts`, especially `getBearArt(status, density)`.
- Existing renderer already uses direct ANSI output, synchronized terminal output, spinners, compact action summaries, and locale-aware labels.
- Terminal UI constraints: high-density developer output, minimal borders, semantic soft colors, tree indentation, and sticky footer lines for current hypothesis/action status.
