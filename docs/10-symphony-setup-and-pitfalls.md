# Symphony 实操配置与踩坑记录

本文记录 QDD 项目接入 Symphony 的实际流程、关键配置、状态机约定和本次遇到的坑。目标是以后新建类似自动开发流程时，可以直接复用这份检查表。

## 当前项目配置

QDD 仓库：

- GitHub: `https://github.com/BillyChen123/qdd`
- SSH remote: `git@github.com:BillyChen123/qdd.git`
- 主分支: `main`
- 本地仓库: `/data/chenyz/project/qdd`
- Symphony 仓库: `/data/chenyz/symphony`
- Symphony workspace: `~/code/qdd-symphony-workspaces`
- QDD workflow: `/data/chenyz/project/qdd/WORKFLOW.md`
- Linear project slug: `qdd-5bbf8f2a81d1`
- 必需 Linear label: `qdd-conclude`

不要把 API key 写入仓库。当前做法是把全局环境变量放在用户目录，例如 `~/.config/symphony/env`，再由 `~/.bashrc` source。

## 先理解三层控制面

Symphony 不是把一个本地目录“托管”起来，而是持续轮询 Linear，找到符合条件的 issue 后，在独立 workspace 里启动 Codex agent。

三层职责分别是：

- Linear issue state: 决定哪些工单会被 Symphony 调度。
- `WORKFLOW.md`: 决定 Symphony 怎么筛工单、怎么创建 workspace、用什么 Codex 命令、agent 收到什么任务协议。
- GitHub: agent 在独立分支上提交、推送、开 PR、最终合并到 `main`。

这里最容易混淆的是 Linear 的 project status 和 issue workflow state。当前 Symphony 实现监听的是 issue state，不是 project status。

## Linear 状态机

需要在 Linear 的 `Team Settings -> Workflow` 里配置 issue statuses，而不是只改 project status。

推荐状态流：

```text
Todo -> In Progress -> Human Review -> Merging -> Done
```

含义：

- `Todo`: 等待 Symphony 接单。
- `In Progress`: agent 正在实现。
- `Human Review`: 人工审核暂停态，不应触发 agent。
- `Merging`: 人工确认通过后，把 issue 改到这个状态，重新触发 agent 做合并收尾。
- `Done`: 终态，不再触发 agent。

`WORKFLOW.md` 中对应：

```yaml
tracker:
  active_states:
    - Todo
    - In Progress
    - Rework
    - Merging
  terminal_states:
    - Done
    - Closed
    - Cancelled
    - Canceled
    - Duplicate
```

注意：`Human Review` 不放进 `active_states`，它就是为了让系统暂停等待人类。

## WORKFLOW.md 的作用

`WORKFLOW.md` 分两部分。

第一部分是 YAML front matter，在 `---` 和 `---` 中间：

```yaml
tracker:
  kind: linear
  project_slug: "qdd-5bbf8f2a81d1"
  required_labels:
    - qdd-conclude
  active_states:
    - Todo
    - In Progress
    - Rework
    - Merging
workspace:
  root: ~/code/qdd-symphony-workspaces
hooks:
  after_create: |
    git clone git@github.com:BillyChen123/qdd.git .
    npm install
    npm run build
codex:
  command: codex --config shell_environment_policy.inherit=all --config 'model="gpt-5.4"' --config model_reasoning_effort=xhigh app-server
```

关键字段：

- `tracker.kind`: 当前使用 Linear。
- `tracker.project_slug`: 只轮询这个 Linear project。
- `tracker.required_labels`: 只有带这些 label 的 issue 才会被调度。
- `tracker.active_states`: Symphony 会抓取并启动 agent 的 issue states。
- `tracker.terminal_states`: 终态；进入这些状态后不再工作，workspace 可能被清理。
- `workspace.root`: 每个 issue 的独立工作目录根路径。
- `hooks.after_create`: 新 workspace 创建后执行，一般用于 clone repo、安装依赖、初次 build。
- `agent.max_concurrent_agents`: 同时跑几个 agent。QDD 当前设为 1，方便学习和观察。
- `agent.max_turns`: 单次 agent run 最多循环多少 turn。
- `codex.command`: 启动 Codex app-server 的命令，包括模型和 reasoning effort。
- `codex.approval_policy: never`: agent 不再交互式问批准，适合自动化，但要确保 workflow 和权限边界写清楚。

第二部分是 prompt 正文，决定 agent 行为。例如：

- 开发时先读 `docs/09-qdd-conclude-prd.md`。
- PR/报告/Linear workpad 用中文。
- `Human Review` 是暂停态。
- `Merging` 只做合并，不扩展功能范围。
- PR 必须以 `main` 为 base。

## 启动流程

先确保代理可用。本次第三方模型 provider 会访问 `https://www.78code.cc/v1/responses`，无代理时遇到过 Cloudflare 403。

```bash
clashon
clashtun
```

然后启动 Symphony：

```bash
qdd-symphony
```

`qdd-symphony` 是本机 shell function/alias，作用是运行：

```bash
/data/chenyz/symphony/elixir/bin/symphony /data/chenyz/project/qdd/WORKFLOW.md
```

如果换项目，应该换成对应项目的 `WORKFLOW.md`。

## 正常工作流

