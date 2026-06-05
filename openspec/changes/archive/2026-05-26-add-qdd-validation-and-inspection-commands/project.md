## Theme

Harden the current QDD prototype for repeated use by adding validation and stable inspection commands on top of the existing study/artifact lifecycle.

## Initial Question

Which non-state-advancing commands should land next so the current QDD CLI can be checked, inspected, and safely reused across real projects without changing the underlying research workflow?

## Mode

`human`.

The CLI still manages filesystem state only. Humans and agents continue to own research judgment, while the new commands provide validation and read-only inspection surfaces around the existing truth sources.

## Scope

### In Scope

- Add `qdd validate` for protocol integrity checks.
- Add `qdd artifacts list --json` as a stable artifact inspection surface.
- Add `qdd context` as a stable project-context inspection surface.
- Reuse the current truth sources: YAML at project level, Markdown frontmatter for study/task records.
- Keep `context/` open-ended instead of hardcoding a fixed set of context filenames.
- Add tests and docs updates for the new read/validation command surface.

### Out Of Scope

- Changing the core study/task/artifact/closure lifecycle added in the previous slice.
- Adding `qdd close-task` in this change.
- Adding agent bootstrap generation, plugins, TUI, or auto mode.
- Introducing new caches, summaries, or duplicate state files just to support inspection.

## Evidence Standard

This change is successful when a QDD project can:

- validate its control files and record files for required fields and basic state consistency,
- expose artifacts in a machine-readable listing suitable for agents or humans,
- expose project context through a stable CLI surface,
- do all of the above without changing the core filesystem truth sources.

## Shared Context

- The current CLI already supports `init`, `status --json`, `instructions <id> --json`, `add-study`, `add-task`, `register-artifact`, and `close-study`.
- The current code prototype is strong enough for one manual end-to-end demo loop, but inspection is still file-oriented and validation is missing.
- `docs/01-development-prototype.md` treats `qdd validate` as part of the core filesystem protocol milestone and `qdd artifacts list --json` as part of the artifact-system milestone.
- `docs/00-product-requirements-document.md` also defines `qdd context` and `qdd validate` as public CLI commands.
