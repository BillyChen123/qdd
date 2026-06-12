## Filesystem Contract

Managed QDD files remain normal files under the existing layout:

- `studies/STUDY-XXX/study.md`
- `studies/STUDY-XXX/tasks/TASK-XXX.md`
- `studies/STUDY-XXX/output/artifact-candidates.yaml`
- `contract.yaml`
- `evolution.yaml`
- `artifacts/index.yaml`

The protocol change is not to move these files behind a full update API. Instead, agents may still write editable Markdown and YAML, but managed paths written through the auto runner must parse successfully before the write is accepted.

For managed Markdown files, only YAML frontmatter is machine-critical. Long natural-language content should prefer Markdown body sections.

## Identifiers And Metadata

No new identifiers are introduced.

The existing fields remain valid:

- study frontmatter: `study_id`, `question`, `hypothesis`, `status`, `task_ids`, `blockers`, `expected_artifacts`, `closed_at`
- task frontmatter: `task_id`, `study_id`, `goal`, `status`, `expected_outputs`, `depends_on`, `skills`, `promotion_status`, `artifact_ids`, `blocker_reason`, `result_summary`, `updated_at`
- artifact candidates: `artifact_candidates[].path`, `type`, `task_id`, `reusable`, `scope`, `description`, `schema`

The semantic tightening is:

- `result_summary` is a short optional machine-facing summary, not the primary place for long narrative evidence.
- Long task summaries belong in `## Result Summary`.
- Long study rationale belongs in the matching study body section.
- Natural-language YAML fields that are hand-written should be quoted or rendered as block scalars.

## Status JSON

`qdd status --json` remains strict. If a managed file cannot be parsed, auto mode should treat this as invalid managed state rather than silently continuing.

No status shape changes are required.

## Instructions JSON

`qdd instructions ... --json` should continue to list managed schema references and examples.

The instructions rules may be tightened to tell agents:

- keep long summaries out of frontmatter when a Markdown body section exists
- use quoted strings or `>-` for natural-language YAML values when hand-writing managed YAML
- preserve short machine fields in frontmatter

The generated `.qdd/instructions.md` validation checklist is intentionally out of scope for this change.

## Agent Usage Rules

Agents may still write managed Markdown when needed, but should avoid putting long narrative prose into YAML frontmatter.

The auto runner should reject malformed managed-file writes immediately and return the parser error to the agent. This keeps the workflow lightweight while making the error recoverable in the same phase.

The runner should not validate every research output file. Validation is limited to managed project/state files whose parse failure can break `qdd status`, `qdd validate`, or auto phase transitions.
