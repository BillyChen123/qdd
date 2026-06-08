---
name: singlecell/scatac/scatac-batch-latent
description: Problem-level scATAC latent-space diagnosis and optional batch correction skill. Use when a task must validate or rebuild an LSI-based ATAC manifold before clustering and annotation.
domain: singlecell
stage: integration
tags:
  - scatac
  - batch
---

# singlecell/scatac/scatac-batch-latent

## 入口

- script: `scripts/scatac_batch_latent.py`
- params: `parameters.yaml`
- environment: `qdd-skill-core`

## 什么时候用

- 已经有 peak-oriented `AnnData`
- 需要判断多样本 ATAC 是否存在明显 batch 结构
- 需要在 downstream annotation / DAR 前建立图结构、Leiden cluster 和 UMAP
- 需要选择“不校正，只诊断”还是“在 LSI 上做轻量校正”

## 支持方法

- `none`: 不做 batch correction，只用当前 LSI 建图、聚类和 UMAP，适合诊断
- `harmony`: 在 `X_lsi` 上做 Harmony，再建图和聚类

## 关键参数

- `--batch-key`
- `--method none|harmony`
- `--use-rep auto|X_lsi|X_lsi_harmony`
- `--n-components`
- `--n-neighbors`
- `--leiden-resolution`
- `--cluster-key`
- `--umap-min-dist`
- `--random-state`

## 示例

```bash
conda run -n qdd-skill-core python \
  domain-skills/singlecell/scatac/scatac-batch-latent/scripts/scatac_batch_latent.py \
  --input outputs/scatac_preprocess/processed.h5ad \
  --output outputs/scatac_batch \
  --batch-key sample_id \
  --method harmony
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

## 注意事项

- `method none` 不是失败路径，而是有意保留 batch 结构用于判断
- 如果输入没有 `X_lsi`，脚本会尝试从当前 peak matrix 重建一个轻量 LSI
- 这个 skill 会顺带给出 cluster 和 UMAP，因为在 ATAC 里 latent 诊断通常离不开图结构
- 这条路径仍是 matrix-first，不应被表述为完整 fragment-native integration
