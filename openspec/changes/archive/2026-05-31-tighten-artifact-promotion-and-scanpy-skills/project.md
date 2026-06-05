## Theme

Tighten QDD's reusable artifact flow and domain-skill baseline so single-cell studies land in a cleaner filesystem contract, close into stable reusable evidence, and execute against more professional default analysis guidance.

## Initial Question

How should QDD flatten shared data storage under `artifacts/data/`, promote reusable outputs into canonical artifact locations at closure time, expose a layer-aware role policy to agents, and seed a first practical scanpy/plot skill baseline for single-cell studies?

## Mode

`human`

Humans still own project truth, study boundaries, and closure judgment. Agents may structure artifact promotion, resolve workflow-specific skill requirements, and execute scanpy-guided tasks, but must not invent domain defaults or silently swap in ad hoc methods outside the declared skill and protocol contract.

## Scope

### In Scope

- Remove the separate project-root `data/` entrypoint convention and converge shared data storage on `artifacts/data/`.
- Keep `artifacts/data/` flat in this slice rather than introducing subfolders such as `linked/` or `derived/`.
- Clarify that files inside `artifacts/data/` are not automatically formal artifacts; only entries registered in `artifacts/index.yaml` count as promoted reusable artifacts.
- Update promotion behavior so reusable outputs are physically moved into canonical artifact directories during registration or closure-time promotion.
- Preserve study-local readability after promotion, for example by replacing the old study-output path with a link or otherwise leaving an auditable pointer.
- Add a human-editable `.qdd/layer-policy.yaml` that defines:
  - layer -> role mapping (`project -> thesis-manager`, `study -> study-brain`, `task -> executor`)
  - layer-owned required and optional local skills
  - command -> target + decision-layer mapping
- Extend instructions generation so command-aware prompts can request role-aware skill resolution instead of always returning empty optional skills.
- Make `qdd-close` explicitly operate on a study target while deferring artifact and carry-forward judgment to the project decision layer.
- Keep `qdd register-artifact` as an exception/manual fast path rather than the core promotion path; normal artifact elevation should flow through `artifact-candidates.yaml` and `qdd-close`.
- Seed the first single-cell domain skill baseline, centered on scanpy and concrete plotting behaviors that are actually reusable across studies.
- Encode a stricter default clustering stance for scRNA workflows: prefer neighbors plus Leiden unless a task explicitly justifies an alternative.

### Out Of Scope

- Building a general plugin marketplace or remote skill installer for domain methods.
- Covering every single-cell subdomain such as trajectory, cell-cell communication, spatial, or multi-omic integration in this slice.
- Replacing task-declared skills with full automatic skill inference from free text alone.
- Redesigning the entire artifact registry schema beyond the canonical-path and promotion behavior needed here.
- Introducing a new project planner, run database, or hidden orchestration engine.

## Evidence Standard

This change is successful when:

- initialized projects no longer depend on a separate root `data/` directory,
- canonical reusable data lives under `artifacts/data/`,
- promotion actually relocates reusable outputs into canonical artifact paths rather than only registering the old path,
- study-local auditability is preserved after promotion,
- command-aware prompts can surface required and optional skills from a human-edited layer policy,
- `qdd-close` clearly behaves as `study target + project decision layer`,
- `qdd-apply` and related instructions consistently expose concrete scanpy and plotting skills when the policy and tasks require them,
- and the first-wave single-cell skills steer common analyses toward official scanpy-style practice rather than weak defaults such as ad hoc `k-means` clustering.

## Shared Context

- The current runtime already defines `artifacts/data`, `artifacts/code`, `artifacts/figures`, and `artifacts/reports`, but promotion currently registers paths without relocating files into those canonical locations.
- The user wants shared data entrypoints and promoted data outputs to coexist under one flat `artifacts/data/` surface, accepting that the registry distinguishes formal artifacts from mere files.
- Current instructions output leaves `optional_skills` empty and only exposes task-declared matches, which is too weak for layer-owned defaults such as always loading environment or domain-default skills during task execution.
- The user wants the core role hierarchy to be explicit and stable:
  - `project -> Thesis Manager`
  - `study -> Study Brain`
  - `task -> Executor`
- Commands should map onto that role hierarchy rather than defining an independent workflow-keyed skill universe.
- There is no mature public bioinformatics `SKILL.md` ecosystem worth directly vendoring. The strongest reusable sources are official or widely used method references such as `scanpy`, `scanpy-tutorials`, `AnnData`, `single-cell-best-practices`, and closely related scverse material.
- The motivating failure mode is concrete: a single-cell task drifted toward `k-means` instead of the more professional scanpy-style graph clustering flow based on neighbors and Leiden.
- Existing domain skills in this repository are still minimal, so the first wave should stay focused and executable rather than trying to cover the full single-cell stack.
