## Question Before

QDD still relies on `.agents/skills/` as a local registry boundary, while task skill references are only partially tied to the tool-local skill trees that users actually inspect and maintain.

## Question After

QDD should use categorized tool-local skill trees, validate task skill IDs against `.codex/skills/`, keep `.claude/skills/` mirrored for tool compatibility, and stop creating `.agents/skills/` entirely.

## Change Type

`refinement`

## Change Driver

The current registry shape is harder to reason about than the user's intended operating model. The user wants workflow skills and domain skills to live where the tools already expect them, grouped by category, with no extra local layer and no fictional task skill references.

## Open Boundaries

- Whether future commands should actively repair `.claude/skills/` drift or only report it
- Whether QDD should add a dedicated "install/import domain skill" command later
- How aggressively existing projects should be migrated when they still contain `.agents/skills/`

## Evidence Summary

This change defines a cleaner skill contract: categorized tool-local skill trees, explicit workflow skill grouping under `qdd/`, validated task skill IDs, and synchronized task skill rendering for both machine and human readers.

## Recommended Next Step

Implement the runtime migration, bootstrap projection, task-skill validation, and prompt/test refresh needed to make the categorized local skill contract real.
