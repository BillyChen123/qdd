## Task Goal

Execute a no-protocol-drift refactor that turns the current runtime-heavy implementation into a responsibility-based source layout.

## Study Link

This task implements the bounded refactor study defined in `study.md`. It supports later QDD work by making lifecycle, validation, rendering, and managed-file logic easier to locate and change.

## Method

1. Split `src/types.ts` into concern-based modules under `src/types/`, with one stable `index.ts` barrel.
2. Extract study and task document operations from `src/runtime/lifecycle.ts` into `src/services/studies.ts` and `src/services/tasks.ts`.
3. Extract artifact candidate, artifact registry, and promotion logic into `src/services/artifacts.ts`.
4. Extract close preflight, close execution, memory/evolution updates, and cleanup orchestration into `src/services/closure.ts`.
5. Move `research-map.html` rendering out of `src/runtime/evolution.ts` into `src/render/research-map.ts`.
6. Reduce `src/runtime/defaults.ts` to a narrow composition layer or remove it where file-contract defaults already exist.
7. Keep `src/commands/*` as thin adapters and update imports to call the new service layer.
8. Refresh tests and prototype-map docs so the new structure is navigable.

## Expected Outputs

- New source modules under:
  - `src/services/`
  - `src/render/`
  - `src/types/`
- Shrunk or removed mixed-responsibility runtime files
- Updated imports across commands/runtime helpers/tests
- Updated code-map or architecture docs reflecting the new structure
- Passing build/test evidence

## Run Contract

Each implementation pass must:

- preserve external command behavior,
- preserve managed-file schemas and enum meanings,
- avoid long-lived duplicate truths between old runtime files and new services,
- update all import sites when ownership moves,
- and verify behavior with targeted tests plus a full build/test run before closure.

## Failure / Blocker Conditions

- A service split that silently changes CLI output or file semantics is invalid.
- A migration that leaves two competing homes for the same lifecycle logic is incomplete.
- New circular dependencies between services, contracts, and runtime infrastructure should block completion until resolved.
- If a target module has no clear ownership boundary, the refactor should stop and clarify the design before widening the change.
