---
name: singlecell/scrna/sc-preprocess-qc
description: Problem-level single-cell preprocessing and QC skill for h5ad/AnnData studies. Use when a task must determine data state, quality-control logic, and whether standard Scanpy preprocessing should be run.
domain: singlecell
stage: preprocess
tags:
  - scrna
  - qc
---

# singlecell/scrna/sc-preprocess-qc

## 入口

- script: `scripts/scrna_preprocess_qc.py`
- params: `parameters.yaml`
- environment: `qdd-skill-core`

## 什么时候用

- 输入是 `h5ad` / `AnnData`
- 需要判断 `.X`、`layers`、`raw` 的状态
- 需要决定是否做过滤、归一化、`log1p`、HVG、PCA

## 支持模式

- `auto`: 自动判断当前矩阵是否像 raw counts，只在合理时执行 count-based preprocessing
- `force`: 把指定层强制当作 counts 重跑
- `inspect`: 只做状态检查和 QC 汇总，不改矩阵

## 关键参数

- `--counts-layer auto|X|<layer>`
- `--min-genes`
- `--min-cells`
- `--max-mt-pct`
- `--target-sum`
- `--hvg-flavor`
- `--n-top-genes`
- `--batch-key`
- `--run-scale`
- `--scale-max-value`
- `--n-pcs`

## 示例

```bash
conda run -n qdd-skill-core python \
  domain-skills/singlecell/scrna/sc-preprocess-qc/scripts/scrna_preprocess_qc.py \
  --input data/input.h5ad \
  --output outputs/preprocess_qc \
  --mode auto \
  --batch-key sample_id
```

## 输出

- `processed.h5ad`
- `report.md`
- `result.json`
- `tables/qc_metrics_obs.csv`
- `tables/qc_metrics_var.csv`
- `tables/highly_variable_genes.csv`（如果执行了 HVG）
- `figures/qc_histograms.png`
- `figures/mt_scatter.png`

## 注意事项

- 不看对象状态就重复预处理是错误的
- 如果对象已经 log-normalized，`auto` 模式通常不会重跑 counts-based preprocessing
- 如果执行了 `log1p`，脚本会在 HVG 截断和 scaling 之前保留 `.raw`，方便后续 marker 分析
- 默认不进行 `scale`，只有在后续 PCA 检查提示存在明显 technical signal 时，才考虑回到 preprocess 再补这一步
- `regress_out` 不是默认步骤；只有在具体对象和分析目标都明确支持时才考虑
- 这个脚本默认不做 neighbors / clustering；它的职责是把对象预处理到可下游分析的状态
