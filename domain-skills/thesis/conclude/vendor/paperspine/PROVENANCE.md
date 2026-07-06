# PaperSpine Vendor Provenance

Status: scaffold only. No upstream PaperSpine source files are vendored in this phase.

## Reserved Metadata

- upstream_repository: `TBD`
- upstream_version: `v4.0.0`
- upstream_commit: `TBD`
- upstream_license: `MIT`
- local_modification_note: `QDD conclude scaffold only; no QDD-specific PaperSpine workflow changes are implemented yet.`

`upstream_version` is pinned from the conclude PRD and should stay aligned with future vendor import work unless the PRD changes.

## Reserved Files

- `UPSTREAM.md`
- `VERSION`
- `COMMIT`
- `LICENSE`

## Import Checklist

- copy the exact upstream repository URL into `UPSTREAM.md`
- keep the vendored release version in `VERSION`
- pin the exact imported commit in `COMMIT`
- replace the placeholder contents of `LICENSE` with the upstream MIT license text when upstream files are copied in
- record the first local QDD-specific vendor delta in this file before editing vendored sources
