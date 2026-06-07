---
name: spatial/spatial-differential-expression
description: Spatial differential expression or differential feature testing skill for AnnData. Use after annotation when a task must test features between conditions, groups, niches, labels, or populations with cell/spot-level or sample-aware pseudobulk evidence.
domain: spatial
stage: downstream
tags:
  - de
---

# spatial/spatial-differential-expression

## Entry

- script: `scripts/spatial_differential_expression.py`
- params: `parameters.yaml`
- environment: `qdd-skill-core`

## When To Use

Use this skill when the task asks whether genes or features differ between groups.

It is appropriate for:

- cell/spot/bead-level two-group testing
- condition comparisons within a cell type, niche, or region
- sample-aware pseudobulk export and backend handoff
- genome-wide ranked DE output
- ranked output for pathway enrichment

It is not appropriate for:

- descriptive detection rates without inferential claims
- annotation
- neighborhood or niche composition analysis

## Methods

- `cell-level`: runs `scanpy.tl.rank_genes_groups(method="wilcoxon")` on the requested contrast
- `pseudobulk`: aggregates by sample and group, then runs `PyDESeq2` when a valid raw-count pseudobulk contrast is available

The pseudobulk path does not fabricate p-values in Python. When `PyDESeq2` cannot be used safely, it falls back to explicit export-only mode and writes the reason into the report.

## Key Parameters

- `--method cell-level|pseudobulk`
- `--group-key`
- `--group-a`
- `--group-b`
- `--sample-key`
- `--features`
- `--feature-file`
- `--subset-key`
- `--subset-values`
- `--test wilcoxon`
- `--p-threshold`
- `--min-pct`
- `--pseudobulk-backend`
- `--layer`
- `--use-raw`

## Example

```bash
conda run -n qdd-skill-core python \
  domain-skills/spatial/spatial-differential-expression/scripts/spatial_differential_expression.py \
  --input outputs/annotation/annotated.h5ad \
  --output outputs/de_day14_vs_sham \
  --method pseudobulk \
  --group-key condition \
  --group-a Sham \
  --group-b Day14 \
  --sample-key sample_id
```

## Outputs

- `report.md`
- `result.json`
- `tables/de_results.csv`
- `tables/pseudobulk_counts.csv` for pseudobulk
- `tables/pseudobulk_design.csv` for pseudobulk
- `tables/pseudobulk_normalized.csv` when normalization export is requested
- `figures/volcano.png`

## Notes

- Use `spatial-group-stats` for descriptive summaries and this skill for inferential DE.
- Prefer `pseudobulk` when biological samples or sections are available.
- `cell-level` is still useful for exploratory or benchmark-style fixed calculations, but it can overstate significance when observations are not independent.
- `cell-level` uses Scanpy's Wilcoxon implementation instead of a hand-rolled rank-sum loop.
- `pseudobulk` requires non-negative integer-like counts after aggregation. Logged or scaled matrices are exported but not passed into `PyDESeq2`.
