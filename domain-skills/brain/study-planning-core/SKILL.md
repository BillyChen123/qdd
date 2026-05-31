---
name: brain/study-planning-core
description: Single-cell study-brain protocol for QDD. Use during qdd-propose and qdd-explore whenever the study involves scRNA-seq planning on h5ad/AnnData and the agent must decide which stages are already reusable, which stages must be rerun, and which executor skills should be attached to tasks.
---

# brain/study-planning-core

## When To Use

Use this skill only during `qdd-propose` and `qdd-explore`.

Trigger this skill when all of the following are true:

- the study involves single-cell RNA-seq
- the main working object is `h5ad` / `AnnData`
- the agent must plan or review one of these stages:
  - preprocess
  - integration
  - clustering and annotation
  - downstream analysis
- the agent must decide whether an existing result can be reused or a stage must be redone
- the agent must choose executor skills for a task

Do not use this skill as an executor skill.
Do not write `brain/*` into task `skills:`.

## Role In QDD

This skill does not define QDD workflow semantics.

- `qdd-propose` owns study/task creation
- `qdd-explore` owns discussion and refinement
- this skill only provides the single-cell planning protocol used inside those workflows

Its job is:

1. inspect whether the current h5ad is already usable
2. decide which stages are passed, which must be rerun, and which can be lightly repaired
3. define one stable downstream starting point
4. help choose executor skills through bounded `qdd skills suggest`

## Planning Contract

Treat single-cell planning as a fixed four-stage protocol:

1. Preprocess
2. Integration
3. Clustering and Annotation
4. Downstream

These are not four mandatory reruns.
They are four mandatory review gates.

For each gate, the planner must decide one of:

- `reuse` - existing result is good enough and can be carried forward
- `repair` - only light repair is needed, such as renaming columns, harmonizing fields, or restoring expected layers
- `rerun` - the stage is not trustworthy and must be redone

The planner must not enter a later gate until the earlier gate is either `reuse`, `repair`, or `rerun -> completed`.

The target before downstream is a single reusable study-level analysis object:

- one canonical `adata` / `h5ad`
- field names are clear
- provenance is clear
- the state is sufficient for downstream analysis
- it can be reused across later studies or tasks

If multiple candidate h5ad objects exist, choose one as the primary downstream base and explain why.

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

## Stage 1: Preprocess

### Goal

Establish whether the current h5ad is structurally valid and biologically usable as the base object.

### Input Checks

Check at minimum:

- is the object a valid `h5ad` / `AnnData`
- does `obs` contain required metadata for this study
- does `var` contain usable gene symbols or a mapped gene identifier
- does `.X` look like raw counts, logged values, or an unclear processed matrix
- do `layers` contain a better source matrix
- does `.raw` exist and is it meaningful
- are basic QC fields already present
- are HVGs already defined and are they trustworthy

### Default Action

Default to `inspect first`, not immediate rerun.

If the object is new or unclear, plan a preprocess task.

### Condition Branches

- If structure is incomplete, metadata is missing, or matrix state is unclear:
  - `rerun` or `repair` preprocess
- If the object is already well-prepared and the processing history is legible:
  - `reuse`
- If the object is mostly usable but field names, layers, or metadata need harmonization:
  - `repair`

### Reusable Output

A preprocess-passed object should preserve or establish:

- usable `obs`
- usable `var`
- clear matrix semantics
- QC summary
- HVG state
- a saved processed `h5ad`

This object is a valid candidate for reuse in later integration, clustering, or downstream planning.

### QDD Skill Hook

If preprocess work is needed, prefer:

```bash
qdd skills suggest --domain singlecell --stage preprocess --tag h5ad --tag qc --json
```

Expected executor skill candidate:

- `singlecell/scrna/sc-preprocess-qc`

### Examples

Good:

- inspect first, then skip rerun because the object is already logged and HVGs are present
- repair only metadata column names and preserve the processed matrix

Bad:

- rerun normalize/log1p without checking whether the object was already processed
- carry an object forward when gene symbols or required study metadata are missing

---

## Stage 2: Integration

### Goal

Decide whether batch/sample structure must be diagnosed or corrected before clustering and downstream work.

### Input Checks

Check at minimum:

- is this a multi-sample or multi-batch study
- is there a reliable batch/sample column in `obs`
- does the study require cross-sample comparison or atlas-style joint analysis
- do existing embeddings show likely sample separation
- does an integrated object already exist
- if integration already exists, is the method and provenance clear

### Default Action

Default to `diagnose before correcting`.

Do not assume multi-sample always means forced correction.
Do not assume no correction is needed without inspection.

### Condition Branches

- Single-sample:
  - usually `reuse` and skip correction
- Multi-sample with no obvious batch problem and no strong integration need:
  - may `reuse` non-integrated object
