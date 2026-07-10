---
name: thesis/conclude
description: Durable QDD conclude guidance for turning accumulated project evidence into an auditable manuscript-oriented package through the `qdd conclude` CLI. This skill captures taste, scientific guardrails, manuscript-native workflow intent, and PaperSpine provenance expectations without becoming a second user-facing product entrypoint.
---

# thesis/conclude

## Entry

- user-facing skill name: `conclude`
- committed source directory: `domain-skills/thesis/conclude/`
- skill type: durable manuscript guidance + provenance surface
- canonical executable entry point: `qdd conclude`
- current status: active guidance for the implemented conclude pipeline

This repository stores the durable conclude guidance here, while the runnable automation surface lives in the CLI implementation under `src/commands/conclude.ts` and `src/services/conclude.ts`.
It does not replace the CLI. Users run `qdd conclude`; the skill assets here constrain how conclude should reason and what it should preserve.

## When To Use

Use this skill when a QDD project is ready for manuscript-oriented synthesis or when a mid-project evidence audit is needed.

Typical moments:

- the project has accumulated reusable figures, tables, reports, and study memories
- the frontier is synthesis-ready or close to synthesis-ready
- the user wants an auditable writing package built from existing QDD evidence rather than new analysis
- the user wants to compare multiple story candidates before choosing one for drafting

Treat this skill as the durable taste and guardrail layer for the CLI workflow, not as a separate non-CLI product or as a manual-only scaffold.
Do not write `thesis/conclude` into task `skills:` for ordinary task execution; conclude remains a project-level synthesis surface.

## Current Scope

Current conclude behavior in `main`:

- `qdd conclude` runs QDD preflight and render-tool detection
- builds a versioned source-aware evidence dossier from bounded reads of reports, tables, and figure metadata
- harvests QDD evidence from studies, tasks, memories, artifacts, evolution, and resources
- compresses raw records into manuscript-oriented evidence packets
- targets 2-3 dossier-backed viable story candidates and stops at the human story-selection gate
- emits one candidate with `insufficient-story-diversity`, or stops at `insufficient-evidence`, when the evidence cannot support genuine story diversity
- restores a selected story from `--selected-story-id` or `--selected-story-path`
- writes manuscript-planning artifacts and the current final paper package after selection
- reports blocked PDF/Word rendering status when TeX or pandoc dependencies are missing
- uses a dedicated Parkinson conclude eval harness when draft-quality issues need quantitative regression checks

Current limitations that still matter:

- conclude is still conservative and should not invent new biological analyses
- external citation coverage is incomplete unless verified BibTeX support is provided
- final manuscript quality can continue to improve, but the product contract is already CLI-first rather than scaffold-only
- PaperSpine source is not yet fully vendored beyond provenance placeholders

## Required Product Constraints

Implementation work must continue to follow [`docs/09-qdd-conclude-prd.md`](../../../docs/09-qdd-conclude-prd.md).

Especially preserve these guardrails:

- write only from existing QDD evidence
- target 2-3 viable story candidates before drafting, but never invent candidates to meet a quota
- build each candidate from a dossier-only scientific claim graph with explicit claim IDs, Results ordering, figure/table sequence, limitations, and multidimensional viability diagnostics
- never introduce an audit-report, method paper, or QDD-workflow contribution unless the dossier itself scientifically studies and validates it
- stop for user selection before final manuscript drafting
- keep negative, dissolved, blocked, or downgraded studies as usable boundary evidence
- downgrade weak associative claims instead of overstating mechanism
- report missing TeX or pandoc tooling as blocked rendering status
- keep internal evidence anchors traceable back to QDD artifacts
- keep raw study/task execution language out of central claim, story, and selected-story narrative bodies
- prefer manuscript-native evidence packets and story packets over direct reuse of raw `StudyRecord` / `TaskRecord` text
- keep scientific statements and QDD provenance in separate dossier fields; task/study completion is not supporting evidence

## Workflow Intent

The intended conclude boundary is:

1. raw QDD records and artifacts
2. evidence audit plus manuscript-oriented evidence packets
3. story candidates with central claim, narrative arc, claim bundle, packet refs, reviewer objections, and claim safety limits
4. selected story packet that is stable to restore
5. planning artifacts and final paper package

This workflow should stay manuscript-native even when internal provenance remains rich.

That means:

- raw QDD records remain valuable as provenance
- narrative outputs should be based on compressed evidence packets
- story candidates should differ in real narrative arc, not just framing label
- selected story should contain a versioned structured candidate snapshot and be recoverable without parsing prose
- final drafting quality may improve through internal adapters or agent-backed drafting, but those remain implementation details of `qdd conclude`

## Boundary Rules

- Do not write `thesis/conclude` into task `skills:`.
- Do not treat this skill as a second interactive surface separate from `qdd conclude`.
- Do not claim PDF or Word success when required tooling is missing.
- Do not use external literature to invent results that QDD did not produce.
- Do not let workflow status text such as `TASK-xxx`, `status closed`, `None.`, or checklist fragments become central manuscript prose.

## Skill Layout

```text
domain-skills/thesis/conclude/
├── SKILL.md
├── README.md
└── vendor/
    └── paperspine/
        ├── PROVENANCE.md
        ├── UPSTREAM.md
        ├── VERSION
        ├── COMMIT
        └── LICENSE
```

`vendor/paperspine/` remains reserved for the eventual PaperSpine fork or vendor import required by the PRD.
At the moment it still holds provenance placeholders rather than a full upstream source vendor.
