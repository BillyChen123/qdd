# Benchmark Handoff

This document summarizes the current benchmark selection for evaluating the QDD agent and is intended to be copied into a separate evaluation workspace.

## Goal

Evaluate the agent with a small, practical benchmark suite that separates:

- public executable bioinformatics tasks
- public comparison anchors against recent models
- QDD-specific behavior that public benchmarks do not measure

The recommended benchmark suite is:

| Layer | Benchmark | Role |
|---|---|---|
| Public execution benchmark | scBench public canonical evals | Main public single-cell execution test |
| Public generalization benchmark | SpatialBench representative evals | Spatial transcriptomics transfer test |
| QDD-specific benchmark | Custom QDD benchmark | Main test of question evolution and research governance |
| Optional external anchor | LAB-Bench DbQA/SeqQA | Comparison anchor against Biomni and database/sequence QA agents |

## Recommended Plan

Use three benchmark tracks:

| Track | What to run | Comparison target | Claim supported |
|---|---|---|---|
| scBench public subset | All 6 public canonical evals | base LLMs, general coding agents, mini-swe-agent style baselines | The agent can execute real single-cell analysis tasks |
| SpatialBench sample | 6-10 fixed representative evals | same model/agent stack used for scBench | The agent can generalize from scRNA-seq to spatial transcriptomics workflows |
| Custom QDD benchmark | 8-12 multi-step studies | general agents and coding agents that can run in the same local environment | QDD improves question evolution, artifact reuse, and study closure |

Do not claim that results on the public scBench or sampled SpatialBench tasks reproduce the full leaderboard. Treat them as public, reproducible diagnostic evaluations. The main QDD claim should come from the custom benchmark.

## Benchmark Details

### scBench

Repository: <https://github.com/latchbio/scbench>

Purpose: evaluate AI agents on single-cell RNA-seq analysis.

Public status:

- Full benchmark: 195 evaluations, withheld to reduce contamination.
- Public subset: 6 canonical evals in `evals/`, covering 6 platforms and 6 task categories.
- Public results: `results/model_results.csv`, plus category/platform breakdowns.

Public canonical tasks:

| Task category | Example eval | Representative question type |
|---|---|---|
| QC | `bd_rhapsody_tnbc_panel_aware_qc` | Given a BD Rhapsody targeted-panel `.h5ad`, determine QC-retained PBMC count, median genes per PBMC, and monocyte count. |
| Dimensionality reduction | `dr_05_pca_preprocessing_sentinels` | Run preprocessing/PCA and recover expected dimensionality-reduction behavior under sentinel conditions. |
| Normalization | `NRM01_sparse_normalization` | Choose/apply appropriate sparse normalization and recover deterministic output values. |
| Cell typing | `T04a_endothelin_niche_sources` | Normalize, cluster, score marker panels, annotate source cell populations, and output structured answers. |
| Clustering | `tapestri_ccus_clustering_12_largest_mutant_clone` | Cluster Mission Bio Tapestri data and identify the largest mutant clone-related cluster. |
| Differential expression | `DE01_pseudobulk_de` | Perform donor-aware pseudobulk differential expression rather than treating cells as independent samples. |

What it measures:

- AnnData handling
- Scanpy-style analysis workflows
- QC decisions
- clustering and dimensionality reduction
- marker-based cell typing
- pseudobulk/statistical design
- structured output to `eval_answer.json`

Why it fits QDD:

- It is close to the target domain: exploratory single-cell bioinformatics.
- It requires empirical data interaction rather than static QA.
- It is small enough to use as an initial public test before scaling.

Important limitation:

- The public 6-task subset is not enough for a strong statistical headline result. Use it as a reproducible diagnostic subset unless full benchmark access/submission is available.

Latest public model results from `results/model_results.csv`:

| Model + harness | Accuracy (%) | N |
|---|---:|---:|
| `gpt-5.5 + mini-swe-agent` | 57.95 | 195 |
| `gpt-5.5 + openai-codex` | 57.78 | 195 |
| `gpt-5.4 + mini-swe-agent` | 57.44 | 195 |
| `claude-opus-4-7 + mini-swe-agent` | 55.21 | 195 |
| `claude-opus-4-7 + claude-code` | 54.02 | 195 |
| `gemini-3.1-pro-preview + mini-swe-agent` | 53.85 | 195 |

These are full benchmark leaderboard numbers from the repository, not numbers that can be independently reproduced using only the 6 public evals.

### SpatialBench

Repository: <https://github.com/latchbio/spatialbench>

Purpose: evaluate AI agents on real-world spatial transcriptomics workflows.

Public status:

- Full benchmark: 159 evaluations, withheld to reduce contamination.
- Public subset: representative sample in `example_evals/`.
- Public trajectories and human verification notes are available for reviewed evaluations.
- Public results: `results/model_results.csv`, plus category/platform breakdowns.

Recommended sample strategy:

- Use a fixed, stratified sample rather than pure random sampling.
- Include at least one task from each major category that matters to the paper narrative.
- Record the exact task IDs in the report to avoid cherry-picking concerns.

