## Filesystem Contract

This slice does not change the current QDD root layout. It adds validation and inspection interfaces over the same filesystem contract:

```text
project-root/
├── contract.yaml
├── evolution.yaml
├── context/
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
└── .qdd/
    └── instructions.md
```

New command responsibilities:

- `qdd validate` reads project control files, study/task frontmatter, and artifact index state and reports whether the project is structurally valid.
- `qdd artifacts list --json` reads `artifacts/index.yaml` and returns a stable machine-readable artifact listing.
- `qdd context` reads `context/*.yaml` and returns project-level shared context without requiring callers to know file names in advance.

These commands must not create new state files or derived caches.

## Identifiers And Metadata

This slice validates the metadata already defined by the current lifecycle commands.

Validation checks should at minimum cover:

- `contract.yaml` includes required top-level fields: `theme`, `initial_question`, `mode`, `scope`, `termination_type`
- `evolution.yaml` includes `evolution_trail`, and any `question_delta` values use valid `change_type`
- `artifacts/index.yaml` includes an `artifacts` array, and each entry has `id`, `type`, `path`, `produced_by`, `reusable`, `scope`, `description`, and `schema`
- every `study.md` includes valid frontmatter with `study_id`, `question`, and `hypothesis`
- every `TASK-XXX.md` includes valid frontmatter with `task_id`, `study_id`, and `goal`
- task and study state relationships are coherent enough for the current lifecycle, especially before study closure

Context validation should stay shallow in this slice:

- each `context/*.yaml` file must parse successfully as YAML
- command output should surface the filename and parsed content, not impose a domain schema on every context file

## Status JSON

`qdd status --json` remains the high-level summary interface. This slice does not replace it. Instead, it complements `status` with more focused inspection commands.

Expected layering after this change:

- `status` = project summary
- `artifacts list` = artifact-level inspection
- `context` = project-context inspection
- `validate` = structural integrity and state-consistency checks

## Instructions JSON

`qdd instructions <id> --json` also remains unchanged in role. It is the execution-guidance surface, while the new commands are read/guard surfaces.

Agents may call the new commands before or during execution to reduce brittle file assumptions:

- call `qdd context --json` when project context is needed in structured form
- call `qdd artifacts list --json` when searching for reusable outputs
- call `qdd validate --json` before closing a study or before higher-assurance workflows later

The new commands should not force any change to the existing `instructions` response shape.

## Agent Usage Rules

These commands are intentionally non-core lifecycle commands.

- `qdd validate` is a guard command, not a state-advancing command.
- `qdd artifacts list --json` and `qdd context` are inspection commands, not planning engines.
- They should help agents avoid brittle file scraping, but they must not become a second truth source.
- The primary research loop remains `init -> add-study -> add-task -> instructions -> register-artifact -> close-study`.

This slice should make the current loop safer and easier to inspect without changing its semantics.
