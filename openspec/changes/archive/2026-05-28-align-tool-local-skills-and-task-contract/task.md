## Task Goal

Replace the old local skill registry assumptions with a categorized tool-local skill contract and enforce that `task.md` skill references only point at installed local skills.

## Study Link

This task supports the study question of how QDD should bind workflow and domain skills to actual study execution without hidden dependencies or duplicate registries.

## Method

- Update bootstrap and path constants so QDD writes workflow skills into categorized `.codex/skills/` and `.claude/skills/` paths.
- Rewrite local skill discovery, instructions, inspection, and validation to use `.codex/skills/` as the task-skill inventory.
- Keep task frontmatter `skills:` and body `## Skills` generated from the same normalized list during create and edit flows.
- Treat `skills:` as optional, but hard-fail execution when a non-empty skill list contains missing local skills.
- Reserve `qdd/*` for workflow/bootstrap use and keep task skill lists limited to domain skills such as `plot/*`, `genomics/*`, or `env/*`.
- Refresh prompts, tests, and docs so they only reference valid categorized local skill IDs.

## Expected Outputs

- Updated runtime path and bootstrap behavior for categorized tool-local skills
- Updated instructions and validation behavior for missing or mismatched task skills
- Updated task document contract for synchronized skill lists
- Refreshed tests and docs showing category-based local skill layout

## Run Contract

Each implementation run must record:

- which skill directories were treated as authoritative,
- which task-skill IDs were considered valid or missing,
- which docs/tests were updated to reflect the new contract,
- and whether mirrored `.claude/skills/` paths stayed aligned with `.codex/skills/`.

## Failure / Blocker Conditions

- A task can still reference skills that do not exist under `.codex/skills/`
- Bootstrap still creates or depends on `.agents/skills/`
- Workflow skill IDs and domain skill IDs collide or lose category information
- Frontmatter `skills:` and body `## Skills` can drift after edits
- `qdd-apply` continues execution even though a task declares missing local skills
