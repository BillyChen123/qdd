## Question

How should one QDD study refer to local workflow and domain skills so execution stays auditable, category-aware, and free of hidden global dependencies?

## Hypothesis / Expectation

If QDD discovers skills from categorized tool-local directories, validates every task skill against `.codex/skills/`, and keeps task skill rendering synchronized, then study planning and execution can reuse domain skills cleanly without a separate registry layer.

## Inputs

- Current bootstrap, skill discovery, instructions, inspection, and lifecycle code
- Existing QDD workflow prompts and generated skill assets
- Current task document format with frontmatter `skills:` and body `## Skills`
- User expectations for category-based local skill organization such as `qdd/`, `plot/`, and similar domain folders

## Evidence Plan

- A protocol that removes `.agents/skills/` and defines categorized tool-local skill paths
- Runtime behavior that discovers valid task skills from `.codex/skills/`
- Task document behavior that keeps frontmatter and Markdown skill lists identical
- Apply behavior that stops when a task declares missing local skills
- Bootstrap and validation behavior that surfaces missing or unsynced skills clearly

## Blockers

- Two tool-local trees can drift if refresh rules are weak
- Existing test fixtures and docs still point at `.agents/skills/`
- Imported domain skills need a stable ID scheme that does not collide with workflow skills
- Proposal/explore prompts must stop writing `qdd/*` workflow skills into task records

## Exit Signal

This study can close when QDD has one clear categorized skill contract, no longer depends on `.agents/skills/`, and can explain exactly how a task skill becomes valid, visible, and executable.
