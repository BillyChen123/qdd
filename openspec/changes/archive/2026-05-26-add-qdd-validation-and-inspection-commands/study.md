## Question

How should QDD add validation and read-only inspection commands so the current lifecycle can be reused safely and repeatedly without inflating the core workflow?

## Hypothesis / Expectation

If QDD adds one guard command (`validate`) and two inspection commands (`artifacts list`, `context`) over the existing truth sources, then the system becomes materially easier to dogfood and safer to connect to agents without introducing redundant state.

## Inputs

- Existing lifecycle commands already implemented in `src/`
- Product requirements for `qdd context` and `qdd validate` in `docs/00-product-requirements-document.md`
- Milestone guidance for `qdd validate` and `qdd artifacts list --json` in `docs/01-development-prototype.md`
- Current progress and gap analysis in `docs/02-code-prototype-map.md`

## Evidence Plan

- Define command behavior and JSON output for `validate`, `artifacts list`, and `context`
- Keep the existing truth-source model unchanged
- Add validation coverage for malformed YAML/frontmatter and basic state inconsistency
- Add tests proving these commands help inspect or guard the current lifecycle

## Blockers

- The desired depth of validation is still bounded; this slice should avoid becoming a full schema engine
- `context/` is intentionally open-ended, so `qdd context` must inspect without overfitting to one domain

## Exit Signal

This study is complete when the three commands are specified clearly enough that they can be implemented as thin, useful layers over the current runtime without reopening the core protocol design.
