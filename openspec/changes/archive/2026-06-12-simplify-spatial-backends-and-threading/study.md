## Question

How should QDD harden its core scRNA and spatial executor skills so heavy graph-based analyses are explicit about dependencies, can use multiple CPU cores predictably, and stop bloating saved AnnData outputs through `.raw` duplication?

## Hypothesis / Expectation

If QDD removes homemade spatial graph fallbacks, adds explicit thread controls and optional UMAP skipping to the main heavy executor paths, and stops creating or propagating `.raw` in generated outputs, then the skill library will become easier to reason about, less memory-wasteful, and less likely to stall or diverge across environments.

## Inputs

- Spatial graph skills and docs:
  - `domain-skills/spatial/spatial-clustering/*`
  - `domain-skills/spatial/spatial-neighborhood-analysis/*`
  - `domain-skills/spatial/spatial-structure-quant/*`
- P0 heavy executor paths:
  - `domain-skills/singlecell/scrna/sc-preprocess-qc/*`
  - `domain-skills/singlecell/scrna/sc-batch-integration/*`
  - `domain-skills/singlecell/scrna/sc-clustering/*`
  - `domain-skills/singlecell/scrna/sc-trajectory/*`
  - `domain-skills/spatial/spatial-preprocess-qc/*`
  - `domain-skills/spatial/spatial-batch-integration/*`
  - `domain-skills/spatial/spatial-clustering/*`
- Existing QDD patience semantics in:
  - `.codex/skills/qdd/qdd-apply/SKILL.md`
  - `src/file-contracts/instructions.ts`
- Current environment intent:
  - `envs/qdd-skill-core.yml` already treats `squidpy` as part of the default shipped skill environment
- Current `.raw` touch points:
  - preprocess and integration skills that create or preserve `.raw`
  - downstream skills that can still optionally read `.raw`

## Evidence Plan

- A clarified executor contract showing which spatial graph skills now require `squidpy` without silent fallback.
- A concrete P0 threading plan for the main heavy scRNA/spatial scripts, including pre-import thread bootstrapping and output provenance.
- A memory contract stating that QDD-generated outputs do not create or preserve `.raw`.
- Updated `SKILL.md` and `parameters.yaml` surfaces that match the new executor behavior.
- Tests or smoke coverage showing that the new parameters and output expectations remain coherent.

## Blockers

- Some heavy library calls do not expose a direct `n_jobs` parameter, so thread control must be validated carefully through environment variables and the few APIs that do accept an explicit job count.
- `scvelo` is not currently importable in the local shell used for inspection, so implementation will need environment-aware verification for trajectory changes.
- Removing fallback graph code changes failure behavior from “keep going differently” to “stop clearly,” which is intended but must be documented carefully.
- Downstream skills that can still read `.raw` should not be allowed to quietly recreate a `.raw`-centric contract after the write path is removed.

## Exit Signal

This study is ready to close when the implementation path is clear enough to:

- remove the homemade spatial graph fallback branches from the scoped spatial skills,
- add explicit, auditable P0 threading and `skip_umap` controls to the core heavy executor scripts,
- and enforce a clear rule that QDD-generated outputs do not create or preserve `.raw` as a reusable handoff layer.
