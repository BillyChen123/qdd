## 1. Thesis Guidance

- [x] 1.1 Update `domain-skills/thesis/frontier-planning/SKILL.md` so thesis-manager owns project-level continuation versus stop judgment.
- [x] 1.2 Add lightweight project lifecycle guidance as prompt-only reasoning: exploration, main evidence, story enrichment, synthesis-ready, closed.
- [x] 1.3 State that finding a central model should usually trigger story enrichment, not immediate project stop.
- [x] 1.4 State that remaining open boundaries may be carried as limitations or future directions when they are not worth automatic continuation.
- [x] 1.5 Define executable next candidates as studies likely to validate, enrich, stress-test, or redirect the central model within available data/resources.

## 2. Close Prompt

- [x] 2.1 Update `src/runtime/bootstrap-prompts/qdd-close.md` to align close-time decisions with thesis-manager project-level authority.
- [x] 2.2 Remove or soften wording that forces `continue` whenever any open boundary remains.
- [x] 2.3 Preserve the requirement that each executable next candidate includes an expected signal and strategy.
- [x] 2.4 Add explicit guidance that synthesis-ready projects can stop auto continuation while preserving unresolved boundaries as limitations or future directions.
- [x] 2.5 Add calibration language: UC-like enriched central story should be allowed to synthesize; PD-like unresolved active feasibility frontier should continue.

## 3. Runtime Continuation

- [x] 3.1 Update `src/runtime/orchestrator.ts` so `checkTermination()` no longer treats open boundaries alone as a continuation signal.
- [x] 3.2 Preserve continuation when `question_state.next_candidates` contains executable candidates.
- [x] 3.3 Preserve phase selection for active studies with pending/running tasks, completed studies ready for close, blocked studies, and invalid managed state.
- [x] 3.4 Preserve explicit `--max-iterations` cap behavior when a user sets one.

## 4. Tests

- [x] 4.1 Add or update smoke tests showing auto terminates when there are open boundaries but no next candidates.
- [x] 4.2 Add or preserve smoke tests showing auto continues to propose when next candidates exist.
- [x] 4.3 Add or preserve tests showing active studies with pending tasks still go to `qdd-apply`.
- [x] 4.4 Add or preserve tests for invalid managed state, missing auth, and explicit max-iteration stops.

## 5. Verification

- [x] 5.1 Run `npm run build`.
- [x] 5.2 Run `npm test`.
- [x] 5.3 Confirm generated `dist/` assets are updated if build output is committed.
- [x] 5.4 Summarize the behavior change clearly: thesis-manager chooses whether to emit candidates; open boundaries alone no longer force auto continuation.
