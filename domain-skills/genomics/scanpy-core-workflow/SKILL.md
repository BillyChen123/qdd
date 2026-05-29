---
name: genomics/scanpy-core-workflow
description: Default first-pass single-cell RNA analysis workflow for AnnData and Scanpy. Use when a task needs ordinary scRNA preprocessing review, neighbors graph construction, Leiden clustering, UMAP embedding, and marker discovery with reproducible parameter tracking.
---

# genomics/scanpy-core-workflow

这个 skill 是 QDD 在单细胞 RNA 任务里的默认主干流程。只要任务是普通的 scRNA 首轮分析，而不是特殊模型或 atlas-level pipeline，默认先走这条线。

## 什么时候用

- 输入是 `h5ad` / `AnnData`
- 任务要回答聚类、亚群、marker、条件差异的第一轮问题
- 你需要一条专业但不过度复杂的 Scanpy 默认路径

## 不要默认做的事

- 不要把 `k-means` 当成普通 scRNA 聚类默认方法
- 不要在没确认数据状态前盲目重复归一化、HVG、batch correction
- 不要只给结论不给脚本、参数和图

## 默认分析顺序

1. 明确输入对象状态
   - 是否是原始 counts
   - 是否已经做过 normalization / log1p / HVG
   - `adata.X`、`adata.layers`、`adata.raw` 分别存什么
2. 如果任务需要从原始 counts 起步，优先显式记录：
   - 过滤规则
   - `normalize_total`
   - `log1p`
   - HVG 选择
   - scaling / PCA
3. 图结构与聚类默认走：
   - `sc.pp.neighbors`
   - `sc.tl.leiden`
   - `sc.tl.umap`
4. marker 发现默认走：
   - `sc.tl.rank_genes_groups`
5. 关键结果至少落三类东西：
   - `output/code/` 脚本
   - `output/figures/` 关键 embedding 或表达图
   - `output/tables/` cluster / marker 结果表

## 最低参数透明度

每次分析至少要明确记录这些参数或决定：

- 使用的数据层：`X` / `layers[...]` / `raw`
- `n_top_genes`
- `n_pcs`
- `n_neighbors`
- `resolution`
- 随机种子
- 是否做 batch correction；如果没做，也要说明为什么

## 推荐代码骨架

```python
import scanpy as sc

adata = sc.read_h5ad("input.h5ad")

# 明确当前对象状态后，再决定是否从 counts 重做预处理
sc.pp.normalize_total(adata, target_sum=1e4)
sc.pp.log1p(adata)
sc.pp.highly_variable_genes(adata, n_top_genes=2000, subset=True)
sc.pp.scale(adata, max_value=10)
sc.tl.pca(adata, svd_solver="arpack")
sc.pp.neighbors(adata, n_neighbors=15, n_pcs=30)
sc.tl.leiden(adata, resolution=0.5, key_added="leiden_r05")
sc.tl.umap(adata)
sc.tl.rank_genes_groups(adata, groupby="leiden_r05", method="wilcoxon")
```

## 输出要求

- 脚本：`studies/STUDY-XXX/output/code/`
- 聚类或 marker 表：`studies/STUDY-XXX/output/tables/`
- UMAP / QC 图：`studies/STUDY-XXX/output/figures/`
- 如果结果值得复用，再登记到 `artifact-candidates.yaml`

## 结果审查要点

- cluster 数量是否与分辨率和数据规模大致相称
- 是否出现明显技术批次驱动而被误读成生物群体
- marker 是否真能支持 cluster 解释
- 是否给出了能复查的参数和脚本

## 何时切换到别的技能

- 如果任务重点是 cluster 注释，而不是主干聚类流程，叠加 `genomics/scanpy-marker-annotation`
- 如果任务重点是出图，叠加 `plot/scanpy-embedding-panels` 或 `plot/scanpy-expression-panels`

## 参考来源

- Scanpy API and tutorials: https://scanpy.readthedocs.io/
- AnnData documentation: https://anndata.readthedocs.io/
- Single-cell best practices: https://www.sc-best-practices.org/
