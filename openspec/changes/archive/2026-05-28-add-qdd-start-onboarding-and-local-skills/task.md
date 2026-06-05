## Task Goal

Implement the minimum protocol and bootstrap changes required for project onboarding, dataset linking, and repo-local skill authority without adding a separate project manager.

## Study Link

This task implements the study decision that QDD needs one explicit onboarding surface before the existing propose/explore/apply/close loop can be relied on in real research use.

## Method

- extend the path and scaffold contract with `data/` and `.agents/skills/`
- add a generated `qdd-start` workflow prompt/skill
- add a project-level instructions target for onboarding reads and writes
- teach later study/task instructions to resolve skill IDs only from `.agents/skills/`
- record onboarding context in `contract.yaml` and `context/resources.md`
- create dataset symlinks under `data/` instead of copying source files
- add validation for placeholder project context, broken links, and missing referenced skills
- refresh bootstrap outputs and tests so the onboarding surface is locked in

## Expected Outputs

- updated scaffold layout and defaults
- generated `qdd-start` workflow assets for supported tool targets
- a repo-local `.agents/skills/` registry populated during bootstrap
- updated instructions behavior for `PROJECT`, `STUDY-XXX`, and `TASK-XXX`
- validation and test coverage for local skill resolution and dataset-link onboarding
- docs or prototype map updates that explain the onboarding contract

## Run Contract

Each implementation run should record:

- whether `qdd init` now creates `data/` and `.agents/skills/`
- where `qdd-start` prompt or skill assets are installed
- what the project-level instructions target is named and what it exposes
- how local skill IDs are discovered and filtered
- how dataset symlinks are created and how they are recorded in project context
- whether broken links and missing local skills are validated explicitly
- command and test evidence for bootstrap refresh and protocol behavior

## Failure / Blocker Conditions

- the change requires a full interactive project manager rather than a thin bootstrap layer
- local skill authority cannot be represented clearly enough to guide later workflows
- dataset-link handling becomes OS-specific or fragile enough to undermine the minimal CLI
- the slice starts redesigning study closure, artifact promotion, or broader project semantics that belong elsewhere
