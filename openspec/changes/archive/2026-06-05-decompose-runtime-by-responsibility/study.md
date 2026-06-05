## Question

How should QDD separate study/task/artifact/closure responsibilities into explicit service modules so future protocol work can be implemented locally instead of editing several large runtime files at once?

## Hypothesis / Expectation

The current maintenance cost comes less from missing features and more from mixed ownership. If QDD gives each major responsibility one stable home, then:

- source reading becomes faster,
- later protocol changes become smaller and safer,
- validators and lifecycle code stop drifting,
- and the CLI can keep the same behavior with lower implementation friction.

## Inputs

- Current large runtime files:
  - `src/runtime/lifecycle.ts`
  - `src/runtime/evolution.ts`
  - `src/runtime/defaults.ts`
  - `src/runtime/inspection.ts`
  - `src/types.ts`
- Existing contract layer under `src/file-contracts/`
- Existing runtime infrastructure worth keeping:
  - `src/runtime/paths.ts`
  - `src/runtime/store.ts`
  - `src/runtime/bootstrap.ts`
  - `src/runtime/local-skills.ts`
  - `src/runtime/constants.ts`
- Existing tests and smoke checks under `src/test/`
- Recent archived changes that tightened protocol semantics and should remain intact

## Evidence Plan

This refactor should produce:

- an explicit target module layout under `src/`,
- code moved into `services`, `render`, and `types` ownership zones,
- a materially smaller or removed `src/runtime/lifecycle.ts`,
- a materially smaller `src/runtime/evolution.ts` with rendering pulled out,
- a split type surface under `src/types/`,
- thin command modules that delegate instead of owning logic,
- and updated docs or code maps so the new layout is inspectable by humans.

## Blockers

- Circular dependencies may appear if service boundaries are drawn poorly.
- A naive split could duplicate helpers across runtime and services.
- Some modules currently return mixed data shapes, so extraction may require careful intermediate adapters.
- Import churn can become noisy unless the migration uses a stable type barrel and well-defined service entrypoints.

## Exit Signal

This study is complete when:

- the responsibility split is visible in the tree, not just in comments,
- commands stay thin,
- managed-file templates/examples no longer hide inside orchestration code,
- large runtime files no longer act as the default home for unrelated logic,
- and build/tests show no external behavior regression.
