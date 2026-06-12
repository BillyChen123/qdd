## Question Before

Is the current `qdd auto` behavior structurally inconsistent with the intended end-to-end multi-agent design, or did one run fail mainly because an agent wrote stale managed-file schemas?

## Question After

How should QDD harden `qdd auto` so the intended end-to-end multi-agent loop remains intact, while post-phase continuation, invalid-state reporting, and schema-source hygiene prevent stale YAML writes from breaking the run?

## Change Type

refinement

## Change Driver

The investigation separated three concerns that were previously conflated:

- Product intent: `qdd auto` should be able to run a complete `start -> propose -> apply -> close` loop.
- Phase discipline: `qdd-start` should not itself create and close a study, but this can be treated as drift when the resulting state is valid.
- True failure: stale or mixed managed-file schemas in `evolution.yaml` and `artifact-candidates.yaml` prevent status/validation from reading project state.

The right next question is therefore runtime hardening, not removal of auto mode or redefinition of `qdd-start`.

## Open Boundaries

- Whether phase drift should initially be warning-only or blocking for `qdd-start` overreach.
- Whether a future slice should enforce instruction `write` paths inside `agent-runner` tools rather than relying on drift detection.
- Whether old PRD/prototype docs should remain in `docs/` with explicit historical banners or move under an archive path.
- Whether long-running task heartbeat/run-state should become a separate follow-up change after auto schema hardening.

## Evidence Summary

- The current auto orchestrator already encodes the intended multi-agent phase loop.
- `qdd-start` prompt and project instructions define a narrower onboarding phase, but the runner does not enforce write-path boundaries.
- The current phase completion check accepts `start` unconditionally.
- The next phase after a phase is chosen by `nextPhase(current, status)`, which can ignore over-completed persisted state.
- Current file contracts define new sparse `evolution.yaml` and top-level `artifact_candidates`, while older docs still show retired schema examples.

## Recommended Next Step

Implement the hardening checklist: add safe status handling and `invalid_state`, recompute next phase from persisted state after real phases, add lightweight phase drift diagnostics, tighten close/start prompt rules, and mark stale schema documentation as historical.
