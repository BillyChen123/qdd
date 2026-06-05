## Task Goal

Define the implementation work needed to make `qdd-apply` and `qdd-close` behave as one hardened artifact lifecycle: package final outputs, record explicit candidates, promote canonical reusable artifacts, and clean scratch leftovers.

## Study Link

This task supports the bounded study in `study.md`: make the execution-to-closure chain reliable for real benchmark use without adding a heavy new runtime model.

## Method

Implement the slice in four coordinated parts:

1. Tighten file contracts and examples so `table` and canonical candidate-path rules are explicit.
2. Tighten runtime lifecycle code so close executes directly after preflight and promotion canonicalizes outputs into `artifacts/*`.
3. Tighten apply/close instructions and prompts so agents package outputs correctly before closure.
4. Add verification around promotion, tmp rejection, tables, and scratch cleanup.

## Expected Outputs

- updated artifact contract enums and examples
- updated path/runtime helpers for `artifacts/tables/`
- updated close-study behavior with direct execution after preflight
- updated promotion flow for `data`, `code`, `figure`, `table`, and `report`
- updated study-local backlink behavior after promotion
- updated cleanup behavior for heavy scratch files
- updated tests and docs covering the hardened lifecycle

## Run Contract

Each implementation run should record:

- which contract files changed
- which runtime paths and lifecycle checks changed
- how close-time promotion canonicalizes paths into `artifacts/*`
- how study-local readability is preserved after promotion
- how scratch cleanup avoids deleting final truth
- what tests or smoke checks prove the lifecycle works

## Failure / Blocker Conditions

- Close still pauses for an avoidable extra human confirmation after preflight passes.
- `table` remains invalid or undocumented in candidate and artifact schemas.
- A candidate pointing into `output/tmp/` can still be promoted.
- Final processed h5ad or main script can still remain only in scratch space.
- Successful close still leaves large temporary h5ad files behind without necessity.