Suggested categories:

| Task category | Why include it |
|---|---|
| QC | tests data inspection and basic quality reasoning |
| Cell typing | tests marker interpretation and spatial cell-type identification |
| Differential expression | tests statistical workflow selection |
| Spatial analysis | tests domain-specific spatial reasoning beyond ordinary scRNA-seq |
| Normalization or dimensionality reduction | tests preprocessing and representation choices |

Representative public question shapes:

| Example type | Representative question |
|---|---|
| Xenium kidney spatial composition | Determine which condition/timepoint shows expansion of a neighborhood, compare neighborhood composition to whole-tissue background, and output numeric enrichment/proportion fields. |
| Spatial differential expression | Identify genes or gene families showing spatial or condition-specific expression changes under a deterministic grader. |
| Cell typing | Resolve spatial cell populations using marker behavior and output labels/counts/sets. |
| QC | Detect quality issues such as doublets, probe/assay artifacts, or platform-specific preprocessing pitfalls. |

What it measures:

- spatial transcriptomics data handling
- niche/composition analysis
- spatial cell typing
- spatial differential expression
- platform-specific reasoning across Xenium, Visium, Vizgen/MERFISH, Curio, AtlasXOmics

Important limitation:

- If the current QDD agent has strong single-cell skills but weak spatial-specific skills, SpatialBench may reveal missing execution capabilities. Use it as a secondary generalization test, not the main claim at first.

Latest public model results from `results/model_results.csv`:

| Model + harness | Accuracy (%) | N |
|---|---:|---:|
| `gpt-5.5 + mini-swe-agent` | 57.65 | 159 |
| `gpt-5.4 + mini-swe-agent` | 57.44 | 159 |
| `gpt-5.5 + openai-codex` | 53.67 | 159 |
| `claude-opus-4-6 + mini-swe-agent` | 52.83 | 159 |
| `claude-opus-4-7 + mini-swe-agent` | 52.41 | 159 |
| `gemini-3.1-pro-preview + mini-swe-agent` | 51.57 | 159 |

### LAB-Bench

Repository: <https://github.com/Future-House/LAB-Bench>

Purpose: benchmark foundational biology research capabilities, including literature QA, database QA, protocol troubleshooting, sequence manipulation, figures, tables, and cloning.

Public status:

- Public repository contains approximately 80% of the full dataset.
- 20% private test subset is withheld to monitor contamination.
- Official harness exists.
- Tasks are generally multiple-choice and easy to score.

Recommended usage:

- Use only as a supplemental anchor.
- Prioritize `DbQA` and `SeqQA` if comparing with Biomni.
- Do not use LAB-Bench as the main QDD benchmark because it mostly measures task-level QA, retrieval, and sequence manipulation rather than long-horizon question evolution.

Representative question types:

| Subtask | Representative question |
|---|---|
| `DbQA` | Which gene is associated with a disease in DisGeNet but not OMIM? |
| `DbQA` | Which gene is located at a specified cytoband according to a specified Ensembl release? |
| `DbQA` | Which gene belongs to a specified MSigDB, MouseMine, GTRD, miRDB, ClinVar, or P-HIPSTer-derived set? |
| `SeqQA` | Given primers and a DNA template, determine PCR amplicon length. |
| `SeqQA` | Given a DNA sequence, identify an ORF or translated product. |
| `ProtocolQA` | Given a biology protocol and a failure mode, select the likely correction. |
| `LitQA2` | Answer a literature-derived biology question with multiple-choice options. |

Published Biomni anchor results:

| Benchmark | Result |
|---|---:|
| `Biomni on LAB-Bench DbQA` | 74.4% |
| `Biomni on LAB-Bench SeqQA` | 81.9% |
| `Human expert on DbQA` | 74.7% |
| `ReAct+Code on DbQA` | 40.8% |

Biomni reports these on a representative 12.5% subset due to API cost constraints. Treat the numbers as external paper anchors, not a directly identical setup unless the same subset is available.

### BixBench

Repository: <https://github.com/Future-House/BixBench>

Purpose: evaluate bioinformatics agents on notebook/code execution tasks derived from real analyses.

Current recommendation:

- Deprioritize for now.
- It is conceptually aligned with agentic bioinformatics, but the most convenient public baseline files mostly cover older frontier baselines such as `gpt-4o` and `claude-3-5-sonnet-latest`.
- Use later if the evaluation needs a broader notebook-style bioinformatics benchmark.

### CellBench

Repository: <https://github.com/zou-group/CellVoyager>

Purpose: evaluate whether an agent can predict analyses performed in published scRNA-seq papers from paper background sections.

Current recommendation:

- Use as related-work context, not as a main benchmark.
- It is closely associated with CellVoyager and less clean as a public comparison suite.
- The public headline result is that CellVoyager outperforms GPT-4o and o3-mini by up to 23% on 76 published scRNA-seq studies, but the scoring setup is less convenient for independent reproducible comparison than scBench/SpatialBench/LAB-Bench.

## Custom QDD Benchmark

