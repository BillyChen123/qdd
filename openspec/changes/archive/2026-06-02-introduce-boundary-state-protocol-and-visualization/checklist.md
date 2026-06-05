## 1. Boundary Core

- [x] 1.1 Add boundary-state types, paths, defaults, and YAML helpers for `boundaries.yaml`
- [x] 1.2 Define and validate the thin `boundary-updates.yaml` apply contract
- [x] 1.3 Extend status and validation logic to include boundary-state summaries and consistency checks

## 2. CLI Surface

- [x] 2.1 Add `qdd boundaries --json` for dedicated project boundary inspection
- [x] 2.2 Add `qdd boundaries apply --file <updates.yaml>` as the only controlled mutation surface
- [x] 2.3 Add `qdd boundaries render --output <path>` with project-root `boundary-graph.html` as the first-class render target

## 3. Workflow Integration

- [x] 3.1 Make `qdd init` scaffold a default `boundaries.yaml`
- [x] 3.2 Tighten `qdd-start` so it seeds the first real boundary state through `qdd boundaries apply`
- [x] 3.3 Extend study contracts so `study.md` records `target_boundaries`
- [x] 3.4 Tighten `qdd-propose` and its instructions so planning reads current boundaries and writes explicit targets
- [x] 3.5 Tighten `qdd-close` so it writes `studies/STUDY-XXX/output/boundary-updates.yaml` and applies it before final closure

## 4. Verification

- [x] 4.1 Add tests or smoke coverage for boundary read / apply behavior and mutation authority boundaries
- [x] 4.2 Add render coverage proving a project-local HTML boundary view can be generated from boundary state plus study evolution inputs
- [x] 4.3 Update relevant documentation and prompt references so boundary state is treated as a core QDD protocol rather than a domain skill
