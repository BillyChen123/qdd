---
name: spatial/spatial-niche-composition
description: Spatial niche, region, or community composition skill for AnnData. Use after annotation when a task must compare the label composition of a spatial niche, CN, region, cluster, or compartment against a matched background.
domain: spatial
stage: downstream
tags:
  - niche
---

# spatial/spatial-niche-composition

## Entry

- script: `scripts/spatial_niche_composition.py`
- params: `parameters.yaml`
- environment: project-configured Python environment (packaged example env `qdd-skill-core` is optional)

## When To Use

Use this skill after annotation is available and a spatial niche, region, compartment, CN, or community label already exists.

It is appropriate for:

- niche cell-type composition
- region-vs-background composition
- CN/community label interpretation
- dominant label vs enriched label comparison
- condition-specific niche composition

It is not appropriate for:

- defining cell types or populations
- computing spatial neighborhoods
- discovering niches from scratch
- counting contiguous structures

## Key Parameters

- `--niche-key`
- `--label-key`
- `--niche-values`
- `--label-values`
- `--group-key`
- `--subset-key`
- `--subset-values`
- `--background-scope same-group|all`
- `--pseudocount`

## Example

```bash
python \
  domain-skills/spatial/spatial-niche-composition/scripts/spatial_niche_composition.py \
  --input outputs/annotation/annotated.h5ad \
  --output outputs/cn7_composition \
  --niche-key cellular_neighborhood \
  --niche-values CN7 \
  --label-key cell_type \
  --group-key timepoint \
  --subset-key timepoint \
  --subset-values Day14
```

## Outputs

- `report.md`
- `result.json`
- `tables/niche_composition.csv`
- `tables/niche_enrichment.csv`
- `tables/niche_summary.csv`
- `figures/niche_composition_barplot.png`
- `figures/niche_enrichment_barplot.png`

## Notes

- This skill assumes niche and label columns already exist.
- It compares a focal niche against a matched background. With `--background-scope same-group`, background is restricted to the same group or condition.
- Enrichment is relative, not causal. Biological interpretation remains downstream reporting.
- Do not use this skill to relabel observations.
