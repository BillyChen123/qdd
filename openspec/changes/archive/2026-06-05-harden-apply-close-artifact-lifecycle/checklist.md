## 1. Contract And Schema

- [x] 1.1 Add `table` to artifact candidate and artifact index contract enums, and document `artifacts/tables/`
- [x] 1.2 Tighten candidate path rules so promotion candidates must point to canonical study output paths and must not point into `output/tmp/`
- [x] 1.3 Update generated schema reference and examples to explain final output packaging, `table`, and tmp-path rejection

## 2. Runtime Lifecycle

- [x] 2.1 Extend path/bootstrap helpers so initialized projects create and understand `artifacts/tables/`
- [x] 2.2 Remove the extra manual confirmation gate from `qdd close-study` so preflight success leads directly to closure
- [x] 2.3 Make close-time promotion canonicalize `data`, `code`, `figure`, `table`, and `report` candidates into `artifacts/*`
- [x] 2.4 Preserve a readable study-local back-link or pointer after promotion so study outputs remain auditable
- [x] 2.5 Reject candidates that still point into `studies/STUDY-XXX/output/tmp/` or other scratch-only locations
- [x] 2.6 Clean heavy scratch outputs such as temporary h5ad files after successful close while preserving final truth

## 3. Apply And Close Guidance

- [x] 3.1 Tighten `qdd-apply` prompts and instructions so final h5ad, main script, key figures, and reusable tables are packaged into canonical study output directories before task completion
- [x] 3.2 Tighten `qdd-close` prompts and instructions so agents promote only explicit candidates, never infer from `tmp/`, and understand direct close-after-preflight semantics
- [x] 3.3 Surface close-preflight lifecycle failures clearly in status or instruction outputs so agents can fix packaging issues before retrying close

## 4. Verification

- [x] 4.1 Add or update tests for `table` validation and `artifacts/tables/` scaffolding
- [x] 4.2 Add or update tests for tmp-path rejection and direct close execution after preflight
- [x] 4.3 Add or update tests for canonical promotion into `artifacts/*` and study-local backlink preservation
- [x] 4.4 Add or update tests for scratch cleanup so large temporary h5ad files are removed but final packaged data remains
- [x] 4.5 Update the prototype map or adjacent docs so readers can find the hardened lifecycle quickly
