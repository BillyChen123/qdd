## Task Goal

Define the concrete implementation work needed to tighten the single-cell brain skill boundary and refresh the default `context/resources.md` scaffold.

## Study Link

This task supports the study of how QDD should carry domain priors and durable analyst preferences without introducing a second memory subsystem.

## Method

Make the change in three coordinated parts:

1. Rewrite the brain skill so it focuses on domain heuristics, controlled executor-skill lookup hints, and method-selection cautions.
2. Refresh the default `resources.md` scaffold so one file clearly separates project facts from durable preferences.
3. Update prompts, defaults, and tests that mention the old scaffold or imply the wrong brain-skill role.

## Expected Outputs

- Updated `domain-skills/brain/study-planning-core/SKILL.md`
- Updated `src/runtime/defaults.ts` scaffold for `context/resources.md`
- Prompt and documentation adjustments where `qdd-start` describes how `resources.md` should be used
- Updated tests that assert the default scaffold content

## Run Contract

Each implementation run should record:

- which files changed,
- which `resources.md` sections were added, removed, or renamed,
- how the brain skill boundary was tightened,
- and what build or smoke checks were used to verify consistency.

## Failure / Blocker Conditions

- The brain skill still duplicates workflow semantics after revision.
- The updated `resources.md` scaffold becomes too heavy or starts mixing dynamic workflow state into durable project context.
- Tests, inspection rules, or prompts still assume the old scaffold and are left inconsistent.
