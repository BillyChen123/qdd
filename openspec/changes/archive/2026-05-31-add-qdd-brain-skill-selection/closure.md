## Question Before

How should QDD load the right local skills for research planning and task execution without drifting into either brittle free-text search or a heavy hidden routing system?

## Question After

How should QDD keep study-brain heuristics and executor problem-level skills separate, use a small metadata catalog plus bounded suggestion CLI during planning, and freeze the chosen skill bundle inside each task for deterministic execution?

## Change Type

`refinement`

## Change Driver

The routing discussion clarified that the real problem is not generic semantic skill search; it is keeping research reasoning, tool discovery, and task execution at distinct layers with enough structure to stay stable and auditable.

## Open Boundaries

- How large the first controlled vocabularies for `domain`, `stage`, and `tags` should be.
- Whether catalog generation should read metadata only from `SKILL.md` or also accept sidecar files later.
- How aggressively suggestion results should expose ambiguity in assist versus auto mode.
- Which first problem-level domain skills should be upgraded to the new metadata contract before wider rollout.

## Evidence Summary

- The user prefers a QDD-native structure over a direct OmicsClaw clone.
- One task is allowed to carry a small group of related problem-level skills.
- Study Brain should load human experience guidance, not the whole tool library.
- Executor should only load declared task-local problem-level skills.
- A thin metadata-driven suggestion interface is acceptable if it stays controlled and deterministic.

## Recommended Next Step

Implement the minimal split and suggestion surface first:

- define controlled problem-skill metadata,
- generate a small local catalog,
- add bounded candidate lookup,
- update propose/explore to write chosen tool bundles into tasks,
- and keep apply execution catalog-free beyond the declared task skill set.
