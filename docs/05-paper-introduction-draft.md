# Introduction Draft: Question-Driven Discovery

## Compressed Version

### English

Biomedical AI agents are becoming increasingly capable of executing scientific actions: they can write code, call tools, analyze data, and generate follow-up analyses. Systems such as CellVoyager and Biomni illustrate this shift from language assistance to scientific execution. However, long-horizon exploratory research remains difficult because discovery is not simply a sequence of tasks over a fixed objective. In exploratory bioinformatics, each intermediate result can reshape the hypothesis space itself. A batch effect, rare cell population, failed clustering, or missing covariate does not merely update an answer; it may change what should be asked next.

This exposes a missing abstraction in current AI-for-science systems: question governance. Existing agents usually coordinate around prompts, tasks, notebooks, workflows, or tool calls. These are useful execution units, but they do not preserve the central axis of scientific exploration: how the research question changes. Without this axis, long-chain research easily fragments into disconnected analyses, arbitrary pivots, and decisions that cannot be audited or reused.

We propose Question-Driven Discovery (QDD), a general paradigm for human-AI collaboration in exploratory bioinformatics. QDD defines question evolution as the organizing axis of research. Studies, tasks, evidence artifacts, and agent actions are supporting structures that record how a question is refined, confirmed, pivoted, or dissolved by evidence. This makes the research process auditable and keeps human-AI collaboration aligned around the most important object: the next better question.

QDD further enables quantitative evaluation of what makes a question better. By measuring artifact reuse, boundary reduction, testability, and evidence-grounded pivots, QDD turns question evolution into a computable signal. Thus, autonomous research agents can be evaluated not only by whether they produce outputs, but by whether they continuously ask more bounded, testable, evidence-based, and scientifically valuable questions.

### 中文

生物医学 AI agent 正在变得越来越擅长执行科学行动：它们可以写代码、调用工具、分析数据，并生成后续分析方向。CellVoyager 和 Biomni 代表了这种从语言辅助到科学执行的转变。然而，长链路探索性研究仍然困难，因为科学发现并不是围绕固定目标展开的一串任务。在探索性生物信息学中，每一个中间结果都可能重塑假设空间本身。批次效应、罕见细胞群、失败的聚类或缺失的协变量，不只是更新答案；它们可能改变下一步应该问什么。

这暴露出现有 AI-for-science 系统缺失的核心抽象：问题治理。现有 agent 通常围绕 prompt、任务、notebook、workflow 或工具调用进行协作。这些是有用的执行单元，但它们不能保留科学探索的中心主轴：研究问题是如何变化的。没有这条主轴，长链路研究很容易碎片化为割裂的分析、任意的 pivot 和无法审计复用的隐式决策。

我们提出 Question-Driven Discovery（QDD），一个面向探索性生物信息学的人机协作通用范式。QDD 将问题演化定义为科研过程的组织主轴。Study、task、证据 artifact 和 agent 行动都是支撑结构，用来记录一个问题如何被证据 refine、confirm、pivot 或 dissolve。这样，研究过程变得可审计，人机协作也始终围绕最重要的对象展开：下一个更好的问题。

QDD 进一步支持量化评估什么是更好的问题。通过衡量 artifact 复用、边界收缩、可检验性和证据驱动的 pivot，QDD 将问题演化转化为可计算信号。因此，自主科研 agent 的质量不仅取决于它是否产出结果，更取决于它是否能持续提出更有边界、更可检验、更有证据基础、更有科学价值的问题。

## English

Biomedical research is entering an era in which artificial intelligence systems can increasingly execute scientific actions. Recent agents can write analysis code, operate software tools, query biomedical databases, design workflows, and even suggest follow-up analyses. Systems such as CellVoyager and Biomni illustrate this shift from passive language assistance to active scientific execution: the former focuses on autonomous single-cell analysis, whereas the latter expands the biomedical action space through large collections of tools, databases, and software interfaces. These systems demonstrate that AI agents are becoming capable executors. Yet long-horizon exploratory research remains difficult to automate or coordinate reliably.

The central difficulty is that exploratory science is not merely a long sequence of tasks. Most current agents implicitly model discovery as task solving over a relatively stable objective: a goal is provided, the agent decomposes it into subtasks, calls tools, evaluates outputs, and searches for an answer. This view works when the problem, success criteria, and hypothesis space are predefined. However, exploratory bioinformatics rarely follows this pattern. Each intermediate result can change not only the candidate answers, but also the space of meaningful questions. A failed clustering, an unexpected batch effect, a rare cell population, an inconsistent marker gene, or a missing clinical covariate does not simply update an answer; it can rewrite what should be asked next.

