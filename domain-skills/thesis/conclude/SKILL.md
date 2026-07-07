---
name: thesis/conclude
description: Durable QDD conclude guardrail for turning accumulated project evidence into an auditable manuscript-oriented package through the `qdd conclude` CLI. This skill defines scientific constraints, workflow intent, and PaperSpine provenance expectations; it is not a separate user-facing product entrypoint.
---

# thesis/conclude

## Entry

- canonical user-facing entrypoint: `qdd conclude`
- committed guardrail source directory: `domain-skills/thesis/conclude/`
- skill type: thesis-layer synthesis guardrail
- current status: active contract and provenance surface for the conclude product

This directory is the durable source of truth for conclude-specific scientific guardrails, workflow intent, and vendor provenance.

It does not replace the CLI. Users run `qdd conclude`; the skill assets here constrain how conclude should reason and what it should preserve.

## When To Use

Use conclude when a QDD project is ready for manuscript-oriented synthesis or when a mid-project evidence audit is needed.

Typical moments:

- the project has accumulated reusable figures, tables, reports, and study memories
- the frontier is synthesis-ready or close to synthesis-ready
- the user wants an auditable writing package built from existing QDD evidence rather than new analysis
- the user wants to compare multiple story candidates before choosing one for drafting

## Product Contract

Conclude is a single product surface with one canonical entrypoint:

```bash
qdd conclude
```

The workflow currently supports:

- preflight over QDD project state
- evidence harvesting from studies, memories, and artifacts
- generation of 2-3 story candidates
- a mandatory user story-selection gate
- selected-story manuscript-planning artifacts
- final paper package generation centered on `main.tex`
- rendering-status reporting
- Parkinson golden-case evaluation support

Future implementation work should refine output quality and internal architecture without redefining the product as a separate manual tool or second writing product.

## Required Guardrails

Preserve these product constraints from [`docs/09-qdd-conclude-prd.md`](../../../docs/09-qdd-conclude-prd.md):

- write only from existing QDD evidence
- generate 2-3 story candidates before drafting
- stop for user selection before final manuscript drafting
- keep negative, dissolved, blocked, or downgraded studies as usable boundary evidence
- downgrade weak associative claims instead of overstating mechanism
- report missing TeX or pandoc tooling as blocked rendering status
- keep internal evidence anchors traceable back to QDD artifacts
- do not let raw task/study execution language dominate story candidates or manuscript prose

## Architectural Direction

Conclude should reason in manuscript-native intermediate objects rather than directly drafting from raw task/study records.

That means:

- raw QDD records remain valuable as provenance
- narrative outputs should be based on compressed evidence packets
- story candidates should differ in real narrative arc, not just framing label
- selected story should be stable and recoverable as a machine-readable drafting input
- final drafting quality may improve through internal adapters or agent-backed drafting, but those remain implementation details of `qdd conclude`

## Boundary Rules

- Do not write `thesis/conclude` into task `skills:`.
- Do not treat this skill as a second interactive surface separate from `qdd conclude`.
- Do not claim PDF or Word success when required tooling is missing.
- Do not use external literature to invent results that QDD did not produce.
- Do not let workflow status text such as `TASK-xxx`, `status closed`, `None.`, or checklist fragments become central manuscript prose.

## Vendor Layout

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

`vendor/paperspine/` is the reserved provenance location for the PaperSpine-based conclude workflow.
QDD may vendor and modify upstream resources here while preserving license, version, commit, and local modification notes.
