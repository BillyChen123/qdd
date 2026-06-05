## Question

How should QDD support external public scRNA dataset planning so a study can decide when local resources are insufficient, search CELLxGENE during planning, and hand a small selected download set to `qdd-apply` without introducing a heavy manifest or hidden runtime layer?

## Hypothesis / Expectation

If QDD adds one dedicated public-data planning brain skill plus one thin `public_data_request.yaml` handoff file, then agents will be able to:

- decide whether external public data is actually needed,
- convert a human research direction into a structured CELLxGENE search request,
- surface a small candidate table during planning,
- carry only the final selected dataset IDs into execution,
- and keep “no suitable external dataset found” as an explicit bounded blocker instead of silently leaking that failure into unrelated execution paths.

## Inputs

- Existing QDD planning/executor split under:
  - `domain-skills/brain/*`
  - `domain-skills/singlecell/*`
- Existing bounded skill retrieval path under:
  - `src/runtime/local-skills.ts`
  - `src/commands/skills-suggest.ts`
- Current project memory and resource context under:
  - `context/resources.md`
- User requirement that:
  - search and selection happen in `qdd-propose` or `qdd-explore`,
  - `qdd-apply` only executes downloads already chosen,
  - and persisted state should stay thin, human-readable, and easy to edit.
- Official CELLxGENE metadata and `h5ad` download capabilities as the first supported public source.
- The user's preference that the first-pass relevance check may use structured fields plus title / citation / collection context, without requiring a stable abstract field in the initial implementation.

## Evidence Plan

This study should produce:

- one durable planning protocol for when and how external public data search is triggered,
- one thin YAML handoff contract for search request and final selection,
- one executor skill boundary for CELLxGENE search and download,
- one explicit rule for when no public-data task should be created or when a public-data blocker should be recorded instead,
- runtime metadata updates so the executor skill is suggested through controlled lookup,
- and clear mode semantics for `human`, `assist`, and `auto`.

## Blockers

- The search path must stay structured enough to avoid broad noisy results while still being flexible across tissues, diseases, and states.
- Official CELLxGENE fields and APIs may not align perfectly with every research phrasing, so the planning skill must define explicit search broadening rules.
- The public-data path must not silently grow into a second planner or candidate registry outside the main study files.
- Auto mode needs to stay end to end without letting planning directly perform large side-effectful downloads.
- Rich article abstracts or collection summaries may not always be available through one stable interface, so the first slice must still make acceptable relevance judgments from structured metadata and citation context.

## Exit Signal

This study is ready to move into closure when:

- the planning skill defines clear triggers, search structure, and selection rules,
- `public_data_request.yaml` is explicit enough for both humans and agents to edit,
- the executor skill boundary is thin and stable,
- the proposal makes clear when missing external data becomes a bounded blocker and when no public-data task should exist at all,
- and the overall contract keeps selection in planning and download in apply without reopening the search loop mid-execution.
