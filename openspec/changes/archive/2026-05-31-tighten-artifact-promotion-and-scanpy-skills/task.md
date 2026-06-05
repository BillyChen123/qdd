## Task Goal

Implement the minimal runtime and bootstrap changes needed to make artifact promotion physically canonical, layer-owned role policy human-editable, and first-wave scanpy/plot skills practically usable in QDD single-cell studies.

## Study Link

This task supports the study decision that better filesystem and skill contracts are not optional polish; they directly determine whether one bounded study executes with reproducible evidence and defensible domain methods.

## Method

- Remove root `data/` from the initialized scaffold, instructions, and runtime path contract, and redirect dataset entrypoint guidance to `artifacts/data/`.
- Introduce `.qdd/layer-policy.yaml` and teach runtime instructions to merge layer-owned role defaults with task-declared domain skills through an explicit command hint.
- Update `qdd-start`, `qdd-explore`, `qdd-apply`, and related prompts to call command-aware instructions and honor the layer policy.
- Update artifact registration and closure-time promotion so reusable files move into canonical artifact directories and leave an auditable pointer behind at the original study-local location.
- Make `qdd-close` resolve as `study target + project decision layer`, so closure-time promotion and carry-forward judgment happen from the Thesis Manager role rather than from the study role alone.
- Keep `qdd register-artifact` as an exception path rather than the normal promotion path, while still enforcing canonical relocation when it is used.
- Add the first focused domain skills for scanpy-centered single-cell analysis and scanpy-grounded plotting.
- Refresh bootstrap projections and tests so installed projects receive the new contract by default.

## Expected Outputs

- Updated runtime constants, defaults, instructions, lifecycle, and related tests
- Updated `.qdd` bootstrap assets including a new layer-policy scaffold
- Updated workflow prompts that pass command context into instructions
- First-wave domain skills under categorized skill trees, likely including:
  - `genomics/scanpy-core-workflow`
  - `genomics/scanpy-marker-annotation`
  - `plot/scanpy-embedding-panels`
  - `plot/scanpy-expression-panels`
- Reference notes or helper scripts inside those skill directories where needed

## Run Contract

Each implementation run should record:

- whether shared data now lands in `artifacts/data/` rather than root `data/`
- how canonical promoted paths are chosen and how original study-local paths remain auditable
- which prompts now pass `--command`
- how `.qdd/layer-policy.yaml` is validated and merged
- how commands map to `target`, `decision_layer`, and `role`
- which domain skills were added and which official references they encode
- whether the scanpy clustering default is now clearly neighbors plus Leiden rather than `k-means`
- which bootstrap assets and tests were refreshed

## Failure / Blocker Conditions

- The change still initializes or documents a separate root `data/` surface as the primary project data entrypoint.
- Promotion still only registers old study-local paths without canonical relocation.
- Promotion relocates files but leaves no usable audit trail at the original study-local location.
- Prompts still cannot reliably load required and optional skills by layer and command context.
- The new policy allows referencing non-existent or workflow-category skills as task domain requirements.
- `qdd-close` still behaves as if closure judgment belongs only to the study layer instead of the project decision layer.
- The new single-cell skills remain too vague to steer method choice, especially around clustering and figure generation.
- The slice grows into a broad single-cell platform instead of a focused first-wave baseline.
