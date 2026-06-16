## Theme

Harden QDD auto mode against stale managed-file schemas when agents hand-write study metadata.

## Initial Question

How can auto mode stop failing on old `artifact-candidates.yaml` and study status shapes without adding a heavy managed-file API layer?

## Mode

Assist. The runtime keeps authority over schema validation and terminal diagnostics; study agents keep authority over scientific execution and evidence packaging.

## Scope

### In Scope

- Make the current `artifact-candidates.yaml` shape explicit wherever apply agents are asked to write it.
- Prevent `judgeable` from being used as a machine `study.status`.
- Improve auto/runtime diagnostics so old `candidates:` manifests are reported as stale schema, not misleading path errors.
- Add focused tests for stale candidate manifests and invalid apply-written study statuses.

### Out Of Scope

- Adding new `update-study`, `update-task`, or `record-artifact-candidate` CLI commands.
- Redesigning artifact promotion, close-study behavior, or the managed-file contract format.
- Auto-migrating arbitrary old projects as part of normal runtime execution.
- Changing thesis/frontier planning semantics.

## Evidence Standard

The change is acceptable if a new auto run gets explicit current schema guidance, stale `candidates:` manifests fail with a precise actionable diagnostic, and `judgeable` no longer appears as an encouraged status value.

## Shared Context

Recent auto runs failed after analysis succeeded because the agent hand-wrote stale managed metadata:

- `studies/STUDY-002/output/artifact-candidates.yaml` used top-level `candidates:` instead of current `artifact_candidates:`.
- `studies/STUDY-002/study.md` used `status: judgeable`, which is a reasoning concept but not a legal status.
- The current runtime compressed this into `Invalid artifact candidate paths`, which was technically routed to the right file but did not explain the stale schema.
