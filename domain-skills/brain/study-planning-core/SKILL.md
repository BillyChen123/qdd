---
name: brain/study-planning-core
description: Study-layer planning heuristics for QDD. Use during propose and explore to turn biological context, data reality, and prior evidence into a bounded study plus a problem-level task graph.
---

# brain/study-planning-core

这个 skill 只服务于 study 规划，不服务于 task 执行。

它的职责是帮 Study Brain 想清楚：

- 这个研究问题是否足够收敛
- 现有资源能不能支撑
- 哪些问题应该先验证
- 哪类 problem-level executor skill 应该被检索和写入 task

## 核心原则

1. 先判断研究问题，再判断方法
2. 先看资源现实，再规划 task
3. 先选问题级技能，再让 executor 在技能内部选具体方法
4. 不把 `brain/*` 写进 task `skills:`

## 常见思考线索

### 多样本单细胞

- 如果研究要联合多个样本，优先检查是否存在批次整合问题
- 如果 UMAP 明显按 sample 分离，也要考虑整合或至少做批次诊断
- 不要默认直接比较 cluster 差异而跳过整合判断

### h5ad 状态判断

- 如果 `.X` 看起来是整数或 raw counts，要先判断是否需要标准预处理
- 如果对象已经 log-normalized 或带有明确处理层，不要盲目重复预处理
- 要看 `adata.layers`、`adata.raw`、`obs`、`var`

### 注释问题

- 如果 cluster 身份本身不清楚，不要直接做下游机制比较
- 先规划 annotation 或 marker 审查任务

## 推荐动作

在 `qdd-propose` / `qdd-explore` 中：

1. 用这个 skill 明确 study 的 evidence plan
2. 把 task 切成 2-4 个尽量解耦的证据单元
3. 再用 `qdd skills:suggest --domain <domain> --stage <stage> --tag <tag> --json` 找 problem-level executor skills
4. 只把确认后的 executor skills 写进 task
