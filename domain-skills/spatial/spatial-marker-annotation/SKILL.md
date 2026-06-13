---
name: spatial/spatial-marker-annotation
description: Spatial marker annotation and population inference skill for AnnData. Use when a task must define reusable cell, nucleus, bead, spot, bin, or population labels from markers, existing metadata, or cluster evidence before downstream spatial analysis.
domain: spatial
stage: clustering
tags:
  - markers
---

# spatial/spatial-marker-annotation

## Entry

- script: `scripts/spatial_marker_annotation.py`
- params: `parameters.yaml`
- environment: project-configured Python environment (packaged example env `qdd-skill-core` is optional)

## When To Use

Use this skill when:

- a spatial object needs reusable annotation before downstream analysis
- marker panel coverage must be audited
- an existing annotation column must be copied, harmonized, or summarized
- marker-supported populations such as `fibroblast-like`, `immune-like`, `oocyte`, or `granulosa` must be defined
- cluster labels must be converted into biological labels
- observations may be cells, nuclei, beads, spots, or bins

## Supported Modes

- `inspect`: audit marker coverage and existing labels only
- `auto`: assign labels when the requested evidence is sufficient
- `assisted`: assign candidate labels and emit review artifacts for human adjudication

## Assignment Units

- `existing`: copy an existing `obs` label column into a canonical annotation key
- `obs`: score each observation directly from marker sets
- `cluster`: score clusters from `rank_genes_groups` marker rankings
- `auto`: use `cluster` if `--cluster-key` is provided, otherwise `obs`

## Marker File

Marker files may be TSV or CSV.

Supported label columns:

- `label`
- `cell_type`
- `population`

Supported gene columns:

- `genes`
- `markers`

Example:

```text
label	genes
fibroblast_like	Col1a1,Col1a2,Dcn
immune_like	Lyz2,C1qa,Cd3d
```

## Key Parameters

- `--marker-file`
- `--assignment-unit auto|existing|obs|cluster`
- `--existing-label-key`
- `--cluster-key`
- `--annotation-key`
- `--unknown-label`
- `--min-score`
- `--min-margin`
- `--use-raw`
- `--layer`
- `--case-insensitive`
- `--embedding-key`
- `--spatial-obsm-key`

## Example

```bash
python \
  domain-skills/spatial/spatial-marker-annotation/scripts/spatial_marker_annotation.py \
  --input outputs/spatial_preprocess_qc/processed.h5ad \
  --output outputs/spatial_marker_annotation \
  --mode assisted \
  --marker-file refs/spatial_markers.tsv \
  --annotation-key population_label
```

## Outputs

- `annotated.h5ad`
- `report.md`
- `result.json`
- `tables/panel_coverage.csv`
- `tables/observation_annotations.csv` when assigning per observation
- `tables/cluster_annotation_summary.csv` when assigning per cluster
- `tables/label_score_summary.csv`
- `figures/annotation_on_embedding.png` when an embedding is available
- `figures/annotation_on_spatial.png` when coordinates are available

## Notes

- This skill defines labels. It does not make niche, co-localization, or structure claims.
- Marker absence is only meaningful if the marker is covered by the panel.
- `assisted` mode is appropriate when marker evidence produces candidates but final biological boundaries require review.
- Keep unknown or low-confidence labels explicit instead of forcing every observation into a named population.
