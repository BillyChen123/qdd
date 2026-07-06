---
name: thesis/conclude
description: Manual-only QDD synthesis skill scaffold for turning accumulated project evidence into an auditable manuscript-oriented package. This first phase defines the entry surface and PaperSpine vendor provenance placeholders only; it is not a task executor surface and does not yet generate story candidates, drafts, or rendered outputs.
---

# thesis/conclude

## Entry

- user-facing skill name: `conclude`
- committed source directory: `domain-skills/thesis/conclude/`
- skill type: manual synthesis skill
- current status: first-phase scaffold only

This repository stores the durable skill assets here, while later Codex or Claude bootstrap surfaces can project a user-facing `conclude` entry from the same source of truth.

## When To Use

Use this skill manually when a QDD project is ready for manuscript-oriented synthesis or when a mid-project evidence audit is needed.

Typical moments:

- the project has accumulated reusable figures, tables, reports, and study memories
- the frontier is synthesis-ready or close to synthesis-ready
- the user wants an auditable writing package built from existing QDD evidence rather than new analysis

This scaffold is documentation and provenance only in this phase; it is not a runnable task executor workflow.
Do not use this scaffold as a task executor skill.
Do not write `thesis/conclude` into task `skills:` until a later implementation phase explicitly adds that surface.

## Current Scope

This issue slice intentionally implements only the first-phase scaffold:

- create the durable conclude skill directory
- document the entry point and expected future workflow
- reserve PaperSpine vendor provenance files and metadata slots
- clarify the boundary between this manual synthesis entry and future execution phases

This scaffold does **not** yet implement:

- QDD preflight
- evidence harvest
- story candidate generation
- user story selection gate mechanics
- manuscript drafting artifacts
- TeX, PDF, or Word rendering
- PaperSpine upstream source import or local vendor modifications

## Required Product Constraints

Future implementation work must continue to follow [`docs/09-qdd-conclude-prd.md`](../../../docs/09-qdd-conclude-prd.md).

Especially preserve these guardrails:

- write only from existing QDD evidence
- generate 2-3 story candidates before drafting
- stop for user selection before final manuscript drafting
- keep negative, dissolved, blocked, or downgraded studies as usable boundary evidence
- downgrade weak associative claims instead of overstating mechanism
- report missing TeX or pandoc tooling as blocked rendering status

## Scaffold Layout

```text
domain-skills/thesis/conclude/
├── SKILL.md
└── vendor/
    └── paperspine/
        ├── PROVENANCE.md
        ├── UPSTREAM.md
        ├── VERSION
        ├── COMMIT
        └── LICENSE
```

`vendor/paperspine/` is reserved for the eventual PaperSpine fork or vendor import required by the PRD.
In this phase it holds provenance placeholders only.
QDD has not vendored upstream PaperSpine source files, scripts, or templates yet.
