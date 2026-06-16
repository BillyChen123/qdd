## Filesystem Contract

This change keeps the existing managed file layout:

```text
studies/STUDY-XXX/study.md
studies/STUDY-XXX/tasks/TASK-XXX.md
studies/STUDY-XXX/output/artifact-candidates.yaml
```

The canonical artifact candidate manifest remains:

```yaml
artifact_candidates:
  - path: studies/STUDY-XXX/output/tables/example.csv
    type: table
    task_id: TASK-XXX
    reusable: true
    scope: study
    description: >-
      Short reason this output is worth promoting.
    schema: csv-table
```

The old top-level key `candidates:` is invalid for `artifact-candidates.yaml`.

## Identifiers And Metadata

Legal `study.status` values remain:

```text
created | confirmed | running | blocked | completed | closed
```

`judgeable` is not a status. If apply has produced enough evidence for close, it should set or preserve `status: completed` and explain judgeability in the Markdown body or final message.

## Status JSON

`qdd status --json` may continue to expose `studies_with_invalid_candidate_paths`, but stale manifest shape must be distinguishable in validation and auto terminal diagnostics.

When `artifact-candidates.yaml` contains `candidates:` without `artifact_candidates:`, the diagnostic should say that the manifest uses an old schema and should be renamed to `artifact_candidates`.

## Instructions JSON

Generated apply instructions and bootstrap prompts should include the current minimal `artifact_candidates:` template near the place where agents are told to edit `artifact-candidates.yaml`.

The instructions should also explicitly state:

- Do not use top-level `candidates:` in `artifact-candidates.yaml`.
- Do not write `status: judgeable`; use `completed` when the study is ready for close.
- Keep long natural-language descriptions in YAML block scalars such as `>-`.

## Agent Usage Rules

Agents may still hand-write managed files in this lightweight design, but whenever they edit `artifact-candidates.yaml` they should copy the current schema shape rather than inventing keys from memory.

Runtime should reject invalid managed state, but the rejection should be actionable enough that the next auto turn or a human can repair the file without inspecting TypeScript contracts.
