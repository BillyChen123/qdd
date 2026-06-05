## Question Before

How should QDD make evolving research boundaries explicit and inspectable without drifting away from its question-first semantics into a task-planning workflow?

## Question After

How should QDD introduce one project-owned `boundaries.yaml` state layer plus controlled read / apply / render CLI surfaces so `qdd-start` seeds boundaries, `qdd-propose` targets them, and `qdd-close` updates them end to end?

## Change Type

refinement

## Change Driver

The original need was broad: make proposal quality and question evolution more objective and more visible.

This study narrowed that into a smaller protocol slice:

- add one explicit current-state boundary file instead of relying only on free-text study summaries,
- keep study tasks local and temporary rather than promoting them into a project-wide planner graph,
- standardize mutation through one CLI apply surface instead of ad hoc prompt-edited YAML,
- let `qdd-start` and `qdd-close` own boundary-state writes,
- and generate one project-local HTML report so the evolving boundary graph is visible after each study.

The strongest forcing requirement was the user's insistence that this become a QDD core protocol rather than a domain skill or a loose prompt convention.

## Open Boundaries

- How boundary weights should eventually be calibrated for project-level quality and priority scoring
- Whether later slices need more boundary update actions such as reopen, split, or merge
- How much of the boundary-update history should also be normalized into `evolution.yaml` versus remaining in study-local outputs
- Whether the renderer should later support timeline filtering, diff views, or lightweight interaction beyond the first report-style HTML output

## Evidence Summary

- `contract.yaml` and `evolution.yaml` already define project scope and history, but there is still no explicit current-state layer for open question boundaries.
- The current workflow roles already place `qdd-start` and `qdd-close` under `thesis-manager`, which matches project-owned boundary authority.
- The user explicitly rejected a task graph as the primary project abstraction and instead wants a dynamic boundary graph that studies act upon locally.
- A thin CLI mutation surface gives stronger protocol stability than letting prompts edit `boundaries.yaml` freely.
- A project-local HTML report is sufficient for the first visualization slice and does not require a server or heavy application framework.

## Recommended Next Step

Apply this slice by:

- adding `boundaries.yaml` and boundary-update contracts to runtime,
- implementing `qdd boundaries` read / apply / render commands,
- updating `qdd-start`, `qdd-propose`, and `qdd-close` to consume the new protocol correctly,
- and validating that boundary state remains question-centered, auditable, and light.