- Multi-sample with visible separation or atlas/comparison goal:
  - `rerun` or `reuse` integration depending on provenance quality
- Existing integrated object but unclear method, inputs, or batch key:
  - prefer `rerun` or at least treat as suspicious

### Reusable Output

An integration-passed object should include:

- a saved integrated or integration-reviewed `h5ad`
- clear batch/sample key usage
- method provenance
- diagnostic figures or summary tables showing why integration was or was not used

This is still part of the canonical downstream base.

### QDD Skill Hook

If integration work is needed, prefer:

```bash
qdd skills suggest --domain singlecell --stage integration --tag multi-sample --tag batch-diagnosis --json
```

Expected executor skill candidate:

- `singlecell/scrna/sc-batch-integration`

### Examples

Good:

- diagnose first, then decide Harmony or Scanorama is necessary
- explicitly keep the non-integrated object when no meaningful batch effect is found

Bad:

- integrate every multi-sample dataset by reflex
- skip diagnosis when embeddings already suggest strong sample separation

---

## Stage 3: Clustering And Annotation

### Goal

Establish a biologically interpretable cell-state or cell-type structure that is good enough to support downstream questions.

### Input Checks

Check at minimum:

- are PCA, neighbors, and UMAP already present
- are clusters already present
- if clusters exist, are they relevant to the current study question
- is annotation already present
- if annotation exists, is it trustworthy for this study
- are marker resources or prior labels available

### Default Action

Default to review existing clustering and annotation before rerunning.

Do not treat existing labels as automatically valid.
Do not rerun clustering if the current result is already suitable.

### Condition Branches

- No clustering present:
  - `rerun`
- Clustering present but provenance or relevance is weak:
  - `rerun`
- Clustering present and suitable, annotation absent:
  - `reuse clustering`, plan annotation only
- Annotation present but weakly justified:
  - `repair` or `rerun` annotation
- High-quality clustering and annotation already aligned with the study:
  - `reuse`

### Reusable Output

A clustering/annotation-passed object should include:

- cluster assignments
- annotation fields when available
- key marker evidence or annotation notes
- a saved h5ad ready for downstream analysis

This is the preferred downstream starting object.

### QDD Skill Hook

If clustering work is needed:

```bash
qdd skills suggest --domain singlecell --stage clustering --tag leiden --tag umap --json
```

Expected executor skill candidate:

- `singlecell/scrna/sc-clustering`

If annotation work is needed:

```bash
qdd skills suggest --domain singlecell --stage annotation --tag markers --tag cell-type --json
```

Expected executor skill candidate:

- `singlecell/scrna/sc-marker-annotation`

### Examples

Good:

- reuse existing clusters, but re-annotate because the prior annotation is too coarse for the current study
- rerun clustering when the old clustering was built for a different biological question

Bad:

- trust old labels without checking whether they serve the current study
- move into downstream comparison before clusters or annotations are interpretable

---

## Stage 4: Downstream

### Goal

Plan downstream analysis only after a stable canonical h5ad has been established.

### Input Checks

Before entering downstream, confirm that the canonical h5ad is available and that:

- preprocess gate is passed
- integration gate is passed or explicitly skipped with justification
- clustering and annotation gate is passed at the level required by the study

### Default Action

Downstream planning is allowed only after a usable canonical h5ad exists.

### Condition Branches

- If the canonical h5ad does not yet exist:
  - do not plan downstream as the main task
- If the canonical h5ad exists but annotations are too weak for the downstream claim:
  - return to Stage 3
- If the canonical h5ad is ready:
  - downstream planning may proceed

### Reusable Output

Downstream executor skills are not defined yet in this slice.

For now, downstream planning should leave an explicit placeholder describing:

- target question
- required biological grouping
- expected outputs
- missing downstream skill gap, if any

---

## Reuse Standard

Before downstream, QDD should prefer to produce one primary reusable study-level `h5ad`.

This object should be:

- readable
- provenance-clear
- semantically clear in fields and layers
- adequate for later downstream tasks
- saved under study outputs and eligible for artifact promotion

Promote or preserve at least these reusable materials when they are valid:

- canonical processed, integrated, or annotated `h5ad`
- QC summaries
- integration diagnostics
- cluster and annotation summaries
- key figures required to justify stage decisions

Do not promote:

- ambiguous temporary objects
- outputs with unclear provenance
- failed or abandoned trial artifacts
- stage results that cannot explain how they were produced

## Hard Rules

- do not skip directly to downstream because the object looks usable
- do not rerun an earlier stage without checking whether it can be reused
- do not carry forward an h5ad with unclear matrix semantics
- do not treat existing labels as trustworthy without checking relevance to the current study
- do not plan downstream on top of a non-canonical or poorly documented base object
