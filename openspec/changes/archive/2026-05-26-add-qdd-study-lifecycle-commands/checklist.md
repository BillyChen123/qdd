## 1. CLI Surface

- [x] 1.1 Add `qdd add-study` to allocate the next study ID and scaffold `study.md`, `tasks/`, and `output/`.
- [x] 1.2 Add `qdd add-task STUDY-XXX` to allocate the next task ID, create `TASK-XXX.md`, update the study's `task_ids`, and append a summary entry under `## Tasks` in `study.md`.
- [x] 1.3 Add `qdd register-artifact <path>` to allocate artifact IDs and append provenance-aware entries to `artifacts/index.yaml`.
- [x] 1.4 Add `qdd close-study STUDY-XXX` to validate study readiness, append `question_delta` to `evolution.yaml`, and mark the study closed.

## 2. Runtime And Templates

- [x] 2.1 Extend `src/types.ts` with the minimum new fields needed for lifecycle writes without changing the root layout.
- [x] 2.2 Add reusable runtime helpers for next-ID allocation, Markdown frontmatter mutation, and study/task record updates.
- [x] 2.3 Make the generated `study.md` and `TASK-XXX.md` bodies follow the section structure in `docs/01-development-prototype.md`.
- [x] 2.4 Update the default `.qdd/instructions.md` content so it follows the prototype's single-file guidance shape: quick reference, workflow, validation checklist, and advanced notes.
- [x] 2.5 Update `qdd status --json` so completed and blocked lifecycle states are visible in the machine-readable summary.
- [x] 2.6 Update `qdd instructions <id> --json` so write targets include the study/task records that agents are expected to mutate directly during execution.

## 3. Validation And Docs

- [x] 3.1 Add smoke tests covering one end-to-end flow: init -> add-study -> add-task -> agent-style task record update -> register-artifact -> close-study.
- [x] 3.2 Update [docs/02-code-prototype-map.md](/data/chenyz/project/qdd/docs/02-code-prototype-map.md) to reflect the expanded command surface and new runtime helpers.
- [x] 3.3 Verify that `context/` remains an open YAML directory and that no OpenSpec proposal/spec/design/task terminology leaks into runtime records.
- [x] 3.4 Verify that this slice follows `docs/01-development-prototype.md` for workflow shape even where the earlier prototype code had drifted.
