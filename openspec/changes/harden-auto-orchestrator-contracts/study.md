## Question

Can QDD make auto-mode robust to phase overreach and stale schema writes by recomputing phase progression from persisted state, catching invalid managed-file state explicitly, and reducing stale schema sources, without changing the intended multi-agent `start -> propose -> apply -> close` design?

## Hypothesis / Expectation

If auto-mode treats each agent phase as a bounded attempt whose output must be reinterpreted through current QDD status and managed-file contracts, then small phase discipline errors can become recoverable drift diagnostics while true schema corruption becomes an explicit resumable failure.

The expected improvement is not stricter prompt obedience by itself. The expected improvement is that the runtime can distinguish:

- acceptable over-completion that left valid project state,
- incomplete phase output that needs another phase or resume,
- and invalid managed-file state that must be repaired before continuation.

## Inputs

- Current `src/runtime/orchestrator.ts` phase computation and phase completion logic.
- Current `src/runtime/agent-runner.ts` project-root scoped tool execution.
- Current `src/services/status.ts`, `src/runtime/evolution.ts`, and `src/runtime/evidence.ts` managed-file readers.
- Current bootstrap prompts under `src/runtime/bootstrap-prompts/`.
- Current generated managed-file contracts under `src/file-contracts/*`.
- Historical docs that still contain retired schema examples.

## Evidence Plan

- Produce a code change that makes post-phase auto progression state-derived after every real phase.
- Add safe status/error handling so invalid `evolution.yaml` or `artifact-candidates.yaml` leads to a structured auto terminal result.
- Add lightweight phase drift detection around managed write surfaces, especially for `qdd-start` writes to study/close-owned files.
- Tighten prompt/instruction wording around current schema references and `qdd close-study` as the only close-time evolution writer.
- Mark or update stale docs so retired schemas are not presented as current protocol.
- Add focused tests for:
  - state-derived continuation after `start` creates or completes a study,
  - invalid managed YAML producing `invalid_state`,
  - `qdd-start` drift diagnostics,
  - prompt/doc guardrails against retired schema language.

## Blockers

- Real SDK execution cannot be fully deterministic in tests, so most evidence should be unit-level or dry-run orchestration tests.
- A perfect shell write sandbox is out of scope; drift detection is an acceptable first hardening layer.
- Existing stale docs may be long-form product history; this change should mark them historical rather than deleting useful context wholesale.

## Exit Signal

This study can move to closure when the change has an implementation-ready checklist that preserves the full auto loop, defines explicit invalid-state handling, and gives developers concrete tests to prevent stale schema regressions.
