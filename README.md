# QDD

QDD 是一个面向 AI 辅助科研的轻量 CLI，完整名称是 `Question-Driven Discovery`。

它的目标不是替你做科研，而是把研究问题、study、task、evidence 和 `question_delta` 固定到一个清晰的文件系统协议里，让 Claude、Codex 这类 agent 能在同一个项目里持续工作，而不是每次从一段聊天重新开始。

## 当前定位

当前仓库是 **可用的原型版**，已经支持一条最小研究闭环：

`qdd init -> qdd add-study -> qdd add-task -> qdd instructions -> qdd close-study`

并且已经接上了两类 agent bootstrap：

- Claude Code: 项目内 `.claude/commands/` 和 `.claude/skills/`
- Codex: 用户级 `~/.codex/prompts/` 和项目内 `.codex/skills/`

## 安装

QDD 目前**还没有发布到 npm registry**。安装方式见详细指南：

- [安装指南](./docs/04-installation-guide.md)

最常见的源码安装方式是：

```bash
git clone <your-qdd-repo-url>
cd qdd
npm install
npm run build
npm install -g .
```

安装完成后，任意目录都可以使用：

```bash
qdd --version
qdd init my-qdd-project
```

## 快速开始

```bash
mkdir my-qdd-project
cd my-qdd-project
qdd init .
```

初始化后，先补两处最关键的人工上下文：

- `contract.yaml`
- `context/resources.md`

然后开始第一个 study：

```bash
qdd add-study \
  --question "ALOX12B 是否定义了一个可复现的 KC state？" \
  --hypothesis "ALOX12B-high KC 在病例组中呈现稳定状态特征"

qdd add-task STUDY-001 \
  --goal "做第一轮数据现实性检查和状态验证"
```

执行前，让 agent 先读取结构化边界：

```bash
qdd status --json
qdd instructions STUDY-001 --json
qdd instructions TASK-001 --json
```

收尾时常用：

```bash
qdd validate --json
qdd artifacts:list --json
qdd close-study STUDY-001 \
  --question-after "下一步是否需要跨样本验证？" \
  --change-type refinement \
  --change-driver "初步证据支持存在状态，但跨样本稳定性仍待确认"
```

## 你会得到什么

`qdd init` 会创建一个最小 QDD 项目骨架：

```text
project-root/
├── contract.yaml
├── evolution.yaml
├── context/
├── studies/
├── artifacts/
└── .qdd/
```

并额外安装 agent 需要的 bootstrap 文件。当前默认会同时安装 `claude` 和 `codex`。

## 常用命令

- `qdd init [path]`
- `qdd status --json`
- `qdd instructions <id> --json`
- `qdd add-study`
- `qdd add-task STUDY-XXX`
- `qdd register-artifact <path>`
- `qdd close-study STUDY-XXX`
- `qdd validate --json`
- `qdd artifacts:list --json`
- `qdd context --json`

## 更多文档

- [安装指南](./docs/04-installation-guide.md)
- [代码原型图](./docs/02-code-prototype-map.md)
- [开发原型说明](./docs/01-development-prototype.md)
- [产品需求文档](./docs/00-product-requirements-document.md)

## 现阶段限制

- 还没有发布到 npm
- 还没有 `qdd close-task`
- 还没有 plugin 系统和 auto mode
- 更适合先做单项目、小范围 dogfood，再继续打磨协议
