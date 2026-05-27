# QDD Installation Guide

这份文档回答一个很实际的问题：**别的用户怎么安装 QDD，并且在自己的目录里使用，而不是依赖你当前这个仓库路径。**

在安装之前，先记住 QDD 对外只保留的最小工作流：

1. `qdd-init`：创建脚手架，把生物背景、数据资源、运行环境注入 `context/`
2. `qdd-proposal`：人给模糊研究计划，Agent 创建 `study.md` 和 `task.md`
3. `qdd-explore`：人和 Agent 讨论并完善 `study.md` / `task.md`
4. `qdd-apply`：Agent 读取假设和任务要求，写代码、跑结果、产出证据
5. `qdd-close`：Agent 评判假设，把可复用内容写回 `context` / `artifacts`，并给出 follow-up 方向

当前代码中的实际入口分别是：

- `qdd-init` -> `qdd init`
- `qdd-proposal` -> 安装后的 `qdd-propose`
- `qdd-explore` -> 安装后的 `qdd-explore`
- `qdd-apply` -> 安装后的 `qdd-apply`
- `qdd-close` -> 安装后的 `qdd-close`

## 前提

目标用户需要：

- Node.js `>= 20.19.0`
- npm
- 一个可写的 home 目录

可选：

- Claude Code
- Codex / `~/.codex`

QDD 当前没有发布到 npm registry，所以安装方式是 **源码安装** 或 **tarball 安装**。

---

## 方案 A：从源码全局安装（推荐）

适合：开发者、本机长期使用者。

### 1. 获取仓库

```bash
git clone <your-qdd-repo-url>
cd qdd
```

### 2. 安装依赖并构建

```bash
npm install
npm run build
```

### 3. 全局安装 CLI

```bash
npm install -g .
```

### 4. 验证

```bash
qdd --version
which qdd
```

安装完成后，这个用户就可以在**任意目录**运行：

```bash
mkdir ~/research/my-qdd-project
cd ~/research/my-qdd-project
qdd init .
```

这一步已经和你的原始仓库目录解耦了。

---

## 方案 B：分发 tarball 给别的用户

适合：另一台机器、另一个用户、或者不想直接给源码仓库的人。

### 维护者打包

在 QDD 仓库根目录执行：

```bash
npm install
npm run build
npm pack
```

会生成一个类似下面的文件：

```text
qdd-0.1.0.tgz
```

把这个文件发给对方。

### 对方安装

```bash
npm install -g ./qdd-0.1.0.tgz
```

然后验证：

```bash
qdd --version
```

之后就可以在自己的任意目录里初始化项目：

```bash
mkdir my-qdd-project
cd my-qdd-project
qdd init .
```

---

## 方案 C：开发态安装（`npm link`）

适合：本地继续开发 QDD，同时想直接测试 `qdd` 命令。

在仓库根目录执行：

```bash
npm install
npm run build
npm link
```

之后当前用户就能直接用：

```bash
qdd --version
```

如果你改了源码，需要重新构建：

```bash
npm run build
```

---

## 初始化一个新项目

安装好 CLI 后，QDD 的使用与源码位置无关。你只需要在目标研究目录中执行：

```bash
mkdir my-qdd-project
cd my-qdd-project
qdd init .
```

默认会安装两套 bootstrap：

- Claude Code
- Codex

如果只想装一套：

```bash
qdd init . --tool claude
qdd init . --tool codex
```

如果后续升级了 QDD，想刷新当前项目的 bootstrap：

```bash
qdd init . --refresh-bootstrap
```

初始化后，先由人补两个项目级真相源：

- `contract.yaml`
- `context/resources.md`

---

## 安装后会写到哪里

### 项目内

`qdd init .` 会在当前项目写入：

```text
.qdd/
.claude/
.codex/skills/
contract.yaml
evolution.yaml
context/
studies/
artifacts/
```

### 用户级

如果启用了 Codex，QDD 还会写用户级 prompt：

```text
$CODEX_HOME/prompts/
```

默认情况下：

```text
~/.codex/prompts/
```

也就是说：

- `.codex/skills/` 是**项目级**的
- `~/.codex/prompts/` 是**用户级**的

这和 OpenSpec 的做法一致，便于多个项目共用同一组 Codex prompt 名称。

---

## 最短使用流程

```bash
qdd init .
```

然后让 Agent 按这条最小循环工作：

1. `qdd-propose`
2. `qdd-explore`
3. `qdd-apply`
4. `qdd-close`

如果 Agent 需要结构化读取边界，最常用的是：

```bash
qdd status --json
qdd instructions STUDY-001 --json
qdd instructions TASK-001 --json
qdd validate --json
```

这一套就够了。对外介绍时，不需要把 QDD 讲成更多层命令系统。

---

## 升级方式

如果用户是通过源码目录安装的：

```bash
cd /path/to/qdd
git pull
npm install
npm run build
npm install -g .
```

如果用户是通过 tarball 安装的：

```bash
npm install -g ./qdd-<new-version>.tgz
```

升级 CLI 后，建议在已有项目里执行一次：

```bash
qdd init . --refresh-bootstrap
```

---

## 卸载

```bash
npm uninstall -g qdd
```

这只会移除 CLI，不会删除已经初始化的 QDD 项目。

---

## 常见问题

### 1. `qdd: command not found`

通常是 npm global bin 不在 `PATH` 里。

先看：

```bash
npm bin -g
```

把输出目录加入 shell 的 `PATH`。

### 2. Codex prompt 没装到预期位置

检查：

```bash
echo $CODEX_HOME
```

如果没设置，默认就是：

```text
~/.codex
```

### 3. 新版本 prompt 没生效

在项目根目录执行：

```bash
qdd init . --refresh-bootstrap
```

### 4. 别的用户不在你的仓库目录下，还能用吗？

可以。只要他已经通过全局安装拿到 `qdd` 命令，后续就只和**他自己的项目目录**有关，不依赖你的仓库绝对路径。

---

## 维护建议

如果你准备给更多人分发，建议采用这条流程：

1. 在主仓库里完成修改
2. `npm run build`
3. `npm test`
4. `npm pack`
5. 分发 `qdd-<version>.tgz`

这样最稳，不要求对方理解仓库结构，也不要求对方在你的源码目录里工作。
