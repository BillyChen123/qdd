---
name: plot/scanpy-embedding-panels
description: Create reviewable Scanpy embedding panels such as UMAP/tSNE colored by cluster, annotation, condition, or score. Use when a task needs visual evidence for cell structure, label quality, or condition shifts.
---

# plot/scanpy-embedding-panels

这个 skill 约束单细胞 embedding 图怎么出，避免只留下随手截图。

## 什么时候用

- 需要展示 cluster 结构
- 需要展示 cell type 注释结果
- 需要比较 condition / sample / score 在 embedding 上的分布

## 默认图型

优先考虑这些 panel：

1. `cluster`
2. `cell_type` 或候选注释
3. `sample` / `batch`
4. `condition`
5. 关键 score 或 marker 单基因表达

## 输出要求

- 主图放在 `studies/STUDY-XXX/output/figures/`
- 文件名应表达内容，例如：
  - `umap_leiden_r05.png`
  - `umap_celltype_annotation.png`
  - `umap_condition_split.png`
- 如果图将进入汇报或论文，额外导出一个矢量版本或高分辨率版本

## 最低 QA

- 颜色映射前后一致，不要同一标签在不同图里频繁换色
- 标题说明清楚分组变量
- 图例可读，不遮挡主体
- 点大小与透明度适中，避免密集区域糊成一片
- 不要把 batch 驱动的分离误说成生物分群

## 推荐实现

```python
sc.pl.umap(
    adata,
    color=["leiden_r05", "cell_type", "condition"],
    wspace=0.4,
    save="_multi_panel.png",
    show=False,
)
```

如果内置输出不够清楚，可以先导出 embedding 坐标和元数据，再走更定制的作图流程。

## 什么时候不该单靠 embedding 下结论

- 只凭 UMAP 空间接近就推断谱系或机制
- 只凭视觉分离就认定 cluster 合法
- 忽略 marker、metadata、QC 指标

embedding 是证据面板，不是真相本身。

## 参考来源

- Scanpy plotting docs: https://scanpy.readthedocs.io/
- Single-cell best practices on visualization and interpretation: https://www.sc-best-practices.org/
