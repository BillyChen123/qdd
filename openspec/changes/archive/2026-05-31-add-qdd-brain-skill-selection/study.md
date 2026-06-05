## Question

How should QDD let a Study Brain convert human research heuristics into a bounded problem-skill search, so study planning remains auditable and executor-time tool loading remains deterministic?

## Hypothesis / Expectation

If QDD separates study-brain heuristic skills from executor problem-level skills, gives those skills a small controlled metadata surface, and resolves candidates through a thin `domain + stage + tags` suggestion command, then study planning will stay understandable to humans while task execution will stay narrower and less error-prone than free-form skill search.

## Inputs

- Current local-skill validation and discovery logic in `src/runtime/local-skills.ts`
- Current bootstrap and skill projection logic in `src/runtime/bootstrap.ts`
- Existing QDD workflow prompts and instructions generation
- User requirements from `docs/00-product-requirements-document.md` and the recent routing discussion
- OmicsClaw as a reference for skill grouping and deterministic candidate narrowing, without inheriting its full runtime complexity
- Existing categorized local skill trees under `.codex/skills/` and `domain-skills/`

## Evidence Plan

- A clear protocol distinction between study-brain skills and executor problem-level skills.
- A minimal metadata schema for problem-level skills that is constrained enough to lint and stable enough to search.
- A bounded suggestion interface that takes controlled filters rather than arbitrary free-text search.
- A deterministic ranking rule that prefers hard filtering and simple tie-breaks over opaque scoring.
- Prompt and instructions guidance that makes propose/explore the only phase where candidate search occurs.
- A task contract that explicitly allows a task to carry a small set of related problem-level skills.
- Documentation and tests that show executor behavior no longer depends on full-library ad hoc search.

## Blockers

- If metadata vocabularies drift into uncontrolled synonyms, candidate lookup will become as brittle as keyword grep.
- If study-brain guidance is written as loose prose rather than operational heuristics, agent planning may still drift.
- If apply-time workflows are allowed to keep searching the catalog, the whole split loses value.
- If problem-level skills do not maintain good metadata, the lightweight resolver path weakens as the library grows.

## Exit Signal

This study is ready to close when the implementation path is clear enough to support one bounded planning loop:

- Study Brain reads experience skills and identifies what kind of analysis decision is needed.
- QDD suggests a small candidate set from controlled metadata.
- The chosen skills are written into task records, with one task allowed to hold multiple related problem-level skills.
- Executor runs only against those chosen task skills.
- The protocol stays auditable without introducing a large hidden routing system.
