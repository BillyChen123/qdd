## Theme

Add a high-quality scATAC domain layer to QDD that matches the current scRNA skill standard while keeping the workflow lightweight, h5ad-first, and reusable.

## Initial Question

How should QDD represent scATAC planning knowledge and executor skills so that agents can analyze h5ad-based ATAC inputs with clearer boundaries, stronger domain judgment, and directly runnable scripts?

## Mode

`human`

Humans still decide the desired scientific boundary, what quality bar is acceptable for ATAC conclusions, and whether limited h5ad-only analysis is sufficient. Agents may propose the scATAC planning contract, implement domain skills, and wire skill metadata into QDD, but must not overstate fragment-level guarantees when the input is only a matrix-style h5ad.

## Scope

### In Scope

- Add one scATAC study-brain skill under `domain-skills/brain/` for `qdd-propose` and `qdd-explore`.
- Add a first batch of executor problem-level scATAC skills under `domain-skills/singlecell/scatac/`.
- Keep the scATAC skill shape aligned with the existing scRNA standard: `SKILL.md`, `parameters.yaml`, and directly runnable `scripts/*.py`.
- Treat `h5ad` as the default QDD handoff object for scATAC tasks.
- Make the planning skill explicitly distinguish:
  - matrix-only h5ad
  - mixed multiome h5ad
  - fragment-aware mode
- Define one reusable pre-downstream ATAC object that later tasks can consume consistently.
- Extend QDD skill metadata and suggestability only as needed for the new scATAC skills.

### Out Of Scope

- Building a full fragment-first ATAC platform comparable to ArchR or Signac.
- Claiming full TSS/FRiP/doublet/peak-calling guarantees when only matrix-style h5ad inputs are available.
- Adding a heavy skill router, new registry service, or free-text retrieval system.
- Covering every downstream ATAC method in the first pass.
- Solving all environment packaging issues beyond what is needed to make the first skill batch runnable and inspectable.

## Evidence Standard

This change is successful when:

- QDD gains a readable scATAC planning skill that defines a stable four-stage planning protocol and clear `reuse` / `repair` / `rerun` gates.
- The first scATAC executor skills are concrete, runnable, and documented at a quality level comparable to the current scRNA skills.
- The planning skill and executor skills agree on one h5ad-first contract instead of mixing incompatible ATAC assumptions.
- Skill metadata is explicit enough that `qdd skills suggest` can surface the new executor skills through controlled `domain` / `stage` / `tag` filters.
- The documentation makes clear where limited matrix-only analysis ends and where fragment-aware analysis would be required.

## Shared Context

- The current QDD repo already has one strong reference style under:
  - `domain-skills/brain/singlecell/scrna-planning`
  - `domain-skills/singlecell/scrna/*`
- The user wants scATAC quality to match that bar, not a loose placeholder or a copied catalog dump.
- The preferred product contract is lightweight and h5ad-first, even though some ATAC methods in the wider ecosystem are fragment-aware.
- Existing public examples such as OmicsClaw show a matrix-oriented ATAC path, but QDD should make the evidence boundary more explicit than those examples do.
- The benchmark example `GSE192780.h5ad` shows why the planning layer must distinguish mixed multiome h5ad from a clean peak-only object.
