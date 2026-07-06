# Repository Guidelines

## Project Structure & Module Organization

This repository is the active QDD TypeScript CLI implementation. Work from the repository root.

Feature code lives in `src/`: `src/cli` wires the Commander entrypoint, `src/commands` owns command surfaces, `src/runtime` and `src/services` hold workflow logic, `src/file-contracts` defines managed file schemas, and `src/utils`, `src/render`, and `src/ui` contain supporting modules. Tests currently live under `src/test/` and compile into `dist/test/`.

Durable QDD skill and research assets live outside `src/`: `domain-skills/` contains committed domain and planning skills, `docs/` contains product and architecture notes, `openspec/` contains planning artifacts, and `.qdd/` contains local runtime bootstrap state when present. The `.codex/` directory is local agent bootstrap state and is ignored by git; do not assume it exists in a fresh Symphony workspace unless the workflow hook installs it.

For the conclude skill work, treat `docs/09-qdd-conclude-prd.md` as the product source of truth.

## Build, Test, and Development Commands

Run package commands from the repository root:

- `npm install` - install dependencies; requires Node `>=20.19.0`
- `npm run build` - compile TypeScript into `dist/` and copy runtime assets
- `npm test` - run Node test files from `dist/test/*.js`; run `npm run build` first
- `npm run dev` - TypeScript watch build

Local CLI smoke path:

```bash
npm run build
node bin/qdd.js --help
node bin/qdd.js validate --help
```

Symphony workspace bootstrap is defined in `WORKFLOW.md` and currently runs `git clone`, `npm install`, and `npm run build`.

## Coding Style & Naming Conventions

Use TypeScript with strict compiler settings and 2-space indentation. Match existing file naming: kebab-case for utility files such as `change-utils.ts`, PascalCase for classes such as `ValidateCommand`, and camelCase for functions and variables.

Follow `OpenSpec/eslint.config.js`. There is no Prettier config here, so keep formatting consistent with nearby files. One repository-specific rule matters: do not add static `@inquirer/*` imports outside the explicitly allowed init path; use dynamic `import()` instead.

## Testing Guidelines

The current test runner is Node's built-in test runner over compiled JavaScript. Add TypeScript tests under `src/test/` with the `*.test.ts` suffix when practical, then run `npm run build` before `npm test`.

Prefer focused tests for `src/file-contracts`, `src/runtime`, `src/services`, and command behavior. For CLI-facing changes, include at least one smoke path through `node bin/qdd.js ...` or a service-level test that proves the same behavior.

For conclude skill changes, validate the smallest meaningful slice:

- scaffold-only changes: `npm run build`
- parsing/harvesting logic: add or update a focused fixture/test, then `npm run build && npm test`
- CLI command changes: include a CLI smoke command

## Documentation Structure

- `README.md` and `README.zh-CN.md` describe the current product surface.
- `docs/04-installation-guide.md` covers installation.
- `docs/09-qdd-conclude-prd.md` is the active PRD for the conclude skill.
- `openspec/specs/` and `openspec/changes/` contain planning artifacts, but QDD's primary implementation contracts are the TypeScript file contracts and runtime behavior.
- `domain-skills/**/SKILL.md` files are committed reusable skill instructions for research execution.

Keep documentation updates close to the changed behavior. Do not add generated reports or local API keys to git.

## Self-Verification Checklist

Before handing off a change, report:

- files changed and why
- exact validation commands run
- whether `npm run build` passed
- whether `npm test` was run or why it was not needed
- any missing local tools or credentials
- any follow-up issue that should be created instead of expanding scope

## Commit & Pull Request Guidelines

Follow the commit style already in history: concise, imperative subjects with conventional prefixes when useful, for example `fix: ...`, `test: ...`, or `docs(migration-guide): ...`.

Small fixes can go straight to a PR. Larger features, workflow changes, or refactors should start with an OpenSpec proposal under `openspec/changes/<change-id>/` when the design is not already captured elsewhere. For the conclude skill, `docs/09-qdd-conclude-prd.md` is the accepted planning source unless a later OpenSpec change supersedes it.

PRs should include a short summary, affected paths or commands, test evidence, and terminal output when CLI UX changes. If AI-generated code is included, disclose the agent and model in the PR description.

When Symphony is driving work, keep the Linear workpad and PR summary in Chinese unless the issue asks otherwise.
