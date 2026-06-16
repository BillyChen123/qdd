## Question Before

Auto-mode continuation currently depends too strongly on mechanical frontier signals: if any open boundary or next candidate remains, the runtime tends to keep proposing studies. This makes project-level closure difficult even when the biological story is mature enough to synthesize.

## Question After

Auto-mode project continuation should be a thesis-manager judgment. Runtime should continue only when the thesis-manager leaves executable next candidates. Open boundaries can remain as limitations or future directions without forcing more auto studies.

## Change Type

refinement

## Change Driver

The current system already supports study-level closure, but project-level closure is under-specified. Observed auto runs show two distinct cases:

- UC anti-TNF: the project has a stable and enriched central story, and remaining upstream mechanism questions mostly require new modality/data or would add marginal detail. This should be synthesis-ready.
- Parkinson: the project has an active isoform-feasibility frontier with pending tasks. This should continue until the feasibility verdict is known.

This distinction requires thesis-manager judgment, not a runtime heuristic based on open boundary count.

## Open Boundaries

- How aggressive the thesis-manager should be in stopping after story enrichment may need tuning after more auto runs.
- A future change may add a final project synthesis/report mode, but this change should not implement that mode yet.
- The lifecycle terms should remain prompt guidance unless repeated failures prove a machine-readable phase is needed.

## Evidence Summary

The proposal defines a minimal change:

- Keep `evolution.yaml` as the only sparse project frontier ledger.
- Keep open boundaries as durable scientific memory.
- Treat `next_candidates` as executable auto-continuation intent.
- Make project lifecycle a thesis-manager reasoning scaffold, not a new schema.
- Change runtime so open boundaries alone do not continue auto.

This preserves enrichment because the thesis-manager is instructed not to stop immediately after a central result; it should usually run validation, robustness, mechanism triage, functional consequence, or negative-control studies before synthesis.

## Recommended Next Step

Implement the minimal change:

- update frontier-planning and qdd-close prompts,
- adjust runtime termination semantics,
- add smoke tests for open-boundary-without-candidate termination and candidate-driven continuation.
