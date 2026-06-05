## Theme

Keep QDD's local skill boundary tool-native, categorized, and auditable without introducing a third repo-local registry.

## Initial Question

How should QDD use categorized `.codex/skills/` and `.claude/skills/` trees for workflow and domain skills, while preventing `task.md` from referencing skills that do not actually exist?

## Mode

`human`.

Humans decide the skill taxonomy, which external domain skills are worth carrying into the project, and when a task really needs a skill. Agents may sync, validate, and render skill references, but must stay inside the locally installed skill inventory.

## Scope

### In Scope

- Remove `.agents/skills/` from the QDD bootstrap and protocol.
- Replace it directly rather than carrying compatibility shims or dual-layout support.
- Treat `.codex/skills/` and `.claude/skills/` as the maintained local skill surfaces.
- Organize skills by category folders such as `qdd/`, `plot/`, `genomics/`, or `env/`.
- Place QDD-owned workflow skills under `qdd/`.
- Support integrating existing domain skills into the local categorized skill trees.
- Make task frontmatter `skills:` and body `## Skills` stay identical.
- Reject or surface task skill references that do not exist under `.codex/skills/`.
- Treat missing declared task skills as execution blockers for `qdd-apply`.

### Out Of Scope

- Redesigning how `qdd-propose` decomposes one study into multiple tasks.
- Building a remote skill marketplace, package manager, or auto-download flow.
- Defining domain-specific skill content in this change.
- Reworking non-skill parts of the QDD study lifecycle.

## Evidence Standard

This change is successful when a fresh QDD scaffold:

- creates workflow skills under categorized tool-local paths instead of `.agents/skills/`,
- lets later QDD commands discover and validate task skills from the local inventory,
- keeps task frontmatter `skills:` and Markdown `## Skills` synchronized,
- and blocks or warns when a task names a skill that is not present under `.codex/skills/`.

## Shared Context

- Current bootstrap writes workflow skills into `.agents/skills/`, `.claude/skills/`, and `.codex/skills/`.
- Current skill discovery and instructions resolution still depend on `.agents/skills/`.
- `task.md` already renders `## Skills` from frontmatter on creation, but runtime validation still points at the old registry.
- The user wants no `.agents/skills/`, wants category-based organization, and wants task skill references to stay inside the local installed set.
- The user also wants task skill declaration to stay narrow: `skills:` is optional, but if present it should describe real domain dependencies rather than generic workflow steps.
