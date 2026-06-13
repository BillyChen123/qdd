---
name: singlecell/scatac/scatac-annotation-geneactivity
description: Problem-level scATAC annotation skill for turning ATAC clusters into auditable labels from gene-linked features, marker peaks, or trusted paired labels. Use when a task must attach explicit annotation evidence instead of informal cluster naming.
domain: singlecell
stage: clustering
tags:
  - scatac
  - markers
---

# singlecell/scatac/scatac-annotation-geneactivity

## 入口

- script: `scripts/scatac_annotation_geneactivity.py`
- params: `parameters.yaml`
- environment: project-configured Python environment (packaged example env `qdd-skill-core` is optional)

## 什么时候用

- 已有 cluster
- 需要把 ATAC cluster 转成可审查的 label
- 需要结合 marker peaks、gene-linked feature 列、或可信的 paired labels
- 需要把“标签是怎么来的”写清楚，而不是只留口头判断

## 支持证据来源

- `--marker-file`: marker peak 或 gene marker 文件
- `--feature-column`: 当 marker 是 gene 名时，用于把 peak feature 映射到 gene-linked 列
- `--existing-label-key`: 如果对象已经有可信标签，可做 cluster-level majority vote

## 关键参数

- `--cluster-key`
- `--marker-file`
- `--marker-mode auto|peak|gene`
- `--feature-column`
- `--existing-label-key`
- `--annotation-key`
- `--unknown-label`
- `--min-marker-score`
- `--min-label-purity`

## 示例

```bash
python \
  domain-skills/singlecell/scatac/scatac-annotation-geneactivity/scripts/scatac_annotation_geneactivity.py \
  --input outputs/scatac_batch/processed.h5ad \
  --output outputs/scatac_annotation \
  --cluster-key leiden \
  --marker-file refs/atac_markers.tsv \
  --marker-mode peak \
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

- 这不是完整 reference mapping，也不是 fragment-native gene activity 推断平台
- 如果没有 marker 文件，也没有可信 existing labels，脚本会拒绝假装注释成功
- 如果证据弱，脚本会保留 `unknown`
- 先有 cluster-level 证据，再有 cell type 名字
