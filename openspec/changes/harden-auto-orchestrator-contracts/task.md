## Task Goal

Implement a narrow hardening pass for `qdd auto` so invalid managed YAML becomes an explicit resumable failure, post-phase continuation follows persisted project state, and stale schema sources no longer steer agents toward retired formats.

## Study Link

This task supports the study question in `study.md`: whether auto-mode can stay multi-agent and end-to-end while becoming robust to phase overreach and stale schema writes.

## Method

Work in three bounded layers:

1. Runtime orchestration hardening in `src/runtime/orchestrator.ts` and adjacent tests.
2. Prompt/instruction tightening in bootstrap prompts and instruction rules.
3. Historical documentation marking or cleanup for retired schema examples.

Keep the existing Claude SDK session model and QDD object model. Prefer small helper functions around current code over a new orchestration framework.

## Expected Outputs

- Runtime code changes that introduce safe status handling and an `invalid_state` auto terminal result.
- Runtime code changes that select the next phase from persisted status after each real phase.
- Lightweight phase drift diagnostics for unexpected managed-file mutations.
- Prompt/instruction updates that make `qdd close-study` the required path for close-time evolution writes and clarify `qdd-start` write boundaries.
- Historical doc updates that mark retired schema examples as non-current or remove misleading schema blocks from active references.
- Focused tests in the existing Vitest suite.

## Run Contract

Implementation runs should record:

- Which auto terminal codes changed and why.
- Which phase transition helper now chooses the next phase after real runs.
- Which managed-file paths are included in drift detection.
- Which docs were marked historical or updated.
- Test commands run, at minimum `npm test` or a targeted Vitest command plus `npm run build` when TypeScript changes.

## Failure / Blocker Conditions

Stop and return to exploration if:

- The implementation requires a full shell write sandbox instead of lightweight drift detection.
- The phase transition logic would skip required `qdd-close` for completed but unclosed studies.
- Invalid managed-file state is silently converted or ignored rather than reported.
- The change requires redefining `evolution.yaml` or `artifact-candidates.yaml` schemas.
- Tests can only be made to pass by weakening current managed-file validation.
