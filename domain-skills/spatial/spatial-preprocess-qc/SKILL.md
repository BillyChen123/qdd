---
name: spatial/spatial-preprocess-qc
description: Problem-level spatial AnnData preprocessing and QC skill. Use when a task must inspect matrix state, coordinate availability, spatial metadata, panel context, observation scale, and optionally run conservative Scanpy preprocessing.
domain: spatial
stage: preprocess
tags:
  - qc
---

# spatial/spatial-preprocess-qc

## Entry

- script: `scripts/spatial_preprocess_qc.py`
- params: `parameters.yaml`
- environment: `qdd-skill-core`

## When To Use

Use this skill when:

- input is a spatial `h5ad` / `AnnData`
- matrix state is unclear
- spatial coordinate fields must be found or summarized
- sample, section, timepoint, condition, or batch metadata must be audited
- observations may be cells, nuclei, beads, spots, or bins
- a targeted panel must be distinguished from a genome-wide assay
- conservative normalization or light preprocessing is needed

## Supported Modes

- `inspect`: audit only; do not mutate the matrix
- `auto`: run count-based normalization only when the selected matrix looks like raw counts
- `force`: treat the selected layer or `.X` as counts and rerun the requested preprocessing steps

## Key Parameters

- `--counts-layer auto|X|<layer>`
- `--assay auto|targeted|genome-wide|feature-activity`
- `--sample-key`
- `--section-key`
- `--time-key`
- `--condition-key`
- `--batch-key`
- `--spatial-obsm-key`
- `--x-key`
- `--y-key`
- `--target-sum`
- `--run-hvg`
- `--run-pca`
- `--n-top-genes`
- `--n-pcs`

## Example

```bash
conda run -n qdd-skill-core python \
  domain-skills/spatial/spatial-preprocess-qc/scripts/spatial_preprocess_qc.py \
  --input data/spatial.h5ad \
  --output outputs/spatial_preprocess_qc \
  --mode auto \
  --sample-key sample
```

## Outputs

- `processed.h5ad`
- `report.md`
- `result.json`
- `tables/qc_metrics_obs.csv`
- `tables/qc_metrics_var.csv`
- `tables/matrix_state.csv`
- `tables/coordinate_summary.csv`
- `tables/metadata_summary.csv`
- `figures/qc_histograms.png`
- `figures/spatial_overview.png` when coordinates are available

## Notes

- Do not apply scRNA default filtering thresholds blindly to targeted spatial panels.
- Default behavior is conservative: no cell/spot filtering, no HVG, no PCA unless requested or needed by a later task.
- Coordinates may be section-local. Do not compare coordinates across samples or sections unless registration is explicit.
- Panel coverage is part of evidence. Missing marker signal is weak negative evidence if the marker is not covered.
- This skill does not perform marker annotation, clustering, neighborhood analysis, or niche interpretation.
