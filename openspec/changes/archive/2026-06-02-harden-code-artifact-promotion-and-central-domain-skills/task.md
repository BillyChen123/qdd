## Task Goal

Implement the minimal runtime, bootstrap, and prompt changes needed to centralize domain skill sourcing and harden `code` artifact promotion for executed study scripts.

## Study Link

This task supports the study decision that reusable domain knowledge should live in one QDD-owned library, while reusable executed code should be promoted from the study workspace rather than left implicit.

## Method

Implement the change in two coordinated parts:

1. Centralize domain skill sourcing:
   - keep QDD workflow assets bootstrapped locally for tool UX,
   - stop projecting domain skills into project-local tool directories,
   - and resolve task domain skill IDs against the QDD root `domain-skills/` tree.

2. Harden `code` artifact promotion:
   - preserve substantive final analysis scripts under `studies/STUDY-XXX/output/code/`,
   - default the main script into `artifact-candidates.yaml` as `type: code`,
   - and make `qdd-close` promote those explicit code candidates into `artifacts/code/`.

## Expected Outputs

- Updated runtime/bootstrap behavior for central QDD-root domain skill resolution
- Updated prompts/instructions that distinguish local workflow skills from central domain skills
- Updated apply/close contract for `code` candidates and `artifacts/code/` promotion
- Tests or smoke coverage proving:
  - no project-local domain skill projection,
  - valid central skill-path resolution,
  - and explicit code-candidate promotion through close

## Run Contract

Each implementation run should record:

- whether domain skills were resolved from the QDD root library or from a project-local mirror,
- which runtime and prompt files changed,
- whether the executed script was preserved under `studies/STUDY-XXX/output/code/`,
- whether a `code` candidate was recorded or directly registered,
- and what test evidence proves the new path and promotion contract.

## Failure / Blocker Conditions

- `qdd init` or bootstrap still copies domain skills into project-local `.codex/skills/` or `.claude/skills/`.
- Task domain skill IDs still depend on project-local mirrors to be readable.
- A task can run substantive analysis code and finish without any explicit `code` promotion review.
- `qdd-close` still skips explicit code candidates or promotes upstream library scripts instead of the executed study-local copy.
- The slice grows into a new registry/runtime system instead of staying a thin path-and-promotion contract.
