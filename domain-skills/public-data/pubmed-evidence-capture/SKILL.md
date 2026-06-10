---
name: public-data/pubmed-evidence-capture
description: Lightweight PubMed evidence capture skill for QDD. Use when a task needs a bounded, reviewable citation table with PMID-backed provenance rather than a long free-text literature summary.
domain: public-data
stage: acquisition
tags:
  - literature
---

# public-data/pubmed-evidence-capture

## Entry

- script: `scripts/pubmed_evidence_capture.py`
- params: `parameters.yaml`
- environment: `qdd-skill-core`

## When To Use

Use this skill when:

- planning already decided that a study should freeze literature evidence into a local table
- the task needs a reviewable PMID-backed citation surface
- the intended source is PubMed
- the bounded search intent is already captured in the task text

Typical downstream role:

- audit marker, pathway, cell-state, or mechanism claims before or after biological interpretation

## What It Does

- issues a bounded PubMed search against NCBI E-utilities
- optionally resolves one or more explicit PMIDs
- fetches article metadata and abstract text when available
- writes a local evidence CSV plus report
- records minimal provenance in the result JSON

## What It Does Not Do

- it does not use `public_data_request.yaml`
- it does not replace human or agent judgment about whether a paper truly supports the claim
- it does not write a long prose literature review for the user

## Key Parameters

- `--output`
- `--query <text>` repeatable
- `--pmid <id>` repeatable
- `--claim <text>`
- `--journal <text>`
- `--year-from <int>`
- `--year-to <int>`
- `--max-results <int>`
- `--note <text>`
- `--api-key <text>`
- `--email <text>`

At least one bounded signal such as `--query` or `--pmid` should normally be provided.

## Example

```bash
conda run -n qdd-skill-core python \
  domain-skills/public-data/pubmed-evidence-capture/scripts/pubmed_evidence_capture.py \
  --output studies/STUDY-001/output \
  --query "ulcerative colitis fibroblast inflammatory signaling" \
  --claim "Inflammatory fibroblast programs are recurrent in ulcerative colitis tissue" \
  --year-from 2018 \
  --max-results 12 \
  --note "Literature audit for downstream spatial interpretation"
```

## Outputs

- `tables/pubmed_evidence.csv`
- `reports/pubmed_evidence_capture_report.md`
- `reports/pubmed_evidence_capture_result.json`

`pubmed_evidence.csv` includes at minimum:

- `pmid`
- `doi`
- `title`
- `year`
- `journal`
- `query`
- `claim`
- `support_level`
- `url`
- `abstract_excerpt`
- `note`

## Notes

- This skill is for structured evidence capture, not full literature synthesis
- Keep the query bounded; do not use it as an open-ended topic crawl
- `support_level` is intentionally conservative by default and should be interpreted alongside the table content
