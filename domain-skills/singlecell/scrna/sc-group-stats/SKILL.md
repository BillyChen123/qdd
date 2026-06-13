---
name: singlecell/scrna/sc-group-stats
description: Generic downstream descriptive grouped statistics skill for scRNA AnnData objects. Use after annotation when a task needs detection rates, fold changes, correlations, or cell abundance summaries without a full differential-expression analysis.
domain: singlecell
stage: downstream
tags:
  - scrna
  - group-stats
---

# singlecell/scrna/sc-group-stats

## Entry

- script: `scripts/scrna_group_stats.py`
- params: `parameters.yaml`
- environment: project-configured Python environment (packaged example env `qdd-skill-core` is optional)

## When To Use

Use this skill after a stable annotation or grouping key exists.

It is appropriate for:

- gene detection rates
- descriptive log2 fold change between two groups
- gene-gene correlation
- annotated cell abundance by group

It is not appropriate for:

- defining cell type labels
- full DE with FDR, sample blocking, or pseudobulk inference
- pathway enrichment
- trajectory inference
- cell communication analysis

## Supported Analyses

- `detection-rate`
- `fold-change`
- `correlation`
- `abundance`

## Example

```bash
python \
  domain-skills/singlecell/scrna/sc-group-stats/scripts/scrna_group_stats.py \
  --input outputs/annotation/annotated.h5ad \
  --output outputs/celltype_abundance \
  --analysis abundance \
  --group-key condition \
  --label-key cell_type
```

## Outputs

- `report.md`
- `result.json`
- `tables/statistics.csv`
- `figures/statistics_barplot.png` when applicable

## Notes

- For inferential DE, use `singlecell/scrna/sc-differential-expression`.
- The script still accepts `two-group-test` as a lightweight compatibility path, but planning should prefer the DE skill for p-values, FDR, or pseudobulk.
