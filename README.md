# QDD

**Question-Driven Discovery for AI-assisted biomedical research.**

QDD is a research orchestration layer for long-horizon discovery. It does not treat an AI agent as a one-shot script generator. Instead, it keeps the whole research process organized around evolving questions: what was asked, what evidence was produced, what changed, what should be reused, and what the next better question should be.

[中文版本](#中文版本)

## One Sentence

**QDD turns exploratory biomedical analysis into an auditable question loop**: a stable project contract, bounded studies, executable tasks, promoted artifacts, and a sparse evolution record that both humans and agents can read.

## Why QDD

Modern AI agents can write code, search public databases, and run analyses. The hard part is no longer only execution. The hard part is keeping a multi-step scientific project coherent after every partial result, failed hypothesis, dataset limitation, or promising signal.

QDD is built for that gap:

| Without QDD | With QDD |
|---|---|
| Scattered chats, scripts, notebooks, and folders | One readable research state shared by humans and agents |
| Agents optimize the next task only | Agents optimize the next question |
| Negative results become dead ends | Negative results become pivots, validations, or robustness studies |
| Public-data searches are hard to audit | Dataset and reference choices are recorded as reusable evidence |
| Domain knowledge must be re-explained every turn | Domain skills are injected into the right role at the right time |

## The Five Core Flows

QDD is intentionally small. The human-facing mental model is five flows plus Auto Mode.

### 1. Start

Establish the project contract: research theme, scope, data assumptions, runtime environment, durable resources, and mode. This is the stable "why are we doing this?" layer.

### 2. Propose

Turn the current frontier into one bounded study. A good study has a judgeable question, a falsifiable expectation, a small task graph, and explicit resource fit.

### 3. Explore

Stress-test a proposed study before execution. This is where the agent and user refine boundaries, decide whether public data is needed, and avoid over-broad or under-powered plans.

### 4. Apply

Execute the study tasks. QDD injects task-local domain skills, runs code inside the project, preserves scripts and outputs, and keeps final artifacts under a canonical study output surface.

### 5. Close

Synthesize evidence and update the research frontier. A close event can refine, confirm, pivot, or dissolve a question. QDD records what changed, what remains open, which artifacts are reusable, and what next candidates are worth pursuing.

## Auto Mode

Auto Mode runs the whole loop through an Anthropic-compatible SDK session:

```text
Start -> Propose -> Apply -> Close -> Propose -> ...
```

It is designed for long-running research automation, not a single prompt. The runtime decides the next phase from persisted QDD state, while the thesis-manager role decides whether the project should continue, stop, validate, pivot, or search for better data.

Minimal launch:

```bash
qdd auto --max-turns unlimited
```

Auto Mode currently speaks the Anthropic protocol. Install dependencies and configure an Anthropic-compatible model before running it. If you use DeepSeek as the default backend, route it through an Anthropic-compatible gateway or internal proxy:

```bash
export ANTHROPIC_AUTH_TOKEN="your-api-key"
export ANTHROPIC_BASE_URL="https://<your-anthropic-compatible-deepseek-gateway>"
export ANTHROPIC_MODEL="deepseek-reasoner"
qdd auto --max-turns unlimited
```

You can also pass the model explicitly:

```bash
qdd auto --model deepseek-reasoner --max-turns unlimited
```

## Domain Skill Injection

QDD ships with **34 local skills** that are routed by role and task instead of dumped into every prompt.

| Skill layer | Current coverage |
|---|---|
| Thesis planning | project-frontier planning and continue/stop/pivot decisions |
| Study brain | single-cell, spatial, and public-data planning |
| scRNA-seq | QC, integration, clustering, annotation, DE, group stats, module scoring, enrichment, communication, trajectory |
| scATAC-seq | LSI preprocessing, latent integration, gene-activity annotation, DAR |
| Spatial transcriptomics | QC, integration, clustering, annotation, group stats, DE, neighborhood, niche composition, structure quantification |
| Public data and reference | CELLxGENE, GEO, PubMed, CellMarker, ligand-receptor resources |

The point is not just more tools. The point is **role-aware injection**:

- thesis-manager gets frontier-planning skills
- study-brain gets planning skills
- executor gets only the task-local domain skills it needs
- public-data skills are separated from downstream analysis skills

This keeps prompts smaller, analysis more reproducible, and agent behavior easier to audit.

## Public Data As First-Class Research Context

QDD treats external data and references as evidence, not hidden prompt memory.

Supported public-data/reference surfaces currently include:

- CELLxGENE dataset discovery
- GEO candidate capture
- PubMed evidence capture
- CellMarker marker reference capture
- ligand-receptor database capture

Dataset acquisition and downstream analysis are deliberately decoupled:

```text
external source -> fetch/capture skill -> local artifact -> domain executor -> study output
```

That means an agent can first find or validate a dataset, then hand a normalized local artifact to a single-cell or spatial workflow without mixing search logic into analysis code.

## What QDD Is Not

- It is not a clinical decision system.
- It is not a black-box cloud notebook.
- It is not a replacement for domain judgment.
- It is not a rigid workflow engine where every branch is pre-scripted.

QDD is a protocol layer for human-agent research: local files, explicit evidence, reusable artifacts, and question evolution.

## Quick Start

Requirements:

- Node `>=20.19.0`
- An Anthropic-compatible model configuration for Auto Mode

Install locally:

```bash
npm install
npm run build
npm install -g .
```

Initialize a research project:

```bash
mkdir my-qdd-project
cd my-qdd-project
qdd init .
```

Then either run the five flows manually through your agent workflow, or start Auto Mode:

```bash
qdd auto --max-turns unlimited
```

More installation details are in [docs/04-installation-guide.md](docs/04-installation-guide.md).

---

# 中文版本

**面向 AI 辅助生物医学研究的 Question-Driven Discovery 框架。**

QDD 不是把 AI agent 当成一次性脚本生成器，而是把长期探索型研究组织成一个可审计的问题循环：问了什么、产生了什么证据、问题如何变化、哪些产物值得复用、下一步应该问什么。

[English](#qdd)

## 一句话定义

**QDD 把探索型生物医学分析变成可追踪的问题演化流程**：稳定的项目契约、边界清晰的 study、可执行 task、可复用 artifact，以及人和 agent 都能读懂的 evolution 记录。

## 为什么需要 QDD

现在的 AI agent 已经能写代码、查数据库、跑分析。真正困难的是：当一个项目经历多个阶段、多个数据集、多个负结果和多个新信号时，如何保持研究方向不散、证据不丢、问题越来越可判断。

QDD 解决的是这个上层问题：

| 没有 QDD | 使用 QDD |
|---|---|
| 对话、脚本、notebook 和文件夹分散 | 人和 agent 共享同一套可读研究状态 |
| agent 只优化下一个任务 | agent 优化下一个更好的科学问题 |
| 负结果容易变成死胡同 | 负结果会被整理成 pivot、validation 或 robustness |
| 公共数据检索难以复盘 | 数据集和 reference 选择会被记录为可复用证据 |
| 每轮都要重新解释领域知识 | 领域 skill 会按角色和任务自动注入 |

## 五大关键流程

QDD 的用户心智模型很简单：五个关键流程，加一个 Auto 模式。

### 1. Start

建立项目契约：研究主题、边界、数据假设、运行环境、稳定资源和运行模式。这一层回答“我们为什么做这个项目”。

### 2. Propose

把当前研究前沿转成一个可执行的 study。一个好的 study 应该有可判断的问题、可证伪的预期、小规模 task graph，以及清晰的数据适配说明。

### 3. Explore

在执行前压力测试 study。这里适合和 agent 一起讨论边界、是否需要 public data、是否过宽或过窄、是否应该调整任务结构。

### 4. Apply

执行 study 里的任务。QDD 会注入 task-local 的领域 skill，在项目内运行代码，保留脚本和输出，并把最终产物整理到规范的 study output 中。

### 5. Close

综合证据并更新研究前沿。一个 close event 可以是 refinement、confirmation、pivot 或 dissolution。QDD 会记录问题如何变化、还剩什么边界、哪些 artifact 值得复用、下一步候选问题是什么。

## Auto 模式

Auto 模式通过 Anthropic-compatible SDK 自动运行完整研究循环：

```text
Start -> Propose -> Apply -> Close -> Propose -> ...
```

它不是一次性 prompt，而是面向长程研究的自动编排。runtime 根据 QDD 项目状态决定下一阶段；thesis-manager 负责判断项目是继续、停止、验证、转向，还是寻找更合适的数据。

最小启动方式：

```bash
qdd auto --max-turns unlimited
```

目前 Auto 模式只支持 Anthropic 协议。运行前需要安装依赖并配置 Anthropic-compatible 模型。如果默认后端使用 DeepSeek，需要通过 Anthropic-compatible gateway 或内部代理接入：

```bash
export ANTHROPIC_AUTH_TOKEN="your-api-key"
export ANTHROPIC_BASE_URL="https://<your-anthropic-compatible-deepseek-gateway>"
export ANTHROPIC_MODEL="deepseek-reasoner"
qdd auto --max-turns unlimited
```

也可以显式指定模型：

```bash
qdd auto --model deepseek-reasoner --max-turns unlimited
```

## 领域 Skill 注入

QDD 当前内置 **34 个本地 skill**，并且按角色和任务路由，而不是一次性塞进所有 prompt。

| Skill 层级 | 当前覆盖 |
|---|---|
| Thesis planning | 项目前沿规划、继续/停止/pivot 决策 |
| Study brain | 单细胞、空间组学、public-data planning |
| scRNA-seq | QC、integration、clustering、annotation、DE、group stats、module score、enrichment、communication、trajectory |
| scATAC-seq | LSI preprocessing、latent integration、gene-activity annotation、DAR |
| Spatial transcriptomics | QC、integration、clustering、annotation、group stats、DE、neighborhood、niche composition、structure quantification |
| Public data / reference | CELLxGENE、GEO、PubMed、CellMarker、ligand-receptor resources |

关键不只是工具数量，而是 **按角色注入**：

- thesis-manager 只拿项目前沿规划 skill
- study-brain 只拿 study planning skill
- executor 只拿当前 task 真正需要的领域 skill
- public-data skill 和 downstream analysis skill 解耦

这样 prompt 更轻，分析更可复现，agent 行为也更容易审计。

## 公共数据作为一等研究上下文

QDD 把外部数据和 reference 当成证据，而不是藏在 prompt 里的记忆。

当前支持的 public-data/reference surface 包括：

- CELLxGENE dataset discovery
- GEO candidate capture
- PubMed evidence capture
- CellMarker marker reference capture
- ligand-receptor database capture

数据获取和下游分析是解耦的：

```text
external source -> fetch/capture skill -> local artifact -> domain executor -> study output
```

也就是说，agent 可以先查找或验证数据集，再把规范化后的本地 artifact 交给单细胞或空间组学 workflow，而不是把搜索逻辑混进分析代码里。

## QDD 不是什么

- 不是临床诊断系统。
- 不是黑盒云端 notebook。
- 不是替代领域专家判断。
- 不是每个分支都提前写死的传统 workflow engine。

QDD 是人和 agent 共同推进科研项目的协议层：本地文件、显式证据、可复用 artifact，以及持续演化的问题。

## 快速开始

要求：

- Node `>=20.19.0`
- Auto 模式需要配置 Anthropic-compatible 模型

本地安装：

```bash
npm install
npm run build
npm install -g .
```

初始化研究项目：

```bash
mkdir my-qdd-project
cd my-qdd-project
qdd init .
```

之后可以手动运行五大流程，也可以直接启动 Auto 模式：

```bash
qdd auto --max-turns unlimited
```

更多安装细节见 [docs/04-installation-guide.md](docs/04-installation-guide.md)。
