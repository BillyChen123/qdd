你的判断我同意。这个 UC case 最强的证据不是“发现了新机制”，而是“QDD 能自动完成一个研究闭环，并在多次负结果后收缩边界”。

关键差异
人类分析师和这次 auto mode 最大的差别不是技术流程，而是“信号治理”。

人类会更早把 FN1 降级成 interesting candidate / biomarker，因为验证队列没有明确 responder 标签，而是用 inflammation delta 代理响应；这会让 inflammation-led 结论有一定循环性。项目自己也记录了这个降级点：context/
resources.md:41。同时 FN1 在验证队列 DEG 里是 FDR=0.10，更像强候选而不是机制核心：context/resources.md:49。

auto mode 的问题是：一旦 FN1 成为最显眼信号，它会持续围绕它加深，最后把“候选标记 + 负机制排除 + L-R 共表达”组织成完整机制故事。人类会更敏感地问：这个故事是否有因果支点？是否有独立结局？是否有空间/蛋白/功能证据？如果没
有，就不会写成“FN1 repair hub drives healing”。你们现在的最终报告在表达上已经偏强，比如把链条写成 anti-TNF → ... → mucosal healing：artifacts/reports/ART-119-final_biological_narrative.md:22。

这个 Case 怎么定位
我建议不要把它作为“AI scientist discovers biology”的主 case。更稳的定位是：

> QDD autonomously conducts hypothesis-driven biomedical exploration, detects data boundaries, validates and downgrades candidates, and terminates at a defensible frontier.

UC case 可以讲，但标题要降级。不要用 discovers a quiescent-FN1 repair niche 这种强标题；当前 storyboard 这个方向风险偏高：artifacts/reports/UC_case_storyboard_for_agent_paper.md:5。更合适的是：

> Autonomous biomedical research can complete a full evidence loop while converging from mechanism claims to bounded hypotheses.

生物学主结论可以写成：

> Anti-TNF response is most consistently inflammation-resolution-dominant; FN1 marks a reproducible, isolated stromal candidate niche signal, but current public scRNA-seq data do not prove it is causal or
> mechanistically upstream of mucosal healing.

QDD 下一步该改什么
我会优先加一个“hypothesis evidence ledger / 降权机制”，不是再加更多分析工具。

具体规则：

1. 每个候选必须有状态：signal、candidate、cross-cohort candidate、mechanistic hypothesis、supported mechanism。
2. 从 candidate 升级到 mechanistic hypothesis，必须至少满足：独立标签、非循环验证、同方向复现、程序级或细胞状态级支持。
3. 如果验证队列使用 proxy label，所有结论最多到 candidate，不能写成 mechanism。
6. 最终报告生成前加一个 adversarial reviewer pass，专门把标题、摘要、模型图中的动词降级，比如 drives 改成 is associated with，mechanism 改成 hypothesis。

你的原始 prompt 其实已经有“不强行拔高”的要求：.0prompt/auto_mode_single_input.md:28。但它同时强要求“完整故事”和“Nature Methods 风格 case study”：.0prompt/auto_mode_single_input.md:53。这会诱导 auto mode 把弱机制组织成
强叙事。以后 prompt 里要明确：完整故事可以是“候选被降级的故事”，不是一定要形成机制故事。
更容易成功的 case 应该满足：

1. 有明确、独立、硬结局标签，比如 survival、drug response、relapse、pathology score，而不是 agent 自己构造 proxy。
2. 有至少两个独立 cohort，且 discovery 和 validation 的标签定义相近。
3. 有多模态或空间信息，能从“表达相关”升级到“组织位置/调控证据”。
4. 问题不要太开放，最好是“某个治疗/状态下的 resistance niche / cell-cell interaction / lineage state”。
5. 生物学故事要允许负结果变成亮点，但必须有一个正向可复现核心。

我会把下一轮选题方向改成：癌症免疫治疗 response、IBD fibrosis spatial niche、肿瘤耐药 persister state、或者单细胞 + 空间配对的组织修复/炎症问题。不要再选只有 scRNA、弱临床标签、强 proxy 的 case。

客观说：QDD 现在可以做到“像一个很勤奋的 junior/postdoc 自动推进研究闭环”。它还做不到稳定替代 senior scientist 的品味判断。要实现你想要的“一次真正漂亮的新生物学故事”，最关键不是让 agent 多跑，而是给它更硬的数据、更窄的
问题、以及强制降权/升级门槛。
