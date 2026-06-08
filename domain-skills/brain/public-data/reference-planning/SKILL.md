---
name: brain/public-data/reference-planning
description: Public reference planning protocol for QDD. Use during qdd-propose and qdd-explore when a study needs lightweight public reference tables such as markers or ligand-receptor pairs and the agent must decide which source to query, what bounded search intent to write into the task, and which fetch executor should materialize the local file.
---

# brain/public-data/reference-planning

## When To Use

Use this skill only during `qdd-propose` and `qdd-explore`.

Trigger this skill when the study needs a lightweight public reference resource such as:

- marker tables for annotation
- ligand-receptor pairs for communication scoring
- other small public reference tables that can be fetched on demand

Do not use this skill for dataset discovery or validation cohorts.
Those belong to `brain/public-data/public-data-planning`.

Do not use this skill as an executor skill.
Do not write `brain/*` into task `skills:`.

## Role In QDD

This skill stores planning-time judgment only.

Its job is:

1. decide whether an external reference table is actually needed
2. choose the most appropriate public source for that need
3. write a bounded search intent directly into the task text
4. assign the corresponding fetch executor during planning
5. make sure apply will materialize a local CSV or TSV for downstream reuse

This skill does not introduce a new managed YAML contract.

## Core Principle

Treat lightweight public references differently from datasets.

- Datasets need selection and a thin handoff such as `public_data_request.yaml`
- Reference tables usually do not need a separate handoff file
- The bounded search intent should live in the task itself
- The executor should freeze the chosen content into a local CSV or TSV

The agent still makes the selection judgment.
But the final chosen rows must become a local file so downstream analysis is reviewable and reproducible.

## Required Read Order

Before planning, read in this order:

1. `contract.yaml`
2. `context/resources.md`
3. current `study.md`
4. current `task.md`
5. relevant reusable artifacts
6. this skill

## Step 1: Decide Whether A Reference Fetch Is Needed

Ask:

- does a downstream executor already have enough built-in prior knowledge
- would a public reference materially improve consistency or auditability
- is the need specifically for a small table rather than a new dataset
- will the downstream task consume a local `--marker-file` or `--lr-file`

If the study can proceed well enough without an external reference table, do not force one.

## Step 2: Pick The Source Family

Use the smallest stable public source that matches the need.

Current stable executors:

- `public-data/cellmarker-fetch`
  - for marker-backed annotation tables
- `public-data/lrdb-fetch`
  - for ligand-receptor interaction tables

Do not assign a source unless there is an installed executor skill for it.

## Step 3: Write The Bounded Search Intent Into The Task

Do not invent a new YAML handoff.

Instead, make the task explicit about:

- why the reference is needed
- which source to query
- the organism
- optional tissue or system context
- the main query terms the executor should search
- which downstream executor will consume the output

Good task wording example:

- fetch a bounded CellMarker marker table for human ovarian stromal and immune populations, materialize `markers_selected.csv`, then use it in `spatial/spatial-marker-annotation`

Good task wording example:

- fetch a mouse ligand-receptor table from CellTalkDB with immune and fibroblast signaling terms, materialize `lr_selected.tsv`, then use it in `singlecell/scrna/sc-cell-communication`

Bad:

- get some markers from the internet
- download a big reference database just in case
- leave source choice for apply to improvise

## Step 4: Keep The Fetch Task Lightweight

Reference fetch tasks should stay small.

Prefer:

- one explicit source
- one organism
- a short list of query terms
- one local output file meant for downstream reuse

Do not ask apply to build a long candidate pool or a giant local knowledge base by default.

## Step 5: Final Planning Outcome

The planning outcome should be one of:

- `no-reference-fetch`
  - downstream work can proceed without it
- `reference-fetch`
  - write a bounded fetch task with one executor skill
- `blocked`
  - the study truly requires the reference, but no installed source skill fits

If `reference-fetch` is chosen:

- write the task-local executor skill during planning
- keep the search intent in task Markdown
- expect apply to materialize a local CSV or TSV under the study output directory

## Mapping To Existing Executors

### Marker files

Use `public-data/cellmarker-fetch` when:

- `singlecell/scrna/sc-marker-annotation` needs `--marker-file`
- `spatial/spatial-marker-annotation` needs `--marker-file`
- `singlecell/scatac/scatac-annotation-geneactivity` needs `--marker-file`

### Ligand-receptor files

Use `public-data/lrdb-fetch` when:

- `singlecell/scrna/sc-cell-communication` needs `--lr-file`

## Notes

- The executor may search online during apply, but only within the bounded source and query intent recorded during planning
- The selected reference rows should always end up in a local CSV or TSV, not only in narrative text
- Keep the planning contract light; the task text is the handoff
