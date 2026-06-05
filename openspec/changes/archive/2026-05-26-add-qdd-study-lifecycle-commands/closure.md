## Question Before

The current QDD CLI can initialize a project and read structured state, but it cannot create new studies, add tasks, register outputs, or close the study through deterministic commands, and its future write path was drifting away from the Markdown workflow shown in `docs/01-development-prototype.md`.

## Question After

QDD should support a minimal human-mode study lifecycle through deterministic write commands that scaffold studies and tasks, let agents update Markdown task records directly during execution, register reusable artifacts, and close a study with a structured `question_delta`.

## Change Type

refinement

## Change Driver

The simplified filesystem protocol is already concrete enough to support write operations. What is missing is a small set of lifecycle transitions and Markdown scaffolds aligned to the development prototype, not a new architecture layer.

## Open Boundaries

- Whether a dedicated `qdd close-task` command should appear in a later slice once task/run semantics are clearer.
- Whether dedicated multi-run storage should become a first-class runtime layout in the next slice.
- Whether `qdd validate`, `qdd artifacts list`, or `qdd context` should follow immediately after the lifecycle commands.
- How much result narrative belongs in frontmatter versus Markdown body sections for closed tasks and studies.

## Evidence Summary

This change identifies the next command surface that turns the current prototype into a usable research loop while preserving the simplified root layout, following the study/task Markdown shape from `docs/01-development-prototype.md`, and keeping QDD research semantics separate from OpenSpec agent infrastructure.

## Recommended Next Step

Implement `add-study`, `add-task`, `register-artifact`, and `close-study` in the root CLI, then run an explore pass on later task/run history depth and the later agent-bootstrap boundary.
