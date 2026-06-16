## 1. Apply-Facing Guidance

- [x] 1.1 Update `src/runtime/bootstrap-prompts/qdd-apply.md` to show the current `artifact_candidates:` template when instructing agents to edit `artifact-candidates.yaml`.
- [x] 1.2 Update generated instructions in `src/services/instructions.ts` where they independently mention artifact candidate editing, so the current key `artifact_candidates` is explicit.
- [x] 1.3 Add explicit wording that `candidates:` is an old invalid key for `artifact-candidates.yaml`.
- [x] 1.4 Add explicit wording that `judgeable` is not a legal `study.status`; apply should use `completed` when ready for close.

## 2. Diagnostics

- [x] 2.1 Update artifact candidate manifest/path inspection so a top-level `candidates:` manifest reports stale schema and names `artifact_candidates`.
- [x] 2.2 Update auto invalid-state routing so stale candidate manifest shape is not summarized only as invalid paths.
- [x] 2.3 Preserve rejection of old `candidates:`; do not silently accept it as an alias.

## 3. Tests

- [x] 3.1 Add or update a test fixture for old top-level `candidates:` that asserts the diagnostic mentions stale/old schema and `artifact_candidates`.
- [x] 3.2 Add or update a test that apply-facing prompt/instructions include `artifact_candidates:` and warn against `candidates:`.
- [x] 3.3 Add or update a test that apply-facing prompt/instructions warn against `status: judgeable` and point to `completed`.
- [x] 3.4 Run `npm run build` and `npm test`.

## 4. Generated Outputs

- [x] 4.1 Rebuild checked-in `dist/` outputs if source changes require it.
- [x] 4.2 Confirm no unrelated existing dirty worktree changes were reverted.
