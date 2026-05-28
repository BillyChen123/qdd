# QDD

QDD 是一个面向 AI 辅助科研的轻量 CLI，完整名称是 `Question-Driven Discovery`。

它只做一件事：把科研协作压缩成一条尽量简单、可持续复用的工作流，让人和 Agent 围绕同一组 `context / study / task / evidence / question_delta` 文件工作，而不是每次从聊天重新开始。

## QDD 只保留这 5 个流程

下面是 QDD 对外应该强调的最小工作流。左边是概念名，右边是当前实际入口。

### 0. `qdd-start`

前置脚手架命令：`qdd init`

实际 workflow surface：安装后的 `qdd-start`

作用：先由 `qdd init` 创建项目骨架，再由 `qdd-start` 把三类项目级先验信息注入共享上下文：

- 生物背景
- 数据资源
- 运行环境

初始化后，项目里最重要的人工维护文件是：

- `contract.yaml`
- `context/resources.md`
- `data/`
- `domain-skills/`：本仓库维护的中央领域 skill 源目录
- `.codex/skills/`
- `.claude/skills/`

### 1. `qdd-proposal`

当前安装的 workflow surface：`qdd-propose`

作用：人输入一个模糊研究计划，Agent 调用 QDD CLI 去创建第一版：

- `studies/STUDY-XXX/study.md`
- `studies/STUDY-XXX/tasks/TASK-XXX.md`

这里的重点不是把计划说得很完美，而是先把一个可执行的 study 边界和初始 task 落到文件里。

### 2. `qdd-explore`

当前安装的 workflow surface：`qdd-explore`

作用：人和 Agent 一起讨论，持续完善：

- `study.md`
- `task.md`

这一阶段的重点是把问题边界、资源匹配、blocker、evidence plan 讨论清楚，而不是直接跑分析。

### 3. `qdd-apply`

当前安装的 workflow surface：`qdd-apply`

作用：Agent 调用 QDD CLI 读取当前假设和任务需求，然后开始：

- 写代码
- 跑结果
- 产出证据

主要会围绕这些位置工作：

- `qdd instructions STUDY-XXX --json`
- `qdd instructions TASK-XXX --json`
- `studies/STUDY-XXX/output/`

当前约定下，实质分析要尽量留下：

- `output/code/` 里的脚本
- `output/figures/` 里的关键图
- `output/reports/` / `output/tables/` 里的摘要和证据

### 4. `qdd-close`

当前安装的 workflow surface：`qdd-close`

作用：Agent 读取结果和证据，对当前 hypothesis 做评判，并完成收尾：

- 把可复用的稳定结果写进 `context/`
- 把证据登记进 `artifacts/`
- 写入 `question_delta`
- 从 project 层给出一组 follow-up 研究方向

这个阶段的重点不是写一个漂亮总结，而是把“哪些能复用、问题下一步怎么走”说清楚。

## 项目里真正重要的文件

QDD 不想让仓库里充满复杂中间层。当前最关键的文件就是：

- `contract.yaml`：项目边界和模式
- `context/resources.md`：项目级背景、数据、环境
- `data/`：项目级数据入口，默认用软连接挂真实数据
- `domain-skills/`：中央维护的领域 skill 源目录，`qdd init` 会把它们投影到项目内
- `.codex/skills/`：项目级 local skill inventory，task `skills:` 以它为校验真相源
- `.claude/skills/`：Claude 侧的镜像 skill surface
- `studies/STUDY-XXX/study.md`：一个研究问题的边界
- `studies/STUDY-XXX/tasks/TASK-XXX.md`：证据生产任务
- `studies/STUDY-XXX/output/`：代码、图、表、报告等本地证据
- `artifacts/index.yaml`：明确登记过的可复用证据
- `evolution.yaml`：问题如何演化

## 安装

QDD 目前还没有发布到 npm registry。安装方式见：

- [安装指南](./docs/04-installation-guide.md)

最常见的源码安装方式：

```bash
git clone <your-qdd-repo-url>
cd qdd
npm install
npm run build
npm install -g .
```

安装完成后，在任意目录都可以初始化一个项目：

```bash
mkdir my-qdd-project
cd my-qdd-project
qdd init .
```

## 快速开始

### 1. 初始化项目

```bash
qdd init .
```

然后先走项目 onboarding：

- `qdd-start`

如果你不用 Agent，也至少先补这些真相源：

- `contract.yaml`
- `context/resources.md`
- `data/`
- `domain-skills/`（如果你要维护可复用领域 skill）

### 2. 进入 proposal / explore / apply / close 循环

`qdd init` 会自动安装给 Agent 用的 bootstrap 文件。当前默认会同时安装：

- Claude Code bootstrap
- Codex bootstrap
- 当前仓库 `domain-skills/` 里的全部领域 skill

后续实际协作顺序就是：

0. `qdd-start`
1. `qdd-propose`
2. `qdd-explore`
3. `qdd-apply`
4. `qdd-close`

如果 Agent 要读结构化边界，最常用的 CLI 是：

```bash
qdd status --json
qdd instructions PROJECT --json
qdd instructions STUDY-001 --json
qdd instructions TASK-001 --json
qdd validate --json
```

task 里的 `skills:` 现在有两个硬约束：

- 只写真实的领域 skill，例如 `plot/marker-heatmap`
- 不能写 `qdd/*` 这种 workflow skill

领域 skill 的维护方式现在是：

1. 把 skill 写在仓库根目录的 `domain-skills/<category>/<skill>/`
2. 运行 `qdd init .` 或 `qdd init . --refresh-bootstrap`
3. QDD 会把它们复制到目标项目的 `.codex/skills/` 和 `.claude/skills/`

可以把 `domain-skills/` 当成中央源，而把项目里的 `.codex/.claude` skill 目录当成 bootstrap 投影。

## 当前定位

这个仓库现在是一个**可用的原型**，不是完整产品。它更适合：

- 做单项目 dogfood
- 打磨研究工作流协议
- 把 Agent 行为固定到一套清楚的文件系统约定

而不是：

- 大而全的科研平台
- 自动化 pipeline 引擎
- 多人协作平台

## 更多文档

- [安装指南](./docs/04-installation-guide.md)
- [代码原型图](./docs/02-code-prototype-map.md)
- [开发原型说明](./docs/01-development-prototype.md)
- [产品需求文档](./docs/00-product-requirements-document.md)
