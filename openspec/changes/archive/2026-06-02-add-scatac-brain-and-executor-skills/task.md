## Task Goal

Implement the first high-quality scATAC domain slice for QDD: one planning brain skill, one bounded batch of executor skills, and the minimum metadata/runtime updates needed for those skills to be suggested and executed cleanly.

## Study Link

This task supports the study decision that QDD should gain an h5ad-first scATAC path with explicit scientific boundaries, rather than leaving ATAC planning and execution to improvised task-specific prompts.

## Method

Implement the change in three coordinated parts:

1. Add the planning layer:
   - create `brain/singlecell/scatac-planning`,
   - define the three input states:
     - matrix-only h5ad
     - mixed multiome h5ad
     - fragment-aware mode
   - define the fixed four-stage ATAC planning protocol:
     - Input & QC
     - Representation & Integration
     - Clustering & Annotation
     - Downstream Regulatory Analysis
   - make the planning contract explicit around `reuse` / `repair` / `rerun`.

2. Add the first executor layer:
   - create `singlecell/scatac/scatac-preprocess-lsi`
   - create `singlecell/scatac/scatac-batch-latent`
   - create `singlecell/scatac/scatac-annotation-geneactivity`
   - create `singlecell/scatac/scatac-dar`
   - keep each skill aligned with the current scRNA quality bar:
     - clear `SKILL.md`
     - explicit `parameters.yaml`
     - directly runnable Python entry script

3. Add the minimum QDD integration surface:
   - extend controlled skill tags and catalog handling only as needed for the new scATAC branch,
   - ensure `qdd skills suggest` can retrieve the new executor skills,
   - keep task-local skill IDs stable and problem-level,
   - avoid introducing a heavier router or extra ATAC lifecycle layer.

## Expected Outputs

- New planning skill:
  - `domain-skills/brain/singlecell/scatac-planning/SKILL.md`
- New executor skills:
  - `domain-skills/singlecell/scatac/scatac-preprocess-lsi/`
  - `domain-skills/singlecell/scatac/scatac-batch-latent/`
  - `domain-skills/singlecell/scatac/scatac-annotation-geneactivity/`
  - `domain-skills/singlecell/scatac/scatac-dar/`
- Runtime and metadata updates needed to catalog and suggest those skills
- Tests or smoke coverage proving:
  - the new skills are discovered,
  - the new metadata is cataloged,
  - and controlled scATAC retrieval works through `qdd skills suggest`

## Run Contract

Each implementation run should record:

- which scATAC skill directories were added or modified,
- which controlled tags or metadata contracts changed,
- whether each executor skill has a real runnable entry script,
- whether the planning skill and executor skills agree on the same h5ad-first contract,
- and what test evidence shows the new skills are visible to QDD catalog/suggest flows.

## Failure / Blocker Conditions

- The brain skill collapses back into vague prose instead of a stable planning protocol.
- Executor skills are placeholders without directly runnable scripts.
- The new scATAC branch claims fragment-level guarantees while only handling matrix-style h5ad inputs.
- `qdd skills suggest` cannot surface the new executor skills through controlled metadata.
- The slice grows into a broad ATAC platform rewrite instead of staying a strong first QDD-ready skill set.
