# Known Bad Draft Excerpts

Source: Parkinson conclude evaluation run `eval-2026-07-07T15-07-41-045Z`.

The original evaluator scored this draft `26/35` with `logical_coherence=5/5` and no hard fail. These excerpts show why that result is a false positive.

## Artifact Descriptions Pasted Into The Abstract

> Across the selected evidence chain, leiden-clustered and cell-type-annotated snRNA-seq analysis matrix for PD substantia nigra (GSE253462)., while cell-type abundance summary for GSE253462 PD SN snRNA-seq: nuclei count and fraction per annotated cell type [...].

Why it fails: the text concatenates catalog descriptions, contains broken punctuation, and never states a manuscript contribution.

## Evidence Inventory Presented As Results

> Specifically, leiden-clustered and cell-type-annotated snRNA-seq analysis matrix [...]; Moran's I spatial autocorrelation statistics [...]; Spearman correlation [...].

Why it fails: naming three artifacts is not a result chain. The paragraph lacks a comparison, decisive value, figure reference, and interpretation.

## Workflow Boundary Text Pasted Into Prose

> requires a narrowed analytical path., which keeps the interpretation bounded. This section therefore remains conservative: current wording is already bounded to the available evidence..

Why it fails: this is execution metadata and writing commentary, not scientific prose.

## Generic Discussion Generated From Status Text

> Negative and boundary findings remain scientifically informative because isoform-level analysis is NOT feasible [...] require…; requires a narrowed analytical path.; contains only 1 PD + 1 iLBD donor [...].

Why it fails: limitations are dumped as fragments rather than used to bound a specific conclusion or motivate a concrete next test.

## Missing Citations Hidden By A Placeholder

> External background citations are currently unavailable and must be added later using verified BibTeX entries.

Why it fails: an unfinished citation placeholder is acceptable in an audit, but not evidence that the manuscript itself has citation integrity.

## Evaluator Failure

The old evaluator inferred logical coherence from the presence of Abstract, Introduction, Results, Discussion, and enough subsections. It inferred manuscript viability from file existence, claim count, placeholders, and a bibliography command. Those structural proxies cannot distinguish a paper from an evidence inventory and must never be sufficient for a passing result.
