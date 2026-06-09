---
name: brain/public-data/public-data-planning
description: Public dataset planning protocol for QDD. Use during qdd-propose and qdd-explore whenever a study may need external datasets and the agent must decide whether to search, whether a lightweight candidate-capture task is enough, how to structure the request, and what final selected targets should be handed to apply.
---

# brain/public-data/public-data-planning

## When To Use

Use this skill only during `qdd-propose` and `qdd-explore`.

Trigger this skill when at least one of the following is true:

- the current study cannot be executed from local resources alone
- the study needs an external validation cohort
- the study needs an external reference atlas for annotation
- the study needs an external control or baseline dataset
- the user explicitly asks to search public datasets

Do not use this skill as an executor skill.
Do not write `brain/*` into task `skills:`.
Do not use this skill for lightweight public reference tables such as markers, ligand-receptor pairs, or pathway collections; those belong to `brain/public-data/reference-planning`.

If local resources already support the study well enough, do not force a public-data task.

## Role In QDD

This skill does not define QDD workflow semantics.

- `qdd-propose` owns first-pass study/task creation
- `qdd-explore` owns discussion and refinement
- this skill only provides the public-data planning protocol used inside those workflows

Its job is:

1. decide whether external public data is actually needed
2. decide whether the next step is a selected-dataset path or a lighter candidate-capture path
3. structure either a thin search request or a bounded candidate-capture intent that a source skill can execute
4. narrow candidate datasets to a very small selected set when the study truly needs immediate acquisition
5. define the handoff that `qdd-apply` may consume without reopening broad search

This skill is specifically for dataset-shaped public data.
It is not the planning surface for lightweight reference fetches.

## Planning Contract

Treat public-data planning as a fixed four-step protocol:

1. Resource sufficiency check
2. Search intent structuring
3. Candidate narrowing
4. Selection or blocker decision

The outcome must be one of:

- `no-public-data-task`
  - local resources are sufficient
  - do not create a public-data task
  - do not create `public_data_request.yaml`
- `capture`
  - create a lightweight public-data task
  - keep the bounded search intent in the task itself
  - do not create `public_data_request.yaml`
  - use this when the study first needs an auditable candidate table rather than an immediate download
- `selected`
  - create a public-data task
  - write a thin `public_data_request.yaml`
  - let `qdd-apply` download only the selected targets
- `blocked`
  - external data is genuinely needed
  - no acceptable public dataset was found
  - record a bounded blocker instead of pretending execution can continue

Do not create a public-data task just because public datasets exist in principle.

Do not treat a failed public-data search as a project-wide failure when the study can still proceed from local resources.

## Required Read Order

Before planning, read in this order:

1. `contract.yaml`
2. `context/resources.md`
3. current `study.md`
4. current `task.md`
5. relevant reusable artifacts
6. this skill

If project facts conflict with heuristics in this skill, trust project facts.

---

## Step 1: Resource Sufficiency Check

### Goal

Decide whether the study really needs external public data.

### Check At Minimum

- do local datasets already support the question directly
- do local datasets cover the key organism, tissue, and disease state
- is the external need about:
  - validation
  - reference annotation
  - control/baseline
  - extension to a missing cohort
- can the current study remain judgeable without outside data

### Outcomes

- If local resources are sufficient:
  - stop here
  - do not create a public-data task
- If outside data would improve the study but is not essential:
  - keep that optionality explicit
  - do not force a download path into the first pass unless the study truly depends on it
- If outside data is essential:
  - continue to Step 2

### Examples

Good:

- skip public-data planning because the local h5ad already supports the primary hypothesis test
- create a public-data task because the study explicitly needs an independent validation cohort

Bad:

- create a public-data task by reflex before checking local resources
- treat “more public data might be interesting” as the same thing as “the study requires external data now”

---

## Step 2: Search Intent Structuring

### Goal

Convert the human research direction into a thin structured request that an executor skill can consume directly.

### Required Fields

Write or confirm these fields for `public_data_request.yaml`:

- `source`: current executor-backed public source such as `cellxgene`
- `modality`: study intent such as `scrna` or `spatial`
- `goal`: a short study-level purpose such as:
  - `validation`
  - `reference`
  - `control`
  - `extension`

