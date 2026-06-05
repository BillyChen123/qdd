## Question

How should QDD redefine project evolution and study memory so the system keeps one sparse structured history, one readable study narrative, and one derived research map without semantic duplication?

## Hypothesis / Expectation

If QDD keeps `evolution.yaml` thin, uses `context/memory/STUDY-XXX.md` as the sole default narrative report, and derives `research-map.html` only from structured evolution state, then both agent behavior and human review will become clearer and less brittle.

## Inputs

- Existing managed file contracts:
  - `src/file-contracts/evolution.ts`
  - `src/file-contracts/memory.ts`
  - `src/file-contracts/artifact-index.ts`
- Existing runtime logic:
  - `src/runtime/evolution.ts`
  - `src/runtime/lifecycle.ts`
  - `src/runtime/status.ts`
  - `src/runtime/instructions.ts`
  - `src/runtime/inspection.ts`
- Existing prompt surfaces:
  - `src/runtime/bootstrap-prompts/qdd-propose.md`
  - `src/runtime/bootstrap-prompts/qdd-explore.md`
  - `src/runtime/bootstrap-prompts/qdd-close.md`
- User feedback from benchmark runs:
  - evolution semantics are too noisy
  - memory files are not organized around what users actually need
  - HTML output is stale or inconsistent
  - report/memory/evolution responsibilities are currently mixed

## Evidence Plan

This study should produce:

- one explicit sparse `evolution.yaml` contract
- one explicit default memory contract for `context/memory/STUDY-XXX.md`
- one clear decision on removing report duplication from the default close flow
- one implementation path for re-rendering `research-map.html` from the new evolution truth source only
- one validation path proving runtime, instructions, and docs all align with the new model

## Blockers

- Existing code may still assume older evolution fields such as `question_before` and `question_after`
- Some close-time behavior may still expect a separate report surface
- HTML rendering may be coupled to the older evolution/boundary shape
- The memory template must stay useful without becoming another dumping ground

## Exit Signal

This study is ready to close when:

- the new evolution structure is precise enough to implement,
- memory scope is clearly bounded,
- research-map derivation is unambiguous,
- and the runtime no longer needs the older duplicated project-state semantics.
