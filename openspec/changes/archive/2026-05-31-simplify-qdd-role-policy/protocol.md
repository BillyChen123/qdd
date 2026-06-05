## Filesystem Contract

This slice keeps the existing QDD filesystem layout, but simplifies the editable workflow-policy surface.

```text
project-root/
├── contract.yaml
├── evolution.yaml
├── context/
│   └── resources.md
├── studies/
│   └── STUDY-XXX/
│       ├── study.md
│       ├── tasks/
│       │   └── TASK-XXX.md
│       └── output/
├── artifacts/
│   ├── index.yaml
│   ├── data/
│   ├── code/
│   ├── figures/
│   └── reports/
├── .qdd/
│   ├── instructions.md
│   ├── bootstrap.yaml
│   └── layer-policy.yaml
├── .codex/
│   └── skills/
└── .claude/
    ├── commands/
    └── skills/
```

Rules for this slice:

- Keep `.qdd/layer-policy.yaml` as the editable workflow-policy file for now, but change its meaning.
- The file should stop modeling `project/study/task` as policy layers with owned execution defaults.
- The file should instead model:
  - `commands -> role`
  - `roles -> default_skills`
- `study-brain` may own planning defaults.
- `executor` should default to an empty policy-owned skill set.
- `thesis-manager` may default to an empty skill set in the scaffold, while still owning `qdd-start` and `qdd-close`.
- Task-local executor skills remain in `task.md` and are still the primary execution dependency list.

Minimal policy example:

```yaml
commands:
  qdd-start: thesis-manager
  qdd-propose: study-brain
  qdd-explore: study-brain
  qdd-apply: executor
  qdd-close: thesis-manager

roles:
  thesis-manager:
    default_skills: []
  study-brain:
    default_skills:
      - brain/singlecell/scrna-study-brain
  executor:
    default_skills: []
```

## Identifiers And Metadata

Identifiers retained in this slice:

- modes: `human`, `assist`, `auto`
- workflow commands: `qdd-start`, `qdd-propose`, `qdd-explore`, `qdd-apply`, `qdd-close`
- roles: `thesis-manager`, `study-brain`, `executor`
- study IDs: `STUDY-XXX`
- task IDs: `TASK-XXX`
- artifact IDs: `ART-XXX`
- question delta types: `refinement`, `confirmation`, `pivot`, `dissolution`

Policy rules tightened here:

- Commands map directly to roles; they do not map to separate `target + decision_layer` records.
- `qdd-close` still targets a study artifact set in practice, but its authority role is `thesis-manager`.
- `qdd-start` is also a `thesis-manager` command because it establishes project-level context and shared resources.
- Role `default_skills` are optional planning or management defaults, not a replacement for task-local executor skill declarations.
- `study-brain` default skills may include `brain/*` planning skills.
- `executor` default skills should remain empty in the base contract.
- Policy files must not declare `qdd/*` workflow skills as role defaults.
- Task `skills:` and `## Skills` remain the only executor-facing skill contract for apply.

## Status JSON

`qdd status --json` does not need a new top-level shape in this slice.

What should change semantically:

- status output should remain compatible with the existing project/study/task discovery surface,
- but any role-aware surfaces should resolve roles from the simplified command policy rather than from policy layers,
- and no status consumer should assume that policy files carry executor-side required skill bundles.

No broad lifecycle or schema expansion is needed here.

## Instructions JSON

`qdd instructions <id> --json` remains the machine-facing instruction boundary.

This slice changes what it resolves from policy:

- command -> role
- role -> default_skills

It should stop resolving:

- `decision_layer`
- layer-owned required execution defaults
- layer-owned optional execution defaults

Expected role resolution:

- `PROJECT` with `--command qdd-start`
  - role: `thesis-manager`
  - include any `thesis-manager` default skills
- `STUDY-XXX` with `--command qdd-propose`
  - role: `study-brain`
  - include `study-brain` default skills
- `STUDY-XXX` with `--command qdd-explore`
  - role: `study-brain`
  - include `study-brain` default skills
- `STUDY-XXX` or `TASK-XXX` with `--command qdd-apply`
  - role: `executor`
  - do not inject policy-owned executor defaults except whatever is explicitly allowed by the simplified role policy
  - merge task-local executor skills as the primary execution dependency list
- `STUDY-XXX` with `--command qdd-close`
  - role: `thesis-manager`
  - include any `thesis-manager` default skills
  - continue reading artifact candidates, artifact index, study outputs, and context as closure evidence inputs

Returned JSON may keep the current `role` field and should stay easy for prompts to consume.

## Agent Usage Rules

- `qdd-start` should behave as a `thesis-manager` command that establishes project-level context and shared dataset entrypoints.
- `qdd-propose` and `qdd-explore` should use `study-brain` defaults plus any planning-time helper commands such as bounded skill suggestion.
- `qdd-apply` should not reopen broad policy-driven skill search once task-local executor skills are already declared.
- `qdd-apply` should treat the task-local skill list as the execution truth source.
- `qdd-close` should continue to treat artifact promotion, reusable evidence judgment, and context carry-forward as `thesis-manager` work.
- The policy file should stay small enough that a human can audit it quickly without reconstructing hidden layer semantics.
