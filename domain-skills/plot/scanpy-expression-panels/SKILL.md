---
name: plot/scanpy-expression-panels
description: Build marker-expression evidence panels for Scanpy studies, including dotplot, heatmap, matrixplot, stacked violin, or related grouped summaries. Use when a task must justify annotation or differential claims with interpretable marker views.
---

# plot/scanpy-expression-panels

这个 skill 约束 marker 表达证据图，不让“marker 结论”只停留在表格里。

## 什么时候用

- 需要支持 cluster annotation
- 需要展示 marker 在不同 cluster / cell type / condition 的模式
- 需要把 DEG 结果变成能快速审查的图

## 图型选择原则

- `dotplot`：适合多 cluster x 多 marker 的概览
- `heatmap`：适合展示相对表达梯度和 block 结构
- `matrixplot`：适合更紧凑的 grouped summary
- `stacked_violin` / `violin`：适合检查少量关键 marker 的分布形态

不要一个任务里把所有图型都堆满。按判断需要选最能支持结论的 1-2 组图。

## 面板设计原则

- marker 集合要短而有解释力
- 同一张图里不要混入过多无关基因
- 分组变量要明确，比如 `leiden_r05`、`cell_type`、`condition`
- 如果是注释任务，优先围绕支持和冲突 marker 组织图

## 推荐输出

- 一张 overview 图，例如 dotplot 或 matrixplot
- 一张补充图，例如 heatmap 或 violin
- 一份 marker 列表文本或表格，说明为什么选这些基因

## 推荐实现

```python
sc.pl.dotplot(
    adata,
    var_names=["EPCAM", "KRT14", "KRT10", "MKI67"],
    groupby="leiden_r05",
    show=False,
)

sc.pl.matrixplot(
    adata,
    var_names=["CXCR6", "ITGAE", "ZNF683"],
    groupby="cell_type",
    show=False,
)
```

## QA 清单

- 字体和标签能读清
- 基因顺序有生物学或叙事逻辑
- 分组顺序清楚，不混乱跳变
- 图和 study 结论是一一对应的，而不是“随便出几张 marker 图”

## 常见坏做法

- 用几十上百个基因把图塞满
- 图里没有分组上下文
- 只展示支持 marker，不展示冲突 marker
- 把明显低表达噪声也包装成结论

## 参考来源

- Scanpy plotting docs: https://scanpy.readthedocs.io/
- Single-cell best practices on visualization and marker interpretation: https://www.sc-best-practices.org/
