---
name: singlecell/scrna/sc-preprocess-qc
description: Problem-level single-cell preprocessing and QC skill for h5ad/AnnData studies. Use when a task must determine data state, quality-control logic, and whether standard Scanpy preprocessing should be run.
domain: singlecell
stage: preprocess
tags:
  - scanpy
  - anndata
  - h5ad
  - raw-counts
  - qc
  - normalization
---

# singlecell/scrna/sc-preprocess-qc

这个 skill 对应的问题不是“怎么调用某个 API”，而是：

> 这份单细胞对象现在是什么状态，是否需要标准预处理与 QC？

## 什么时候用

- 输入是 `h5ad` / `AnnData`
- 需要判断 `.X`、`layers`、`raw` 的状态
- 需要决定是否做过滤、归一化、log1p、HVG

## 任务目标

- 明确对象当前状态
- 明确是否应从 raw counts 开始
- 给出可复查的预处理脚本和参数

## 不要做的事

- 不看对象状态就默认重复预处理
- 把已经处理过的数据再当 raw counts 重跑
- 只写结论不留脚本

## 默认检查项

1. `.X` 是否接近整数 counts
2. `adata.layers` 是否已有原始层或标准化层
3. `adata.raw` 是否存在
4. `obs` 是否已有 sample / batch / condition 信息
5. 是否需要细胞与基因过滤

## 常见实现

- `sc.pp.filter_cells`
- `sc.pp.filter_genes`
- `sc.pp.normalize_total`
- `sc.pp.log1p`
- `sc.pp.highly_variable_genes`

## 最低产出

- `output/code/` 中的可运行脚本
- `output/reports/` 中的数据状态说明
- 必要时给出 QC 图
