## Question

Can QDD auto mode delegate project-level continuation and stop judgment to the thesis-manager while preserving enough story-enrichment behavior to avoid premature project closure?

## Hypothesis / Expectation

The current over-continuation problem can be fixed without a heavy new project-frontier schema. If `thesis/frontier-planning` and `qdd-close` teach the thesis-manager how to distinguish exploration, main evidence, story enrichment, synthesis-ready, and closed stages, then auto mode can stop opening new studies when the project is synthesis-ready while still continuing projects that have unresolved actionable frontiers.

The runtime only needs a small semantic correction: executable `next_candidates` should drive continuation; open boundaries alone should not.

## Inputs

- Existing thesis skill: `domain-skills/thesis/frontier-planning/SKILL.md`
- Existing close prompt: `src/runtime/bootstrap-prompts/qdd-close.md`
- Existing auto phase selector: `src/runtime/orchestrator.ts`
- Existing status output shape: `question_state.next_candidates` and `question_state.open_boundary_ids`
- Calibration case A: UC anti-TNF project, where the central FN1/inflammatory-quiescence story is enriched enough that remaining upstream epigenetic questions should be future directions rather than automatic next studies.
- Calibration case B: Parkinson project, where the active isoform-feasibility study should continue because the current frontier is still directly actionable and unresolved.

## Evidence Plan

Implementation should produce:

- Updated frontier-planning guidance that gives the thesis-manager explicit project-level closure authority.
- Updated close prompt that allows project-level stop/synthesis-ready decisions even with open boundaries, when no executable candidate should remain.
- Runtime continuation behavior where `next_candidates` drive propose and open boundaries alone do not.
- Tests covering continuation with candidates and termination without candidates despite open boundaries.
- Tests preserving operational stop behavior for invalid state and active task execution.

## Blockers

- No new schema should be introduced unless implementation reveals that prompt-only guidance is insufficient.
- The change must avoid making auto mode stop too early after a central result. Prompt guidance must explicitly prefer at least one enrichment pass when the evidence story is still thin.
- The change should not disrupt existing study/task/artifact validation behavior.

## Exit Signal

This study is ready to close when the proposal identifies a minimal implementation path that:

- gives scientific continuation choice to thesis-manager,
- prevents open boundaries from hard-driving continuation,
- preserves story enrichment after main results emerge,
- and defines tests that distinguish the UC-style synthesis-ready case from the PD-style continue case.
