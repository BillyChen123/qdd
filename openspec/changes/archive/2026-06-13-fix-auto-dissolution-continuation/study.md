## Question

Can QDD auto mode continue from a closed `dissolution` study into a meaningful next proposal when thesis-manager has preserved executable validation, robustness, pivot, or data-acquisition candidates?

## Hypothesis / Expectation

If runtime treats `dissolution` as a study-local outcome unless the frontier has no candidates or open boundaries, then auto mode will behave more like an end-to-end research system:

```text
evidence rejects current hypothesis
  -> thesis-manager records a better next direction
  -> study-brain proposes the next bounded study
```

The expected change is narrow. It should not make runtime a scientific planner, and it should not allow vague continuation with no candidate or boundary.

## Inputs

- Current auto routing in `src/runtime/orchestrator.ts`, especially `checkTermination()`, `computeInitialPhase()`, and `nextPhase()`.
- Thesis frontier skill at `domain-skills/thesis/frontier-planning/SKILL.md`.
- Close prompt at `src/runtime/bootstrap-prompts/qdd-close.md`.
- Propose prompt at `src/runtime/bootstrap-prompts/qdd-propose.md`.
- Existing status/tests in `src/test/smoke.test.ts`.
- UC anti-TNF fixture behavior:
  - all studies closed
  - `last_kind=dissolution`
  - one open boundary
  - three next candidates with expected signals and strategies

## Evidence Plan

This study should produce:

- A clarified runtime continuation rule:
  - `dissolution + continuation signals` proceeds
  - `dissolution + no continuation signals` stops
- Updated thesis skill wording that distinguishes local-hypothesis dissolution from project-frontier termination.
- Updated close prompt wording that avoids using `needs-human` for normal negative results with clear next candidates.
- Updated propose prompt wording that converts dissolution candidates into:
  - validation using existing datasets
  - robustness checks
  - pivot studies
  - public-data candidate capture when needed
- Regression tests covering the UC state shape.
- A dry-run check on the UC project showing the next phase becomes `qdd-propose` for `STUDY-005`.

## Blockers

- `evolution.yaml` candidates are currently strings, so runtime should not depend on a heavy parser for `strategy` or `expected_signal`.
- Existing tests may already encode the prior "contradictory dissolution plus continuation is safe-stopped" behavior and must be intentionally updated.
- `openspec/changes/add-thesis-frontier-planning` remains listed as an old unarchived change; implementation should avoid mixing this new change with unrelated archive cleanup.

## Exit Signal

The change is ready to apply when the implementation checklist identifies:

- exact runtime tests to change or add
- exact prompt/skill text to update
- the smallest `checkTermination()` behavior change
- the UC dry-run command and expected result
