## Theme

Stabilize QDD managed Markdown/YAML writes without adding a heavy update-command layer.

## Initial Question

Can QDD reduce auto-mode failures caused by malformed YAML frontmatter while preserving the lightweight agent workflow where study and task files remain editable Markdown?

## Mode

Assist mode for development.

The human decision is to avoid a broad `update-task` / `update-study` CLI expansion for now. The implementation should keep agent editing flexible while adding clearer schema guidance and immediate managed-file write validation.

## Scope

### In Scope

- Managed Markdown examples and schema guidance for `study.md` and `task.md`.
- Guidance that long natural-language summaries should live in Markdown body sections rather than YAML frontmatter.
- Safe YAML guidance for hand-written managed fields that must still contain natural language.
- Runtime validation for `write` tool calls that target QDD managed files.
- Tests covering schema guidance and rejected invalid managed writes.

### Out Of Scope

- Adding `update-task`, `update-study`, or other broad structured update CLI commands.
- Changing generated `.qdd/instructions.md` checklist content.
- Weakening `qdd status`, `qdd validate`, or auto-mode invalid-state gates.
- Reworking the QDD object model or managed-file contracts wholesale.

## Evidence Standard

The change is acceptable if malformed managed frontmatter/YAML is caught at write time during auto runs, task examples steer agents toward body-based summaries, and existing build/test behavior remains stable.

## Shared Context

The failure mode was observed in an auto run where `TASK-003.md` was overwritten with an unquoted `result_summary` containing `Key related work: ...`, causing YAML parse failure at phase end. Existing `add-study` and `add-task` generate valid files, but later agent `write` calls can bypass serializers.
