## Task Goal

Update auto/apply schema guidance and invalid-state diagnostics so stale `artifact-candidates.yaml` and `study.status` writes fail early with actionable messages and are less likely to be generated.

## Study Link

Supports the study question: can lightweight prompt/schema hardening prevent recurring old managed-file schema failures without adding new CLI update commands?

## Method

Implement three narrow changes:

1. Add the current `artifact_candidates:` manifest template to apply-facing instructions.
2. Add explicit status guidance: `judgeable` is reasoning prose, `completed` is the machine status for apply-ready-to-close.
3. Improve validation/auto diagnostics for stale artifact candidate manifests so old `candidates:` is named directly.

## Expected Outputs

- Updated `src/runtime/bootstrap-prompts/qdd-apply.md`.
- Updated generated instruction text in `src/services/instructions.ts` if that path independently tells agents how to edit candidates.
- Updated diagnostics in `src/runtime/evidence.ts`, `src/services/inspection.ts`, or `src/runtime/orchestrator.ts` as needed.
- Regression tests in `src/test/smoke.test.ts`.
- Rebuilt `dist/` if this repository expects generated JS to be checked in.

## Run Contract

Verification should include:

- `npm run build`
- `npm test`
- A targeted validation fixture where `artifact-candidates.yaml` contains top-level `candidates:` and the diagnostic mentions old/stale schema and `artifact_candidates`.
- A targeted validation fixture where `study.status: judgeable` remains invalid and the apply-facing prompt no longer encourages it.

## Failure / Blocker Conditions

- Do not implement new managed-file update commands in this change.
- Do not rewrite archived proposal history just because it contains historical old examples.
- Do not silently accept `candidates:` as an alias; accepting both schemas would hide drift and keep agents learning the wrong shape.
