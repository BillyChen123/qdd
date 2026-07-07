# conclude guardrail

This directory is the committed source of truth for the durable QDD conclude guardrails and PaperSpine provenance.

Current state:

- conclude is an active CLI product surfaced through `qdd conclude`
- this directory stores guardrails, workflow intent, and vendor provenance
- this directory is not a second product entrypoint

Included here:

- guardrail contract in `SKILL.md`
- PaperSpine vendor provenance placeholders and metadata under `vendor/paperspine/`
- durable conclude-facing documentation that should stay aligned with the product PRD

Not included here:

- a separate manual-only conclude workflow
- task executor registration through task `skills:`
- a second conclude product outside the CLI

Use [`docs/09-qdd-conclude-prd.md`](../../../docs/09-qdd-conclude-prd.md) as the product source of truth and [`WORKFLOW.md`](../../../WORKFLOW.md) as the Symphony execution contract.
