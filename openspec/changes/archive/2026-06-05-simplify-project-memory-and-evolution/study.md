## Question

How should QDD simplify project-state semantics so question evolution stays readable, study memory becomes first-class, and research visualization remains useful without a separate boundary-governance system?

## Hypothesis / Expectation

If QDD keeps `contract.yaml` as the stable contract, compresses `evolution.yaml` into a thin structured project map, and moves study narrative into `context/memory/STUDY-XXX.md`, then the workflow will become easier for both humans and agents to read and maintain while preserving enough structure for project-level visualization.

## Inputs

- Existing runtime and prompts:
  - `src/runtime/lifecycle.ts`
  - `src/runtime/status.ts`
  - `src/runtime/instructions.ts`
  - `src/runtime/defaults.ts`
  - `src/runtime/boundaries.ts`
  - `src/runtime/bootstrap-prompts/qdd-propose.md`
  - `src/runtime/bootstrap-prompts/qdd-explore.md`
  - `src/runtime/bootstrap-prompts/qdd-close.md`
- Existing validation and smoke coverage:
  - `src/runtime/inspection.ts`
  - `src/test/smoke.test.ts`
- User benchmark feedback:
  - current boundary semantics are too heavy
  - `evolution.yaml` is doing too much
  - per-study memory is missing
  - the visual graph is valuable, but only if the underlying state stays simple

## Evidence Plan

This study should produce:

- one simplified `evolution.yaml` contract
- one first-class `context/memory/STUDY-XXX.md` close-time artifact
- one derived `research-map.html` that shows both study nodes and boundary nodes
- one runtime design that removes `boundaries.yaml` from the core governance loop
- prompt, instruction, and validation changes that align propose/explore/close with the lighter state model

## Blockers

- Existing runtime and tests are deeply coupled to `boundaries.yaml`, `boundary-updates.yaml`, and score-driven planning.
- The new graph needs to stay simple enough that it helps readers instead of replacing one heavy map with another.
- This slice should not accidentally turn `memory` into another unbounded dumping ground.

## Exit Signal

This study is ready to close when:

- `evolution.yaml` has a clear minimal structure,
- per-study memory is explicit and close-owned,
- the derived graph no longer depends on separate boundary truth files,
- and the new semantics are precise enough to implement without reopening the ontology debate.
