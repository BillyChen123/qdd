---
name: brain/spatial/spatial-planning
description: Spatial transcriptomics study-brain protocol for QDD. Use during qdd-propose and qdd-explore when the study involves spatial AnnData objects at cell, bead, or spot resolution and the agent must decide which spatial stages are reusable, which must be repaired or rerun, and which executor skills should be attached to tasks.
---

# brain/spatial/spatial-planning

## When To Use

Use this skill only during `qdd-propose` and `qdd-explore`.

Trigger this skill when all of the following are true:

- the study involves spatial transcriptomics, spatial gene activity, spatial motif activity, or image-free spatial molecular profiles
- the observations may represent cells, nuclei, beads, spots, or bins
- the main working object is `h5ad` / `AnnData`
- the agent must plan or review one of these stages:
  - preprocess / QC
  - integration
  - clustering and annotation
  - downstream spatial analysis
- the agent must decide whether an existing result can be reused, lightly repaired, or rerun
- the agent must choose executor skills for a task

Do not use this skill as an executor skill.
Do not write `brain/*` into task `skills:`.

## Role In QDD

This skill does not define QDD workflow semantics.

- `qdd-propose` owns study/task creation
- `qdd-explore` owns discussion and refinement
- this skill only provides the spatial planning protocol used inside those workflows

Its job is:

1. inspect whether the current spatial `h5ad` is already usable
2. decide which stages are passed, which must be rerun, and which can be lightly repaired
3. define one stable annotated object before downstream analysis
4. help choose executor skills through bounded `qdd skills suggest`

## Planning Contract

Treat spatial planning as the same four-stage protocol used for scRNA:

1. Preprocess / QC
2. Integration
3. Clustering and Annotation
4. Downstream

These are not four mandatory reruns.
They are four mandatory review gates.

For each gate, the planner must decide one of:

- `reuse` - existing result is good enough and can be carried forward
- `repair` - only light repair is needed, such as renaming fields, restoring coordinates, or harmonizing metadata
- `rerun` - the stage is not trustworthy and must be redone

The planner must not enter a later gate until the earlier gate is either `reuse`, `repair`, or `rerun -> completed`.

The target before downstream is a single reusable study-level annotated object:

- one canonical `adata` / `h5ad`
- matrix semantics are clear
- coordinate semantics are clear
- sample, section, batch, and timepoint fields are clear when relevant
- cell type, cluster, or population labels are explicit
- provenance is clear
- it can be reused across later downstream tasks

If multiple candidate h5ad objects exist, choose one as the primary downstream base and explain why.

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

---

## Stage 1: Preprocess / QC

### Goal

Establish whether the current spatial object is structurally valid and biologically usable as the base object.

### Input Checks

Check at minimum:

- is the object a valid `h5ad` / `AnnData`
- does `obs` contain required metadata for this study
- does `var` contain usable gene, motif, or feature names
- does `.X` look like raw counts, logged values, gene activity, motif activity, or an unclear processed matrix
- do `layers` contain a better source matrix
- does `.raw` exist and is it meaningful
- are spatial coordinates available in `obsm` or `obs`
- are coordinates global, section-local, or unclear
- are sample, donor, batch, section, condition, and timepoint fields explicit when relevant
- is the assay targeted or genome-wide
- does panel coverage limit marker or negative-evidence interpretation

### Default Action

Default to `inspect first`, not immediate rerun.

Do not apply scRNA-style default filtering thresholds blindly.
Targeted spatial panels can have few genes by design.

### Condition Branches

- If matrix state, coordinates, or required metadata are unclear:
  - `rerun` or `repair` preprocess
- If the object is already well-prepared and the processing history is legible:
  - `reuse`
- If the object is mostly usable but field names, coordinate fields, layers, or metadata need harmonization:
  - `repair`

### Reusable Output

A preprocess-passed object should preserve or establish:

- usable `obs`
- usable `var`
- clear matrix semantics
- clear coordinate semantics
- QC summary
- panel or genome-wide status
- a saved processed `h5ad`

### QDD Skill Hook

If preprocess work is needed, prefer:

```bash
qdd skills suggest --domain spatial --stage preprocess --tag qc --json
```

Expected executor skill candidate:

- `spatial/spatial-preprocess-qc`

### Examples

Good:

- inspect first, then reuse a normalized Xenium object because matrix state and coordinate fields are clear
- repair only coordinate column names and preserve the processed matrix

Bad:

- filter a targeted MERFISH panel with a high `min_genes` threshold copied from scRNA
- compare coordinates across tissue sections without checking whether they are section-local

---

## Stage 2: Integration

### Goal

Decide whether sample, donor, section, or timepoint structure must be diagnosed or corrected before clustering and annotation.

### Input Checks

Check at minimum:

- is this a multi-sample, multi-donor, multi-section, or time-course study
- is there a reliable sample / donor / batch / section / timepoint column in `obs`
- does the study require joint clustering or cross-condition comparison
- do existing embeddings show likely sample, section, or timepoint separation
- does an integrated object already exist
- if integration already exists, is the method and provenance clear

### Default Action

Default to `diagnose before correcting`.

Do not assume multi-sample always means forced correction.
Do not assume no correction is needed without inspection.

### Condition Branches

- Single-sample or section-local downstream task:
  - usually `reuse` and skip correction
- Multi-sample with no obvious batch problem and no strong integration need:
  - may `reuse` non-integrated object
- Multi-sample with visible separation or atlas-style comparison goal:
  - `rerun` or `reuse` integration depending on provenance quality
- Existing integrated object but unclear method, inputs, or batch key:
  - prefer `rerun` or at least treat as suspicious

### Reusable Output

An integration-passed object should include:

