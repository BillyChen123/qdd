---
name: public-data/geo-candidate-capture
description: Lightweight GEO candidate capture skill for QDD. Use when a task needs an auditable table of bounded GEO candidates without committing to immediate dataset download or conversion.
domain: public-data
stage: acquisition
tags:
  - datasets
---

# public-data/geo-candidate-capture

## Entry

- script: `scripts/geo_candidate_capture.py`
- params: `parameters.yaml`
- environment: project-configured Python environment (packaged example env `qdd-skill-core` is optional)

## When To Use

Use this skill when:

- planning already decided that a study needs a bounded GEO search
- the task first needs a reviewable candidate table rather than immediate dataset download
- the intended source is GEO
- the bounded search intent is already captured in the task text

Typical downstream role:

- dataset survey before deciding whether a later fetch or manual curation step is worth doing

## What It Does

- issues a bounded GEO search against NCBI E-utilities
- optionally resolves one or more explicit accession queries
- normalizes the returned metadata into a small candidate table
- writes a local CSV and report for later human or agent review
- records minimal provenance in the result JSON

## What It Does Not Do

- it does not use `public_data_request.yaml`
- it does not auto-download all candidate files
- it does not promise that GEO supplementary files are already in a directly runnable format
- it does not replace study-level judgment about which accession is actually worth using

## Key Parameters

- `--output`
- `--query <text>` repeatable
- `--accession <GSE/GDS/GSM>` repeatable
- `--organism <text>`
- `--modality <scrna|spatial|bulk|other>`
- `--title-contains <text>`
- `--max-results <int>`
- `--note <text>`
- `--api-key <text>`
- `--email <text>`

At least one bounded signal such as `--query`, `--accession`, or `--title-contains` should normally be provided.

## Example

```bash
python \
  domain-skills/public-data/geo-candidate-capture/scripts/geo_candidate_capture.py \
  --output studies/STUDY-001/output \
  --query "ulcerative colitis fibroblast single cell" \
  --organism "Homo sapiens" \
  --modality scrna \
  --max-results 8 \
  --note "Candidate GEO survey for external validation cohort"
```

## Outputs

- `tables/geo_candidates.csv`
- `reports/geo_candidate_capture_report.md`
- `reports/geo_candidate_capture_result.json`

`geo_candidates.csv` includes at minimum:

- `accession`
- `geo_id`
- `title`
- `organism`
- `entry_type`
- `modality_hint`
- `sample_count`
- `year`
- `source_url`
- `recommended`
- `note`

## Notes

- This is a capture skill, not a full download/conversion pipeline
- Keep the query bounded; do not turn one task into an open-ended GEO crawl
- The output is meant to be reviewable and auditable, even when the later download path stays manual
