---
name: singlecell/public-data/cellxgene-discover
description: Problem-level external public dataset search and download skill for CELLxGENE. Use when a task must search CELLxGENE from a structured request, show a small candidate set, and download the final selected h5ad targets.
domain: singlecell
stage: acquisition
tags:
  - public-data
  - dataset-search
  - dataset-download
  - cellxgene
  - citation
  - title-match
---

# singlecell/public-data/cellxgene-discover

## 入口

- script: `scripts/cellxgene_discover.py`
- params: `parameters.yaml`
- environment: `CellFM_torch`

## 什么时候用

- 研究规划已经确认需要外部 public scRNA 数据
- 输入已经被整理成 `public_data_request.yaml`
- 需要执行两类动作之一：
  - `search`
  - `download`

## 输入契约

这个 skill 读取的核心 handoff 文件是：

- `studies/STUDY-XXX/output/public_data_request.yaml`

最小结构：

```yaml
source: cellxgene
modality: scrna
goal: validation

query:
  organism: Homo sapiens
  tissue: ovary
  disease: ovarian cancer
  state: TRM
  cell_type:
  max_results: 5

selected:
  - dataset_id: 00000000-0000-0000-0000-000000000000
    alias: cellxgene_validation_01

selection_note: matched ovary cancer validation cohort
```

## 支持动作

### 1. search

读取 `query`，调用 CELLxGENE 元数据接口，输出一个小候选表。

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
- `--max-results <int>`：可覆盖 request 里的 `query.max_results`
- `--primary-only`：默认只保留 primary data

## 示例

```bash
conda run -n CellFM_torch python \
  domain-skills/singlecell/public-data/cellxgene-discover/scripts/cellxgene_discover.py \
  --action search \
  --request studies/STUDY-001/output/public_data_request.yaml \
  --output studies/STUDY-001/output \
  --artifact-data-dir artifacts/data
```

```bash
conda run -n CellFM_torch python \
  domain-skills/singlecell/public-data/cellxgene-discover/scripts/cellxgene_discover.py \
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

- 这个 skill 不负责决定“是否需要 public data”，那是 `brain/singlecell/public-data-planning` 的职责
- 这个 skill 不负责自由文本研究规划
- `download` 只消费 `selected`，不重新做 broad search
- 第一版相关性判断主要依赖结构化字段、标题、citation、collection 信息，不要求必须有论文摘要
- 默认不要下载很多数据集；如果 `selected` 超过 2 个，应把它视为 planning 约束被破坏
