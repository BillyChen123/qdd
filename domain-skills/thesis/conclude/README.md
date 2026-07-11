# QDD Conclude Guidance

This directory preserves conclude guidance and PaperSpine provenance while the
human-mode `$qdd-conclude` workflow skill is added to QDD bootstrap.

The intended product is a project-level workflow skill installed by `qdd init`
for general-purpose agents such as Codex and Claude Code. It is not:

- an ordinary task executor skill
- a `qdd conclude` manuscript-authoring CLI
- an Agent SDK production workflow
- a deterministic evidence or story pipeline
- an auto-mode phase in the current release

The content flow is:

```text
QDD memory, evolution, studies, outputs, and artifacts
  -> research_synthesis.md
  -> Gate 1: narrative intent alignment
  -> complete story.md
  -> Gate 2: story review and revision
  -> faithful TeX rendering
```

`story.md` is the accepted semantic source of truth. TeX is a presentation
derivative, and conclude ends after the accepted story is rendered and validated.

Use [`docs/09-qdd-conclude-prd.md`](../../../docs/09-qdd-conclude-prd.md) as the
product and architecture source of truth. `WORKFLOW.md` remains the Symphony
execution contract.
