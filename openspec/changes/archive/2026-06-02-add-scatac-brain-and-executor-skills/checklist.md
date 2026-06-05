## 1. scATAC Planning Layer

- [x] 1.1 Create `domain-skills/brain/singlecell/scatac-planning/SKILL.md`
- [x] 1.2 Encode the three input states: matrix-only h5ad, mixed multiome h5ad, fragment-aware mode
- [x] 1.3 Encode the four-stage planning protocol and explicit `reuse` / `repair` / `rerun` gates
- [x] 1.4 Align the scATAC brain skill tone and structure with the current scRNA planning skill quality bar

## 2. scATAC Executor Skills

- [x] 2.1 Create `singlecell/scatac/scatac-preprocess-lsi` with `SKILL.md`, `parameters.yaml`, and a runnable Python entry script
- [x] 2.2 Create `singlecell/scatac/scatac-batch-latent` with `SKILL.md`, `parameters.yaml`, and a runnable Python entry script
- [x] 2.3 Create `singlecell/scatac/scatac-annotation-geneactivity` with `SKILL.md`, `parameters.yaml`, and a runnable Python entry script
- [x] 2.4 Create `singlecell/scatac/scatac-dar` with `SKILL.md`, `parameters.yaml`, and a runnable Python entry script
- [x] 2.5 Keep output contracts explicit so these skills produce reusable study-local data, code, figure, table, and report surfaces

## 3. Metadata And QDD Integration

- [x] 3.1 Extend controlled skill tags only as needed for the first scATAC branch
- [x] 3.2 Ensure local skill discovery and catalog generation include the new `singlecell/scatac/*` executor skills
- [x] 3.3 Ensure `qdd skills suggest` can surface the new executor skills through controlled `domain` / `stage` / `tag` filters
- [x] 3.4 Keep planning-only and executor-only boundaries intact for the new scATAC skills

## 4. Validation

- [x] 4.1 Add or update tests for scATAC skill catalog discovery and suggestion behavior
- [x] 4.2 Smoke-check that each new executor skill exposes a coherent runnable surface and parameter contract
- [x] 4.3 Verify the planning skill and executor skills agree on the same h5ad-first ATAC boundary
- [x] 4.4 Refresh any prototype or contributor docs that need to mention the new scATAC branch
