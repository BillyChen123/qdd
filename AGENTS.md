# Repository Guidelines

## Project Structure & Module Organization

This workspace has two layers. Root-level files (`docs/`, `CLAUDE.md`) describe the QDD research framework and planned architecture. The active implementation lives in `OpenSpec/`, a TypeScript CLI package used as the current execution base.

Inside `OpenSpec/`, keep feature code in `src/`: `src/cli` wires the Commander entrypoint, `src/commands` owns command surfaces, `src/core` holds shared workflow logic, and `src/utils`, `src/telemetry`, and `src/ui` contain supporting modules. Tests mirror that layout under `OpenSpec/test/`. Spec artifacts and change proposals live in `OpenSpec/openspec/specs/` and `OpenSpec/openspec/changes/`. Static assets belong in `OpenSpec/assets/`.

## Build, Test, and Development Commands

Run all package commands from `OpenSpec/`:

- `pnpm install` - install dependencies; requires Node `>=20.19.0`
- `pnpm build` - compile TypeScript into `dist/`
- `pnpm lint` - run ESLint on `src/`
- `pnpm test` - run the Vitest suite once
- `pnpm test:watch` - watch mode for local iteration
- `pnpm test:coverage` - generate text/json/html coverage reports
- `pnpm dev` - TypeScript watch build
- `pnpm dev:cli` - rebuild and execute the local CLI

## Coding Style & Naming Conventions

Use TypeScript with strict compiler settings and 2-space indentation. Match existing file naming: kebab-case for utility files such as `change-utils.ts`, PascalCase for classes such as `ValidateCommand`, and camelCase for functions and variables.

Follow `OpenSpec/eslint.config.js`. There is no Prettier config here, so keep formatting consistent with nearby files. One repository-specific rule matters: do not add static `@inquirer/*` imports outside the explicitly allowed init path; use dynamic `import()` instead.

## Testing Guidelines

Vitest is the test runner. Add tests under `OpenSpec/test/**` with the `*.test.ts` suffix, mirroring the touched source area when practical. Prefer focused unit tests for `src/core` and `src/utils`, and extend `test/cli-e2e/` when command behavior or JSON output changes. Run `pnpm test` before submitting; use `VITEST_MAX_WORKERS=1 pnpm test` if local resources are tight.

## Commit & Pull Request Guidelines

Follow the commit style already in history: concise, imperative subjects with conventional prefixes when useful, for example `fix: ...`, `test: ...`, or `docs(migration-guide): ...`.

Small fixes can go straight to a PR. Larger features, workflow changes, or refactors should start with an OpenSpec proposal under `OpenSpec/openspec/changes/<change-id>/`. PRs should include a short summary, affected paths or commands, test evidence, and screenshots or terminal output when CLI UX changes. If AI-generated code is included, disclose the agent and model in the PR description.
