---
name: singlecell/scrna/sc-differential-expression
description: scRNA differential expression skill for AnnData. Use after preprocessing, integration, clustering, or annotation when a task must test genes between conditions, groups, clusters, cell types, or populations with cell-level or sample-aware pseudobulk evidence.
domain: singlecell
stage: downstream
tags:
  - scrna
  - de
---

# singlecell/scrna/sc-differential-expression

## Entry

- script: `scripts/scrna_differential_expression.py`
- params: `parameters.yaml`
- environment: project-configured Python environment (packaged example env `qdd-skill-core` is optional)

## When To Use

Use this skill when the task asks whether genes differ between groups.

It is appropriate for:

- cell-level two-group testing
- cell-type-specific condition comparisons
- cluster-level or annotation-level contrasts
- sample-aware pseudobulk export and backend handoff
- genome-wide ranked DE output
- ranked output for pathway enrichment

It is not appropriate for:

- descriptive summaries without inferential claims
- marker annotation
- trajectory inference
- cell-cell communication analysis

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
python \
  domain-skills/singlecell/scrna/sc-differential-expression/scripts/scrna_differential_expression.py \
  --input outputs/annotation/annotated.h5ad \
  --output outputs/de_treated_vs_control \
  --method pseudobulk \
  --group-key condition \
  --group-a control \
  --group-b treated \
  --sample-key donor_id \
  --subset-key cell_type \
  --subset-values CD14_Mono
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

- Use a descriptive statistics skill for detection rates, abundances, and fold-change-only summaries.
- Prefer `pseudobulk` when biological replicates are available.
- `cell-level` is useful for exploratory screening, but it can overstate significance when cells are treated as independent replicates.
- `cell-level` uses Scanpy's Wilcoxon implementation instead of a hand-rolled rank-sum loop.
- `pseudobulk` requires non-negative integer-like counts after aggregation. Logged or scaled matrices are exported but not passed into `PyDESeq2`.
