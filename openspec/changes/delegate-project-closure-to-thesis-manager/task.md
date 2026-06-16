## Task Goal

Implement the minimal auto-mode project-closure adjustment: thesis-manager owns the scientific continuation decision, and runtime only continues automatically when thesis-manager leaves executable next candidates.

## Study Link

Supports the study question in `study.md`: can QDD delegate project-level continuation and stop judgment to the thesis-manager without losing story-enrichment behavior?

## Method

1. Update `domain-skills/thesis/frontier-planning/SKILL.md`.
   - Add the lightweight project lifecycle as reasoning guidance only.
   - Make clear that finding a central result starts story enrichment rather than immediate stop.
   - Make clear that remaining open boundaries may be parked as limitations or future directions.
   - Tell the thesis-manager to emit `next_candidates` only for executable studies likely to validate, enrich, stress-test, or redirect the central model.

2. Update `src/runtime/bootstrap-prompts/qdd-close.md`.
   - Align close-time instructions with thesis-manager authority.
   - Remove or soften language that forces `continue` whenever any open boundary remains.
   - Preserve the requirement that candidates include expected signal and strategy.
   - Explicitly allow project-level synthesis-ready/stop behavior when no executable next candidate should remain.

3. Update runtime continuation in `src/runtime/orchestrator.ts`.
   - Change `checkTermination()` so `open_boundary_ids` alone do not drive continuation.
   - Continue when `next_candidates.length > 0`.
   - Terminate when there are no next candidates, even if open boundaries remain, unless an active/completed/blocked study requires apply/close.
   - Preserve operational stop and continuation behavior for active tasks, invalid state, missing auth, agent failures, and explicit max-iteration caps.

4. Update tests in `src/test/smoke.test.ts`.
   - Add or adjust tests showing that open boundaries without candidates terminate auto.
   - Add or preserve tests showing that candidates still drive continuation.
   - Preserve existing invalid-state and active-task behavior.

## Expected Outputs

- Updated thesis frontier-planning skill.
- Updated qdd-close bootstrap prompt.
- Updated runtime termination logic.
- Updated smoke tests.
- Rebuilt `dist/` output if this repository keeps generated assets committed.

## Run Contract

Implementation verification should record:

- `npm run build`
- `npm test`
- Relevant `qdd auto --dry-run --json` or unit-level evidence if added for termination behavior.

The implementation summary should explicitly state:

- open boundaries no longer force auto continuation,
- executable next candidates still continue auto,
- thesis-manager prompt now discourages premature closure and supports story enrichment.

## Failure / Blocker Conditions

- Do not introduce a new required `frontier.yaml`, `project_phase`, or `frontier_decision` machine schema in this change.
- Do not remove open boundary persistence.
- Do not make runtime ignore active studies or pending/running tasks.
- Do not make auto stop immediately after every `dissolution`; a dissolved local hypothesis with executable next candidates should still continue.
- If tests show that removing open-boundary continuation breaks existing phase selection for active studies, fix phase selection rather than restoring open-boundary hard control.
