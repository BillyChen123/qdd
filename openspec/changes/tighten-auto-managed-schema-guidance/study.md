## Question

Can QDD auto mode prevent or precisely diagnose stale managed-file schema writes for `artifact-candidates.yaml` and `study.status` while preserving the current lightweight hand-written metadata workflow?

## Hypothesis / Expectation

Explicit current-schema guidance plus targeted stale-schema diagnostics is enough to stop recurring `candidates:` and `status: judgeable` failures without introducing new structured update commands.

## Inputs

- Current managed file contracts in `src/file-contracts/artifact-candidates.ts` and `src/file-contracts/study.ts`.
- Apply instructions in `src/runtime/bootstrap-prompts/qdd-apply.md` and `src/services/instructions.ts`.
- Auto invalid-state routing in `src/runtime/orchestrator.ts`.
- Path and manifest inspection helpers in `src/runtime/evidence.ts` and `src/services/inspection.ts`.
- Regression tests in `src/test/smoke.test.ts`.

## Evidence Plan

- Apply-facing instructions show the exact `artifact_candidates:` YAML template.
- Apply-facing instructions explicitly reject `candidates:` and `status: judgeable`.
- Validation/auto diagnostics distinguish stale manifest shape from real invalid output paths.
- Tests cover old `candidates:` manifests and invalid `judgeable` study status.

## Blockers

- Archived OpenSpec documents still contain old examples, but they are historical records and should not be globally rewritten in this change.
- Agents can still hand-write arbitrary metadata; this change reduces recurrence but does not enforce a structured write API.

## Exit Signal

The change is ready to apply when the implementation plan is limited to prompt/instruction updates, targeted diagnostic improvements, and regression tests.
