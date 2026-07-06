---
name: thesis/conclude
description: QDD-native conclude skill for turning accumulated project evidence into an auditable manuscript-oriented package through story candidates, a human selection gate, and PaperSpine-derived writing assets.
---

# thesis/conclude

## When To Use

Use this skill when a QDD project is mature enough to synthesize existing evidence into a manuscript-oriented package.

Typical entry points:

- after `qdd-close` judges the project as synthesis-ready
- during a mid-project audit when the user wants candidate narratives and evidence review
- when the user explicitly asks to run `conclude`

Do not use this skill as a task executor skill.
Do not write `thesis/conclude` into task `skills:`.
Do not use it to generate new scientific results.

## Role In QDD

`conclude` is a thesis-manager writing and synthesis skill.

It sits after evidence generation, not before it:

- studies, tasks, and promoted artifacts remain the truth source for claims
- `conclude` reads that persisted QDD evidence
- `conclude` proposes 2-3 candidate stories
- the user must choose a story before final manuscript drafting begins

## Required Inputs

Before drafting or scoring any story, read:

1. `contract.yaml`
2. `evolution.yaml`
3. `context/resources.md`
4. recent `context/memory/*.md`
5. `artifacts/index.yaml`
6. relevant `studies/*` files and promoted artifacts

Also inspect local rendering capability:

- `latexmk`
- `xelatex`
- `pdflatex`
- `pandoc`

If rendering tools are missing, report rendering as blocked rather than successful.

## Core Workflow

### 1. QDD Preflight

- verify the project has enough persisted evidence to synthesize
- inventory reusable figures, tables, reports, and code provenance
- detect rendering tools and report what can or cannot be built locally

### 2. Evidence Harvest

- gather claims only from persisted QDD evidence
- treat negative, dissolved, blocked, or downgraded studies as useful boundary evidence
- keep external literature as support for context and discussion, not as invented project results

### 3. Story Candidate Generation

- generate 2-3 distinct candidate narratives before drafting
- score them by coherence, evidence strength, novelty, reviewer risk, claim safety, negative-evidence use, and manuscript viability
- explicitly mark claims that must be softened or avoided

### 4. User Selection Gate

Stop after producing candidate stories.

V1 must not auto-select the top story. Human choice is required before manuscript drafting.

### 5. Drafting After Selection

After the user chooses a story, prepare manuscript-planning assets before writing `main.tex`:

- `confirmed_contribution.md`
- `results_validation.md`
- `reviewer_audit.md`
- `citation_support_bank.md`
- `section_blueprints.md`
- `writing_rationale_matrix.md`

### 6. Rendering And Audit

- always generate `main.tex`
- render PDF or Word only when the required local tools exist
- mark missing-tool cases as `BLOCKED`, not complete

## Claim Safety

Stay conservative with biological language.

- prefer associative wording when evidence is correlational
- downgrade candidate-state claims when no causal validation exists
- explain stronger rejected claims in `claim_safety_audit.md`

Do not silently convert association into mechanism or causality.

## PaperSpine Vendor Contract

This skill vendors and modifies PaperSpine for QDD-specific synthesis.

See:

- `vendor/paperspine/LICENSE`
- `vendor/paperspine/UPSTREAM.md`

Requirements:

- preserve upstream MIT license and provenance
- record upstream repo, version, and commit
- keep QDD modifications explicit
- reuse PaperSpine checks where useful, but replace generic intake with QDD evidence harvesting and the story-selection gate

## Output Contract

Default output root:

```text
conclusions/<run-id>/
```

Expected outputs by the full workflow:

- `story_candidates.md`
- `selected_story.md`
- `evidence_audit.md`
- `claim_safety_audit.md`
- `reviewer_risk_audit.md`
- `render_status.md`
- `paper_rewriting_output/final_paper/main.tex`

PDF and DOCX outputs appear only when rendering succeeds locally.

## Current Scope

In this repository slice, `thesis/conclude` is scaffolded as a central skill contract plus vendor provenance.

The following are intentionally not implemented yet in this slice:

- automated QDD preflight execution
- evidence harvesting logic
- story candidate generation
- manuscript drafting
- rendering orchestration

Treat this skill file as the committed product contract for those later slices, not as proof that the full conclude runtime already exists.
