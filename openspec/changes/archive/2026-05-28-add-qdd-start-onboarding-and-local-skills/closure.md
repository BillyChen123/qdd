## Question Before

QDD can scaffold a project and bootstrap the four study-loop surfaces, but it still lacks a clean onboarding step for filling project context, linking datasets, and constraining agent skill usage to project-owned capabilities.

## Question After

QDD should add a thin onboarding slice centered on `qdd-start`, `data/` dataset links, and `.agents/skills/` as the project-local skill boundary, while keeping `qdd init` as the low-level scaffold command and keeping the existing four-step study loop intact.

## Change Type

refinement

## Change Driver

The current friction is not the study loop itself. It is the missing project-entry contract: users still need ad hoc manual setup for resources and there is no trustworthy local skill boundary for agents to follow.

## Open Boundaries

- how much of environment capture should be explicit human input versus lightweight machine discovery
- whether local skill truth should be represented only by the `.agents/skills/` directory or also by a small manifest
- whether project-level onboarding needs additional status hints, or whether validation plus `PROJECT` instructions is enough

## Evidence Summary

This change isolates the missing bootstrap-onboarding gap into one thin slice: project context intake, dataset symlink entrypoints, and repo-local skill authority. It avoids adding a separate project manager while strengthening the base that later studies depend on.

## Recommended Next Step

Implement `qdd-start`, add the project-level instructions target and local skill registry, then dogfood one fresh project from scaffold to first study using only the generated onboarding and study-loop surfaces.
