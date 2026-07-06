# Domain Skill Roadmap

This document captures future domain-skill planning that has been discussed but is not yet implemented.

Current focus remains single-cell and spatial transcriptomics. GWAS is a planned genetics extension, not the immediate implementation priority.

## Current Skill Inventory

Current source of truth: `domain-skills/`.

As of this snapshot, there are `35` total `SKILL.md` files:

| Group | Count | Notes |
|---|---:|---|
| Planning and thesis skills | 7 | `brain/*` planning plus `thesis/frontier-planning` and `thesis/conclude` |
| Public-data executor skills | 5 | `cellxgene-discover`, `cellmarker-fetch`, `lrdb-fetch`, `geo-candidate-capture`, `pubmed-evidence-capture` |
| scRNA executor skills | 10 | preprocess, integration, clustering, annotation, DE, stats, enrichment, module scoring, trajectory, communication |
| scATAC executor skills | 4 | LSI preprocess, latent batch correction, gene activity annotation, DAR |
| Spatial executor skills | 9 | preprocess, integration, clustering, annotation, group stats, DE, neighborhood, niche, structure |
| Problem-level executor skills | 28 | public-data + scRNA + scATAC + spatial |

## Architecture Principle

Keep external resource acquisition separate from domain analysis:

```text
external source
  -> public-data fetch/discover skill
  -> normalized local artifact
  -> domain executor
  -> study output / reusable artifact
```

Planning should stay split:

```text
domain brain
  -> decides whether a study needs external data or references

public-data brain
  -> decides how to acquire and freeze that resource

executor skill
  -> materializes the local artifact or performs the analysis
```

`public-data` is not a biological modality. It is an external resource layer shared by modalities.

## GWAS Extension Plan

### Goal

Add a lightweight genetics / GWAS layer that lets QDD work with public GWAS summary statistics and connect them to single-cell or spatial evidence.

The first GWAS version should focus on public summary statistics, not raw genotype GWAS. Raw genotype workflows require heavier privacy, cohort QC, HPC, and tools such as SAIGE or REGENIE, so they should remain out of scope until there is a concrete need.

### Recommended Domain Split

Add a new controlled domain when implementation begins:

- `genetics`

Recommended skill path root:

```text
domain-skills/genetics/gwas/
```

Do not force GWAS into `singlecell`, `spatial`, or `general`. `bulk` is technically available, but `genetics` is clearer if GWAS becomes a durable pillar.

### Brain Skills

| Skill | Purpose |
|---|---|
| `brain/genetics/gwas-planning` | Genetics-level reasoning: trait fit, ancestry, build, LD reference, QTL reference, coloc suitability, gene-set analysis route |
| `brain/public-data/public-data-planning` | Dataset-style external acquisition: GWAS Catalog, OpenGWAS, FinnGen summary statistics |
| `brain/public-data/reference-planning` | Reference-style acquisition: LD panels, HapMap3 SNPs, GENCODE, chain files, eQTL slices |

GWAS planning should call into the existing public-data planning layer rather than duplicating source acquisition logic.

### Public-Data Skills

| Skill | Purpose | Handoff |
|---|---|---|
| `public-data/gwas-summary-discover` | Search candidate GWAS summary statistics from GWAS Catalog, OpenGWAS, FinnGen | `public_data_request.yaml` |
| `public-data/gwas-summary-fetch` | Download or region-extract selected GWAS summary statistics | selected target from `public_data_request.yaml` |
| `public-data/gwas-reference-fetch` | Fetch LD panels, HapMap3 SNP lists, gene annotations, chain files | lightweight task text + manifest |
| `public-data/qtl-reference-fetch` | Fetch eQTL/QTL slices for selected tissue, gene, variant, or locus | lightweight task text + manifest |

Dataset-shaped public GWAS resources should use `public_data_request.yaml`.
Reference-shaped resources should stay lightweight and produce local files plus a small manifest.

### GWAS Executor Skills

| Skill | Stage | Purpose | Suggested backend |
|---|---|---|---|
| `genetics/gwas/gwas-sumstats-qc-harmonize` | preprocess | Standardize columns, alleles, build, p-values, effect direction, MAF/INFO/N fields | Python + GWASLab, optional R MungeSumstats |
| `genetics/gwas/gwas-locus-report` | downstream | Manhattan/QQ plots, top loci, clumping, nearest gene annotation | Python + PLINK2 |
| `genetics/gwas/gwas-gene-set-enrichment` | downstream | Test gene sets or cell-type marker sets against GWAS signal | MAGMA + Python wrapper |
| `genetics/gwas/gwas-colocalization` | downstream | GWAS-QTL or GWAS-GWAS coloc in bounded loci | R coloc + susieR |
| `genetics/gwas/gwas-ldsc` | downstream | Heritability, genetic correlation, optional stratified LDSC | LDSC |
| `genetics/gwas/gwas-finemapping` | downstream | Credible sets and PIP for bounded loci | R susieR or external FINEMAP |
| `genetics/gwas/gwas-mr` | downstream | Two-sample MR when exposure/outcome assumptions are explicit | R TwoSampleMR |

Recommended implementation order:

1. `brain/genetics/gwas-planning`
2. `public-data/gwas-summary-discover`
3. `public-data/gwas-summary-fetch`
4. `public-data/gwas-reference-fetch`
5. `genetics/gwas/gwas-sumstats-qc-harmonize`
6. `genetics/gwas/gwas-locus-report`
7. `genetics/gwas/gwas-gene-set-enrichment`
8. `public-data/qtl-reference-fetch`
9. `genetics/gwas/gwas-colocalization`

### Agent Thinking Prototype

