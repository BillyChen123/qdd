## 1. Naming Update

- [x] 1.1 Update QDD-owned product text from `Question-Driven Development` to `Question-Driven Discovery`.
- [x] 1.2 Update QDD specs and config language to reflect the new expansion where product-facing text appears.
- [x] 1.3 Leave upstream `OpenSpec/` content untouched unless it is directly copied into QDD-owned files.

## 2. Runtime Skeleton

- [x] 2.1 Add root-level package/runtime scaffolding needed to run a QDD CLI.
- [x] 2.2 Add `bin/qdd.js` and root `src/` entrypoints.
- [x] 2.3 Establish a small internal module layout for commands, filesystem helpers, and JSON output types.

## 3. `qdd init`

- [x] 3.1 Implement `qdd init` to create the minimal QDD project structure.
- [x] 3.2 Seed `qdd.yaml`, `control/research_contract.yaml`, `control/mode.yaml`, `questions/evolution_trail.yaml`, and `artifacts/index.yaml`.
- [x] 3.3 Make init idempotent enough to avoid clobbering existing project state unexpectedly.

## 4. Read Interfaces

- [x] 4.1 Implement `qdd status --json` using the minimal protocol contract.
- [x] 4.2 Implement `qdd instructions <id> --json` for existing study/task targets.
- [x] 4.3 Keep JSON outputs stable and aligned with the bootstrap protocol docs.

## 5. Validation

- [x] 5.1 Add tests or smoke checks for `qdd init`.
- [x] 5.2 Add tests or smoke checks for `qdd status --json`.
- [x] 5.3 Add tests or smoke checks for `qdd instructions <id> --json`.
- [x] 5.4 Confirm this slice still defers agent bootstrap generation to a later change.
