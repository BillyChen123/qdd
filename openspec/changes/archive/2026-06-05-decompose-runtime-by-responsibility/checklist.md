## 1. Type Surface

- [x] 1.1 Split `src/types.ts` into concern-based modules under `src/types/` and keep a stable `src/types/index.ts` barrel
- [x] 1.2 Group types by ownership such as contract/evolution, study-task, artifacts, instructions, and command/runtime shared surfaces
- [x] 1.3 Update imports so no long-lived duplicate type truths remain between `src/types.ts` and `src/types/*`

## 2. Service Extraction

- [x] 2.1 Extract study document creation/read/update logic from `src/runtime/lifecycle.ts` into `src/services/studies.ts`
- [x] 2.2 Extract task document creation/read/update and skill-sync logic into `src/services/tasks.ts`
- [x] 2.3 Extract artifact candidate, registry, promotion, and canonicalization logic into `src/services/artifacts.ts`
- [x] 2.4 Extract close preflight, close execution, memory/evolution writeback, and cleanup orchestration into `src/services/closure.ts`

## 3. Render And Contract Cleanup

- [x] 3.1 Move `research-map.html` rendering out of `src/runtime/evolution.ts` into `src/render/research-map.ts`
- [x] 3.2 Remove managed-file template/example/default builders from orchestration-heavy runtime code and keep them under `src/file-contracts/*`
- [x] 3.3 Reduce `src/runtime/defaults.ts` to a narrow composition layer or remove redundant default wrappers where file contracts already own the truth

## 4. Thin Command Layer

- [x] 4.1 Update `src/commands/*` to delegate to service entrypoints and keep only CLI argument parsing, project-root resolution, and output formatting
- [x] 4.2 Remove remaining business logic from command modules and keep command-facing adapters short
- [x] 4.3 Keep `src/runtime/*` focused on infrastructure helpers such as paths, store, bootstrap, local-skills, and constants

## 5. Verification And Readability

- [x] 5.1 Update or add targeted tests for the extracted service boundaries without changing protocol expectations
- [x] 5.2 Run build/tests and confirm no CLI or managed-file behavior regression
- [x] 5.3 Update the code prototype map or adjacent docs so a reader can understand the new source layout quickly
