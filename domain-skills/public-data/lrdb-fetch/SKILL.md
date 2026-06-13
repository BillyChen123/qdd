---
name: public-data/lrdb-fetch
description: Lightweight public ligand-receptor reference fetch skill for communication analysis. Use when a task needs a bounded ligand-receptor table from a public LR database, materialized into a local TSV for downstream scoring.
domain: public-data
stage: acquisition
tags:
  - communication
---

# public-data/lrdb-fetch

## Entry

- script: `scripts/lrdb_fetch.py`
- params: `parameters.yaml`
- environment: project-configured Python environment (packaged example env `qdd-skill-core` is optional)

## When To Use

Use this skill when:

- planning already decided that communication scoring needs an explicit public LR table
- the task needs a local `--lr-file`
- the intended source is a supported public LR database
- the search intent is already bounded in the task text

Typical downstream consumer:

- `singlecell/scrna/sc-cell-communication`

## Supported Sources

- `celltalkdb`
- `cellchatdb`

The skill downloads the selected source on demand and records which source was used.

## What It Does

- downloads the requested LR database file on demand
- normalizes the main interaction table into a lightweight ligand-receptor surface
- optionally filters by organism, category, pathway, and free-text query terms
- writes a downstream-ready `lr_selected.tsv`
- records minimal provenance in the report and result JSON

## What It Does Not Do

- it does not use `public_data_request.yaml`
- it does not ship a private LR database
- it does not run permutation significance
- it does not replace downstream biological judgment

## Key Parameters

- `--output`
- `--source celltalkdb|cellchatdb`
- `--organism human|mouse|zebrafish`
- `--query <text>` repeatable
- `--category <text>`
- `--pathway <text>`
- `--exact`
- `--max-rows`
- `--note`
- `--refresh`

At least one bounded filter such as `--query`, `--category`, or `--pathway` should normally be provided.

## Example

```bash
python \
  domain-skills/public-data/lrdb-fetch/scripts/lrdb_fetch.py \
  --output studies/STUDY-001/output \
  --source celltalkdb \
  --organism human \
  --query immune \
  --query fibroblast \
  --note "LR baseline for sc-cell-communication"
```

## Outputs

- `tables/lr_selected.tsv`
- `reports/lrdb_fetch_report.md`
- `reports/lrdb_fetch_result.json`

`lr_selected.tsv` includes at minimum:

- `ligand`
- `receptor`
- `source`
- `organism`
- `category`
- `note`

## Notes

- Keep the search bounded; do not dump the full LR database into study outputs by default
- The output table is meant to be transparent and directly consumable by downstream communication scoring
- `cellchatdb` complex entries are expanded into `GENE1+GENE2` style strings when complex metadata is available
