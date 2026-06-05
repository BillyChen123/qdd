## Why This Slice

QDD now has enough moving parts that boundary semantics can drift if they are not fixed explicitly.

The user's real research loops exposed three concrete failures:

1. `boundaries` were often interpreted like workflow steps instead of unresolved frontier questions.
2. `evolution` and `boundaries` were conceptually mixed, especially when a study was only one executable slice of a broader question.
3. `qdd close-study` could record a new `question_delta` while the project boundary state itself remained stale unless a separate command was remembered.

That combination weakens the one thing `boundaries` are supposed to buy us: a meaningful local proposal score over the current frontier.

## Scope

This slice should stay narrow:

- clarify the semantic ownership of `theme`, `evolution`, `boundaries`, and `score`
- tighten close-time persistence so boundary updates are not silently skipped
- tighten propose / explore / close prompts and instructions around the corrected model
- add smoke coverage for the corrected ordering and score visibility

This slice should not:

- introduce a new ontology layer beyond the existing QDD objects
- replace frontier questions with a planner DAG of methods or tasks
- add a hidden database, router, or state store
- redesign the score algorithm from scratch

## Expected Outcome

After this slice:

- `theme` remains broad project background,
- `evolution` is the append-only history of the current working question,
- `boundaries` are the current unresolved frontier graph around that question,
- `score` ranks the next local study against that frontier,
- and close-time state stays coherent even when the project pivots.