This exposes a missing abstraction in current AI-for-science systems: question governance. The bottleneck of long-horizon AI-driven discovery is not only memory, planning, tool use, or code generation, but the ability to track, justify, and evaluate how the object of inquiry changes over time. Existing systems often coordinate around prompts, tasks, notebooks, workflows, or tool calls. These are useful execution units, but they are not sufficient state variables for discovery. When the hypothesis space itself is moving, humans and AI need a shared object that records what question is being asked, why it changed, what evidence caused the change, and which boundaries remain unresolved.

This gap is especially important for human-AI collaboration. In practice, exploratory computational biology is neither fully manual nor fully autonomous. Human researchers provide biological judgment, define scientific value, constrain acceptable interpretations, and decide whether a question is worth pursuing. AI agents provide execution capacity, code generation, literature support, workflow expansion, and evidence synthesis. Without a common protocol, this collaboration easily fragments into disconnected chats, one-off scripts, transient notebooks, and implicit decisions that cannot be audited or reused. The consequence is not only reduced reproducibility, but also a loss of the most valuable signal in exploratory research: how evidence reshapes the research question.

We propose Question-Driven Discovery (QDD), a general paradigm for human-AI collaboration in exploratory bioinformatics research. QDD defines a single organizing axis for the entire research process: how the question changes. Studies, tasks, evidence artifacts, and agent actions are not independent workflow elements, but supporting structures that preserve this axis across a long chain of exploration. At the closure of each study, QDD records a structured question delta: how the question changed, what evidence drove the change, whether the study refined, confirmed, pivoted, or dissolved the original question, and what open boundaries remain. By making question change the primary state transition, QDD prevents long-horizon research from degenerating into disconnected analyses, arbitrary pivots, or untraceable conversations.

This framing shifts the goal of AI-assisted research from task automation to question governance. Under QDD, the most important object is not the next tool call or the next generated script, but the next better question. Evidence does not merely support or reject an answer; it changes what should be asked. A successful study may narrow the scope of a question, expose a hidden confounder, create a reusable artifact, or reveal that a hypothesis is undecidable with current resources. These outcomes are treated as first-class progress because they improve the trajectory of inquiry. In this sense, QDD aligns AI-assisted research with human scientific practice: progress is achieved not only by answering questions, but by learning which questions are worth asking next.

QDD also provides a basis for quantifying what makes a question better. Because each study links question changes to evidence, artifacts, and decisions, the research process can be evaluated through complementary dimensions: whether later studies reuse earlier artifacts, whether question boundaries shrink over time, whether success criteria become more testable, and whether pivots are evidence-driven rather than arbitrary. These measurements turn question evolution from a narrative afterthought into a computable signal. They also provide a practical route for improving autonomous research agents: within the QDD framework, agent quality can be judged not only by whether an agent produces outputs, but by whether it consistently proposes questions that are more bounded, more testable, more evidence-grounded, and more scientifically valuable.

QDD is not intended to replace domain-specific agents such as CellVoyager or general biomedical agents such as Biomni. Instead, it addresses a more upstream coordination problem. Domain agents answer the question of how AI can execute scientific actions; QDD asks how humans and AI should govern the evolving questions that determine which actions matter. In this sense, QDD can serve as a protocol layer above execution agents, enabling human-guided research today and more autonomous discovery systems in the future.

Our core argument is that the next bottleneck in AI-driven biomedical discovery is not simply more tools, larger action spaces, or longer context windows. The deeper challenge is that scientific inquiry is not a search through a fixed hypothesis space, but an evidence-driven restructuring of that space. QDD formalizes this process by making question evolution explicit, auditable, and measurable. By doing so, it offers a unified paradigm for organizing human-AI collaboration around the central object of scientific discovery: the question itself.

## 中文

生物医学研究正在进入一个人工智能系统能够越来越多地执行科学行动的阶段。近期的智能体已经能够编写分析代码、调用软件工具、查询生物医学数据库、设计分析流程，甚至提出后续分析方向。CellVoyager 和 Biomni 代表了这种从被动语言辅助到主动科学执行的转变：前者聚焦于自动化单细胞分析，后者则通过整合大量工具、数据库和软件接口扩展了生物医学行动空间。这些系统说明，AI 智能体正在成为越来越有能力的执行者。然而，长链路的探索性研究仍然难以被可靠地自动化，也难以被稳定地组织起来。

