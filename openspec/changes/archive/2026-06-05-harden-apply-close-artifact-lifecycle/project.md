## Theme

Harden QDD's real execution chain so study outputs are packaged predictably, reusable evidence is promoted automatically at close time, and large scratch files do not leak into long-term project truth.

## Initial Question

How should QDD enforce `apply -> candidate -> close -> promotion -> cleanup` so a real study reliably preserves its final h5ad, main script, key figures, and tables, then promotes the right subset into canonical `artifacts/*` locations without manual salvage?

## Mode

`human`

Humans still decide whether a study is worth running and whether its conclusions are scientifically acceptable. But once `qdd close-study` preflight passes, closure should execute directly without an extra manual confirmation gate. Agents should be able to finish the filesystem lifecycle end to end.

## Scope

### In Scope

- Remove the extra human confirmation step from `qdd close-study`; if preflight passes, close proceeds directly.
- Add `table` as a first-class artifact type.
- Add `artifacts/tables/` as the canonical reusable table destination.
- Tighten apply-time output packaging expectations:
  - final h5ad under `studies/STUDY-XXX/output/data/`
  - main executed script under `studies/STUDY-XXX/output/code/`
  - key figures under `studies/STUDY-XXX/output/figures/`
  - reusable tables under `studies/STUDY-XXX/output/tables/`
- Tighten close-time promotion so it:
  - never guesses final truth from `output/tmp/`
  - rejects promotion candidates that still point into `tmp/`
  - automatically promotes `data`, `code`, `figure`, `table`, and `report`
  - canonicalizes promoted files into `artifacts/*`
  - leaves a readable study-local back-link or pointer after promotion
- Clean large scratch outputs after a successful close, especially temporary h5ad files under `output/tmp/`.
- Add tests and docs around the hardened lifecycle.

### Out Of Scope

- Redesigning the whole artifact registry model beyond the additions needed for `table` and canonical promotion.
- Auto-promoting every file under a study output directory.
- Building a new run database, workflow engine, or storage backend.
- Reworking project-level question evolution semantics in this slice.
- Rewriting domain skills themselves beyond the packaging expectations they must follow.

## Evidence Standard

This change is successful when:

- `qdd close-study` no longer pauses for a second human approval after preflight succeeds,
- `table` is accepted anywhere artifact type validation matters,
- final study truth is packaged into canonical study output folders before closure,
- close-time promotion refuses `tmp/` candidates and promotes only explicit candidates,
- promoted files are physically moved or canonicalized into `artifacts/{data,code,figures,tables,reports}/`,
- study-local output remains readable after promotion through a stable pointer or back-link,
- and successful close removes heavy scratch leftovers while preserving all final reusable truth.

## Shared Context

- Recent benchmark runs exposed the main failure mode clearly:
  - close could be interrupted by an extra human gate,
  - promoted outputs were incomplete or absent,
  - preprocessed h5ad files stayed in scratch locations,
  - tables had no first-class artifact type,
  - study output trees drifted away from one clean final structure.
- QDD already has canonical study output subdirectories plus `artifact-candidates.yaml`, but the lifecycle is still too soft at the apply/close boundary.
- QDD already has reusable artifact roots for `data`, `code`, `figures`, and `reports`; this slice extends that model rather than replacing it.
- The user wants this solved as a thin contract/runtime refinement, not a heavier orchestration system.
