---
name: singlecell/scrna/sc-marker-annotation
description: Problem-level marker-based annotation skill for single-cell clusters. Use when a task must turn marker results into defensible cell-type or cell-state labels with explicit evidence.
domain: singlecell
stage: annotation
tags:
  - scanpy
  - markers
  - marker-based
  - cell-type
  - cell-state
---

# singlecell/scrna/sc-marker-annotation

这个 skill 对应的问题是：

> 如何把 marker 结果变成可审查的 cluster 注释，而不是口头标签？

## 什么时候用

- 已有 cluster
- 已有 `rank_genes_groups` 或等价 marker 结果
- 需要给 cluster 写 cell type / state 注释

## 核心要求

1. 先给证据，再给标签
2. 不确定时保留 `ambiguous` / `unknown`
3. 结合项目里的生物背景

## 最低产出

- 一张注释结果图
- 一个可复查的 marker / annotation 表
- 说明支持与冲突证据
