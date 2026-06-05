## Question Before

How should QDD connect a human research direction to external public single-cell datasets such as CELLxGENE?

## Question After

How should QDD add one explicit public-data planning layer plus one thin YAML handoff so planning can search and select CELLxGENE datasets, while `qdd-apply` only downloads the final selected targets?

## Change Type

refinement

## Change Driver

The original desire was broad: “let the agent find and download relevant public single-cell datasets.”

The study narrowed that into a cleaner and more implementable contract:

- keep “when to search” and “what to select” inside planning,
- keep “how to download” inside a thin executor skill,
- persist only one small study-local handoff file,
- avoid turning public-data acquisition into a large routing subsystem or a second hidden planner,
- and keep failed external-data lookup as a bounded study/task blocker rather than a global apply-time failure.

The strongest forcing requirement was the user's insistence that both humans and agents should be able to read and edit the handoff directly.

## Open Boundaries

- How far the first search broadening ladder should go before results become noisy
- Whether later slices should add GEO, SRA, or ArrayExpress behind the same planning contract
- How much resource registration should be automated after CELLxGENE download completes
- Whether later public-data slices need source-specific quality heuristics beyond the first `cellxgene` implementation
- Whether a later slice should enrich ranking with abstract or collection-summary text once a stable interface is confirmed

## Evidence Summary

- QDD already has a stable split between planning-only brain skills and executor problem-level skills.
- The repository already has a thin metadata-based skill suggestion path that can be extended without adding a heavy router.
- The user explicitly rejected a thick JSON manifest and preferred a single small YAML handoff file.
- Planning-time candidate review plus apply-time download gives a cleaner lifecycle boundary than letting executor prompts search ad hoc mid-run.
- CELLxGENE is a practical first source because it exposes searchable metadata and direct `h5ad` download paths through official APIs.
- The first slice does not need to depend on article abstracts if title, citation, collection, and structured metadata are sufficient to rank candidates.

## Recommended Next Step

Apply this slice by:

- writing `brain/singlecell/public-data-planning` first,
- defining `public_data_request.yaml` as the single persisted handoff,
- implementing `singlecell/public-data/cellxgene-discover` with explicit `search` and `download` paths,
- and updating runtime/prompt contracts so planning selects datasets and apply only downloads them.
