---
name: spatial/spatial-neighborhood-analysis
description: Spatial neighborhood and co-localization analysis skill for AnnData. Use after annotation when a task must compute coordinate-based kNN neighborhoods, neighbor label composition, or co-localization scores across sections, timepoints, or conditions.
domain: spatial
stage: downstream
tags:
  - neighborhood
---

# spatial/spatial-neighborhood-analysis

## Entry

- script: `scripts/spatial_neighborhood_analysis.py`
- params: `parameters.yaml`
- environment: `qdd-skill-core`

## When To Use

Use this skill after annotation is available and the downstream question depends on local spatial neighborhoods.

It is appropriate for:

- kNN neighborhoods on spatial coordinates
- co-localization scores
- neighborhood label composition
- timepoint or condition summaries of spatial mixing
- section-local spatial analysis

It is not appropriate for:

- defining cell or spot labels
- running marker annotation
- niche-vs-background enrichment
- counting contiguous biological structures

## Supported Modes

- `inspect`: audit coordinates and label columns without computing neighborhoods
- `auto`: compute neighborhood scores and summaries
- `assisted`: compute neighborhood scores and emit review artifacts for human interpretation

## Backend

- required: Squidpy spatial graph construction

## Key Parameters

- `--annotation-key`
- `--neighbor-labels`
- `--target-labels`
- `--group-key`
- `--section-key`
- `--spatial-obsm-key`
- `--x-key`
- `--y-key`
- `--n-neighbors`
- `--max-distance`

## Example

```bash
conda run -n qdd-skill-core python \
  domain-skills/spatial/spatial-neighborhood-analysis/scripts/spatial_neighborhood_analysis.py \
  --input outputs/annotation/annotated.h5ad \
  --output outputs/fib_immune_coloc \
  --annotation-key population_label \
  --neighbor-labels fibroblast_like,immune_like \
  --group-key timepoint \
  --section-key sample_id \
  --n-neighbors 15
```

## Outputs

- `report.md`
- `result.json`
- `tables/neighborhood_scores.csv`
- `tables/group_summary.csv`
- `tables/neighbor_composition.csv`
- `figures/group_score_barplot.png`
- `figures/spatial_score_overview.png`

## Notes

- Coordinates should usually be interpreted within a section, FOV, sample, or tissue slice unless global registration is explicit.
- `neighbor-labels` define the positive labels for the co-localization score.
- `target-labels` restrict which observations are summarized as focal observations. If omitted, all observations are focal observations.
- This skill computes spatial evidence. It does not redefine annotations.
- This skill requires `squidpy` in `qdd-skill-core`; there is no hidden fallback graph path.
