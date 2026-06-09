## 1. Contract And Audit

- [x] 1.1 Audit the scoped spatial graph skills and identify every hidden custom fallback branch that should be removed
- [x] 1.2 Audit the P0 heavy scRNA/spatial scripts and define a consistent `--threads` plus pre-import bootstrap contract
- [x] 1.3 Audit every shipped skill that currently creates, preserves, or depends on `.raw` and classify write-path removal versus compatibility-only read-path retention

## 2. Spatial Backend Simplification

- [x] 2.1 Remove the scikit-learn fallback graph path from `spatial/spatial-clustering` and make `squidpy` failure explicit
- [x] 2.2 Remove the SciPy kNN fallback path from `spatial/spatial-neighborhood-analysis` and keep one explicit spatial graph backend
- [x] 2.3 Remove the SciPy graph fallback path from `spatial/spatial-structure-quant` and keep one explicit spatial graph backend
- [x] 2.4 Update the affected `SKILL.md` and `parameters.yaml` files so they no longer advertise fallback spatial graph backends

## 3. P0 Threading And UMAP Controls

- [x] 3.1 Add a thread bootstrap pattern to `singlecell/scrna/sc-preprocess-qc`
- [x] 3.2 Add a thread bootstrap pattern to `singlecell/scrna/sc-batch-integration`
- [x] 3.3 Add `--threads` and `--skip-umap` to `singlecell/scrna/sc-clustering`
- [x] 3.4 Remove `n_jobs=1` and add thread control to `singlecell/scrna/sc-trajectory`
- [x] 3.5 Add a thread bootstrap pattern to `spatial/spatial-preprocess-qc`
- [x] 3.6 Add a thread bootstrap pattern to `spatial/spatial-batch-integration`
- [x] 3.7 Add a thread bootstrap pattern to `spatial/spatial-clustering`
- [x] 3.8 Record thread and UMAP-skip provenance in `report.md` and/or `result.json` for the affected skills

## 4. Raw Memory Cleanup

- [x] 4.1 Remove `.raw` creation from `singlecell/scrna/sc-preprocess-qc`
- [x] 4.2 Remove `.raw` creation from `spatial/spatial-preprocess-qc`
- [x] 4.3 Remove `.raw` propagation from `singlecell/scrna/sc-batch-integration`
- [x] 4.4 Remove `.raw` propagation from `spatial/spatial-batch-integration`
- [x] 4.5 Update downstream docs or compatibility flags so `.raw` is no longer presented as QDD's default reusable matrix contract

## 5. Verification

- [x] 5.1 Verify the changed scripts still expose coherent CLI parameters through `parameters.yaml` and `SKILL.md`
- [x] 5.2 Verify the affected skill outputs record backend/thread provenance and remain usable without mandatory UMAP
- [x] 5.3 Verify QDD-generated outputs from the changed skills do not author or preserve `.raw`
- [x] 5.4 Run the relevant build, test, and targeted script-level checks needed to confirm the change is implementation-ready
