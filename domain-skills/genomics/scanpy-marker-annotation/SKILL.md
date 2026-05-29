---
name: genomics/scanpy-marker-annotation
description: Manual marker-based cluster annotation guidance for Scanpy studies. Use when a task needs defensible cluster-to-cell-type labeling, ambiguity handling, and explicit evidence tables rather than just raw marker lists.
---

# genomics/scanpy-marker-annotation

这个 skill 用于把 cluster marker 变成可审查的细胞类型注释，而不是停留在“看起来像某种细胞”的口头判断。

## 什么时候用

- 已经有 cluster 结果
- 已经有 `rank_genes_groups` 或等价 marker 结果
- 需要把 cluster 注释成 cell type / state / program

## 核心原则

1. 先给证据，再给标签
2. 不确定时保留 `unknown` / `ambiguous` / `mixed`
3. 不要只凭一个 marker 就下强结论
4. 结合 `context/resources.md` 里的生物背景，而不是脱离项目语境乱贴标签

## 标准流程

1. 读取 cluster marker 结果
2. 对每个 cluster 提炼一组核心 marker，而不是机械抄整张表
3. 对照已知 marker 组合做人工判断
4. 明确记录：
   - 候选标签
   - 支持基因
   - 冲突基因
   - 置信度
   - 是否需要后续验证

## 推荐产出

至少落一个可复查的注释表，例如：

```text
cluster,label,confidence,supporting_markers,conflicting_markers,notes
0,TRM,high,ITGAE|CXCR6|ZNF683,,consistent with tissue-resident program
1,ambiguous_T_NK,low,NKG7|TRAC,KLRD1 and T-cell markers mixed,needs follow-up
```

## 推荐配套图

- embedding 上色：cluster / candidate label / condition
- marker 表达图：dotplot / heatmap / matrixplot / violin

这些图通常由 `plot/scanpy-embedding-panels` 和 `plot/scanpy-expression-panels` 负责。

## 不要做的事

- 不要把自动标签当最终真相
- 不要忽略双细胞、低质量群、批次群
- 不要把功能状态误写成稳定 cell type，除非证据足够

## 什么时候判为“不足以注释”

出现这些情况时，不要硬贴标签：

- marker 很弱或互相冲突
- cluster 明显受技术因素支配
- 不同候选标签证据接近
- 项目背景知识无法支持更细解释

这时应明确写成待验证结论，并把后续需求写回 study/task。

## 参考来源

- Scanpy marker ranking and plotting docs: https://scanpy.readthedocs.io/
- Single-cell best practices on annotation and interpretation: https://www.sc-best-practices.org/
