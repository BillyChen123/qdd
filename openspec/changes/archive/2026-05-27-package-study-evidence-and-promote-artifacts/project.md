## Theme

Make QDD study outputs reproducible enough for real research review by packaging executable analysis evidence and promoting only the right subset into reusable artifacts.

## Initial Question

How should QDD require preserved analysis scripts and key figures during study execution, while keeping artifact promotion explicit and selective at study closure?

## Mode

`human`.

Humans still own study judgment and closure approval. Agents may package outputs, maintain promotion candidates, and perform closure-time registration inside the approved study boundary.

## Scope

### In Scope

- Define a clearer study output packaging convention for code, figures, tables, and reports.
- Strengthen `qdd-apply` and task scaffolding so analysis scripts are preserved instead of being implied.
- Require at least one saved figure when a study conclusion depends on visual inspection or visual evidence.
- Add an explicit machine-readable artifact-candidate manifest for outputs that should be promoted at closure.
- Extend `qdd close-study` so it can register missing promoted artifacts before final closure.
- Add tests and docs for the packaging and promotion workflow.

### Out Of Scope

- Blindly registering every file under `studies/STUDY-XXX/output/`.
- Building a separate run engine, notebook manager, or provenance database.
- Auto-generating scientific figures when the analysis itself did not create them.
- Large-file deduplication, artifact versioning, or remote storage.
- Reworking the overall QDD study/task/question-delta model.

## Evidence Standard

This change is successful when one real QDD study can:

- leave behind the executable analysis script used for the main result,
- leave behind the key figure(s) needed to inspect the main claim when visualization matters,
- keep ordinary intermediate outputs in `studies/STUDY-XXX/output/`,
- promote only explicitly selected evidence into `artifacts/index.yaml`,
- and close the study without the user manually reconstructing what code, figure, and summary support the result.

## Shared Context

- Current QDD dogfood output in `tmp/test_qdd` produced reports and tables but did not preserve an analysis script or figure for the main result.
- Current `register-artifact` already works, but `close-study` does not elevate important evidence on its own.
- The user wants selective promotion, not a bloated artifact registry.
- The existing filesystem protocol already separates study-local outputs from reusable artifacts, so this slice should stay inside that model.
- This change should remain a thin runtime and prompt refinement, not a new orchestration layer.
