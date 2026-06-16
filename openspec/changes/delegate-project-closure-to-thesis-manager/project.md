## Theme

Improve QDD auto-mode project-level closure by delegating continuation versus stop judgment to the thesis-manager, while keeping the workflow lightweight and avoiding a heavy new frontier schema.

## Initial Question

How should QDD decide when an autonomous research project has enough evidence to stop opening new studies and synthesize a final biological story, without stopping too early after the first stable result?

## Mode

Auto-mode orchestration remains supported, but scientific continuation authority should belong to the thesis-manager. Runtime should enforce operational validity and consume executable next candidates, not infer scientific value from open boundaries alone.

## Scope

### In Scope

- Update thesis-manager and frontier-planning guidance so project closure is an explicit scientific judgment.
- Add a lightweight project-lifecycle thinking framework: exploration, main evidence, story enrichment, synthesis-ready, closed.
- Preserve evidence enrichment after a central result emerges, so auto mode does not stop immediately after finding a main result.
- Allow unresolved boundaries to remain as limitations or future directions without forcing another auto study.
- Adjust runtime continuation semantics so executable next candidates, not open boundaries alone, drive automatic propose.
- Use observed behavior as calibration:
  - UC anti-TNF case: should be considered synthesis-ready after the central FN1/inflammatory-quiescence story is enriched and multiple obvious mechanisms are ruled out.
  - Parkinson case: should continue through the active isoform-feasibility study because the current frontier is still unresolved and directly actionable.

### Out Of Scope

- Adding a heavy `frontier.yaml` or project-phase schema.
- Replacing the current `evolution.yaml` event model.
- Creating a manuscript writer or final report generator in this change.
- Adding new domain-analysis skills.
- Changing study/task/artifact contracts except where needed for prompt clarity or minimal runtime continuation behavior.

## Evidence Standard

This change is acceptable if:

- `thesis/frontier-planning` tells the thesis-manager to distinguish "unresolved" from "worth continuing automatically".
- `qdd-close` guidance makes project-level stop or synthesis-ready decisions legitimate even when open boundaries remain.
- The guidance prevents premature stopping by requiring story enrichment after a central model emerges.
- Runtime no longer treats open boundaries alone as proof that auto should continue.
- Tests or dry-run coverage demonstrate that:
  - next candidates still drive continuation,
  - no next candidates can terminate auto even if open boundaries remain,
  - operational invalid states still stop safely.

## Shared Context

The current auto runtime computes continuation from persisted project status. `checkTermination()` currently treats either `next_candidates` or `open_boundary_ids` as a continuation signal. This makes auto mode difficult to stop when scientific boundaries remain but are no longer worth pursuing within the current project.

The existing thesis skill already exists at `domain-skills/thesis/frontier-planning/SKILL.md`, but its current decision rules are conservative: if a real candidate or open boundary exists, it generally chooses continue. The preferred update is to make the thesis-manager's judgment stronger while keeping persistence lightweight.

The desired research style is:

1. Explore until a stable anchor result emerges.
2. Lock the central model.
3. Enrich the story through validation, robustness, mechanism triage, functional consequence, and negative controls.
4. Stop opening new studies when remaining questions mostly require new modality/data or add marginal detail, while carrying them as limitations or future directions.
