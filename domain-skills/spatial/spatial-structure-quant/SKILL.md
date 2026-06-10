---
name: spatial/spatial-structure-quant
description: Spatial connected-structure quantification skill for AnnData. Use after annotation when a task must identify and count coordinate-connected structures made from selected labels, optionally anchored by seed labels.
domain: spatial
stage: downstream
tags:
  - structure
---

# spatial/spatial-structure-quant

## Entry

- script: `scripts/spatial_structure_quant.py`
- params: `parameters.yaml`
- environment: `qdd-skill-core`

## When To Use

Use this skill after annotation is available and the downstream object is a spatially contiguous structure.

It is appropriate for:

- connected component counting
- seed-anchored structures
- structure-local label composition
- section-aware structure quantification
- assisted review of candidate structures

It is not appropriate for:

- discovering cell types
- marker annotation
- niche-vs-background enrichment
- general kNN co-localization summaries

## Supported Graphs

- `knn`: connect each selected observation to its selected nearest neighbors
- `radius`: connect selected observations within a spatial radius

## Backend

- required: Squidpy spatial graph construction

## Key Parameters

- `--label-key`
- `--component-labels`
- `--seed-labels`
- `--required-labels`
- `--group-key`
- `--section-key`
- `--spatial-obsm-key`
- `--x-key`
- `--y-key`
- `--graph-method`
- `--n-neighbors`
- `--radius`
- `--min-size`
- `--min-seed-count`
- `--min-required-count`

## Example

```bash
conda run -n qdd-skill-core python \
  domain-skills/spatial/spatial-structure-quant/scripts/spatial_structure_quant.py \
  --input outputs/annotation/annotated.h5ad \
  --output outputs/follicle_candidates \
  --label-key cell_type \
  --component-labels oocyte,granulosa \
  --seed-labels oocyte \
  --required-labels granulosa \
  --section-key sample_id \
  --graph-method radius \
  --radius 80
```

## Outputs

- `report.md`
- `result.json`
- `tables/component_summary.csv`
- `tables/component_assignments.csv`
- `tables/group_summary.csv`
- `figures/spatial_components.png`

## Notes

- This skill counts coordinate-connected structures from existing labels. It does not redefine labels.
- `seed-labels` are optional anchors. If provided, a component must include at least `--min-seed-count` seed observations to pass.
- `required-labels` are optional supporting labels. If provided, each required label must appear at least `--min-required-count` times.
- `assisted` interpretation should use the component tables and spatial plot rather than hidden manual edits.
- This skill requires `squidpy` in `qdd-skill-core`; there is no hidden fallback graph path.
