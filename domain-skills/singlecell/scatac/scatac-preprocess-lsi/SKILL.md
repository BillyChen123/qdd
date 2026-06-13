---
name: singlecell/scatac/scatac-preprocess-lsi
description: Problem-level scATAC preprocessing, mixed-feature repair, and TF-IDF/LSI skill for h5ad/AnnData studies. Use when a task must turn an ATAC-like h5ad into a clean peak-oriented object with explicit matrix semantics and a reusable latent representation.
domain: singlecell
stage: preprocess
tags:
  - scatac
  - qc
---

# singlecell/scatac/scatac-preprocess-lsi

## 入口

- script: `scripts/scatac_preprocess_lsi.py`
- params: `parameters.yaml`
- environment: project-configured Python environment (packaged example env `qdd-skill-core` is optional)

## 什么时候用

- 输入是 scATAC 或 multiome-ATAC 风格的 `h5ad` / `AnnData`
- 需要先判断对象是纯 peak matrix 还是 mixed RNA+ATAC matrix
- 需要把对象修到可用于 downstream clustering 的 `peak-oriented h5ad`
- 需要生成 TF-IDF / LSI 作为后续 integration 或 clustering 的起点

## 支持模式

- `auto`: 自动判断 feature 语义，必要时拆分 mixed multiome，再生成基础 QC 与 LSI
- `repair`: 强制按 repair 路径执行，适合 feature_type 混乱或 mixed object
- `inspect`: 只做结构检查与报告，不主动过滤或重建 latent space

## 关键参数

- `--feature-type-column`
- `--peak-label`
- `--gene-label`
- `--peak-source auto|feature_type|regex`
- `--min-features-per-cell`
- `--min-cells-per-feature`
- `--max-features-per-cell`
- `--binarize`
- `--n-components`
- `--random-state`

## 示例

```bash
python \
  domain-skills/singlecell/scatac/scatac-preprocess-lsi/scripts/scatac_preprocess_lsi.py \
  --input data/input_atac.h5ad \
  --output outputs/scatac_preprocess \
  --mode auto \
  --binarize
```

## 输出

- `processed.h5ad`
- `report.md`
- `result.json`
- `tables/feature_summary.csv`
- `tables/cell_qc_metrics.csv`
- `tables/selected_features.csv`
- `figures/cell_accessibility_histograms.png`
- `figures/feature_class_breakdown.png`

## 注意事项

- 这个 skill 的首要职责是把对象修成可信的 ATAC matrix，不是直接给出最终注释
- mixed multiome 输入必须先处理 feature 语义，不能直接把所有列当 peak
- 这条路径是 `h5ad-first` 的 matrix 路线，不等价于完整 fragment-native QC
- 输出里的 `X_lsi` 是后续 batch / clustering / annotation 的默认起点
