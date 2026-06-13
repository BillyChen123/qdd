---
name: singlecell/scrna/sc-pathway-enrichment
description: scRNA pathway and gene-set enrichment skill for ranked DE outputs or curated gene lists. Use when the task needs ORA or GSEA-style interpretation from a canonical downstream comparison.
domain: singlecell
stage: downstream
tags:
  - scrna
  - enrichment
---

# singlecell/scrna/sc-pathway-enrichment

## Entry

- script: `scripts/scrna_pathway_enrichment.py`
- params: `parameters.yaml`
- environment: project-configured Python environment (packaged example env `qdd-skill-core` is optional)

## When To Use

Use this skill when the task asks which pathways or curated gene sets are enriched in a ranked contrast or selected gene list.

It is appropriate for:

- preranked GSEA from DE outputs
- ORA from significant gene lists
- pathway interpretation after differential expression

It is not appropriate for:

- per-cell signature scoring
- trajectory fitting
- ligand-receptor analysis

## Methods

- `prerank`: `GSEApy prerank`
- `ora`: `GSEApy enrichr`

## Key Parameters

- `--method prerank|ora`
- `--gene-sets`
- `--de-table`
- `--ranking-file`
- `--gene-file`
- `--feature-column`
- `--rank-column`
- `--padj-threshold`
- `--min-abs-lfc`

## Example

```bash
python \
  domain-skills/singlecell/scrna/sc-pathway-enrichment/scripts/scrna_pathway_enrichment.py \
  --output outputs/pathway_ifn \
  --method prerank \
  --de-table outputs/de_results/tables/de_results.csv \
  --gene-sets refs/hallmark.gmt \
  --rank-column score
```

## Outputs

- `report.md`
- `result.json`
- `tables/enrichment_results.csv`
- `tables/ranking_used.csv` for `prerank`
- `tables/genes_used.csv` for `ora`
- `figures/prerank_top_terms.png` or `figures/ora_top_terms.png`

## Notes

- `--gene-sets` can be a GMT path, an Enrichr library name, or a comma-separated list.
- For ORA from a DE table, the script filters by adjusted p-value and optional absolute log2FC.
- For stable offline use, local GMT files are preferred.
