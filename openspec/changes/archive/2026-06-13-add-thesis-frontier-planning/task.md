## Task Goal

Add a lightweight thesis frontier planning layer that lets thesis-manager produce project-level continuation decisions without turning runtime into a scientific judge.

## Study Link

Supports the bounded study in `study.md`: thesis-manager should decide whether QDD continues, stops, or escalates after closure; study-brain and executor responsibilities should remain unchanged.

## Method

Implement in small layers:

1. Add `domain-skills/thesis/frontier-planning/SKILL.md`.
2. Add thesis namespace handling so `thesis/*` is allowed for thesis-manager role skills and rejected in task skill lists.
3. Add `thesis/frontier-planning` to the default thesis-manager role skill bundle.
4. Update `qdd-close` guidance so the close agent produces a lightweight thesis decision.
5. Make runtime continuation consume the close-time decision signals and keep only safety validation.
6. Add targeted tests for role-skill exposure, task-skill rejection, and continuation semantics.

## Expected Outputs

- New thesis skill:
  - `domain-skills/thesis/frontier-planning/SKILL.md`
- Runtime/type changes as needed:
  - thesis namespace classification
  - default role policy update
  - instruction validation update
  - auto continuation adjustment
- Prompt updates:
  - `qdd-close` describes lightweight thesis decision and expected signal
  - `qdd-start` may mention thesis-level project modeling only if useful
- Tests:
  - thesis-manager receives thesis skill
  - study-brain behavior remains unchanged
  - task skills reject `thesis/*`
  - auto can continue from valid thesis continuation signals
  - auto stops from valid thesis stop signals

## Run Contract

Each implementation run should record:

- which files were changed
- whether the thesis skill is role-level only
- whether any task-skill behavior changed
- which status fixture proves continuation
- which status fixture proves stopping
- build/test commands run

Minimum verification:

```bash
npm run build
npm test
git diff --check
```

## Failure / Blocker Conditions

- `thesis/*` can be written into task `skills:` without warning or blocker.
- `brain/*` and `thesis/*` become mixed conceptually or in paths.
- Runtime still independently overrides a valid thesis continue/stop decision with old scientific heuristics.
- A `continue` decision can proceed with no next candidate and no open boundary.
- `needs-human` becomes the normal auto-mode path instead of an exceptional state.
- The change requires a new heavy managed YAML file before the existing `evolution.yaml` path is proven insufficient.
