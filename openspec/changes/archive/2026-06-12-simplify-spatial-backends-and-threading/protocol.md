## Filesystem Contract

This slice does not introduce a new QDD object model. It tightens the executor-skill contract inside the existing central domain-skill library.

```text
project-root/
├── domain-skills/
│   ├── singlecell/
│   │   └── scrna/
│   │       ├── sc-preprocess-qc/
│   │       ├── sc-batch-integration/
│   │       ├── sc-clustering/
│   │       └── sc-trajectory/
│   └── spatial/
│       ├── spatial-preprocess-qc/
│       ├── spatial-batch-integration/
│       ├── spatial-clustering/
│       ├── spatial-neighborhood-analysis/
│       └── spatial-structure-quant/
├── envs/
│   └── qdd-skill-core.yml
├── src/
└── docs/
```

Rules for this slice:

- `qdd-skill-core` remains the intended default Python environment for these skills.
- Spatial graph skills that conceptually depend on Squidpy should declare that dependence honestly and fail loudly when it is missing.
- QDD should not maintain a parallel in-house spatial graph implementation for the same executor path when `squidpy` is already the intended dependency.
- Heavy executor scripts should parse a thread setting before importing heavy numerical libraries so BLAS/OpenMP/Numba thread limits can actually take effect.
- QDD-generated `h5ad` outputs should not create or preserve `.raw` as part of the standard reusable handoff contract.
- Reusable matrix semantics should stay on explicit `.X` or named layers instead of hidden `.raw` state.

## Identifiers And Metadata

Identifiers retained in this slice:

- skill IDs remain unchanged, including:
  - `singlecell/scrna/sc-preprocess-qc`
  - `singlecell/scrna/sc-batch-integration`
  - `singlecell/scrna/sc-clustering`
  - `singlecell/scrna/sc-trajectory`
  - `spatial/spatial-preprocess-qc`
  - `spatial/spatial-batch-integration`
  - `spatial/spatial-clustering`
  - `spatial/spatial-neighborhood-analysis`
  - `spatial/spatial-structure-quant`

Metadata and output rules tightened by this slice:

- P0 heavy skills should expose `--threads` as an explicit executor parameter.
- Graph clustering skills should expose `--skip-umap` when clustering results remain valid without embedding generation.
- Reports and machine-readable outputs should include enough run provenance to recover:
  - requested thread count
  - whether UMAP was skipped
  - which backend was actually used for spatial graph construction
- Spatial graph skills should report one explicit backend state, not a hidden fallback branch.
- QDD-generated outputs should not add `.raw` to the saved object and should not preserve `.raw` only for convenience.

Thread environment variables to standardize before heavy imports:

- `OMP_NUM_THREADS`
- `MKL_NUM_THREADS`
- `OPENBLAS_NUM_THREADS`
- `NUMBA_NUM_THREADS`

## Status JSON

No new top-level `qdd status --json` schema is required in this slice.

The important machine-facing changes are local to skill outputs:

- relevant `result.json` files should surface thread and UMAP-skip provenance,
- and spatial graph executor outputs should expose one explicit backend path rather than an implicit fallback.

Project-level status remains unchanged.

## Instructions JSON

No new top-level `qdd instructions --json` schema is required in this slice.

Instruction changes are behavioral and documentation-facing:

- workflow prompts and skill docs should continue to treat slow graph analysis as normal long-running work,
- but executor-facing skill documentation should stop implying that SciPy or scikit-learn spatial graph fallbacks are part of the supported contract,
- and skill-level guidance should make `.X` or named layers the preferred matrix contract instead of `.raw`.

## Agent Usage Rules

- Agents should not replace graph clustering with cheaper non-graph clustering only because a dataset is large or a run is slow.
- Agents should treat `squidpy` as a required dependency for the central spatial graph skills covered by this slice.
- If `squidpy` is unavailable, fail clearly and fix the environment rather than silently taking a different algorithmic path.
- Agents should prefer explicit matrix sources such as `.X`, `counts`, or another named layer when handing data between skills.
- Agents should not assign `adata.raw = adata.copy()` or preserve `.raw` in outputs just to make later steps convenient.
- Optional compatibility reads from an externally supplied `.raw` object may remain only when they do not turn `.raw` back into QDD's default reusable contract.
