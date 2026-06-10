---
name: singlecell/scrna/sc-trajectory
description: scRNA trajectory skill for canonical AnnData objects. Use when the task needs graph-level progression, pseudotime, or RNA-velocity-based directional structure from an annotated single-cell state space.
domain: singlecell
stage: downstream
tags:
  - scrna
  - trajectory
---

# singlecell/scrna/sc-trajectory

## Entry

- script: `scripts/scrna_trajectory.py`
- params: `parameters.yaml`
- environment: `qdd-skill-core`

## When To Use

Use this skill when the task asks how states connect, progress, or flow across a canonical scRNA embedding.

It is appropriate for:

- graph-level progression with PAGA
- DPT pseudotime from a chosen root
- RNA velocity with spliced/unspliced layers
- trajectory-oriented summaries by cluster

It is not appropriate for:

- annotation without a stable state space
- pathway enrichment
- ligand-receptor analysis

## Methods

- `paga-dpt`: Scanpy PAGA plus DPT pseudotime
- `rna-velocity`: scVelo velocity graph, velocity pseudotime, and optional latent time

## Key Parameters

- `--method paga-dpt|rna-velocity`
- `--threads`
- `--cluster-key`
- `--root-cell`
- `--root-key`
- `--root-values`
- `--embedding-key`
- `--velocity-mode`
- `--compute-latent-time`
- `--rank-velocity-genes`

## Example

```bash
conda run -n qdd-skill-core python \
  domain-skills/singlecell/scrna/sc-trajectory/scripts/scrna_trajectory.py \
  --input outputs/annotation/annotated.h5ad \
  --output outputs/trajectory \
  --method paga-dpt \
  --cluster-key leiden \
  --root-key cell_type \
  --root-values naive_T
```

## Outputs

- `trajectory.h5ad`
- `report.md`
- `result.json`
- `tables/trajectory_metrics.csv`
- `tables/group_trajectory_summary.csv`
- `tables/paga_edges.csv` for `paga-dpt`
- `tables/velocity_gene_metrics.csv` and `tables/velocity_gene_rankings.csv` for `rna-velocity`
- `figures/paga_graph.png`
- `figures/dpt_pseudotime.png`
- `figures/velocity_stream.png`
- `figures/latent_time.png`

## Notes

- `paga-dpt` requires an explicit root choice.
- `rna-velocity` requires `spliced` and `unspliced` layers.
- The skill prefers to reuse existing PCA / neighbors / embeddings when present, and only computes the minimum missing graph structure needed for the requested method.
- Dynamical velocity fitting now follows the explicit `--threads` setting instead of hard-coding single-core execution.
