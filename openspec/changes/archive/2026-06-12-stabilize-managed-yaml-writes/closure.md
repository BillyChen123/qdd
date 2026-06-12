## Question Before

QDD auto mode can complete useful work but may fail at phase end when an agent hand-writes invalid YAML frontmatter in managed Markdown files.

## Question After

QDD should preserve lightweight agent-edited Markdown while making malformed managed frontmatter/YAML fail immediately at the write boundary and steering long summaries into Markdown body sections.

## Change Type

refinement

## Change Driver

The observed failure is not a bad research result and not primarily a need for heavier structured update commands. It is a managed-file serialization safety gap: free-form natural language in YAML can break project state when written without quoting or block scalars.

## Open Boundaries

- Whether future runs still need structured update commands for high-value operations such as artifact candidate recording.
- Whether managed-write validation should later become role-aware or instruction-write allowlist-aware.
- Whether `.qdd/instructions.md` should eventually include the same YAML safety guidance; this is intentionally excluded from the current change.

## Evidence Summary

The proposed implementation keeps strict status/validation gates, adds schema and prompt guidance for safer hand-written YAML, introduces a body-level task result summary section, and catches invalid managed writes before they corrupt disk state.

## Recommended Next Step

Apply this change as a small hardening slice. After several auto runs, reassess whether residual failures justify adding narrow structured commands such as `record-artifact-candidate`; do not add broad `update-task` / `update-study` preemptively.
