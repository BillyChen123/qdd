---
name: singlecell/scrna/sc-marker-annotation
description: Problem-level marker-based annotation skill for single-cell clusters. Use when a task must turn marker results into defensible cell-type or cell-state labels with explicit evidence.
domain: singlecell
stage: clustering
tags:
  - scrna
  - markers
---

# singlecell/scrna/sc-marker-annotation

## 入口

- script: `scripts/scrna_marker_annotation.py`
- params: `parameters.yaml`
- environment: `qdd-skill-core`

## 什么时候用

- 已有 cluster
- 需要先计算或复核 `rank_genes_groups`
- 需要把 cluster 变成可审查的注释标签

## 输入要求

- `--cluster-key`：现有 cluster 列
- `--marker-file`：TSV 或 CSV，至少包含两列：
  - `cell_type`
  - `genes`

推荐 marker 文件格式：

```text
cell_type\tgenes
T_cell\tCD3D,CD3E,IL7R
B_cell\tMS4A1,CD79A
Myeloid\tLYZ,S100A8,CTSS
```

## 关键参数

- `--method wilcoxon|t-test|logreg`
- `--n-genes`
- `--annotation-key`
- `--unknown-label`
- `--min-score`
- `--embedding-key`

## 示例

```bash
conda run -n qdd-skill-core python \
  domain-skills/singlecell/scrna/sc-marker-annotation/scripts/scrna_marker_annotation.py \
  --input outputs/clustering/processed.h5ad \
  --output outputs/annotation \
  --cluster-key leiden \
  --marker-file refs/pbmc_markers.tsv \
  --annotation-key cell_type
```

## 输出

- `annotated.h5ad`
- `report.md`
- `result.json`
- `tables/marker_rankings.csv`
- `tables/annotation_scores.csv`
- `tables/cluster_annotation_summary.csv`
- `figures/umap_by_annotation.png`
- `figures/annotation_score_heatmap.png`

## 注意事项

- 这是一个轻量的 marker-overlap annotation 基线，不是 reference mapping
- 如果 marker 证据弱，脚本会保留 `unknown`
- 这个 skill 默认基于当前对象的表达矩阵工作，不把 `.raw` 视为标准上游交接层
- 先有证据，再给标签；不要只产出口头注释