1. 在 Linear 创建 issue，放到 QDD project，打上 `qdd-conclude` label。
2. issue state 设为 `Todo` 或 `In Progress`。
3. Symphony 轮询到 issue 后创建 workspace，例如 `~/code/qdd-symphony-workspaces/BIL-5`。
4. agent clone GitHub 仓库，安装依赖，执行 build。
5. agent 创建 issue branch，例如 `bil-5-...`。
6. agent 实现、验证、提交、推送。
7. agent 创建或记录 PR，并把 issue 移到 `Human Review`。
8. 人类 review PR。
9. 如果要改，改 issue 到 `Rework`。
10. 如果通过，改 issue 到 `Merging`。
11. Symphony 再次调度 agent，执行 merge 收尾。
12. merge 成功后，agent 更新 workpad 并把 issue 改到 `Done`。
13. 本地开发仓库执行 `git pull` 同步远端 `main`。

## 本次踩坑

### 1. `Merging` 不在 Linear issue workflow 里

只在 `WORKFLOW.md` 写 `Merging` 不够。Linear team workflow 里必须真的有这个 issue status，否则界面选不到，Symphony 也抓不到。

### 2. 改了 project status，但 Symphony 看不到

Linear 有 project status，也有 issue workflow state。当前 Symphony 查询是：

```graphql
issues(filter: {project: ..., state: {name: {in: $stateNames}}})
```

所以它监听 issue state。`Human Review`、`Merging` 要建在 Team Workflow 的 issue statuses 里。

### 3. `Human Review` 不应该是 active state

`Human Review` 是人类审核暂停态。如果放进 `active_states`，agent 可能会在你 review 时继续工作，破坏人工把关。

正确做法：`Human Review` 不 active，`Merging` active。

### 4. BIL-5 一度被设成 `Done`

`Done` 是 terminal state。进入 `Done` 后，Symphony 不会再调度它。如果还没 merge，不要提前设成 `Done`。

### 5. 没开代理导致 Codex session 一直 error

表面现象：

```text
Codex notification: "error"
```

真正根因在 log 里：

```text
Access blocked by Cloudflare ... status 403 Forbidden ... https://www.78code.cc/v1/responses
```

解决：先启动 `clashon` 和 `clashtun`，再启动 `qdd-symphony`。

### 6. 只看 dashboard 不够，要看 log

dashboard 可能只显示 `error`，不显示完整 payload。定位时看：

```bash
tail -n 80 /data/chenyz/symphony/elixir/log/symphony.log.1
```

如果需要更细，可以临时增强 Symphony 的 Codex error 日志，但这属于本地调试补丁，不应混入 QDD 仓库。

### 7. `mise trsut` 是拼写错误

正确命令：

```bash
mise trust
mise install
```

如果没有管理员权限，可以把 `mise` 安装到用户目录，并把用户 bin 加到 PATH：

```bash
export PATH="$HOME/.local/bin:$PATH"
```

长期生效可放进 `~/.bashrc`。

### 8. API key 不要写进仓库

Linear API key 应放在用户级环境文件或 shell profile，不要写入 `WORKFLOW.md`、`AGENTS.md` 或任何 git tracked 文件。

当前建议：

```bash
~/.config/symphony/env
```

然后在 `~/.bashrc` 中 source。

### 9. 本地仓库和 Symphony workspace 是两份 clone

Symphony 不直接在 `/data/chenyz/project/qdd` 里改代码，而是在独立 workspace 里工作。

所以 PR merge 到 GitHub `main` 后，本地 QDD 仓库需要：

```bash
git pull
```

### 10. GitHub 仓库和主分支要显式写进 workflow

如果不写，agent 可能猜错 base branch 或 remote。

QDD 当前明确：

```text
GitHub: https://github.com/BillyChen123/qdd
SSH remote: git@github.com:BillyChen123/qdd.git
Base branch: main
```

## 调试检查表

看当前 workflow 是否能被 Symphony 解析：

```bash
cd /data/chenyz/symphony/elixir
mise exec -- mix run -e 'case SymphonyElixir.Workflow.load("/data/chenyz/project/qdd/WORKFLOW.md") do {:ok, wf} -> IO.inspect(get_in(wf.config, ["tracker", "active_states"]), label: "active_states"); IO.puts("workflow ok"); other -> IO.inspect(other) end'
```

看本地 Git remote 和当前分支：

```bash
git remote -v
git branch --show-current
git ls-remote --symref origin HEAD
```

看 Symphony issue workspace：

```bash
git -C ~/code/qdd-symphony-workspaces/BIL-5 status --short --branch
git -C ~/code/qdd-symphony-workspaces/BIL-5 branch -vv
```

看 Symphony 日志：

```bash
tail -n 80 /data/chenyz/symphony/elixir/log/symphony.log.1
```

## 最小复用模板

新项目接入 Symphony 时，至少准备：

1. 一个 GitHub 仓库和明确主分支。
2. 一个 Linear project。
3. Team Workflow 里的 issue statuses：`Todo`, `In Progress`, `Human Review`, `Merging`, `Done`，可选 `Rework`。
4. 一个项目级 label，用于限制 Symphony 只处理目标 issue。
5. 一个 `WORKFLOW.md`，写清楚：
   - `tracker.project_slug`
   - `required_labels`
   - `active_states`
   - `terminal_states`
   - workspace clone/build hook
   - Codex model 和 reasoning effort
   - repo URL、base branch、PR target
   - 每个 Linear state 下 agent 应该做什么
6. 用户级环境变量：
   - `LINEAR_API_KEY`
   - Codex provider 相关配置
7. 网络代理或 provider 可访问性验证。

## 当前 QDD 推荐状态

QDD 现在应保持：

```text
Todo / In Progress / Rework / Merging -> Symphony active
Human Review -> human pause
Done / Closed / Canceled / Duplicate -> terminal
```

开发完成不直接 `Done`。先到 `Human Review`，人类确认后改到 `Merging`，最后由 Symphony merge 后再到 `Done`。
