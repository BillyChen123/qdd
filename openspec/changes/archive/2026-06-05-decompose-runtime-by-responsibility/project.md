## Theme

Make QDD's source tree responsibility-driven so the protocol stays stable while the implementation becomes readable, local, and easier to change.

## Initial Question

How should QDD decompose the current runtime-heavy implementation into explicit `file-contracts`, `services`, `render`, and `types` layers without changing CLI behavior, managed-file schemas, or workflow semantics?

## Mode

`assist`

Human decisions still own protocol semantics and refactor boundaries. This change may move code aggressively inside `src/`, but it must preserve the external command surface, managed-file truth model, and current study/task/close semantics.

## Scope

### In Scope

- Split current large source files by responsibility, especially:
  - `src/runtime/lifecycle.ts`
  - `src/runtime/evolution.ts`
  - `src/runtime/defaults.ts`
  - `src/types.ts`
- Establish or complete these responsibility-owned areas:
  - `src/file-contracts/`
  - `src/services/studies.ts`
  - `src/services/tasks.ts`
  - `src/services/artifacts.ts`
  - `src/services/closure.ts`
  - `src/render/research-map.ts`
  - `src/types/*`
- Keep `src/commands/*` as thin CLI adapters that parse arguments and delegate.
- Pull managed-file templates, examples, and reference builders out of orchestration-heavy runtime code.
- Reduce long-term coupling between validation, lifecycle state transitions, artifact promotion, and HTML rendering.
- Update code map or adjacent docs so readers can find the new layout quickly.

### Out Of Scope

- Changing CLI command names, flags, or JSON output schemas.
- Changing `contract.yaml`, `evolution.yaml`, `study.md`, `task.md`, `artifact-candidates.yaml`, or `artifacts/index.yaml` semantics.
- Changing QDD workflow authority rules, role policy, or domain-skill selection behavior.
- Rewriting bootstrap prompts beyond import/path adjustments required by the refactor.
- Adding new storage backends, run databases, or orchestration layers.

## Evidence Standard

This change is successful when:

- the current large mixed-responsibility files are materially reduced or replaced,
- study/task/artifact/closure behavior lives under explicit service modules instead of a single runtime hub,
- research-map rendering is owned by a dedicated render module,
- managed-file defaults/examples no longer hide inside orchestration code,
- `src/types.ts` is replaced by a readable split type surface with a stable barrel,
- `src/commands/*` remain thin and do not own domain logic,
- and build/tests still confirm no protocol or CLI behavior regression.

## Shared Context

- The current code already started a `src/file-contracts/` split, but the main runtime is still concentrated in a few large files:
  - `src/runtime/inspection.ts` ~910 lines
  - `src/runtime/lifecycle.ts` ~830 lines
  - `src/types.ts` ~655 lines
  - `src/runtime/evolution.ts` ~594 lines
  - `src/runtime/instructions.ts` ~477 lines
- `src/runtime/lifecycle.ts` still mixes study creation, task creation, artifact registration, promotion logic, close preflight, Markdown rewriting, and memory/evolution updates.
- `src/runtime/evolution.ts` still mixes schema normalization, legacy conversion, memory listing, and HTML rendering concerns.
- `src/runtime/defaults.ts` still acts as a cross-cutting fallback layer even though several defaults already come from `src/file-contracts/*`.
- Recent QDD changes tightened protocol semantics; this slice should not reopen them. It is a readability and maintenance refactor, not a workflow redesign.