```text
user study question
  |
  v
brain/genetics/gwas-planning
  |
  +-- Need public GWAS summary stats?
  |     -> brain/public-data/public-data-planning
  |     -> public-data/gwas-summary-discover
  |     -> public-data/gwas-summary-fetch
  |
  +-- Need LD / annotation / QTL reference?
  |     -> brain/public-data/reference-planning
  |     -> public-data/gwas-reference-fetch or qtl-reference-fetch
  |
  +-- Need standardized GWAS file?
  |     -> genetics/gwas/gwas-sumstats-qc-harmonize
  |
  +-- Main analysis route:
        |
        +-- top loci / candidate genes
        |     -> genetics/gwas/gwas-locus-report
        |
        +-- scRNA/spatial marker enrichment
        |     -> genetics/gwas/gwas-gene-set-enrichment
        |
        +-- GWAS-QTL causal support
        |     -> genetics/gwas/gwas-colocalization
        |
        +-- trait-level architecture
        |     -> genetics/gwas/gwas-ldsc
        |
        +-- causal exposure/outcome question
              -> genetics/gwas/gwas-mr
```

### Environment Plan

Keep the GWAS layer environment-agnostic and describe requirements by capability, not by personal environment name:

- default Python: an existing environment with the required Python bioinformatics packages
- optional R: an existing R environment only when an R-backed GWAS skill is actually introduced

Do not add GWAS dependencies to `qdd-skill-core` until a GWAS skill actually lands.

Suggested Python / conda additions for a dedicated GWAS-capable environment:

```bash
conda activate <your-python-env>

conda install -c conda-forge -c bioconda \
  plink2 \
  bcftools \
  htslib \
  samtools \
  bedtools \
  crossmap \
  ucsc-liftover \
  pysam \
  pyarrow \
  polars \
  duckdb \
  pyranges \
  statsmodels \
  tqdm

pip install \
  gwaslab \
  pyliftover
```

Suggested R additions for an existing compatible R environment:

```r
install.packages(c(
  "data.table",
  "readr",
  "dplyr",
  "ggplot2",
  "jsonlite",
  "optparse",
  "coloc",
  "susieR",
  "remotes"
))

install.packages("BiocManager")
BiocManager::install(version = "3.18")
BiocManager::install(c(
  "MungeSumstats",
  "GenomicRanges",
  "rtracklayer",
  "VariantAnnotation",
  "biomaRt"
))

remotes::install_github("MRCIEU/ieugwasr")
remotes::install_github("MRCIEU/TwoSampleMR")
```

External tools that should stay as explicit binaries or tool paths:

| Tool | Purpose | Notes |
|---|---|---|
| MAGMA | gene-based and gene-set GWAS analysis | likely manual binary install |
| LDSC | h2, genetic correlation, stratified LDSC | add only when `gwas-ldsc` is implemented |

Do not install Hail, SAIGE, REGENIE, PRSice, or bigsnpr for the first GWAS layer unless a task explicitly needs raw genotype or PRS workflows.

## Near-Term Single-Cell And Spatial Priorities

The immediate product direction should remain single-cell and spatial transcriptomics.

### Public-Data Skills Worth Adding

| Candidate skill | Priority | Why |
|---|---:|---|
| `public-data/geo-discover` | P0 | GEO remains the most common public source for scRNA/spatial validation datasets |
| `public-data/geo-fetch` | P0 | After source selection, materialize local matrices, metadata, or supplementary files |
| `public-data/pubmed-evidence-fetch` | P1 | Useful for lightweight literature-backed marker/pathway/evidence checks; should output citation tables, not long summaries |
| `public-data/gene-set-fetch` | P1 | Fetch Enrichr/MSigDB/Reactome-style gene sets on demand for pathway and module-score workflows |
| `public-data/cell-ontology-fetch` | P2 | Normalize or audit cell-type labels against Cell Ontology when annotation consistency matters |

Keep these lightweight. For GEO, use `public_data_request.yaml` because dataset selection matters. For PubMed, gene sets, and ontology references, use task-text handoff plus local CSV/TSV/JSON artifacts.

### Domain Executor Skills Worth Adding

| Candidate skill | Priority | Why |
|---|---:|---|
| `spatial/spatial-batch-integration` hardening | P0 | Skill exists, but should be validated on real multi-section/multi-sample spatial data |
| `spatial/spatial-clustering` hardening | P0 | Skill exists, but should be validated and tuned for targeted panels and spot-level data |
| `singlecell/scrna/sc-cell-communication` upgrade | P1 | Current baseline is transparent; optional permutation or LIANA-style backend can be added later |
| `singlecell/scrna/sc-doublet-detection` | P1 | Common scRNA QC gap; useful for scBench-like tasks |
| `singlecell/scrna/sc-label-transfer` | P1 | Needed when reference atlas labels should be transferred to a new dataset |
| `spatial/spatial-label-transfer` | P1 | Needed for mapping scRNA reference labels onto spatial spots/cells |
| `spatial/spatial-cell-segmentation-qc` | P2 | Relevant for Xenium/CosMx/MERFISH-style cell-level spatial data, but assay-specific |
| `singlecell/scrna/sc-ambient-correction` | P2 | Useful but can become method-heavy; defer until concrete need |

### Do Not Overbuild Yet

Defer these unless a benchmark or user study forces them:

- full Seurat/R duplicate workflows for every Scanpy skill
- raw genotype GWAS
- private reference database shipping
- full literature-review agents
- heavy ontology reasoning
- end-to-end CellChat/CellPhoneDB/NicheNet frameworks as default behavior

The current advantage is transparent, auditable, on-demand analysis rather than a large hidden biological knowledge base.
