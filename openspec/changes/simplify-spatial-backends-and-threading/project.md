## Theme

Simplify QDD's spatial graph backend contract and harden heavy scRNA/spatial executor skills so they are explicit about dependencies, controllable on multi-core machines, and conservative about AnnData memory usage.

## Initial Question

How should QDD tighten its core scRNA and spatial domain skills so spatial graph construction uses one explicit backend, long-running graph workflows expose controllable threading, and generated `.h5ad` outputs stop duplicating matrices into `.raw`?

## Mode

`human`

Humans still decide the product boundary and whether a stricter dependency contract is acceptable. Agents may simplify executor behavior, add explicit thread controls, and remove wasteful `.raw` handling, but must not silently downgrade graph-based methods or add new hidden fallback paths.

## Scope

### In Scope

- Remove homemade spatial graph fallbacks from the core spatial graph skills and require `squidpy` explicitly where QDD already treats it as a shipped dependency.
- Harden the main scRNA/spatial heavy executor scripts with explicit `--threads` control and pre-import thread environment bootstrapping.
- Add `--skip-umap` where graph clustering should remain valid without forcing a visualization step.
- Keep graph clustering as the default clustering route and avoid performance-motivated algorithm downgrades such as swapping to `k-means`.
- Record thread and UMAP-skip provenance clearly in skill outputs.
- Remove skill-authored `.raw` creation and `.raw` propagation from QDD-generated AnnData outputs.
- Clarify that QDD skills should prefer `.X` or explicit named layers over `.raw` as the reusable matrix contract.

### Out Of Scope

- Renaming the existing `spatial/spatial-batch-integration` skill or creating a duplicate `spatial-integration` alias in this slice.
- Redesigning QDD's long-running task patience policy, because that boundary is already defined in `qdd-apply` and managed instructions.
- Broadly rewriting every skill that can optionally read an externally supplied `.raw` object, unless that read path is required to remove internal `.raw` dependence from shipped skills.
- Replacing `squidpy` with a new in-house spatial graph layer or adding a broader backend plugin system.
- Expanding this slice into new biological analyses such as communication, label transfer, or new public-data skills.

## Evidence Standard

This change is successful when:

- the core spatial graph skills no longer hide missing `squidpy` support behind custom SciPy or scikit-learn graph construction,
- the P0 scRNA/spatial executor scripts expose explicit, auditable thread controls that are applied before heavy numerical libraries initialize,
- clustering remains graph-first and can complete without mandatory UMAP generation,
- QDD-generated outputs no longer assign `adata.raw = adata.copy()` or preserve `.raw` as a hidden memory-heavy handoff layer,
- and the resulting scripts, parameters, docs, and tests make those boundaries visible enough that future agents do not reintroduce hidden fallback or `.raw` duplication behavior.

## Shared Context

- The user explicitly wants the spatial graph route simplified: if `squidpy` is the intended dependency, QDD should use it directly rather than maintaining parallel homemade graph backends.
- The current codebase already contains three similar spatial graph fallback patterns:
  - `spatial/spatial-clustering`
  - `spatial/spatial-neighborhood-analysis`
  - `spatial/spatial-structure-quant`
- The current P0 threading gaps are concentrated in:
  - `singlecell/scrna/sc-preprocess-qc`
  - `singlecell/scrna/sc-batch-integration`
  - `singlecell/scrna/sc-clustering`
  - `singlecell/scrna/sc-trajectory`
  - `spatial/spatial-preprocess-qc`
  - `spatial/spatial-batch-integration`
  - `spatial/spatial-clustering`
- QDD's workflow-side patience rule already exists and should be preserved rather than rebuilt:
  - slow clustering, UMAP, integration, and large `h5ad` processing are already treated as normal long-running work unless there is explicit evidence of failure.
- Current memory-heavy `.raw` writes and propagation already exist in shipped skills:
  - `singlecell/scrna/sc-preprocess-qc` assigns `working.raw = working.copy()`
  - `spatial/spatial-preprocess-qc` assigns `working.raw = working.copy()`
  - `singlecell/scrna/sc-batch-integration` preserves `working.raw = adata.raw`
  - `spatial/spatial-batch-integration` preserves `working.raw = adata.raw`
- Several downstream skills can still optionally read `.raw`; this slice should at minimum make sure QDD itself stops authoring or propagating `.raw` as a default reusable contract.