Public benchmarks mostly measure whether an agent can answer or execute a task. They do not directly measure the central QDD claims:

- question evolution
- evidence-grounded pivoting
- artifact reuse
- boundary reduction
- study closure quality
- auditable research state

Build a custom benchmark with 8-12 multi-step studies.

Each study should include:

| Component | Requirement |
|---|---|
| Initial question | A bounded but imperfect research question |
| Data/context | Local data, paper summary, prior artifact, or synthetic project context |
| Required task outputs | At least one concrete data/code/report artifact |
| Expected question delta | Whether the question should be refined, confirmed, pivoted, or dissolved |
| Reuse opportunity | A prior artifact or context item that a good agent should reuse |
| Hidden pitfall | A batch effect, missing covariate, insufficient sample size, wrong normalization assumption, or ambiguous marker interpretation |
| Scoring rubric | Deterministic checks where possible plus blind human review for scientific judgment |

Suggested scoring dimensions:

| Dimension | Score target |
|---|---|
| Task success | Did the agent produce the requested artifact correctly? |
| Evidence grounding | Did claims cite outputs, statistics, or inspected artifacts? |
| Question delta quality | Did the final question change in the right direction? |
| Artifact reuse | Did the agent reuse available prior outputs rather than regenerating or ignoring them? |
| Boundary handling | Did the agent identify what remains unresolved? |
| Reproducibility | Are code, outputs, and decisions auditable? |

Recommended comparison agents:

| Agent type | Role |
|---|---|
| Base LLM with tool/code access | lower-bound general reasoning baseline |
| General coding agent | execution-capable baseline |
| mini-swe-agent style setup | comparable to scBench/SpatialBench public harness |
| Bio agent if runnable without private assets | optional domain-agent baseline |
| QDD agent | target system |

Avoid relying on private databases, hidden skills, or unpublished agent internals in the custom benchmark. The comparison should be runnable in the same local environment for all agents.

## Reporting Strategy

Use the following framing:

| Section | Claim |
|---|---|
| Public diagnostic evaluation | QDD can execute real single-cell and spatial analysis tasks on public deterministic graders. |
| Public leaderboard context | Recent frontier model/harness performance on full scBench and SpatialBench is around 50-58% accuracy, based on official result files. |
| Biomni anchor | LAB-Bench DbQA/SeqQA provides a public external anchor for biomedical database/sequence QA. |
| QDD benchmark | QDD improves the research-process layer: better question updates, artifact reuse, evidence-grounded closure, and auditable state. |

Important wording:

- Say "public subset" or "representative sample" for scBench/SpatialBench runs unless full benchmark access is obtained.
- Do not claim full leaderboard comparability from the 6 public scBench evals.
- Do not compare only model names; compare `model + harness`.
- For SpatialBench sampling, publish the fixed task list and sampling rule.
- Use the custom QDD benchmark for the core novelty claim.

## Immediate Execution Checklist

1. Clone and install `scBench`.
2. Run all 6 public canonical evals with the target QDD agent.
3. Run the same 6 evals with one or two general baselines.
4. Clone and install `SpatialBench`.
5. Select 6-10 fixed representative evals across categories.
6. Run QDD and the same baselines on the selected SpatialBench tasks.
7. Optionally run LAB-Bench `DbQA` and `SeqQA` public subsets for Biomni-related context.
8. Design 8-12 custom QDD benchmark studies.
9. Freeze all task IDs, prompts, data paths, environment versions, and scoring scripts.
10. Report public benchmark results separately from QDD-specific benchmark results.

## Suggested First Task Lists

scBench:

- `evals/qc/bd_rhapsody_tnbc_panel_aware_qc.json`
- `evals/dimensionality_reduction/dr_05_pca_preprocessing_sentinels.json`
- `evals/normalization/NRM01_sparse_normalization.json`
- `evals/cell_typing/T04a_endothelin_niche_sources.json`
- `evals/clustering/tapestri_ccus_clustering_12_largest_mutant_clone.json`
- `evals/differential_expression/DE01_pseudobulk_de.json`

SpatialBench:

- Select from `example_evals/`.
- Include at least QC, cell typing, differential expression, spatial analysis, and one preprocessing-oriented task.
- Record exact chosen IDs before running models.

LAB-Bench optional:

- `DbQA`
- `SeqQA`

## Source Links

- scBench: <https://github.com/latchbio/scbench>
- scBench results: <https://github.com/latchbio/scbench/blob/main/results/model_results.csv>
- SpatialBench: <https://github.com/latchbio/spatialbench>
- SpatialBench results: <https://github.com/latchbio/spatialbench/blob/main/results/model_results.csv>
- SpatialBench methods: <https://github.com/latchbio/spatialbench/blob/main/METHODS.md>
- LAB-Bench: <https://github.com/Future-House/LAB-Bench>
- BixBench: <https://github.com/Future-House/BixBench>
- CellVoyager/CellBench: <https://github.com/zou-group/CellVoyager>
- Biomni: <https://github.com/snap-stanford/Biomni>
- Biomni paper: <https://biomni.stanford.edu/paper.pdf>