- a saved integrated or integration-reviewed `h5ad`
- clear sample / batch / section key usage
- method provenance
- diagnostic figures or summary tables showing why integration was or was not used

### QDD Skill Hook

If integration work is needed, prefer:

```bash
qdd skills suggest --domain spatial --stage integration --tag batch --json
```

Expected executor skill candidate:

- `spatial/spatial-batch-integration`

---

## Stage 3: Clustering And Annotation

### Goal

Establish a biologically interpretable cell, spot, bead, or population label set that is good enough to support downstream spatial questions.

### Input Checks

Check at minimum:

- are PCA, neighbors, and UMAP already present when graph clustering is needed
- are clusters already present
- if clusters exist, are they relevant to the current study question
- is annotation already present
- if annotation exists, is it trustworthy for this study
- are marker genes or marker features covered by the panel
- are population labels already present or derivable from markers and existing metadata

### Annotation Scope

Annotation includes:

- cluster labels
- marker-supported cell type labels
- marker-supported cell state labels
- operational population labels such as `fibroblast-like`, `immune-like`, `oocyte`, or `granulosa`

Annotation does not include:

- niche identity claims
- neighborhood interpretation
- contiguous structure counting
- composition-vs-background reasoning
- detection-limit interpretation

Those belong to downstream.

### Default Action

Default to `evidence first`.

If a task asks for a population-specific downstream metric, first define and store the population label.
Do not compute the downstream metric while silently redefining the population.

### Condition Branches

- Existing trustworthy annotations:
  - `reuse`
- Existing labels but unclear evidence or inconsistent naming:
  - `repair`
- No usable labels and marker evidence is available:
  - `rerun` annotation
- Marker evidence is ambiguous or morphology/structure is needed:
  - use `assisted` mode and emit review artifacts

### Reusable Output

An annotation-passed object should include:

- a saved annotated `h5ad`
- annotation key names
- marker or metadata evidence tables
- panel-coverage notes
- clear unknown / low-confidence labels where needed

This annotated object is the required handoff to downstream.

### QDD Skill Hook

If clustering work is needed, prefer:

```bash
qdd skills suggest --domain spatial --stage clustering --json
```

Expected executor skill candidate:

- `spatial/spatial-clustering`

If annotation work is needed, prefer:

```bash
qdd skills suggest --domain spatial --stage clustering --tag markers --json
```

Expected executor skill candidate:

- `spatial/spatial-marker-annotation`

---

## Stage 4: Downstream

### Goal

Answer the biological or spatial question using the annotated object.

### Input Checks

Check at minimum:

- which annotation key defines the required population
- whether coordinates must be used
- whether coordinates should be restricted within sample, section, or field of view
- whether the metric is a group statistic, neighborhood statistic, niche composition statistic, or structure statistic
- whether the final requested answer is a fixed-format output

### Downstream Families

Use these as planning families, not as benchmark-specific categories:

- group statistics:
  - fold change
  - correlation
  - detection rate
  - grouped abundance
- differential expression:
  - two-group feature testing
  - condition or niche contrasts
  - sample-aware pseudobulk when biological replicates or sections exist
  - ranked output for pathway enrichment
- neighborhood analysis:
  - spatial kNN within section
  - co-localization
  - neighborhood composition
- niche composition:
  - niche cell-type composition
  - niche vs background enrichment
  - dominant vs enriched population comparison
- structure quantification:
  - spatially contiguous structures
  - structure-local cell counts
  - assisted review for biological boundaries

### Default Action

Default to `annotated-object first`.

No downstream claim should redefine basic annotation on the fly.
If downstream reveals that annotation is unstable, return to Stage 3.

### QDD Skill Hook

For group statistics:

```bash
qdd skills suggest --domain spatial --stage downstream --tag group-stats --json
```

Expected executor skill candidate:

- `spatial/spatial-group-stats`

For differential expression:

```bash
qdd skills suggest --domain spatial --stage downstream --tag de --json
```

Expected executor skill candidate:

- `spatial/spatial-differential-expression`

For spatial neighborhoods:

```bash
qdd skills suggest --domain spatial --stage downstream --tag neighborhood --json
```

Expected executor skill candidate:

- `spatial/spatial-neighborhood-analysis`

For niche composition:

```bash
qdd skills suggest --domain spatial --stage downstream --tag niche --json
```

Expected executor skill candidate:

- `spatial/spatial-niche-composition`

For spatial structures:

```bash
qdd skills suggest --domain spatial --stage downstream --tag structure --json
```

Expected executor skill candidate:

- `spatial/spatial-structure-quant`

---

## Assisted Mode

Spatial planning should explicitly allow `assisted` mode.

Use `assisted` when:

- a structure boundary is biological rather than purely computational
- a targeted panel makes negative evidence weak
- a low-resolution spot assay limits lineage separation
- visual or table-based review is more honest than a forced automatic label

`assisted` still requires reproducible artifacts:

- candidate labels or structures
- marker or composition evidence
- coordinate-aware diagnostic figures when relevant
- a short report explaining what requires human adjudication

Do not use `assisted` as a substitute for missing analysis.
Use it when the analysis can produce candidates but the final biological boundary is not fully automatable.

## Method Notes

- Panel-aware reasoning is mandatory for targeted spatial assays.
- Absence of marker signal is not strong negative evidence unless the marker is covered and detectable enough for the assay.
- Spot-level assays such as Visium may support tissue programs better than rare cell-type resolution.
- Cell-level assays such as Xenium or MERFISH still need panel-aware marker interpretation.
- Coordinates should usually be interpreted within sample, section, or field of view unless global coordinate registration is explicit.
- Downstream answer formatting belongs to task execution or benchmark wrappers, not to domain skills.
