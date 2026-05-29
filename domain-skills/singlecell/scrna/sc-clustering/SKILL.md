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

这个 skill 对应的问题是：

> 如何用专业、可复查的方式完成单细胞聚类与 embedding？

## 什么时候用

- 预处理或整合之后需要构建图和 cluster
- 需要为后续 marker / annotation / comparison 提供 cluster 基础

## 默认路径

- `sc.pp.neighbors`
- `sc.tl.leiden`
- `sc.tl.umap`

## 不要做的事

- 把 `k-means` 当成普通 scRNA clustering 默认方案
- 只给一个分辨率，不解释为什么
- 没有图和参数记录

## 最低产出

- 聚类脚本
- 至少一张 cluster UMAP
- 关键参数说明：`n_pcs`、`n_neighbors`、`resolution`
