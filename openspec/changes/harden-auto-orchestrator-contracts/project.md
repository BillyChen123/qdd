## Theme

Harden QDD auto-mode orchestration so the runtime can keep the intended full research loop while preventing phase drift and stale schema writes from corrupting managed project state.

## Initial Question

How should QDD keep `qdd auto` as a multi-agent `start -> propose -> apply -> close` loop, while making each phase recoverable, schema-safe, and grounded in the current managed-file contracts rather than stale prototype documentation?

## Mode

`auto`

The runtime remains the authority for phase transitions. Agents may complete work inside their assigned phase, but the filesystem and orchestrator must decide what phase is actually next after every agent session. Human review still owns product boundaries and whether to archive this hardening change.

## Scope

### In Scope

- Preserve the core auto design: `qdd auto` may run a full study loop from project start through study closure.
- Make post-phase transition selection state-driven rather than blindly following the previous phase label.
- Convert invalid managed-file state into an explicit resumable auto failure with useful diagnostics instead of an uncaught validation crash.
- Detect and report phase drift such as `qdd-start` creating study artifacts or mutating close-owned project state.
- Harden prompts and instruction rules so agents use `qdd close-study` and current `.qdd/schema-reference.md` / `.qdd/examples/*` for managed YAML writes.
- Demote or clearly mark stale product/prototype docs that still show retired `evolution_trail` / `question_delta` schemas.
- Add tests around state-driven phase recomputation, invalid schema handling, and stale-schema prompt/documentation guardrails.

### Out Of Scope

- Removing the multi-agent auto architecture.
- Redefining `qdd-start` as a valid all-in-one study runner.
- Building a full job scheduler, daemon, long-task monitor, or run-state protocol in this slice.
- Redesigning `evolution.yaml`, `artifact-candidates.yaml`, study/task schemas, or artifact promotion semantics.
- Replacing Claude SDK orchestration or changing the domain skill library.
- Perfectly sandboxing arbitrary shell writes; this slice may use lightweight drift detection before a deeper tool allowlist change.

## Evidence Standard

This change is successful when:

- `qdd auto` still sequences a fresh project through `start -> propose -> apply -> close` in dry-run tests.
- After each real phase, the next phase is selected from persisted project state, so over-completion or partial completion is resumed sensibly.
- If a phase writes invalid `evolution.yaml` or `artifact-candidates.yaml`, auto returns a structured terminal reason instead of crashing during status construction.
- `qdd-start` phase drift is visible in logs/result metadata and can stop or warn according to the implemented policy.
- Current managed-file examples remain the preferred schema source, and stale docs no longer present old schemas as current protocol.

## Shared Context

- Current orchestration lives in `src/runtime/orchestrator.ts`, with `runAuto`, `computeInitialPhase`, `nextPhase`, and phase completion checks.
- Current SDK tool execution lives in `src/runtime/agent-runner.ts`; write tools currently restrict paths to the project root but do not enforce `qdd instructions` write lists.
- Current project instructions for `PROJECT/qdd-start` do not include `studies/` or `evolution.yaml` as write paths, but the runtime does not enforce that boundary.
- `src/file-contracts/evolution.ts` defines the current sparse schema: `studies[].id/question/kind/resolves/opens/candidates/ts` plus `boundaries[].id/text/state`.
- `src/file-contracts/artifact-candidates.ts` defines the current promotion manifest under top-level `artifact_candidates`.
- Older docs such as `docs/00-product-requirements-document.md` and `docs/01-development-prototype.md` still contain retired examples like `evolution_trail`, `study_id`, and `question_delta`.
