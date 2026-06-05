## Theme

Tighten QDD's study-planning surface around an explicit split between human experience skills and problem-level executor skills, so agents can plan with domain reasoning, attach a small set of concrete skills to each task, and avoid free-form whole-library skill search.

## Initial Question

How should QDD represent study-layer research reasoning and task-layer problem-skill selection so one task may carry a small set of concrete skills, while a thin CLI resolver suggests candidates from controlled tool metadata instead of relying on brittle keyword search?

## Mode

`human`

Humans still own the research contract, study boundaries, and final task design. Agents may read study-brain guidance, inspect project state, call a bounded skill-suggestion CLI, and write task-local skill lists, but must not silently invent new routing layers, new free-form search vocabularies, or executor-visible skills outside the declared metadata contract.

## Scope

### In Scope

- Define a two-surface local-skill model:
  - study-brain skills for human research heuristics and planning prompts
  - problem-level executor skills for concrete analysis problems such as preprocessing, batch integration, clustering, or annotation
- Keep one task free to declare a small set of problem-level executor skills rather than forcing one skill per task.
- Add a minimal metadata contract for problem-level executor skills, centered on fields such as `domain`, `stage`, and `tags`.
- Treat domain/stage as controlled routing fields rather than free prose.
- Add a thin CLI suggestion surface that accepts bounded filters instead of arbitrary grep-like search.
- Make the suggestion surface support top-k candidate return with simple, deterministic ranking.
- Keep study-brain guidance as the place where human experience such as multi-sample integration checks or raw-count checks is expressed.
- Keep executor behavior simple: it only consumes task-declared problem-level skills, not the full searchable catalog.
- Clarify that search or candidate selection happens during propose/explore planning, not during apply execution.
- Reuse the existing local skill projection and bootstrap machinery where possible.

### Out Of Scope

- Building a semantic embedding retriever, vector database, or LLM reranker for skills.
- Letting executor-time workflows freely search the full skill library mid-run.
- Copying OmicsClaw's full routing stack, registry complexity, or broader platform semantics into QDD.
- Introducing a new hidden project planner that replaces study/task Markdown as the human-auditable truth source.
- Solving every domain's ontology in this slice; the first contract only needs enough structure to support practical QDD study planning.

## Evidence Standard

This change is successful when:

- QDD can cleanly distinguish study-brain skills from executor problem-level skills,
- one task may declare multiple related problem-level skills without implying hidden replanning,
- problem-level skills expose a small, controlled metadata surface that supports bounded lookup,
- the new suggestion command returns deterministic top candidates from metadata filters rather than depending on unconstrained keyword grep,
- study-layer prompts clearly use human experience guidance to decide what class of analysis problems should be searched,
- apply-time execution only reads the task's chosen skills,
- and the resulting protocol stays lighter than an OmicsClaw-style always-on resolver stack while remaining more stable than pure prompt-only free search.

## Shared Context

- The current QDD repository already distinguishes workflow skills from domain skills and validates task-declared local skills against `.codex/skills/`.
- The user's priority is research-native control, not a large autonomous skill marketplace.
- The user explicitly prefers a split where study-level reasoning loads human experience guidance, while task-level execution loads concrete problem-level skills.
- The motivating failure mode is not merely missing skills; it is incorrect or brittle skill loading caused by free-form intent interpretation.
- The user accepts a thin CLI/runtime boundary if it improves consistency, but does not want a heavy router that becomes its own product inside QDD.
- OmicsClaw is useful as a reference for domain grouping, problem-level skill design, and deterministic candidate narrowing, but QDD should not inherit its full platform weight.
- OpenAI and Anthropic patterns suggest progressive disclosure and bounded tool descriptions, but QDD still needs a research-specific contract for how study planning maps to task-local skills.
