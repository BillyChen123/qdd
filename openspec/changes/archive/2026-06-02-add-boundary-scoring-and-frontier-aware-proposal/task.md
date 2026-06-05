## Overview

Implement a deterministic boundary scoring surface and use it to keep QDD study planning frontier-aware in both propose and explore workflows.

## Depends On

- `project.md`
- `protocol.md`
- `study.md`

## Input

- Existing project boundary protocol:
  - `boundaries.yaml`
  - `study.md` with `target_boundaries`
  - current boundary runtime helpers and validation
- Current propose / explore prompt sources and instruction-generation path
- Existing tests for boundary state, instructions, and lifecycle behavior

## Expected Output

- A new boundary score CLI path that returns legality, closure/frontier structure, and computed proposal scores as JSON.
- Frontier-aware propose/explore prompt and instruction changes that respect human-mode semantics.
- Focused tests and docs showing how one large hypothesis is preserved as a long-range target while the current study is reduced to an executable frontier when needed.

## Checklist

- [ ] Add score-model helpers that:
  - read active boundaries from current state
  - compute active ancestor closure
  - compute frontier
  - compute reachable active mass
  - compute `quality_score` and `priority_score`
- [ ] Add `qdd boundaries score --targets <ids> --json`
- [ ] Add `qdd boundaries score --study <study-id> --json`
- [ ] Validate error cases:
  - missing boundary IDs
  - empty target set
  - study without `target_boundaries`
- [ ] Tighten `qdd-propose` prompt and instructions:
  - preserve long-range target in human mode
  - recommend frontier downshift when missing active ancestors exist
  - avoid solving scope problems by only adding more tasks
- [ ] Tighten `qdd-explore` prompt and instructions:
  - call the score surface
  - discuss legality, readiness, and frontier breadth explicitly
- [ ] Add or update tests for score computation and workflow wording
- [ ] Update docs where boundary scoring or frontier-aware planning should be discoverable

## Skills

- Runtime CLI design in the existing QDD TypeScript style
- Deterministic graph traversal over boundary dependencies
- Prompt tightening for `qdd-propose` and `qdd-explore`
- Focused test coverage for machine-readable lifecycle surfaces