Under `constraints`, structure at minimum:

- `organism`
- `tissue`
- `disease`
- `state` when it materially matters
- `cell_type` when it materially matters
- `assay` when it materially matters

Under `source_query`, keep only the few source-specific knobs that matter for this slice, for example:

- `max_results`

Keep the handoff thin.
Do not persist a long free-text rationale in the handoff file.

### Source Choice Rule

- choose a source only when there is a matching executor skill in the local catalog
- do not write a source into `public_data_request.yaml` until a corresponding selected-dataset executor skill exists
- current stable selected-dataset executor: `public-data/cellxgene-discover`
- current stable lightweight dataset-survey executor: `public-data/geo-candidate-capture`

### Lightweight Candidate-Capture Rule

Use a lightweight capture task instead of `public_data_request.yaml` when:

- the study first needs an auditable GEO candidate table
- the likely source files are heterogeneous enough that forced auto-download would be premature
- the user needs reviewable accession-level candidates before committing to one selected dataset

In this path:

- write the bounded source and search terms directly into the task
- choose `public-data/geo-candidate-capture`
- expect apply to materialize a local candidate CSV and report
- do not invent a selected-target handoff yet

### Search Broadening Ladder

Use this order:

1. exact organism + tissue + disease
2. same organism + broader tissue interpretation
3. same organism + disease with weaker state/cell-type constraints
4. same organism + tissue-driven reference/validation fallback

Do not jump straight to broad free-text search.

### Handoff Shape

The only required persisted handoff is:

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

selected: []
selection_note:
```

Do not create a separate persisted candidate manifest by default.
Do not create this handoff at all for lightweight candidate-capture tasks.

---

## Step 3: Candidate Narrowing

### Goal

Use structured metadata plus stable study metadata to reduce candidate datasets to a very small set.

### What To Prefer

In the first slice, prefer ranking signals such as:

- matched organism
- matched tissue
- matched disease
- matched cell type when available
- dataset title relevance
- collection name relevance
- citation or DOI context when available
- reasonable cell count

This first slice does not require stable article-abstract access.

If richer summaries are available later, they may improve ranking, but they are not required to decide the first slice.

### Selected Set Rule

Keep the final selected set small:

- default: one dataset
- maximum: two datasets
- only select two when the study explicitly needs both:
  - a primary target and
  - one validation or reference dataset

Do not turn candidate narrowing into bulk dataset collection.

### Candidate Display Rule

Show the short candidate table in the conversation.
Persist only the final selected result.

---

## Step 4: Selection Or Blocker Decision

### Goal

Choose the execution outcome without leaking planning ambiguity into `qdd-apply`.

### human / assist

- show the short candidate table
- ask for confirmation before finalizing `selected`, unless the target is already unambiguous
- write the chosen target(s) into `public_data_request.yaml`

### auto

- planning may finalize the selected set directly
- `qdd-apply` still owns the actual download
- do not let planning perform large side-effectful downloads

### If Nothing Suitable Is Found

Choose one of:

- `no-public-data-task`
  - if the study can still proceed locally
- `blocked`
  - if external data is essential and no acceptable target exists

Do not create a fake selected target just to keep execution moving.

---

## QDD Skill Hook

When a public-data task is genuinely needed, prefer:

```bash
qdd skills suggest --domain public-data --stage acquisition --tag cellxgene --json
```

Expected executor skill candidate:

- `public-data/cellxgene-discover`

## Output Rules

If a public-data task is required:

- create or update `studies/STUDY-XXX/output/public_data_request.yaml`
- keep `constraints` explicit
- keep `source_query` small
- keep `selected` explicit
- keep `selection_note` short

If a public-data task is not required:

- do not create the file just for symmetry

If a public-data blocker exists:

- record it in the study/task blockers
- do not pretend `qdd-apply` should search again

## Anti-Patterns

Do not:

- create a public-data task before checking local resources
- persist a large candidate history file by default
- let `qdd-apply` reopen broad search
- choose many datasets because they all look vaguely relevant
- depend on article abstracts as a hard requirement for the first slice
- mix public-data acquisition skills into `singlecell/*` or `spatial/*` analysis execution skills
