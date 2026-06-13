---
name: spatial/spatial-group-stats
description: Generic downstream descriptive grouped statistics skill for spatial AnnData objects. Use after annotation when a task needs detection rates, fold changes, correlations, or population abundance summaries without a full differential-expression analysis.
domain: spatial
stage: downstream
tags:
  - group-stats
---

# spatial/spatial-group-stats

## Entry

- script: `scripts/spatial_group_stats.py`
- params: `parameters.yaml`
- environment: project-configured Python environment (packaged example env `qdd-skill-core` is optional)

## When To Use

Use this skill after a stable annotation or grouping key exists.

It is appropriate for:

- feature detection rates
- log2 fold change between two groups
- feature-feature correlation
- annotated population abundance by group

It is not appropriate for:

- defining cell or population labels
- full differential expression with FDR, sample blocking, or pseudobulk inference
- spatial neighborhood analysis
- niche composition reasoning
- contiguous structure counting

## Supported Analyses

- `detection-rate`
- `fold-change`
- `correlation`
- `abundance`

## Key Parameters

- `--analysis`
- `--features`
- `--feature-file`
- `--feature-a`
- `--feature-b`
- `--group-key`
- `--group-a`
- `--group-b`
- `--label-key`
- `--subset-key`
- `--subset-values`
- `--test`
- `--p-threshold`
- `--count-threshold`
- `--pseudocount`
- `--use-raw`
- `--layer`
- `--case-insensitive`

## Examples

Detection rate:

```bash
python \
  domain-skills/spatial/spatial-group-stats/scripts/spatial_group_stats.py \
  --input outputs/annotation/annotated.h5ad \
  --output outputs/cd3d_detection \
  --analysis detection-rate \
  --features CD3D,ELANE
```

Abundance:

```bash
python \
  domain-skills/spatial/spatial-group-stats/scripts/spatial_group_stats.py \
  --input outputs/annotation/annotated.h5ad \
  --output outputs/population_abundance \
  --analysis abundance \
  --group-key timepoint \
  --label-key population_label
```

## Outputs

- `report.md`
- `result.json`
- `tables/statistics.csv`
- `figures/statistics_barplot.png` when applicable

## Notes

- This skill assumes labels or grouping columns already exist.
- For inferential DE, use `spatial/spatial-differential-expression`.
- The script still accepts `two-group-test` as a lightweight compatibility path, but planning should prefer the DE skill for p-values, FDR, or pseudobulk.
- For sparse matrices, features are extracted one at a time to avoid unnecessary dense materialization.
- Benchmark-specific final JSON formatting should be handled by task execution, not by this skill.
