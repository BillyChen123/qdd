---
name: singlecell/scrna/sc-clustering
description: Problem-level single-cell graph construction, clustering, and embedding skill for Scanpy workflows. Use when a task must produce defensible neighborhoods, Leiden clusters, and UMAP structure.
domain: singlecell
stage: clustering
tags:
  - scanpy
  - anndata
  - neighbors
  - leiden
  - umap
---

# singlecell/scrna/sc-clustering

## 入口

- script: `scripts/scrna_clustering.py`
- params: `parameters.yaml`
- environment: `CellFM_torch`

## 什么时候用

- 预处理或整合之后需要构建 neighbor graph
- 需要生成 Leiden cluster
- 需要 UMAP 供 marker / annotation / comparison 使用

## 方法范围

- 当前实现是标准 Scanpy 路径：
  - `sc.pp.neighbors`
  - `sc.tl.leiden`
  - `sc.tl.umap`

## 关键参数

- `--use-rep auto|X_pca|X_pca_harmony|X_scanorama|...`
- `--n-pcs`
- `--n-neighbors`
- `--resolution`
- `--cluster-key`
- `--umap-min-dist`
- `--color-key`

## 示例

```bash
conda run -n CellFM_torch python \
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
