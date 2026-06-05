## Summary

QDD should add one deterministic proposal scoring surface over project boundary state and use it to stop oversized studies earlier, while preserving the user's real scientific target in human mode.

## What Changes

- Add `qdd boundaries score` as a read-only CLI interface over existing boundary state.
- Support both direct target-set scoring and study-based scoring.
- Define a structural model based on active ancestor closure, executable frontier, reachable active mass, and current active project mass.
- Use `quality_score` to express whether a requested target is structurally ready as one study.
- Use `priority_score` to express how much of the active project boundary mass the current frontier could unlock.
- Tighten `qdd-propose` so large hypotheses become discussed long-range targets plus a recommended or enforced frontier study, rather than one overloaded current study.
- Tighten `qdd-explore` so it uses the same scoring output to discuss resizing.

## Decisions

- Do not add new boundary metadata fields in this slice.
- Do not make task count the primary cost model for proposal scoring.
- Treat `frontier_size` as a breadth or burden indicator, not the core score denominator.
- Treat `narrowed` as active and let changed `weight` carry any reduction in remaining importance.
- In human mode, do not silently replace the user's hypothesis; explain why the current study should be smaller.
- In auto mode, allow direct downshift to `suggested_frontier`.

## Risks

- The score can still be gamed if humans keep inflated or inconsistent boundary weights.
- Frontier legality does not guarantee that a study is scientifically good; it only guarantees that the study is structurally better sized.
- Proposal prompts may still over-plan tasks unless wording is tightened clearly against using task count as a substitute for boundary decomposition.
- Reachability and frontier breadth may need later refinement if the project starts using more complex boundary patterns.

## Ready To Close When

This change is ready to close when:

- `qdd boundaries score` is implemented and tested,
- `qdd-propose` and `qdd-explore` both consume the score surface or instruct agents to consume it,
- human-mode proposal wording preserves long-range hypothesis semantics while recommending smaller frontier studies when needed,
- and the resulting protocol remains deterministic, lightweight, and boundary-native.
