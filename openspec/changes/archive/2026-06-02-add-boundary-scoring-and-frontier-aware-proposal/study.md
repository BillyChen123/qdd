## Question

How should QDD turn project boundary state into a deterministic proposal score and use that score to keep one study aligned with the current executable frontier instead of letting one large user hypothesis collapse into an overloaded study?

## Hypothesis

If QDD computes proposal legality, active-ancestor closure, executable frontier, readiness, and project impact directly from `boundaries.yaml`, then `qdd-propose` and `qdd-explore` can size studies more honestly without adding new graph metadata or relying on soft LLM-only grading.

## Blockers

- The current workflow still conflates the user's long-range research goal with the current study unit.
- Task count is an unstable cost proxy because tasks are agent-authored execution structure, not protocol truth.
- Large scientific requests often still depend on missing upstream work such as data onboarding, environment validation, preprocessing, integration repair, or annotation repair.
- Proposal prompts currently have no shared deterministic scoring surface to justify why a study should be down-shifted to frontier boundaries.

## Tasks

1. Define the structural scoring model over active boundaries, target closure, frontier, and reachable active mass.
2. Add one CLI score command that supports both explicit target sets and existing study records.
3. Tighten `qdd-propose` so human mode preserves long-range target semantics while recommending a frontier study when necessary.
4. Tighten `qdd-explore` so study resizing discussions use the same score output rather than ad hoc reasoning.
5. Add focused validation or tests that lock the scoring semantics and prompt contract.

## Expected Artifacts

- Runtime support for `qdd boundaries score --targets ... --json`
- Runtime support for `qdd boundaries score --study ... --json`
- Updated propose/explore prompt sources and generated instruction surfaces
- Tests covering legality, closure/frontier calculation, and prompt-facing score output usage
- Documentation updates explaining long-range target versus current frontier study behavior
