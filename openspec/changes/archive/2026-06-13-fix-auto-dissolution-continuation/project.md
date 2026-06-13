## Theme

Fix QDD auto-mode continuation when a closed study dissolves its local hypothesis but leaves executable next candidates, especially validation, robustness, or pivot directions that require new data or reused public-data candidates.

## Initial Question

How should QDD distinguish "this study hypothesis was dissolved" from "the whole project frontier is terminal" so auto mode can continue end-to-end into a meaningful next proposal?

## Mode

`auto`

The thesis-manager owns scientific frontier judgment at close time. The runtime owns lifecycle routing, schema validation, auth/error handling, max-iteration stops, and phase-completion checks. Runtime should not reinterpret a valid close-time continuation as terminal merely because `last_kind` is `dissolution`.

## Scope

### In Scope

- Allow auto mode to continue after `dissolution` when persisted next candidates or open boundaries define an executable continuation.
- Keep stopping behavior for true dissolved projects with no executable next candidate and no open boundary.
- Teach thesis-manager guidance that a dissolved local hypothesis may lead to:
  - validation in another dataset
  - robustness or integration-method testing
  - pivot to a better-supported mechanism
  - public-data rediscovery when no existing dataset can answer the next question
- Teach propose guidance to prefer existing discovered candidates before reopening broad public-data search.
- Add regression tests based on the UC anti-TNF state shape: `last_kind=dissolution`, open boundary present, and candidate strings containing `Expected signal` plus `Strategy`.
- Preserve the current sparse `evolution.yaml` structure and string candidates.

### Out Of Scope

- Adding a new thesis decision YAML file.
- Adding full auto resume/checkpoint support.
- Adding long-task heartbeat or process monitoring.
- Reworking the study/task markdown schema.
- Changing artifact promotion semantics.
- Implementing new GEO download, PubMed, or dataset acquisition skills.
- Making runtime parse all scientific strategy text beyond simple executable-continuation checks.

## Evidence Standard

This change is successful when:

- A closed project state with `last_kind=dissolution` and executable `next_candidates` routes to `qdd-propose` instead of terminal auto-mode stop.
- A closed project state with `last_kind=dissolution` and no next candidate or open boundary still stops.
- Contradictory or malformed continuation signals can still stop safely.
- `qdd-close` and `thesis/frontier-planning` distinguish local-hypothesis dissolution from project-frontier termination.
- `qdd-propose` is explicitly instructed to turn validation/pivot/robustness candidates into data-aware study plans, including reusing previously discovered datasets before launching new public-data search.

## Shared Context

The concrete failure case came from the UC anti-TNF auto project:

- `STUDY-004` closed successfully.
- The local hypothesis "a discrete NOTCH+stem epithelial subpopulation drives the signal" was rejected.
- The project still had executable next candidates:
  - validate diffuse NOTCH activation in `GSE282122`
  - test integration robustness in `GSE298464`
  - pivot to the stronger `FN1+` stromal signal
- Runtime stopped with: `Dissolution event still contains continuation signals; thesis-manager review is required before auto continuation.`

The desired behavior is:

```text
local hypothesis dissolved
  + executable validation / robustness / pivot candidate
  -> continue to qdd-propose for the next STUDY-XXX
```

The undesired behavior is:

```text
local hypothesis dissolved
  + explicit next candidates
  -> terminal auto stop requiring human review every time
```
