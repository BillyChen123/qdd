## 1. Reuse Boundary

- [x] 1.1 Enumerate the exact OpenSpec subsystems QDD intends to reuse in bootstrap: tool registry, command adapters, config injection, schema/template loading.
- [x] 1.2 Record which OpenSpec workflow opinions QDD explicitly does not inherit: proposal/spec/design/tasks as primary research objects, archive lifecycle, software change semantics.
- [x] 1.3 Decide whether the first implementation slice uses extraction, vendoring, or thin wrappers for the reusable foundation.

## 2. QDD Core Protocol

- [x] 2.1 Define the minimal QDD filesystem contract for `project`, `study`, `task`, `run`, `artifact`, and closure state.
- [x] 2.2 Define the `question_delta` contract and its allowed `change_type` values.
- [x] 2.3 Define the minimal JSON surfaces required for `status` and `instructions`.

## 3. Agent Bootstrap

- [x] 3.1 Specify how QDD will project instructions into Codex and Claude Code locations while preserving existing OpenSpec-compatible patterns.
- [x] 3.2 Decide whether QDD should keep its own command namespace, skill names, and generated prompt identifiers separate from `opsx`.
- [x] 3.3 Define how `openspec/config.yaml` context and per-artifact rules map onto QDD artifacts and instructions.

## 4. Schema And Templates

- [x] 4.1 Draft a QDD-specific schema that models research artifacts instead of software planning artifacts.
- [x] 4.2 Create initial templates for the minimal QDD artifact set.
- [x] 4.3 Verify the schema/template shape is still easy to override project-locally.

## 5. Validation

- [x] 5.1 Add a first spec for the reusable agent foundation boundary.
- [x] 5.2 Add a first spec for QDD research orchestration behavior.
- [x] 5.3 Validate this change set against the agreed bootstrap scope before any code extraction starts.
