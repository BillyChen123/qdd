---
name: public-data/cellxgene-discover
description: Source-specific public dataset search and download skill for CELLxGENE. Use when a task must search or download selected CELLxGENE datasets from a thin public_data_request handoff.
domain: public-data
stage: acquisition
tags:
  - cellxgene
  - datasets
---

# public-data/cellxgene-discover

## 入口

- script: `scripts/cellxgene_discover.py`
- params: `parameters.yaml`
- environment: `qdd-skill-core`

## 什么时候用

- 研究规划已经确认需要外部 public dataset
- source 已明确为 `cellxgene`
- 输入已经被整理成 `public_data_request.yaml`
- 需要执行两类动作之一：
  - `search`
  - `download`

不要把这个 skill 用在 marker、ligand-receptor、PubMed evidence、GEO candidate survey 这类轻量 public-data capture 上。

## 输入契约

这个 skill 读取的核心 handoff 文件是：

- `studies/STUDY-XXX/output/public_data_request.yaml`

推荐最小结构：

```yaml
source: cellxgene
modality: scrna
goal: validation

constraints:
  organism: Homo sapiens
  tissue: ovary
  disease: ovarian cancer
  state: TRM
  cell_type:
  assay:

source_query:
  max_results: 5

selected:
  - dataset_id: 00000000-0000-0000-0000-000000000000
    alias: cellxgene_validation_01

selection_note: matched ovary cancer validation cohort
```

兼容迁移期旧格式：

```yaml
query:
  organism: Homo sapiens
  tissue: ovary
  disease: ovarian cancer
  state: TRM
  cell_type:
  max_results: 5
```

但新规划应优先写 `constraints + source_query`。

## 模态说明

- 当前允许的研究意图：`scrna`、`spatial`
- 这个 skill 是 source skill，不是单细胞专属 skill
- 它不负责 spatial image、segmentation、morphology 等额外对象；它只处理 CELLxGENE 可交付的结构化数据对象

## 支持动作

### 1. search

读取 `constraints` 与 `source_query`，调用 CELLxGENE 元数据接口，输出一个小候选表。

第一版至少返回这些字段：

- `dataset_id`
- `dataset_title`
- `collection_name`
- `collection_doi`
- `citation`
- `cell_count`
- `matched_fields`

候选表默认写到：

- `studies/STUDY-XXX/output/tables/cellxgene_candidates.csv`
- `studies/STUDY-XXX/output/reports/cellxgene_search_report.md`
- `studies/STUDY-XXX/output/reports/cellxgene_search_result.json`

`search` 不负责自动把候选全部写进持久化 handoff。

### 2. download

读取 `selected`，只下载其中列出的 dataset。

下载目标默认落在：

- `artifacts/data/`

同时输出：

- `studies/STUDY-XXX/output/reports/cellxgene_download_report.md`
- `studies/STUDY-XXX/output/reports/cellxgene_download_result.json`

## 关键参数

- `--action {search,download}`
- `--request <public_data_request.yaml>`
- `--output <study-output-dir>`
- `--artifact-data-dir <artifacts/data>`
- `--max-results <int>`：可覆盖 request 里的 `source_query.max_results`
- `--allow-non-primary`：默认只保留 primary data；加这个开关才放宽

## 示例

```bash
conda run -n qdd-skill-core python \
  domain-skills/public-data/cellxgene-discover/scripts/cellxgene_discover.py \
  --action search \
  --request studies/STUDY-001/output/public_data_request.yaml \
  --output studies/STUDY-001/output \
  --artifact-data-dir artifacts/data
```

```bash
conda run -n qdd-skill-core python \
  domain-skills/public-data/cellxgene-discover/scripts/cellxgene_discover.py \
  --action download \
  --request studies/STUDY-001/output/public_data_request.yaml \
  --output studies/STUDY-001/output \
  --artifact-data-dir artifacts/data
```

## 输出

`search`:

- `tables/cellxgene_candidates.csv`
- `reports/cellxgene_search_report.md`
- `reports/cellxgene_search_result.json`

`download`:

- one or two downloaded `.h5ad` files under `artifacts/data/`
- `reports/cellxgene_download_report.md`
- `reports/cellxgene_download_result.json`

## 注意事项

- 这个 skill 不负责决定“是否需要 public data”，那是 `brain/public-data/public-data-planning` 的职责
- 这个 skill 不负责自由文本研究规划
- `download` 只消费 `selected`，不重新做 broad search
- 第一版相关性判断主要依赖结构化字段、标题、citation、collection 信息，不要求必须有论文摘要
- 默认不要下载很多数据集；如果 `selected` 超过 2 个，应把它视为 planning 约束被破坏
