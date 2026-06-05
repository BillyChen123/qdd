- [x] 1. Define boundary score semantics in runtime helpers and docs
- [x] 1.1 Compute active ancestor closure from one target set
- [x] 1.2 Compute executable frontier from that closure
- [x] 1.3 Compute closure mass, frontier mass, reachable active mass, and active project mass
- [x] 1.4 Compute legality, missing active ancestors, suggested frontier, `quality_score`, and `priority_score`
- [x] 1.5 Keep `narrowed` active and rely on `weight` rather than a hard-coded narrowed discount

- [x] 2. Add CLI score surfaces
- [x] 2.1 Implement `qdd boundaries score --targets <ids> --json`
- [x] 2.2 Implement `qdd boundaries score --study <study-id> --json`
- [x] 2.3 Return stable machine-readable JSON with structure, scores, and recommendation flags
- [x] 2.4 Validate bad target IDs, missing study targets, and empty target requests cleanly

- [x] 3. Tighten planning prompts and instructions
- [x] 3.1 Update `qdd-propose` so large hypotheses are preserved as long-range targets in human mode
- [x] 3.2 Update `qdd-propose` so current studies downshift to `suggested_frontier` when active ancestors remain
- [x] 3.3 Update `qdd-propose` wording so task multiplication is not used to hide cross-layer scope
- [x] 3.4 Update `qdd-explore` so it calls or relies on `qdd boundaries score --study <id> --json`
- [x] 3.5 Update generated instructions so legality, readiness, and frontier breadth are visible to planning workflows

- [x] 4. Verify the slice
- [x] 4.1 Add focused tests for closure/frontier and score computation
- [x] 4.2 Add prompt or instruction coverage that locks the new planning contract
- [x] 4.3 Update relevant docs so boundary scoring and frontier-aware planning are discoverable
