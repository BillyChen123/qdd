---
name: env/fix-cache-layout
description: Prepare a project-local cache layout and env exports before Python or R analysis when sandboxed runs fail because .cache paths are missing or unwritable.
---

# env/fix-cache-layout

在新项目第一次跑分析前，如果你怀疑沙箱环境、`matplotlib`、`numba` 或 XDG cache 会因为缺少本地 `.cache/` 而卡住，先用这个 skill。

## 什么时候用

- 项目目录里还没有 `.cache/`
- Python 分析第一次启动就报 cache / permission / config 相关错误
- 你想把运行时缓存固定在项目内，而不是写到用户全局目录

## 这个 skill 做什么

它会在目标项目里创建一组稳定的本地缓存目录：

- `.cache/matplotlib`
- `.cache/numba`
- `.cache/xdg`
- `.cache/tmp`

并生成：

- `.qdd/cache-env.sh`

这个文件可以在运行分析前 `source` 进去，统一导出：

- `XDG_CACHE_HOME`
- `MPLCONFIGDIR`
- `NUMBA_CACHE_DIR`
- `TMPDIR`

## 标准用法

在项目根目录执行：

```bash
bash .codex/skills/env/fix-cache-layout/scripts/ensure_cache_layout.sh .
source .qdd/cache-env.sh
```

如果你当前只看得到 `.claude/skills/`，对应脚本路径可以换成：

```bash
bash .claude/skills/env/fix-cache-layout/scripts/ensure_cache_layout.sh .
source .qdd/cache-env.sh
```

## 使用原则

1. 先跑一次这个脚本，再执行 Python / R 分析命令。
2. 如果项目已经有 `.cache/`，这个脚本只补齐缺失目录，不会删你的现有内容。
3. 不要把大型缓存文件登记进 `artifacts/index.yaml`。这只是运行时依赖，不是研究证据。
4. 如果任务明确依赖项目内缓存，可以在 task 的 `skills:` 和 `## Skills` 里写入 `env/fix-cache-layout`。

## 建议执行方式

一次性命令：

```bash
source .qdd/cache-env.sh && python your_script.py
```

或者在同一个 shell 会话里先加载：

```bash
source .qdd/cache-env.sh
```

然后再跑后续分析命令。

## 什么时候停止

满足下面任一条件就够了：

- `.cache/` 和 `.qdd/cache-env.sh` 已生成
- 相关分析命令已经能正常启动
- 后续任务可以稳定复用这个本地 cache 布局
