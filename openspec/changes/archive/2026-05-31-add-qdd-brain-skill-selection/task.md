## Task Goal

Implement the minimal runtime, metadata, and prompt changes needed to split study-brain skills from executor problem-level skills, support controlled problem-skill lookup, and let one task carry a small set of concrete skills without reintroducing free-form whole-library routing.

## Study Link

This task supports the study decision that QDD should plan research with human heuristics first, choose problem-level skills through a bounded and auditable interface, and execute only against the task's declared skill set.

## Method

- Add a minimal metadata contract for problem-level skills, with controlled `domain`, `stage`, and `tags`.
- Add catalog generation or catalog refresh logic that indexes only executor-facing problem-level skills into `.qdd/skills-catalog.json`.
- Keep study-brain skills outside the task-local skill catalog, while still projecting them into local skill directories for planning-time loading.
- Add a bounded suggestion CLI that filters by `domain` and `stage`, then ranks by tag overlap and deterministic tie-breaks.
- Ensure the indexed executor skills are problem-level skills that may document multiple internal methods rather than one-method primitives.
- Update propose/explore prompts and runtime instructions so skill search only occurs during planning and writes chosen problem-level skills into task records.
- Keep apply-time instructions narrow: executor reads task-local problem-level skills and does not reopen the catalog as a free search space.
- Update docs and validation so new problem-level skills are expected to carry good metadata and use controlled vocabularies.

## Expected Outputs

- Updated local skill metadata model and catalog generation logic
- A new or revised CLI command for bounded tool-skill suggestion
- Prompt updates for `qdd-propose` and `qdd-explore`
- Runtime updates for instructions/status surfaces as needed
- Validation or lint checks for problem-skill metadata quality
- Documentation showing the split between study-brain and problem-level skills

## Run Contract

Each implementation run should record:

- how study-brain and tool-skill inventories are separated
- where tool metadata is stored and how the catalog is generated
- which fields are controlled vocabularies
- how `qdd skills suggest` filters and ranks candidates
- how one task may carry multiple related problem-level skills
- how planning flows write problem-level skills into tasks
- how apply-time flows are prevented from re-running broad skill search
- what tests or fixtures lock the lookup behavior

## Failure / Blocker Conditions

- Study-brain skills and executor problem-level skills remain mixed together in one undifferentiated planning surface.
- Task-local execution still depends on free-form whole-library search during apply.
- Problem-skill metadata grows into an uncontrolled schema that is too heavy to maintain.
- Tag vocabularies are left so loose that candidate lookup becomes equivalent to grep.
- The suggestion command produces unstable or opaque ordering that cannot be debugged.
- The slice indexes one-method primitives directly and loses the problem-oriented skill shape needed for stable matching.
- The slice forces one skill per task and breaks legitimate multi-skill task bundles.
