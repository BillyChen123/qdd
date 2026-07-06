# PaperSpine Upstream Provenance

This directory reserves the vendored PaperSpine surface required by the QDD `conclude` skill.

## Upstream Source

- Repository: `https://github.com/WUBING2023/PaperSpine`
- Upstream project: `WUBING2023/PaperSpine`
- Version tag: `v4.0.0`
- Commit: `3f92fc2df5f516c2bf36a5cd6d0aa59eadbf215f`
- License: `MIT`

## Why It Is Vendored

QDD `conclude` needs a practical local fork rather than a thin external wrapper because it must:

- read persisted QDD evidence instead of generic manuscript intake
- generate 2-3 story candidates before drafting
- stop for human story selection before final manuscript generation
- preserve claim-safety downgrades and negative-evidence handling specific to QDD

## Current Repository Slice

This issue slice scaffolds provenance only.

The repository currently preserves:

- upstream license text
- upstream repository/version/commit metadata
- the intended local modification boundary

It does not yet vendor executable PaperSpine source files into this directory.

## Planned QDD Modifications

Planned modifications relative to upstream PaperSpine include:

1. Replace generic material scan and intake with QDD preflight plus evidence harvesting from `contract.yaml`, `evolution.yaml`, `context/`, `studies/`, and promoted artifacts.
2. Insert story-candidate generation and a mandatory user selection gate before manuscript drafting.
3. Add QDD-specific audits for claim safety, reviewer risk, downgraded biological claims, and negative/boundary evidence usage.
4. Report missing `latexmk`, TeX engines, or `pandoc` as blocked rendering status instead of completion.

## Local Maintenance Note

When executable upstream assets are actually vendored in a later slice, update this file with:

- vendored paths
- a short changelog of local divergences
- any QDD-specific wrapper or glue code added around the upstream content
