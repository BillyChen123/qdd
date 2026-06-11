## Filesystem Contract

This change does not add or rename QDD filesystem objects. Existing project, study, task, run, artifact, closure, memory, and evolution files remain authoritative.

The TUI renderer may read runtime events emitted by `runAuto` and may write the existing run log file already managed by `AutoConsoleRenderer`. It must not create a second UI-specific lifecycle store. Any captured visual sample for tests belongs under the test fixture or snapshot location chosen by the existing test layout.

## Identifiers And Metadata

No new persistent identifiers are introduced.

The renderer may derive transient display state from existing event fields:

- run metadata: project root, prompt, model, max iterations, max turns, dry-run flag, and log path
- phase metadata: role, phase index, phase prompt, start/result/incomplete/terminal events
- agent metadata: turn number, model text, tool use, tool result, and completion marker status
- result metadata: stop code, reason, closed studies, and terminal state

Display phase labels are semantic aliases only:

- Thesis Manager maps to the phase responsible for prompt framing, current project/question assessment, or study lifecycle decisions.
- Study Brain maps to the phase responsible for evidence planning, boundary reasoning, or hypothesis modeling.
- Executor maps to the phase responsible for command/tool execution and artifact-producing work.

These aliases must not replace persisted QDD roles or statuses.

## Status JSON

`qdd auto --json` remains machine-readable and must not include ANSI control sequences, bear art, sticky footer text, spinner frames, or layout-only phase aliases unless the existing `AutoResult` already contains equivalent data.

The interactive renderer can maintain in-memory fields for:

- current proposal or hypothesis line
- current status label: `THINKING`, `EXECUTING`, `WAITING`, `COMPLETE`, or `FAILED`
- current command/sub-action text
- elapsed timer for the active phase/action
- summarized phase rows with state-driven prefixes

These fields are rendering state, not status JSON.

## Instructions JSON

Existing instructions JSON remains scoped to agent behavior and QDD protocol state. It should not be expanded with visual style requirements.

If a future agent needs to know that `qdd auto` has a modern TUI, that belongs in human-facing command help or renderer documentation, not in instructions JSON for research execution.

## Agent Usage Rules

- Agents consume the same QDD state as before and should not invent extra lifecycle phases to match the display.
- The renderer consumes events after the orchestrator emits them; it must not become the source of truth for run progress.
- TTY output may use synchronized output, cursor movement, and a sticky footer, but must restore terminal state on completion, interruption, or failure.
- Non-TTY, CI, or `NO_COLOR` output must degrade to append-only readable logs without sticky cursor control.
- The header/footer layout must never hide final failure details, log paths, or next-step guidance.
