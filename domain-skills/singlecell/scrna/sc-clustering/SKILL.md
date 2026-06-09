---
name: singlecell/scrna/sc-clustering
description: Problem-level single-cell graph construction, clustering, and embedding skill for Scanpy workflows. Use when a task must produce defensible neighborhoods, Leiden clusters, and UMAP structure.
domain: singlecell
stage: clustering
tags:
  - scrna
---

# singlecell/scrna/sc-clustering

## 入口

- script: `scripts/scrna_clustering.py`
- params: `parameters.yaml`
- environment: `qdd-skill-core`

## 什么时候用

- 预处理或整合之后需要构建 neighbor graph
- 需要生成 Leiden cluster
- 需要生成 Leiden cluster；UMAP 只在需要可视化时生成

## 方法范围

- 当前实现是标准 Scanpy 路径：
  - `sc.pp.neighbors`
  - `sc.tl.leiden`
  - `sc.tl.umap`

## 关键参数

- `--use-rep auto|X_pca|X_pca_harmony|X_scanorama|...`
- `--threads`
- `--n-pcs`
- `--n-neighbors`
- `--resolution`
- `--cluster-key`
- `--umap-min-dist`
- `--color-key`
- `--skip-umap`

## 示例

```bash
conda run -n qdd-skill-core python \
  domain-skills/singlecell/scrna/sc-clustering/scripts/scrna_clustering.py \
  --input outputs/integration/processed.h5ad \
  --output outputs/clustering \
  --use-rep X_pca_harmony \
  --resolution 0.8 \
  --color-key sample_id
```

## 输出

- `processed.h5ad`
- `report.md`
- `result.json`
- `tables/cluster_assignments.csv`
- `tables/cluster_counts.csv`
- `figures/umap_by_cluster.png`
- `figures/umap_by_color.png`（如果提供 `--color-key`）

## 注意事项

- 不要把 `k-means` 当作默认 scRNA clustering 方案
- `auto` 会优先使用已存在的集成 embedding，例如 `X_pca_harmony` 或 `X_scanorama`
- 如果没有任何 embedding，脚本会先补 PCA
- `--skip-umap` 不会改变 graph clustering 主路径，只会跳过可视化 embedding
