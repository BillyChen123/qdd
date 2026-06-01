---
name: brain/singlecell/scatac-planning
description: Single-cell ATAC study-brain protocol for QDD. Use during qdd-propose and qdd-explore whenever the study involves scATAC, snATAC, or multiome-ATAC planning on h5ad/AnnData and the agent must decide which ATAC stages are reusable, which stages must be rerun, and which executor skills should be attached to tasks.
---

# brain/singlecell/scatac-planning

## When To Use

Use this skill only during `qdd-propose` and `qdd-explore`.

Trigger this skill when all of the following are true:

- the study involves scATAC-seq, snATAC-seq, or the ATAC side of a multiome dataset
- the main working object is `h5ad` / `AnnData`
- the agent must decide whether the current object is already usable, must be repaired, or must be rerun
- the agent must decide which executor skills belong in task `skills:`

Do not use this skill as an executor skill.
Do not write `brain/*` into task `skills:`.

## Role In QDD

This skill does not define QDD workflow semantics.

- `qdd-propose` owns study/task creation
- `qdd-explore` owns discussion and refinement
- this skill only provides the scATAC planning protocol used inside those workflows

Its job is:

1. classify the ATAC input state before task planning
2. force a stable four-stage review before downstream claims
3. define one reusable pre-downstream ATAC handoff object
4. help choose executor skills through bounded `qdd skills suggest`

## Planning Contract

Treat scATAC planning as a fixed four-stage protocol:

1. Input & QC
2. Representation & Integration
3. Clustering & Annotation
4. Downstream Regulatory Analysis

These are not four mandatory reruns.
They are four mandatory review gates.

For each gate, the planner must decide one of:

- `reuse` - existing result is good enough and can be carried forward
- `repair` - only light repair is needed, such as splitting mixed features, renaming fields, or restoring expected embeddings
- `rerun` - the stage is not trustworthy and must be redone

The planner must not enter a later gate until the earlier gate is either `reuse`, `repair`, or `rerun -> completed`.

The target before downstream is one canonical ATAC object:

- one peak-oriented `h5ad`
- feature semantics are clear
- provenance is clear
- the state is sufficient for clustering and annotation
- it can serve as the default handoff for later DAR or regulatory tasks

In this first slice, call that object the study's `atac_ready` state even if the concrete file name differs by task.

## Storage & Memory Rules

Treat the canonical handoff object as memory-sensitive.

- keep `.X` sparse when saving `h5ad` unless a later method explicitly requires dense input
- avoid `sc.pp.scale` unless the downstream method truly needs scaled dense values
- if a method requires dense materialization, isolate that conversion to the smallest possible scope and do not promote the dense form as the long-lived project base

## Required Read Order

Before planning, read in this order:

1. `contract.yaml`
2. `context/resources.md`
3. current `study.md`
4. current `task.md`
5. relevant reusable artifacts
6. this skill

If project facts conflict with heuristics in this skill, trust project facts.

## Input-State Judgment

Before selecting tasks or executor skills, classify the current ATAC input as one of:

### 1. matrix-only h5ad

Use this when:

- the object is already a peak matrix or ATAC-like matrix
- there is no trusted fragment-level sidecar available to the current study
- the study can only claim matrix-level QC and downstream evidence

Implications:

- TF-IDF / LSI / graph construction are in scope
- clustering, annotation, and DAR are in scope
- full fragment-native claims are out of scope

### 2. mixed multiome h5ad

Use this when:

- one `h5ad` mixes RNA-like and peak-like features
- the ATAC side must be separated or repaired before graph work
- paired RNA information may still help annotation later

Implications:

- first task should usually repair or split the object
- do not treat the mixed object as a clean ATAC matrix without inspection
- preserve any useful paired metadata or RNA-derived labels as side evidence

### 3. fragment-aware mode

Use this when:

- the study really has trusted fragment/BAM/peak sidecars available now
- fragment-level QC or peak-gene logic is materially relevant to the question

Implications:

- the planner may acknowledge that stronger downstream evidence is possible
- but this first QDD slice still should not promise a full ArchR/Signac-style platform
- if the current executor batch cannot support the needed fragment-native claim, record that as a blocker instead of pretending matrix-only work is equivalent

---

## Stage 1: Input & QC

### Goal

Establish whether the current object is truly usable as an ATAC matrix and whether any mixed-feature repair is required first.

### Input Checks

Check at minimum:

- is the object a valid `h5ad` / `AnnData`
- do `var_names` or `feature_type` look like genomic peaks
- are RNA-like features mixed into the same matrix
- are many `feature_type` values blank or inconsistent
- does `.X` look like sparse count-style accessibility data
- does `obs` contain usable sample / batch / donor / patient columns
- are there any trustworthy fragment-level QC hints such as TSS or FRiP

### Default Action

Default to `inspect first`, not immediate rerun.

If the object is mixed or semantically unclear, plan a repair-oriented preprocess task.

### Condition Branches

- If the object is mixed RNA + ATAC:
  - usually `repair` or `rerun`
- If the object is already a clean peak matrix with clear metadata:
  - may `reuse`
- If feature semantics are mostly usable but `feature_type` or metadata are inconsistent:
  - `repair`
- If the question depends on fragment-level QC that is not actually available:
  - keep the matrix path explicit and record the fragment-native gap as a boundary

### Reusable Output

A Stage-1-passed object should preserve or establish:

- peak-oriented features only
- clear feature-class semantics
- basic cell/feature QC summaries
- a saved processed `h5ad`
- a written statement of whether the study is matrix-only, mixed-multiome-repaired, or fragment-aware

### QDD Skill Hook

If Stage 1 work is needed, prefer:

