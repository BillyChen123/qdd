# Project Bootstrap Guide

This file is a project-level bootstrap guide, not a feature-specific spec.

Keep `AGENTS.md` and `CLAUDE.md` aligned. If one changes, update the other in the same edit.

## Project Overview

QDD is the active TypeScript CLI implementation of Question-Driven Discovery.

QDD is a research-first orchestration framework. Its core job is to keep long-running scientific work legible to both humans and agents through durable project state, bounded studies, evidence-producing tasks, reusable artifacts, and explicit question evolution.

Primary object model:

- project
- study
- task
- run
- artifact
- evolution event
- memory

Work from the repository root.

## OpenSpec Relationship

QDD reuses parts of OpenSpec as infrastructure, not as its product identity.

Reuse as infrastructure:

- bootstrap and agent-tooling patterns
- command / skill projection
- schema and template customization
- proposal-style change writing when useful for implementation planning

Do not treat as QDD's primary domain workflow:

- OpenSpec proposal/spec/design/tasks as the main user-facing research objects
- archive semantics as the core QDD lifecycle
- software-change terminology as the primary description of research work

QDD's product-facing identity stays research-native:

- `Question-Driven Discovery`
- project -> study -> task -> run -> artifact -> evolution

## Core Workflow Model

QDD's main workflow remains:

- `qdd-start`
- `qdd-propose`
- `qdd-explore`
- `qdd-apply`
- `qdd-close`
- `qdd-conclude`

These are the project-level human workflow surfaces. Auto mode orchestrates the
bounded research loop and does not include `qdd-conclude`.

Additional command surfaces may exist for focused capabilities. They do not redefine the main QDD object model.

## Bootstrap And Init

Use `qdd init` as the bootstrap installer for project scaffold plus agent-facing assets.

Useful commands:

```bash
qdd init .
qdd init . --refresh-bootstrap
qdd init . --tool claude codex --refresh-bootstrap
```

What bootstrap is responsible for:

- creating the minimal QDD project scaffold
- refreshing `.claude` command surfaces
- refreshing Codex prompt/skill projection
- refreshing local workflow skill metadata

Project-level guidance should stay consistent with what `qdd init` installs.

## Symphony Control Plane

This repository is currently configured to run with Symphony as an external automation loop.

Current project configuration:

- GitHub: `https://github.com/BillyChen123/qdd`
- SSH remote: `git@github.com:BillyChen123/qdd.git`
- base branch: `main`
- workflow file: `WORKFLOW.md`
- Symphony workspace root: `~/code/qdd-symphony-workspaces`
- Linear project slug: `qdd-5bbf8f2a81d1`
- required Linear label: `qdd-conclude`

Important note:

- the `qdd-conclude` label is the current Symphony filter for this repository workflow
- that is a workflow configuration detail, not the full product identity of QDD
- if Symphony later needs to automate other QDD workstreams, update `WORKFLOW.md` intentionally instead of silently broadening issue scope

Symphony uses three control planes:

1. Linear issue state and issue relations
2. `WORKFLOW.md`
3. GitHub branches and PRs

Symphony listens to Linear issue workflow state, not Linear project status.

Active issue states:

- `Todo`
- `In Progress`
- `Rework`
- `Merging`

Pause state:

- `Human Review`

Terminal states:

- `Done`
- `Closed`
- `Cancelled`
- `Canceled`
- `Duplicate`

State rules:

- `Human Review` is a human pause state and should not be active
- `Merging` is only for merge completion and must not add new feature scope
- issue dependencies must use real Linear `Blocked by` / `Blocks` relations
- do not encode dependency order only in prose

Branch and PR rules:

- one branch per Linear issue
- branch name starts with the lower-case issue identifier, for example `bil-20-...`
- PR base branch is `main`
- when Symphony is driving work, keep Linear workpad notes and PR summaries in Chinese unless the issue explicitly requests English

Secret management:

- never commit API keys or tokens
- keep `LINEAR_API_KEY`, `GITHUB_TOKEN` / `GH_TOKEN`, and model-provider credentials in user-level environment files such as `~/.config/symphony/env`
- tracked files may mention variable names, but must not contain secret values

Operational reference:

- `docs/10-symphony-setup-and-pitfalls.md`

## Linear Issues Should Use OpenSpec-Propose Style

