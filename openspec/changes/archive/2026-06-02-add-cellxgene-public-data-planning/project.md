## Theme

Add a lightweight public single-cell data planning and retrieval slice to QDD so agents can move from a human research direction to a selected external dataset without adding a heavy router or opaque manifest system.

## Initial Question

How should QDD decide when a study needs external public scRNA data, turn that need into one thin human-editable handoff file, and let `qdd-apply` download the selected CELLxGENE datasets end to end?

## Mode

`human`

Humans still own the study boundary, whether an external dataset is scientifically appropriate, and the final candidate choice in `human` or `assist` mode. Agents may search metadata, propose a short candidate table, and prepare the download handoff, but must not silently broaden the search scope, download large candidate sets during planning, or invent a second hidden registry.

## Scope

### In Scope

- Add one planning-only brain skill under `domain-skills/brain/singlecell/` for external public data decisions during `qdd-propose` and `qdd-explore`.
- Add one executor skill under `domain-skills/singlecell/public-data/` for CELLxGENE search and download.
- Define one thin study-local handoff file that both humans and agents can read and edit directly.
- Keep candidate display in the conversation flow, while persisting only the final selected dataset IDs and search request state.
- Add the minimum metadata and runtime updates needed for `qdd skills suggest` to surface the new executor skill.
- Make `auto` mode end-to-end by allowing planning to select final datasets and `qdd-apply` to perform the actual download.
- Keep public-data failure local to the affected study/task rather than turning an unfound external dataset into a global apply-time failure when the study can proceed from local resources or close as blocked.

### Out Of Scope

- Adding GEO, SRA, ArrayExpress, or other public sources in this slice.
- Building a large multi-file manifest, background job queue, or hidden planner database.
- Using browser automation or webpage scraping as the main search path.
- Downloading broad candidate sets before the study has selected a small final target set.
- Mixing public-data acquisition semantics into `singlecell/scrna/*` analysis executor skills.

## Evidence Standard

This change is successful when:

- QDD has a readable planning protocol that tells `qdd-propose` and `qdd-explore` when public data search is warranted,
- planning produces one thin handoff file instead of a large opaque manifest,
- the handoff cleanly separates `query` from `selected` dataset targets,
- `qdd-apply` can consume that handoff and execute CELLxGENE download without reopening planning,
- and the public-data path stays lighter than a full routing subsystem while still being reliable enough for end-to-end study setup.

## Shared Context

- QDD already separates planning-only `brain/*` skills from executor problem-level skills under `domain-skills/`.
- The user wants search planning to happen in `qdd-propose` and `qdd-explore`, while `qdd-apply` should only execute the already selected download plan.
- The user strongly prefers one or two thin, human-readable state files over a thick JSON manifest or hidden runtime store.
- The existing skill architecture already supports controlled `domain` / `stage` / `tags` metadata and a bounded `qdd skills suggest` lookup path.
- CELLxGENE is the first target source because it already exposes searchable dataset metadata and direct `h5ad` download paths through official APIs.
- The user accepts a first-pass relevance judgment that relies on structured metadata plus title / citation / collection context, without making article abstracts a required blocking dependency for the first slice.
