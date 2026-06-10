---
name: spatial/spatial-batch-integration
description: Spatial AnnData batch diagnosis and optional integration skill. Use when a multi-sample, multi-section, or multi-batch spatial study needs auditable batch handling before clustering, annotation, or downstream spatial analysis.
domain: spatial
stage: integration
tags:
  - batch
---

# spatial/spatial-batch-integration

## Entry

- script: `scripts/spatial_batch_integration.py`
- params: `parameters.yaml`
- environment: `qdd-skill-core`

## When To Use

Use this skill when:

- a spatial `AnnData` object spans multiple samples, sections, slides, batches, or capture runs
- batch or section separation may confound clustering or marker annotation
- a later task needs a reusable integrated embedding or a documented decision not to integrate
- the study uses cell, nucleus, bead, spot, or bin observations in a common feature space

## Supported Methods

- `none`: run PCA, neighbors, clustering, and UMAP without correction for diagnosis
- `harmony`: use `scanpy.external.pp.harmony_integrate`
- `scanorama`: use `scanpy.external.pp.scanorama_integrate`
- `bbknn`: use `bbknn` for graph-level batch balancing when installed

## Key Parameters

- `--batch-key`
- `--threads`
- `--method none|harmony|scanorama|bbknn`
- `--section-key`
- `--label-key`
- `--use-hvg`
- `--n-hvg`
- `--n-pcs`
- `--n-neighbors`
- `--leiden-resolution`
- `--spatial-obsm-key`
- `--color-key`
- `--skip-metrics`

## Example

```bash
conda run -n qdd-skill-core python \
  domain-skills/spatial/spatial-batch-integration/scripts/spatial_batch_integration.py \
  --input outputs/spatial_preprocess_qc/processed.h5ad \
  --output outputs/spatial_integration \
  --batch-key sample_id \
  --section-key section_id \
  --method harmony
```

## Outputs

- `processed.h5ad`
- `report.md`
- `result.json`
- `tables/batch_sizes.csv`
- `tables/integration_metrics.csv`
- `tables/observation_embeddings.csv`
- `tables/batch_cluster_counts.csv`
- `tables/section_cluster_counts.csv` when `--section-key` is provided
- `figures/umap_by_batch.png`
- `figures/umap_by_cluster.png`
- `figures/umap_by_label.png` when `--label-key` is provided
- `figures/umap_by_color.png` when `--color-key` is provided
- `figures/spatial_by_batch.png` when coordinates are available
- `figures/spatial_by_cluster.png` when coordinates are available

## Notes

- Coordinates are preserved but not registered or transformed.
- Do not compare section-local coordinates across sections unless registration is explicit.
- `none` is a valid diagnostic path, not a failure state.
- QDD does not preserve `.raw` in this output; reusable matrix state should stay on `.X` or named layers.
- This skill does not perform spatial neighborhood, niche, or structure interpretation.
