---
name: singlecell/scrna/sc-cell-communication
description: Lightweight scRNA ligand-receptor communication scoring skill for annotated AnnData. Use when a task needs auditable sender-receiver interaction ranking from a user-provided ligand-receptor table without introducing heavy external communication frameworks.
domain: singlecell
stage: downstream
tags:
  - scrna
  - communication
---

# singlecell/scrna/sc-cell-communication

## Entry

- script: `scripts/scrna_cell_communication.py`
- params: `parameters.yaml`
- environment: `qdd-skill-core`

## When To Use

Use this skill when:

- the object already has a reusable group annotation such as `cell_type`, `cell_state`, or `leiden`
- a task needs ranked sender-receiver interaction candidates
- the user can provide a curated ligand-receptor table
- an auditable lightweight baseline is preferable to a heavy framework with hidden priors

## What It Does

- reads a user-provided ligand-receptor interaction table
- audits panel coverage for ligand and receptor genes
- computes group-level ligand and receptor expression summaries
- scores every sender-receiver pair for every covered interaction
- optionally reduces sample-size imbalance by averaging group means across samples when `--sample-key` is provided

## What It Does Not Do

- it does not ship a private ligand-receptor database
- it does not claim permutation-based significance by default
- it does not replace LIANA, CellPhoneDB, CellChat, or NicheNet for publication-grade causal interpretation

## Interaction File

Interaction files may be TSV or CSV.

Required columns:

- one ligand column: `ligand`, `ligand_gene`, or `ligand_genes`
- one receptor column: `receptor`, `receptor_gene`, or `receptor_genes`

Optional columns:

- `interaction_id`
- `source`

Multi-gene complexes may be written with `+`, `;`, `,`, or `|`.

## Key Parameters

- `--group-key`
- `--lr-file`
- `--sample-key`
- `--score-method geometric_mean|product|min`
- `--use-raw`
- `--layer`
- `--min-detect-fraction`
- `--min-cells-per-group`
- `--top-n`

## Example

```bash
conda run -n qdd-skill-core python \
  domain-skills/singlecell/scrna/sc-cell-communication/scripts/scrna_cell_communication.py \
  --input outputs/annotated/processed.h5ad \
  --output outputs/cell_communication \
  --group-key cell_type \
  --sample-key donor \
  --lr-file refs/ligand_receptor_pairs.tsv
```

## Outputs

- `result.json`
- `report.md`
- `tables/group_abundance.csv`
- `tables/lr_panel_coverage.csv`
- `tables/interaction_scores.csv`
- `tables/sender_receiver_summary.csv`
- `figures/sender_receiver_heatmap.png`

## Notes

- Prefer biologically meaningful annotation keys over raw cluster IDs when possible.
- Interpret low scores carefully on targeted panels with incomplete ligand or receptor coverage.
- Use this as a transparent baseline or production smoke test, not as a substitute for a full communication inference paper pipeline.
