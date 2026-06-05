## Question Before

How should QDD let domain planning guidance and reusable user preference context evolve without becoming a heavy parallel memory system or a duplicate of workflow prompts?

## Question After

How should QDD keep one readable project context file for facts plus durable preferences, while rewriting brain skills so they act only as domain-prior and executor-skill usage guides beside the main workflow prompts?

## Change Type

refinement

## Change Driver

Discussion clarified that the real problem is not missing storage locations, but boundary confusion:

- QDD workflow prompts already own propose/explore semantics.
- Brain skills should inject domain prior and tool-usage judgment only.
- `context/resources.md` is already the right durable context entrypoint and should be improved rather than replaced.

## Open Boundaries

- The exact final section names for `resources.md` still need implementation and test alignment.
- The polished single-cell brain skill will still be only the first domain example; future domain brains may need the same pattern.
- The change does not yet define how `qdd-close` should nominate durable preference updates beyond ordinary shared-context editing.

## Evidence Summary

- Current runtime defaults, prompts, and tests already center `context/resources.md`, making it the cheapest durable context anchor to extend.
- The current brain skill draft still mixes domain heuristics with workflow ownership language, which would cause overlapping guidance during propose/explore.
- The user explicitly prefers a lightweight approach with one improved context file over a separate memory subsystem.

## Recommended Next Step

Apply this slice by:

- tightening the brain-skill wording boundary,
- updating the default `resources.md` scaffold to include stable preference sections,
- and aligning prompts/tests so later agents read the intended single source cleanly.
