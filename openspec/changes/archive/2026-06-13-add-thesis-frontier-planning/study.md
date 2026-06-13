## Question

Can QDD add a thesis-level frontier planning skill that produces lightweight continuation decisions, while keeping study-brain and executor responsibilities unchanged?

## Hypothesis / Expectation

If thesis-manager receives a dedicated `thesis/frontier-planning` skill, then `qdd-close` can produce clearer continue/stop decisions and more judgeable next candidates. Runtime can become a light consumer and validator instead of encoding brittle scientific gate heuristics.

## Inputs

- Current role policy in `.qdd/layer-policy.yaml` and `src/file-contracts/layer-policy.ts`
- Current instruction construction in `src/services/instructions.ts`
- Existing local skill resolver in `src/runtime/local-skills.ts`
- Current `qdd-close` prompt
- Existing `evolution.yaml` study event schema
- Failure cases from the UC anti-TNF auto project

## Evidence Plan

This study should produce:

- A `thesis/frontier-planning` skill with concrete research-strategy heuristics.
- A clear namespace rule separating `thesis/*`, `brain/*`, and executor skills.
- Updated role policy so thesis-manager gets the thesis skill by default.
- Updated instruction validation so thesis skills are allowed for thesis-manager but rejected in task skills.
- Updated close prompt guidance for lightweight decisions and expected signals.
- Runtime continuation behavior that follows thesis-manager continuation signals and keeps only safety validation.

## Blockers

- The existing resolver only treats `brain/*` as planning-only. `thesis/*` will need explicit handling so it does not become a task skill by accident.
- The current `evolution.yaml` candidates are string arrays, so expected signals may initially need to be embedded in candidate text or memory rather than a nested candidate object.

## Exit Signal

Ready to apply when the implementation checklist specifies:

- exactly where the thesis skill lives
- how thesis-manager receives it
- how task skill validation blocks thesis skills
- how `qdd-close` should write lightweight decisions
- how runtime keeps only executable safety checks
