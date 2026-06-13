---
name: singlecell/scrna/sc-module-score
description: scRNA module and signature scoring skill for AnnData. Use after a canonical h5ad is established when the task needs defensible per-cell or per-group signature scores from a curated gene set.
domain: singlecell
stage: downstream
tags:
  - scrna
  - enrichment
  - module-score
---

# singlecell/scrna/sc-module-score

## Entry

- script: `scripts/scrna_module_score.py`
- params: `parameters.yaml`
- environment: project-configured Python environment (packaged example env `qdd-skill-core` is optional)

## When To Use

Use this skill when the task asks whether a known transcriptional program is stronger in some cells, groups, or states.

It is appropriate for:

- curated state signatures
- exhaustion / activation / stress / lineage module scoring
- per-cell scoring before grouped comparisons
- annotation support from known gene programs

It is not appropriate for:

- de novo pathway enrichment from ranked DE output
- trajectory fitting
- ligand-receptor analysis

## Key Parameters

- `--genes`
- `--signature-file`
- `--score-name`
- `--group-key`
- `--subset-key`
- `--subset-values`
- `--gene-pool-file`
- `--use-raw`
- `--layer`
- `--embedding-key`

## Signature File Format

Structured signature files should contain either:

- `signature`, `genes`
- `signature`, `gene`

Example:

```text
signature,genes
IFN_response,IFIT1,IFIT3,ISG15,MX1
Exhaustion,PDCD1,LAG3,TIGIT,TOX,HAVCR2
```

## Example

```bash
python \
  domain-skills/singlecell/scrna/sc-module-score/scripts/scrna_module_score.py \
  --input outputs/annotation/annotated.h5ad \
  --output outputs/module_scores \
  --signature-file refs/signatures.tsv \
  --group-key condition \
  --embedding-key umap
```

## Outputs

- `scored.h5ad`
- `report.md`
- `result.json`
- `tables/signature_scores.csv`
- `tables/signature_coverage.csv`
- `tables/score_summary.csv`
- `tables/group_score_summary.csv` when `--group-key` is provided
- `figures/*_<basis>.png`

## Notes

- This skill uses `scanpy.tl.score_genes`.
- If a subset is requested, scores are computed only on the subset and left as `NaN` elsewhere.
- Signature coverage is always written so missing genes are visible to the operator.
