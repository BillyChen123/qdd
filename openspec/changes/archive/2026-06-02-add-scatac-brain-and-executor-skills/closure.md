## Question Before

How should QDD add scATAC support in a way that feels as coherent and usable as the current scRNA skill set?

## Question After

How should QDD add a first h5ad-first scATAC slice with one strong planning brain skill and a small batch of executor skills, while making the matrix-only versus fragment-aware evidence boundary explicit?

## Change Type

refinement

## Change Driver

The original desire was broad: “add ATAC skills comparable to the scRNA branch.”

The study narrowed that into a more implementable and scientifically honest slice:

- keep the QDD handoff object unified around `h5ad`,
- make the planning layer explicitly classify ATAC inputs as matrix-only, mixed multiome, or fragment-aware,
- implement only the first executor batch that fits the current lightweight QDD contract,
- and avoid pretending that matrix-style inputs provide the same guarantees as a fragment-native workflow.

The mixed `GSE192780.h5ad` example was the clearest forcing case for this refinement.

## Open Boundaries

- Which Python environment should become the long-term stable execution base for scATAC scripts
- Whether a later slice should add a fragment-native import/QC executor skill
- How broad the first controlled scATAC tag set should be before it becomes noisy
- How far the first batch should go in regulatory downstream work beyond DAR and gene-activity-oriented annotation

## Evidence Summary

- QDD already has a strong quality reference in the current scRNA planning and executor skills.
- Public examples such as OmicsClaw confirm that an h5ad/matrix-oriented ATAC path is a practical first slice, but they do not make the evidence boundary explicit enough for QDD.
- The benchmark-style mixed multiome example shows that ATAC planning must distinguish input state before task selection.
- A lightweight but credible first slice is available: one scATAC planning skill plus a narrow executor batch aligned with QDD's existing skill contract.

## Recommended Next Step

Apply this slice by:

- writing the scATAC planning brain skill first,
- implementing the four executor skills as real runnable skill directories,
- extending skill metadata and retrieval only as needed for those skills,
- and verifying that QDD can suggest and execute the new scATAC branch without adding a heavier runtime layer.
