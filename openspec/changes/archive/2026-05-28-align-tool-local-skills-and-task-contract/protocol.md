## Filesystem Contract

This slice removes the extra `.agents/skills/` layer and keeps skill organization inside tool-local directories.

```text
project-root/
├── contract.yaml
├── evolution.yaml
├── context/
├── data/
├── studies/
├── artifacts/
├── .qdd/
├── .codex/
│   └── skills/
│       ├── qdd/
│       │   ├── qdd-start/SKILL.md
│       │   ├── qdd-propose/SKILL.md
│       │   ├── qdd-explore/SKILL.md
│       │   ├── qdd-apply/SKILL.md
│       │   └── qdd-close/SKILL.md
│       ├── plot/
│       │   └── marker-heatmap/SKILL.md
│       └── genomics/
│           └── celltype-annotation/SKILL.md
└── .claude/
    ├── commands/
    └── skills/
        ├── qdd/
        ├── plot/
        └── genomics/
```

Rules for this slice:

- QDD must not create or depend on `.agents/skills/`.
- Skill IDs are derived from the relative folder path under `.codex/skills/`, for example `qdd/qdd-propose` or `plot/marker-heatmap`.
- QDD-owned workflow skills live under the `qdd/` category.
- Domain skills are grouped by their first path segment, such as `plot/`, `genomics/`, or `env/`.
- `.codex/skills/` is the runtime validation inventory for task skill IDs.
- `.claude/skills/` must keep the same relative IDs when QDD bootstraps or refreshes mirrored assets.
- This slice replaces the old layout directly; do not add compatibility code that keeps `.agents/skills/` alive.

## Identifiers And Metadata

Identifiers in this slice:

- workflow command surfaces: `qdd-start`, `qdd-propose`, `qdd-explore`, `qdd-apply`, `qdd-close`
- workflow skill IDs: `qdd/qdd-start`, `qdd/qdd-propose`, `qdd/qdd-explore`, `qdd/qdd-apply`, `qdd/qdd-close`
- domain skill IDs: `<category>/<skill-name>`
- study IDs: `STUDY-XXX`
- task IDs: `TASK-XXX`
- artifact IDs: `ART-XXX`

Metadata rules:

- `task.md` frontmatter `skills:` is the machine-readable skill list.
- `task.md` body `## Skills` is the human-readable mirror of that same list.
- QDD must rewrite both surfaces from the same normalized ordered array so they cannot drift.
- `skills:` is optional. If omitted or empty, the task may still be valid.
- If `skills:` is non-empty, every listed skill must exist at `.codex/skills/<id>/SKILL.md`.
- Task `skills:` is for domain dependencies only. Do not write workflow skills such as `qdd/qdd-propose` or `qdd/qdd-apply` into task records.
- Runtime enforcement is narrow: normalize IDs, de-duplicate them, mirror them into `## Skills`, and verify existence. Runtime does not infer recommended skills on its own.

## Status JSON

`qdd status --json` does not need a new top-level object, but skill health becomes part of project readiness:

- a project with no local workflow skills is not fully bootstrapped,
- a task that names missing skills is not cleanly executable,
- and validation should surface categorized skill IDs exactly as they appear on disk.

No new planner or registry file is introduced.

## Instructions JSON

`qdd instructions` keeps the same targets, but the read/write contract changes:

- `PROJECT` reads `.codex/skills/`, `.claude/skills/`, and bootstrap metadata; it writes refreshed tool-local skill assets.
- `STUDY-XXX` and `TASK-XXX` resolve required skills from task frontmatter via `.codex/skills/`.
- When a matched skill exists, instructions should expose the corresponding `.codex/skills/.../SKILL.md` path and may also expose the mirrored `.claude/skills/.../SKILL.md` path when present.
- When a named skill is missing from `.codex/skills/`, instructions must surface it as a blocker rather than silently accepting it.
- `qdd-apply` must treat a task with missing declared skills as hard-blocked rather than continuing with a weakened contract.

## Agent Usage Rules

- Do not introduce a third local skill registry.
- Keep QDD workflow skills in `qdd/`; keep domain skills in explicit category folders.
- Only mention or assign task skills that exist under `.codex/skills/`.
- `qdd-propose` writes the first-pass task skills. `qdd-explore` may refine them after discussion. `qdd-apply` consumes task skills but does not invent new ones.
- If a desired skill is missing, either install/sync it into the local tree or rewrite the task so the dependency is explicit.
- Keep frontmatter `skills:` and body `## Skills` identical whenever a task is created or edited.
- Tool-specific bootstrap is still reused from the OpenSpec-style infrastructure, but the resulting skill contract must stay QDD-native and category-aware.