```bash
qdd skills suggest --domain singlecell --stage preprocess --tag peak-matrix --tag qc --json
```

Expected executor skill candidate:

- `singlecell/scatac/scatac-preprocess-lsi`

### Examples

Good:

- repair a mixed multiome object into a clean peak matrix before graph work
- keep a matrix-only study honest about what QC evidence is and is not available

Bad:

- run downstream clustering on a mixed object without checking whether features are really peaks
- claim fragment-level QC quality from a matrix-only h5ad

---

## Stage 2: Representation & Integration

### Goal

Build or validate the ATAC latent representation and decide whether multi-sample correction is needed before clustering.

### Input Checks

Check at minimum:

- does the object already have `X_lsi`, `X_lsi_harmony`, or another credible ATAC latent space
- is this a multi-sample or multi-batch study
- does `obs` contain a reliable batch/sample key
- does the current embedding show obvious sample separation
- was any correction already applied, and is the method legible

### Default Action

Default to `diagnose before correcting`.

Do not assume every multi-sample ATAC object must be harmonized.
Do not assume a missing correction is harmless when sample structure is obvious.

### Condition Branches

- Single-sample:
  - usually `reuse` after a valid latent representation exists
- Multi-sample with no obvious batch problem:
  - may `reuse` a non-corrected latent space
- Multi-sample with visible separation or cross-sample comparison goals:
  - `rerun` or `repair` latent integration
- Existing integrated embedding with unclear provenance:
  - prefer `repair` or `rerun`

### Reusable Output

A Stage-2-passed object should include:

- a saved `h5ad` with the chosen latent representation
- graph-ready or integration-ready embeddings
- method provenance
- diagnostic figures showing batch structure or its reduction

### QDD Skill Hook

If Stage 2 work is needed, prefer:

```bash
qdd skills suggest --domain singlecell --stage integration --tag peak-matrix --tag batch-diagnosis --json
```

Expected executor skill candidate:

- `singlecell/scatac/scatac-batch-latent`

### Examples

Good:

- use `method none` first to diagnose whether sample separation is a real problem
- use Harmony on `X_lsi` only when the study genuinely needs a corrected joint manifold

Bad:

- force batch correction for every ATAC dataset by reflex
- skip latent-space review and assume a saved UMAP is automatically trustworthy

---

## Stage 3: Clustering & Annotation

### Goal

Establish a defensible cluster structure and assign labels only when the evidence is explicit.

### Input Checks

Check at minimum:

- are neighbors, clusters, and UMAP already present
- if present, were they built on a credible ATAC latent representation
- is there any existing annotation in `obs`
- are marker peaks, gene-linked features, paired RNA labels, or trusted metadata available
- does the current question need cell-type labels, cell-state labels, or only cluster-level structure

### Default Action

Default to review clustering and annotation before rerunning.

Do not treat inherited labels as automatically valid.
Do not assign cell types from UMAP shape alone.

### Condition Branches

- If no graph or cluster structure exists:
  - `rerun`
- If clusters exist but are tied to an unclear latent space:
  - `repair` or `rerun`
- If labels exist but their evidence source is weak or undocumented:
  - `repair`
- If clustering is sound but labels are the main uncertainty:
  - keep latent/clustering work `reuse` and isolate annotation as its own task

### Reusable Output

A Stage-3-passed object should include:

- one canonical `atac_ready` object
- stable cluster labels
- explicit annotation columns if evidence is sufficient
- written annotation evidence and uncertainty

### QDD Skill Hook

When latent/clustering needs work, prefer:

```bash
qdd skills suggest --domain singlecell --stage integration --tag lsi --tag leiden --json
```

Expected executor skill candidate:

- `singlecell/scatac/scatac-batch-latent`

When annotation needs work, prefer:

```bash
qdd skills suggest --domain singlecell --stage annotation --tag gene-activity --tag cell-type --json
```

Expected executor skill candidate:

- `singlecell/scatac/scatac-annotation-geneactivity`

### Examples

Good:

- separate latent/clustering repair from annotation if those are different uncertainties
- keep annotation as `unknown` when evidence is weak

Bad:

- rename clusters to cell types without marker or paired-label support
- throw away a usable latent representation just because the labels need improvement

---

## Stage 4: Downstream Regulatory Analysis

### Goal

Run downstream analysis only after the ATAC object is stable enough to support the study claim.

### Input Checks

Check at minimum:

- is there one canonical `atac_ready` object
- are the relevant cluster or condition labels already stable
- does the study need DAR, motif, trajectory, or another regulatory summary
- does the current input state actually support the requested downstream claim

### Default Action

Default to a narrow downstream task that matches the evidence actually available.

In this first slice, downstream work should stay conservative.

### Condition Branches

- If the study is matrix-only:
  - DAR is in scope
  - fragment-native claims should remain out of scope
- If the object is stable and the comparison is already clear:
  - `rerun` the needed downstream summary only
- If upstream clustering or annotation is still unstable:
  - do not proceed; return to the earlier gate instead

### Reusable Output

Stage-4-passed work should include:

- one clear downstream result table or figure set
- explicit contrast definitions
- a statement of what the result does and does not justify

### QDD Skill Hook

If Stage 4 work is needed, prefer:

```bash
qdd skills suggest --domain singlecell --stage de --tag differential-accessibility --tag condition-comparison --json
```

Expected executor skill candidate:

- `singlecell/scatac/scatac-dar`

### Examples

Good:

- run a focused DAR comparison after the cluster/condition boundary is already stable
- state clearly when matrix-only evidence supports accessibility differences but not stronger regulatory claims

Bad:

- treat downstream DAR as a substitute for fixing a weak upstream latent space
- imply fragment-aware conclusions from matrix-only evidence
