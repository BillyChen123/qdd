---
name: spatial/spatial-clustering
description: Spatial AnnData graph construction, clustering, and embedding skill. Use when a spatial task needs reproducible expression-based, coordinate-based, or combined clusters before annotation or downstream spatial analysis.
domain: spatial
stage: clustering
tags:
  - neighborhood
---

# spatial/spatial-clustering

## Entry

- script: `scripts/spatial_clustering.py`
- params: `parameters.yaml`
- environment: `qdd-skill-core`

## When To Use

Use this skill when:

- a spatial object needs a reusable clustering column
- clustering should be based on expression, spatial adjacency, or both
- UMAP and spatial diagnostic plots are needed before marker annotation
- observations may be cells, nuclei, beads, spots, or bins

## Supported Graphs

- `expression`: Scanpy PCA or integrated embedding neighbors
- `spatial`: coordinate kNN graph built with Squidpy
- `combined`: weighted average of expression and spatial connectivities

## Key Parameters

- `--graph-source expression|spatial|combined`
- `--threads`
- `--use-rep auto|X_pca|X_pca_harmony|X_scanorama|...`
- `--spatial-obsm-key`
- `--section-key`
- `--n-neighbors`
- `--spatial-neighbors`
- `--spatial-weight`
- `--resolution`
- `--cluster-key`
- `--color-key`

## Example

```bash
conda run -n qdd-skill-core python \
  domain-skills/spatial/spatial-clustering/scripts/spatial_clustering.py \
  --input outputs/spatial_integration/processed.h5ad \
  --output outputs/spatial_clustering \
  --graph-source combined \
  --section-key section_id \
  --cluster-key spatial_leiden
```

## Outputs

- `processed.h5ad`
- `report.md`
- `result.json`
- `tables/cluster_assignments.csv`
- `tables/cluster_counts.csv`
- `tables/section_cluster_counts.csv` when `--section-key` is provided
- `figures/umap_by_cluster.png`
- `figures/umap_by_color.png` when `--color-key` is provided
- `figures/spatial_by_cluster.png` when coordinates are available
- `figures/spatial_by_color.png` when coordinates and `--color-key` are available

## Notes

- If coordinates are section-local, provide `--section-key` so spatial neighbors are built within sections.
- Coordinate-based clustering is an operational spatial structure, not a biological annotation.
- Spatial graph construction requires `squidpy` in `qdd-skill-core`; there is no hidden fallback backend.
- This skill does not assign cell types, niches, neighborhoods, or communication labels.