核心困难在于，探索性科学并不只是一个很长的任务序列。现有大多数智能体实际上把科学发现建模为围绕相对稳定目标的任务求解过程：给定一个目标，智能体将其拆解为子任务，调用工具，评估输出，并搜索答案。当问题、成功标准和假设空间都已经预先定义时，这种视角是有效的。但是，探索性生物信息学研究很少按照这种方式展开。每一个中间结果不仅可能改变候选答案，还可能改变哪些问题本身是有意义的。一次失败的聚类、一个意外的批次效应、一个罕见细胞群、一个不一致的 marker gene，或者一个缺失的临床协变量，都不只是更新答案；它们可能直接改写下一步应该问什么。

这暴露出现有 AI-for-science 系统中缺失的一个核心抽象：问题治理。长链路 AI 驱动发现的瓶颈不只是记忆、规划、工具调用或代码生成，而是系统性地追踪、解释和评估研究对象如何随时间变化的能力。现有系统通常围绕 prompt、任务、notebook、workflow 或工具调用来组织协作。这些都是有用的执行单元，但它们不足以作为科学发现的状态变量。当假设空间本身在移动时，人和 AI 需要一个共享对象来记录：当前正在问什么问题，问题为什么发生变化，是什么证据驱动了这种变化，以及哪些边界仍然没有被解决。

这一缺口对于人机协作尤其重要。在实践中，探索性计算生物学既不是完全人工的，也不是完全自动化的。人类研究者提供生物学判断，定义科学价值，约束可接受的解释，并决定一个问题是否值得继续推进。AI 智能体则提供执行能力、代码生成、文献支持、流程扩展和证据综合。如果没有一个共同协议，这种协作很容易碎片化为彼此割裂的聊天记录、一次性脚本、临时 notebook 和无法审计的隐式决策。其后果不仅是可重复性下降，更重要的是探索性研究中最有价值的信号被丢失了：证据如何重塑研究问题。

我们提出 Question-Driven Discovery（QDD），一个面向探索性生物信息学研究的人机协作通用范式。QDD 为整个科研过程定义了唯一主轴：问题是如何变化的。Study、task、证据 artifact 和 agent 行动并不是彼此独立的 workflow 元素，而是为了在长链路探索中持续保留这条主轴的支撑结构。在每一个 study 结束时，QDD 都会记录一个结构化的 question delta：问题如何变化，是什么证据驱动了变化，本次研究是 refine、confirm、pivot 还是 dissolve 了原始问题，以及还剩下哪些开放边界。通过把“问题变化”定义为最核心的状态转移，QDD 避免长链路研究退化为彼此割裂的分析、任意发生的 pivot，或者无法追溯的聊天记录。

这一框架将 AI 辅助研究的目标从任务自动化推进到问题治理。在 QDD 中，最重要的对象不是下一次工具调用，也不是下一段生成代码，而是下一个更好的问题。证据不仅仅用于支持或反驳一个答案；它会改变下一步应该问什么。一个成功的 study 可能缩小问题范围，暴露隐藏混杂因素，产生可复用 artifact，或者揭示某个假设在当前资源下不可判定。这些结果都被视为一等的科研进展，因为它们改善了研究问题的演化轨迹。从这个意义上说，QDD 与人类科研实践是一致的：科研进展不仅来自回答问题，也来自不断学会哪些问题更值得被提出。

QDD 也为量化“什么是更好的问题”提供了基础。因为每一个 study 都把问题变化与证据、artifact 和决策连接起来，研究过程可以从多个互补维度被评估：后续 study 是否复用了早期 artifact，问题边界是否随时间收缩，成功标准是否变得更加可检验，以及 pivot 是否由证据驱动而不是任意发生。这些度量将问题演化从事后叙述转化为可计算信号。它们也为提升自主科研 agent 提供了一条实际路径：在 QDD 框架下，agent 的质量不仅取决于它是否产出了结果，更取决于它是否能够持续提出更有边界、更可检验、更有证据基础、也更有科学价值的问题。

QDD 并不试图替代 CellVoyager 这样的领域专用智能体，也不试图替代 Biomni 这样的通用生物医学智能体。相反，它解决的是一个更上游的协调问题。领域智能体回答的是 AI 如何执行科学行动的问题；QDD 关注的是人和 AI 应该如何治理那些不断演化的问题，因为正是这些问题决定了哪些行动真正重要。从这个意义上说，QDD 可以作为执行型智能体之上的协议层，既支持当下的人类引导式研究，也为未来更高程度的自动化发现系统提供基础。

我们的核心论点是，AI 驱动生物医学发现的下一个瓶颈，不只是更多工具、更大的行动空间或更长的上下文窗口。更深层的挑战在于，科学探索并不是在一个固定假设空间中搜索答案，而是在证据驱动下不断重构这个假设空间。QDD 通过将问题演化显式化、可审计化和可度量化，形式化了这一过程。由此，它提供了一种统一的人机协作范式，使协作围绕科学发现的中心对象展开：问题本身。
