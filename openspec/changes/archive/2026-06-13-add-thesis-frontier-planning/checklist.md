## 1. Thesis Skill

- [x] 1.1 Add `domain-skills/thesis/frontier-planning/SKILL.md`.
- [x] 1.2 Define the thesis skill as project-level planning only, not study-brain and not executor.
- [x] 1.3 Include the lightweight thesis decision fields: `decision`, `change_type`, `summary`, `open_boundaries`, `next_candidates`, and `stop_reason`.
- [x] 1.4 Require each next candidate to include `question`, `expected_signal`, and `strategy`.
- [x] 1.5 Include the strategy set: `serial-deepen`, `evidence-fanout`, `explore-then-synthesize`, `validation`, `robustness`, and `pivot`.
- [x] 1.6 State that `needs-human` is exceptional in auto mode and should not be used for ordinary uncertainty.

## 2. Skill Namespace And Role Wiring

- [x] 2.1 Add explicit thesis-skill classification for `thesis/*`.
- [x] 2.2 Allow `thesis/*` as role-level planning skills for `thesis-manager`.
- [x] 2.3 Keep `brain/*` as study-brain planning skills.
- [x] 2.4 Reject `thesis/*` in task `skills:` with a clear rule or blocker.
- [x] 2.5 Add `thesis/frontier-planning` to the default thesis-manager role skill bundle.
- [x] 2.6 Ensure `.qdd/layer-policy.yaml` examples and schema reference reflect the new default role skill.

## 3. Close Prompt And Thesis Decision

- [x] 3.1 Update `qdd-close` guidance to invoke thesis frontier planning before calling `qdd close-study`.
- [x] 3.2 Tell close to choose `continue`, `stop`, or `needs-human` explicitly.
- [x] 3.3 Tell close to preserve only 1-3 next candidates.
- [x] 3.4 Tell close that every next candidate needs an expected signal, not just a topic.
- [x] 3.5 Tell close that project-level `stop` should leave no executable next candidates.
- [x] 3.6 Keep the persisted first implementation compatible with current `evolution.yaml` string candidates.

## 4. Runtime Consumer

- [x] 4.1 Keep runtime responsible for invalid state, phase incomplete, missing auth, agent failed, and max iterations.
- [x] 4.2 Stop using runtime-only scientific heuristics as the primary continue/stop judge when close-time decision signals are present.
- [x] 4.3 Continue when thesis decision is effectively `continue` and there is at least one next candidate or open boundary.
- [x] 4.4 Stop when thesis decision is effectively `stop` and no lifecycle work remains.
- [x] 4.5 Treat contradictory decisions as `needs-human` or `invalid_state`, not as silent continuation.
- [x] 4.6 Preserve existing active-study lifecycle routing before project-level stop logic.

## 5. Tests

- [x] 5.1 Test thesis-manager instructions include `thesis/frontier-planning`.
- [x] 5.2 Test study-brain instructions do not inherit thesis skills by default.
- [x] 5.3 Test task instructions reject `thesis/*` task skills.
- [x] 5.4 Test candidate-only continuation can proceed.
- [x] 5.5 Test confirmation plus executable continuation can proceed.
- [x] 5.6 Test true stop with no continuation remains terminal.
- [x] 5.7 Test contradictory stop-with-candidates or continue-without-candidates is handled safely.

## 6. Verification

- [x] 6.1 Run `npm run build`.
- [x] 6.2 Run `npm test`.
- [x] 6.3 Run `git diff --check`.
- [x] 6.4 Optionally dry-run the UC anti-TNF status shape to confirm false terminal behavior is resolved.
