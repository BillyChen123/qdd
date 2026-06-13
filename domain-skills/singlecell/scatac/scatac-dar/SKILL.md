---
name: singlecell/scatac/scatac-dar
description: Problem-level scATAC differential accessibility skill for matrix-style h5ad objects. Use when a task must compare ATAC accessibility across clusters or conditions with explicit contrast definitions and reusable result tables.
domain: singlecell
stage: downstream
tags:
  - scatac
  - de
---

# singlecell/scatac/scatac-dar

## 入口

- script: `scripts/scatac_dar.py`
- params: `parameters.yaml`
- environment: project-configured Python environment (packaged example env `qdd-skill-core` is optional)

## 什么时候用

- 已有稳定 cluster、condition 或 cohort 分组
- 需要对 peak accessibility 做组间比较
- 需要输出可复用的 ranking 表格，而不是只在 notebook 里看一眼

## 支持范围

- 全对象 `groupby` 比较
- 先按 `subset-key` / `subset-value` 限定一个 cluster 或亚群，再做 condition-level DAR
- `wilcoxon`、`t-test` 或 `logreg` 的 Scanpy ranking 路径

## 关键参数

- `--groupby`
- `--reference`
- `--subset-key`
- `--subset-value`
- `--method wilcoxon|t-test|logreg`
- `--n-features`
- `--min-pct`
- `--use-binary`

## 示例

```bash
python \
  domain-skills/singlecell/scatac/scatac-dar/scripts/scatac_dar.py \
  --input outputs/scatac_annotation/annotated.h5ad \
  --output outputs/scatac_dar \
  --groupby disease \
  --subset-key leiden \
  --subset-value 3 \
  --method wilcoxon
```

## 输出

- `ranked.h5ad`
- `report.md`
- `result.json`
- `tables/dar_rankings.csv`
- `tables/dar_summary.csv`
- `figures/top_dar_heatmap.png`

## 注意事项

- 这个 skill 适合 matrix-first 的 differential accessibility，不要把它包装成完整 regulatory inference
- upstream cluster 或 condition 边界不稳时，不要急着做 DAR
- `use-binary` 对很多 ATAC matrix 更稳，但不是强制唯一选择
