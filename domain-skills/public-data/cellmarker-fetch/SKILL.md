---
name: public-data/cellmarker-fetch
description: Lightweight public marker-reference fetch skill for CellMarker. Use when a task needs a bounded marker table from CellMarker, materialized into a local CSV for downstream annotation skills.
domain: public-data
stage: acquisition
tags:
  - markers
---

# public-data/cellmarker-fetch

## Entry

- script: `scripts/cellmarker_fetch.py`
- params: `parameters.yaml`
- environment: `qdd-skill-core`

## When To Use

Use this skill when:

- planning already decided that a public marker reference would improve auditability
- the task needs a local `--marker-file`
- the intended source is CellMarker
- the search intent is already bounded in the task text

Typical downstream consumers:

- `singlecell/scrna/sc-marker-annotation`
- `spatial/spatial-marker-annotation`
- `singlecell/scatac/scatac-annotation-geneactivity`

## What It Does

- downloads the requested CellMarker table on demand
- filters the source table with bounded task-specified query terms
- writes a normalized matched-row table for inspection
- writes a downstream-ready aggregated marker table
- records only minimal provenance in the output files and reports

## What It Does Not Do

- it does not use `public_data_request.yaml`
- it does not pre-download a giant local marker knowledge base
- it does not decide biological truth for the study
- it does not replace downstream judgment about which labels are actually defensible

## Key Parameters

- `--output`
- `--organism human|mouse|all`
- `--query <text>` repeatable
- `--tissue <text>`
- `--system <text>`
- `--cell-type <text>`
- `--exact`
- `--max-rows`
- `--max-genes-per-label`
- `--note`
- `--refresh`

At least one bounded filter such as `--query`, `--tissue`, `--system`, or `--cell-type` should be provided.

## Example

```bash
conda run -n qdd-skill-core python \
  domain-skills/public-data/cellmarker-fetch/scripts/cellmarker_fetch.py \
  --output studies/STUDY-001/output \
  --organism human \
  --tissue ovary \
  --query stromal \
  --query fibroblast \
  --note "Marker reference for spatial annotation baseline"
```

## Outputs

- `tables/cellmarker_matches.csv`
- `tables/markers_selected.csv`
- `reports/cellmarker_fetch_report.md`
- `reports/cellmarker_fetch_result.json`

`markers_selected.csv` is the downstream-ready file and includes at minimum:

- `cell_type`
- `genes`
- `source`
- `organism`
- `tissue`
- `note`

## Notes

- Keep the search bounded; do not use this skill to pull the entire database by default
- The selected marker table is a local working reference, not a final biological verdict
- If CellMarker column names shift across releases, the script normalizes them heuristically and reports the detected mappings
