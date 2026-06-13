## 1. Runtime Continuation Rule

- [x] 1.1 Update `src/runtime/orchestrator.ts` so `checkTermination()` no longer treats `dissolution + continuation signals` as terminal by default.
- [x] 1.2 Keep `dissolution + no next candidates + no open boundaries` terminal.
- [x] 1.3 Preserve existing operational stop behavior for invalid state, phase incomplete, missing auth, agent failure, and max iterations.
- [x] 1.4 Preserve lifecycle routing priority so active/completed/blocked studies are handled before project-level terminal checks.

## 2. Thesis And Prompt Guidance

- [x] 2.1 Update `domain-skills/thesis/frontier-planning/SKILL.md` to distinguish local-hypothesis dissolution from project-frontier termination.
- [x] 2.2 State that continuation after dissolution must move away from the dissolved premise through `validation`, `robustness`, `pivot`, or data feasibility.
- [x] 2.3 Update `src/runtime/bootstrap-prompts/qdd-close.md` so `needs-human` is not used for ordinary negative results with clear executable next candidates.
- [x] 2.4 Update `src/runtime/bootstrap-prompts/qdd-close.md` so project-level stop leaves no executable next candidates.
- [x] 2.5 Update `src/runtime/bootstrap-prompts/qdd-propose.md` so after a dissolution event the next study does not repeat the rejected premise.
- [x] 2.6 Update `src/runtime/bootstrap-prompts/qdd-propose.md` to prefer existing recorded datasets/artifacts before broad public-data rediscovery.
- [x] 2.7 Update `src/runtime/bootstrap-prompts/qdd-propose.md` so named validation datasets first get metadata/label-fit verification tasks.

## 3. Tests

- [x] 3.1 Add or update a test that `dissolution + next_candidates` proceeds to `qdd-propose`.
- [x] 3.2 Add or update a test that `dissolution + open_boundary_ids` proceeds to `qdd-propose`.
- [x] 3.3 Keep or add a test that `dissolution + no continuation signals` is terminal.
- [x] 3.4 Update any prior test that expected `dissolution + continuation signals` to safe-stop.
- [x] 3.5 Ensure confirmation/refinement continuation tests still pass.

## 4. Verification

- [x] 4.1 Rebuild generated output if required by the repository workflow.
- [x] 4.2 Run `npm run build`.
- [x] 4.3 Run `npm test`.
- [x] 4.4 Run `git diff --check`.
- [x] 4.5 Run the UC dry-run check from `<qdd-project-root>`.
- [x] 4.6 Confirm the UC dry run starts at `qdd-propose` targeting `STUDY-005`.
