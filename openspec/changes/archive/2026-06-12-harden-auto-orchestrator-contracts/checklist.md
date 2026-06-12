## 1. Baseline And Regression Tests

- [x] 1.1 Add a test showing current auto dry-run still sequences `start -> propose -> apply -> close` for a clean project.
- [x] 1.2 Add a test fixture where a completed `qdd-start` phase leaves an active study, and assert the next real phase is recomputed from persisted state.
- [x] 1.3 Add a test fixture where a completed `qdd-start` phase leaves a completed but unclosed study, and assert auto resumes at `qdd-close` for that study rather than proposing the next ID.
- [x] 1.4 Add a test fixture with invalid mixed-schema `evolution.yaml` under top-level `studies:` using `study_id`, and assert auto returns `invalid_state` with a useful reason.
- [x] 1.5 Add a test fixture with `artifact-candidates.yaml` using old top-level `candidates:`, and assert auto returns `invalid_state` or equivalent managed-file diagnostic before continuing.

## 2. Runtime State Handling

- [x] 2.1 Add `invalid_state` to `AutoStopCode` and `AutoResult` handling where needed.
- [x] 2.2 Introduce a safe status builder for `qdd auto` that catches managed-file parse/validation errors without crashing the process.
- [x] 2.3 Include the likely managed file path in invalid-state diagnostics when the error message indicates `evolution.yaml`, `artifact-candidates.yaml`, or another known managed file.
- [x] 2.4 Ensure invalid state stops auto before `inspectPhaseCompletion` or next phase selection.
- [x] 2.5 Keep `qdd status --json` strict; do not weaken validators to make auto continue through invalid state.

## 3. Phase Progression

- [x] 3.1 Replace post-phase fixed `nextPhase(current, status)` behavior for real runs with state-derived recomputation from `computeInitialPhase(status, taskRecords)`.
- [x] 3.2 Preserve the clean-project behavior where `start(PROJECT)` with no studies advances to `propose(STUDY-001)`.
- [x] 3.3 Ensure active study with no tasks resumes `qdd-propose` for that study.
- [x] 3.4 Ensure active study with pending/running tasks resumes `qdd-apply` for that study.
- [x] 3.5 Ensure completed or blocked unclosed study resumes `qdd-close` for that study.
- [x] 3.6 Ensure terminal question states still stop auto instead of proposing another study.

## 4. Phase Drift Diagnostics

- [x] 4.1 Add a lightweight managed-path snapshot before and after each real phase.
- [x] 4.2 Define unexpected write patterns for `qdd-start`, including `studies/**`, `evolution.yaml`, and `artifacts/index.yaml`.
- [x] 4.3 Define unexpected write patterns for `qdd-propose` and `qdd-apply`, especially direct `evolution.yaml` mutation.
- [x] 4.4 Record phase drift diagnostics in verbose logs or `AutoPhaseResult` without introducing a new durable state file.
- [x] 4.5 Keep phase drift warning-level in this slice unless it also causes invalid managed-file state.

## 5. Prompt And Instruction Hardening

- [x] 5.1 Tighten `qdd-start` prompt and `PROJECT/qdd-start` instruction rules so study/task creation and evolution mutation are explicitly outside start ownership.
- [x] 5.2 Tighten `qdd-close` prompt and study close instruction rules so agents must use `qdd close-study` rather than hand-writing `evolution.yaml`.
- [x] 5.3 Make current `.qdd/schema-reference.md` and `.qdd/examples/*` the explicit source of truth for managed YAML edits in relevant prompts.
- [x] 5.4 Verify workflow prompts do not contain retired `question_delta` or `evolution_trail` guidance outside explicitly historical context.

## 6. Historical Schema Source Hygiene

- [x] 6.1 Mark `docs/00-product-requirements-document.md` as historical or update its retired `evolution_trail` examples so agents do not treat them as current schema.
- [x] 6.2 Mark `docs/01-development-prototype.md` as historical or update its retired `evolution_trail` examples.
- [x] 6.3 Search `docs/`, `src/runtime/bootstrap-prompts/`, `.codex/skills/`, and `.claude/commands/` for retired schema terms and classify each occurrence as removed, updated, or explicitly historical.
- [x] 6.4 Ensure generated managed-file examples still come from `src/file-contracts/*` and remain aligned with validators.

## 7. Verification

- [x] 7.1 Run the targeted auto/orchestrator Vitest tests.
- [x] 7.2 Run `npm run build`.
- [x] 7.3 Run `npm test`.
- [x] 7.4 Run `openspec status --change harden-auto-orchestrator-contracts` and confirm the change is apply-ready or fully tracked.
- [x] 7.5 Document any remaining boundary, especially whether future work should enforce instruction write allowlists inside `agent-runner`.

Remaining boundary: this slice records phase drift in logs/`AutoPhaseResult` and stops only on invalid managed-file state. It does not yet enforce instruction write allowlists inside `agent-runner`; that should remain a future, deeper sandboxing change if warning-level drift is not enough.