For this repository, the right combination is:

- Linear as scheduling and dependency control plane
- OpenSpec `propose` style as the issue-writing contract

That means a substantial Symphony issue should read like a compact implementation proposal, not a vague feature request.

Recommended issue sections:

1. `Goal`
2. `Current State` or `Why Now`
3. `Scope`
4. `Non-Goals`
5. `Implementation Notes`
6. `Acceptance Criteria`
7. `Validation`
8. `Dependencies`
9. `References`

Issue-writing rules:

- keep each issue to one executable slice
- state what already exists in `main`
- state what changes in user-visible or developer-visible behavior
- state what must remain unchanged
- name the relevant repo surfaces the agent is expected to touch
- include exact validation commands when they matter
- record dependency structure in Linear relations, not only in Markdown

Preferred issue shape:

```md
## Goal

One concrete outcome.

## Current State

What already exists in `main`, and what gap remains.

## Scope

- bounded change 1
- bounded change 2

## Non-Goals

- explicit out-of-scope item

## Implementation Notes

- canonical entrypoint or interface
- key files or contracts

## Acceptance Criteria

- observable outcome 1
- observable outcome 2

## Validation

- `npm run build`
- `npm test`
- one targeted smoke path or fixture path

## Dependencies

- blocked by / blocks

## References

- PRD, prior PRs, regression cases, or issue branches
```

## Current Active Symphony Scope

The current Symphony workflow is focused on issues carrying the `qdd-conclude` label.

That means:

- `conclude` is the current active automation workstream
- `conclude` is not the whole project identity
- project-level bootstrap guidance should stay generic
- feature-specific detail should live in feature-specific PRDs, skills, workflow notes, and issues

If working on the current conclude workstream, use these feature-local sources of truth:

- `docs/09-qdd-conclude-prd.md`
- `src/runtime/bootstrap-prompts/qdd-conclude.md`
- `src/runtime/manuscript-templates/nature/`
- `WORKFLOW.md`

Current conclude document roles:

- `research_synthesis.md` is the complete English scientific substrate and source trail
- `story.md` is the English narrative contract shown to the human at Gate 2
- `main.tex` is a source-grounded Nature-style manuscript draft written after story acceptance, not a mechanical rendering

For current conclude behavior development, use the real local Parkinson QDD
project resolved from `QDD_CONCLUDE_LIVE_PROJECT` or from the issue's explicit
local input path for live acceptance. Do not add a new fabricated scientific
fixture. Missing model vision and missing local TeX tooling are nonblocking
capabilities, not retry reasons.

## Repository Structure

Feature code lives in `src/`:

- `src/cli`: Commander entrypoint
- `src/commands`: command surfaces
- `src/runtime` and `src/services`: workflow logic and service logic
- `src/file-contracts`: managed file schemas
- `src/utils`, `src/render`, `src/ui`: supporting modules

Other important surfaces:

- `domain-skills/`: committed domain and planning skills
- `docs/`: product and architecture notes
- `openspec/`: planning artifacts, specs, and templates
- `.qdd/`: local bootstrap state when present

## Build, Test, And Development Commands

Run package commands from the repository root:

- `npm install`
- `npm run build`
- `npm test`
- `npm run dev`

Common smoke path:

```bash
npm run build
node bin/qdd.js --help
node bin/qdd.js validate --help
```

## Coding Style

- TypeScript with strict compiler settings
- 2-space indentation
- kebab-case for utility files
- PascalCase for classes
- camelCase for functions and variables
- do not add static `@inquirer/*` imports outside the explicitly allowed init path; use dynamic `import()`

Follow nearby formatting. There is no repository Prettier config.

## Testing Guidance

Add TypeScript tests under `src/test/` with the `*.test.ts` suffix when practical, then run `npm run build` before `npm test`.

Prefer focused tests for:

- `src/file-contracts`
- `src/runtime`
- `src/services`
- command behavior

For feature-local work such as conclude, use the relevant PRD and workflow notes to decide the smallest meaningful validation slice.

## Self-Verification Checklist

Before handoff, report:

- files changed and why
- exact validation commands run
- whether `npm run build` passed
- whether `npm test` was run or why it was not needed
- any missing local tools or credentials
- any follow-up issue that should be created instead of expanding scope
