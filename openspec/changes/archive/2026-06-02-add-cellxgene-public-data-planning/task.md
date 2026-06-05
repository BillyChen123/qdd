## Task Goal

Implement the first public-data acquisition slice for QDD: one planning brain skill, one thin study-local handoff file contract, one CELLxGENE executor skill, and the minimum runtime/prompt updates needed to keep search in planning and download in apply.

## Study Link

This task supports the study decision that external single-cell dataset search should be a first-class QDD planning concern rather than an ad hoc executor-time improvisation.

## Method

Implement the change in four coordinated parts:

1. Add the planning layer:
   - create `brain/singlecell/public-data-planning`,
   - define hard triggers for when external public data search is needed,
   - define the structured search fields and search broadening ladder,
   - define how `human`, `assist`, and `auto` differ at selection time,
   - define when no public-data task should be created and when a missing result should instead be recorded as a bounded blocker.

2. Add the handoff contract:
   - standardize `studies/STUDY-XXX/output/public_data_request.yaml`,
   - keep only `query`, `selected`, and a short provenance note,
   - avoid creating a second persisted candidate registry,
   - keep the selected set to one target by default and at most two when the study explicitly needs both a primary target and a validation or reference target.

3. Add the executor layer:
   - create `singlecell/public-data/cellxgene-discover`,
   - expose `search` and `download` paths from one runnable script,
   - keep the executor thin so it only consumes structured request state and selected dataset IDs,
   - make the first search path rely on structured metadata plus title / citation / collection metadata rather than requiring article-abstract access.

4. Add the minimum QDD integration surface:
   - extend controlled `stage` / `tags` only as needed for acquisition,
   - ensure `qdd skills suggest` can retrieve the new executor skill,
   - update planning prompts so they call the new brain skill and use the handoff file correctly,
   - keep `qdd-apply` bounded to downloading the already selected targets.

## Expected Outputs

- New planning skill:
  - `domain-skills/brain/singlecell/public-data-planning/SKILL.md`
- New executor skill:
  - `domain-skills/singlecell/public-data/cellxgene-discover/`
- New thin handoff contract used by studies:
  - `studies/STUDY-XXX/output/public_data_request.yaml`
- Runtime and prompt updates needed to catalog, suggest, and consume the new skill and handoff contract
- Validation proving:
  - the new executor skill is discoverable,
  - planning can express the handoff contract,
  - apply-time execution does not reopen broad public-data search,
  - and missing external data stays a study/task-local blocker when appropriate

## Run Contract

Each implementation run should record:

- which planning and executor skill files were added or modified,
- whether `public_data_request.yaml` remained thin and human-editable,
- which controlled metadata fields changed for acquisition support,
- whether the new executor skill has a directly runnable search/download entry point,
- whether the search path returns enough metadata for planning to rank candidates without depending on abstract scraping,
- and what test evidence shows the planning-to-apply handoff is working as intended.

## Failure / Blocker Conditions

- The planning skill stays vague and does not clearly state when public data search should happen.
- The handoff file grows into a large nested manifest or splits into multiple competing truth sources.
- The executor skill must infer free-form intent instead of consuming a structured request.
- `qdd-apply` reopens search rather than downloading the already selected datasets.
- The public-data path blocks unrelated execution even when the study can proceed entirely from local resources.
- The new public-data branch is mixed into `singlecell/scrna/*` analysis skills instead of remaining a separate acquisition surface.
