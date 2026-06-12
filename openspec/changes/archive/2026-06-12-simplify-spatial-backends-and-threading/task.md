## Task Goal

Implement the minimal domain-skill hardening needed to make spatial graph execution explicit, multicore controls auditable, and AnnData outputs more memory-bounded across the core scRNA and spatial skills.

## Study Link

This task supports the bounded study decision that executor ambiguity is not just implementation noise. Hidden spatial graph fallbacks, weak thread control, and casual `.raw` duplication directly affect performance, memory usage, and reproducibility in real studies.

## Method

- Remove custom spatial graph fallback branches from the scoped spatial graph skills and rely on `squidpy` as the single intended backend for those paths.
- Add a lightweight pre-import thread bootstrap pattern for the P0 heavy scripts so `--threads` can drive BLAS/OpenMP/Numba settings before heavy imports occur.
- Expose `--skip-umap` where clustering should remain valid without forcing a visualization step.
- Keep graph clustering as the default route and avoid any performance-driven downgrade to `k-means` or similar shortcuts.
- Remove skill-authored `.raw` creation and `.raw` propagation from preprocess and integration outputs.
- Audit `.raw`-aware downstream surfaces so the library no longer depends on `.raw` as its own default reusable matrix contract.
- Update parameter files, skill docs, and result/report provenance so the new behavior is explicit.

## Expected Outputs

- Updated Python executor scripts for the scoped scRNA and spatial skills
- Updated `parameters.yaml` files exposing thread and UMAP-skip controls where applicable
- Updated `SKILL.md` files reflecting stricter backend and memory contracts
- Updated tests or smoke coverage for parameter exposure, output provenance, and skill indexing if needed
- Updated built artifacts or generated surfaces if the repository requires them after implementation

## Run Contract

Each implementation run should record:

- which spatial graph fallback branches were removed and which skill IDs were affected
- which scripts now expose `--threads`
- how thread environment variables are applied before heavy imports
- which scripts expose `--skip-umap`
- how `result.json` or `report.md` records thread and UMAP-skip provenance
- which `.raw` write or propagation paths were removed
- whether any downstream `--use-raw` path remains and, if so, why it is only a compatibility read rather than a QDD default contract
- what tests, smoke runs, or static checks were used to verify the change

## Failure / Blocker Conditions

- A spatial graph skill still silently switches to a homemade SciPy or scikit-learn graph backend when `squidpy` is missing or errors.
- A P0 heavy executor still lacks a usable thread control surface or applies thread limits only after heavy imports have already initialized.
- Clustering still requires UMAP to succeed in ordinary graph-based workflows.
- A skill still writes `adata.raw = adata.copy()` or preserves `.raw` in output objects as a convenience contract.
- The change weakens the graph-clustering default or introduces an algorithm downgrade motivated only by runtime speed.
- Docs, parameters, and output provenance drift from the actual executor behavior.
