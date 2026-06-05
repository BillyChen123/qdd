## 1. Filesystem And Promotion

- [x] 1.1 Remove root `data/` from the scaffold, docs, defaults, and runtime path contract, and use `artifacts/data/` as the shared project data surface
- [x] 1.2 Define canonical artifact target naming for flat `artifacts/data/` and related artifact directories
- [x] 1.3 Update registration and closure-time promotion so reusable outputs move into canonical artifact directories instead of only keeping their old study-local path
- [x] 1.4 Preserve an auditable pointer at the original study-local path after canonical promotion

## 2. Layer Policy And Command Mapping

- [x] 2.1 Add `.qdd/layer-policy.yaml` as a human-editable layer -> role -> default-skill policy scaffold
- [x] 2.2 Extend instructions generation to resolve `target`, `decision_layer`, `role`, and merged required/optional skills from `--command`
- [x] 2.3 Update validation so layer policy only references installed local domain skills and rejects `qdd/*` misuse
- [x] 2.4 Update workflow prompts and installed bootstrap surfaces to call `qdd instructions` with explicit command context where role defaults matter
- [x] 2.5 Make `qdd-close` explicitly resolve as `study target + project decision layer`

## 3. First-Wave Single-Cell Skills

- [x] 3.1 Add `genomics/scanpy-core-workflow` with concrete defaults for AnnData handling, graph construction, Leiden clustering, embeddings, and marker discovery
- [x] 3.2 Add `genomics/scanpy-marker-annotation` with concrete guidance for marker-based labeling, ambiguity handling, and output expectations
- [x] 3.3 Add `plot/scanpy-embedding-panels` for UMAP-style figure panels and figure QA
- [x] 3.4 Add `plot/scanpy-expression-panels` for dotplot, heatmap, matrixplot, violin, or related expression evidence views
- [x] 3.5 Ground these skills in official or primary references and avoid weak defaults such as treating `k-means` as the ordinary scRNA clustering path

## 4. Verification

- [x] 4.1 Update or add tests for the new shared data surface and canonical promotion behavior
- [x] 4.2 Update or add tests for command-aware skill resolution, layer-policy validation, and `qdd-close` decision-layer behavior
- [x] 4.3 Verify bootstrap projection installs the new layer-policy scaffold and first-wave domain skills into project-local tool surfaces
- [ ] 4.4 Dogfood the end-to-end flow on a realistic single-cell case and verify canonical outputs, visible skills, and auditable closure behavior
