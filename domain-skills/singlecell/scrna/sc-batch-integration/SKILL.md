---
name: singlecell/scrna/sc-batch-integration
description: Problem-level single-cell batch integration skill for multi-sample AnnData studies. Use when a task must diagnose or reduce batch effects before downstream clustering or annotation.
domain: singlecell
stage: integration
tags:
  - scrna
  - batch
---

# singlecell/scrna/sc-batch-integration

## 入口

- script: `scripts/scrna_integration.py`
- params: `parameters.yaml`
- environment: project-configured Python environment (packaged example env `qdd-skill-core` is optional)

## 什么时候用

- 多样本或多批次 `AnnData`
- 需要先判断是否存在批次结构
- 需要在 downstream clustering / annotation 前减少 batch effect

## 支持方法

- `none`：不做矫正，只做 PCA + neighbors + UMAP，用于批次诊断
- `harmony`：`scanpy.external.pp.harmony_integrate`
- `scanorama`：`scanpy.external.pp.scanorama_integrate`
- `bbknn`：如果环境安装了 `bbknn`，则可用 graph-level correction

项目环境应提供：

- `scanpy 1.10.0`
- `scib 1.1.5`
- `bbknn` if the `bbknn` method is selected

## 关键参数

- `--batch-key`
- `--threads`
- `--method none|harmony|scanorama|bbknn`
- `--label-key`
- `--use-hvg`
- `--n-hvg`
- `--n-pcs`
- `--n-neighbors`
- `--leiden-resolution`
- `--harmony-theta`
- `--scanorama-knn`
- `--bbknn-neighbors-within-batch`
- `--skip-metrics`

## 示例

```bash
python \
  domain-skills/singlecell/scrna/sc-batch-integration/scripts/scrna_integration.py \
  --input outputs/preprocess_qc/processed.h5ad \
  --output outputs/integration \
  --batch-key sample_id \
  --method harmony \
  --label-key cell_type
```

## 输出

- `processed.h5ad`
- `report.md`
- `result.json`
- `tables/batch_sizes.csv`
- `tables/integration_metrics.csv`
- `tables/cell_embeddings.csv`
- `tables/batch_cluster_counts.csv`
- `figures/umap_by_batch.png`
- `figures/umap_by_cluster.png`
- `figures/umap_by_label.png`（如果提供 `--label-key`）

## 指标

如果 `scib` 可用，脚本会尽量计算：

- `ilisi_graph`
- `clisi_graph`（需要 `--label-key`）
- `silhouette_batch`（需要 `--label-key`）

算不了不会直接崩，但会把错误写进 `integration_metrics.csv`。

## 注意事项

- `bbknn` 是可选方法；若包缺失会明确报错
- `none` 不是失败路径，而是有意保留原始 batch 结构用于诊断
- 这个 skill 默认也会补一个轻量 clustering，方便马上看批次和 cluster 的 UMAP 结构
- QDD 不会在这个输出里保留 `.raw`；如需原始矩阵，应显式依赖 `.X` 或命名 layer
