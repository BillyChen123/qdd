## Theme

Turn the current read-focused QDD prototype into a usable human-mode research loop by adding the next minimal study scaffolding, artifact registration, and study closure commands.

## Initial Question

Which QDD commands should land next so a user and a coding agent can create a study, scaffold tasks, execute against the Markdown protocol from `docs/01-development-prototype.md`, register reusable outputs, and close the study without reintroducing OpenSpec's software workflow?

## Mode

`human`.

The human still owns research judgment, especially bounded question selection and `question_delta` decisions. The CLI only manages filesystem state transitions and machine-readable protocol surfaces.

## Scope

### In Scope

- Add deterministic write commands to the root `qdd` TypeScript CLI: `add-study`, `add-task`, `register-artifact`, and `close-study`.
- Keep the current project layout centered on `contract.yaml`, `evolution.yaml`, `context/`, `studies/`, `artifacts/`, and `.qdd/`.
- Scaffold study and task records in the existing Markdown-frontmatter format.
- Make the generated `study.md` and `TASK-XXX.md` bodies follow the sections described in `docs/01-development-prototype.md`.
- Register reusable outputs in `artifacts/index.yaml` with provenance back to study and task.
- Close a study by appending a structured `question_delta` to `evolution.yaml`.
- Keep one root instruction file and align its structure with the single-file guidance described in `docs/01-development-prototype.md`.
- Add smoke tests and lightweight docs updates for the new command surface.

### Out Of Scope

- Generating Codex or Claude Code bootstrap commands.
- Adding interactive prompt flows, TUI views, or SDK auto mode.
- Reintroducing `control/`, `questions/`, `prompts/`, or `runs/` as required core layout for this slice.
- Adding `qdd close-task` or a mandatory run-level lifecycle in this slice.
- Refactoring or modifying `OpenSpec/` runtime code.
- Full schema validation, artifact search UX, or context editing subcommands.

## Evidence Standard

This change is successful when one initialized QDD project can complete a single auditable loop with CLI support for:

- creating a bounded study,
- adding at least one evidence-producing task,
- letting the agent update task records directly inside the generated Markdown protocol,
- registering one or more artifacts with provenance,
- closing the study with a structured `question_delta`, and
- reflecting that state through the existing `qdd status --json` and `qdd instructions <id> --json` surfaces.

## Shared Context

- The current implementation already supports `qdd init`, `qdd status --json`, and `qdd instructions <id> --json`.
- Current truth-source split: project-level state is YAML, while study and task records are Markdown frontmatter.
- `context/` is intentionally open-ended and must remain a generic YAML collection rather than a hardcoded domain file set.
- Existing runtime modules in `src/runtime/` already handle path constants, YAML IO, record discovery, status aggregation, and instructions generation.
- `docs/01-development-prototype.md` is the primary product prototype for this slice; the current `src/` shape is an implementation constraint, not the source of truth for workflow design.
- This slice should extend that runtime instead of introducing a second protocol model.
