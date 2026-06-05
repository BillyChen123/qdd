## Theme

Make QDD's managed files explicit, readable, and machine-safe.

## Initial Question

How should QDD formalize every managed file as an explicit schema, template, and example surface so humans and agents can write the files correctly on the first pass?

## Mode

assist

Human decisions still own protocol semantics and scope boundaries. The implementation may restructure source modules and generated reference files, but it should not silently broaden the workflow model.

## Scope

### In Scope

- Define explicit source-level contracts for the managed files QDD already owns
- Make `study.md`, `task.md`, `evolution.yaml`, `artifact-candidates.yaml`, `artifacts/index.yaml`, `context/resources.md`, memory files, and policy files easier to understand from the codebase
- Generate project-local schema/reference material during `qdd start`
- Align validation and template generation with the same contract definitions
- Clarify legal enums and body-format rules such as task `## Skills`

### Out Of Scope

- Runtime service decomposition or major file moves across `src/runtime/*`
- New workflow commands or a new planning runtime
- Artifact lifecycle changes such as `table` promotion, tmp cleanup, or close-time auto-promotion policy
- Evolution/memory semantic redesign beyond documenting the current intended file contract

## Evidence Standard

This slice is successful when:

- the managed file set has one readable source contract per file shape
- `qdd start` materializes copy-ready schema references and examples into the project
- validators reject real shape violations while agreeing with the written examples
- agents no longer need to guess hidden field names, legal enums, or Markdown formatting rules

## Shared Context

- Current contract logic is scattered across `src/types.ts`, `src/runtime/defaults.ts`, `src/runtime/lifecycle.ts`, `src/runtime/evolution.ts`, `src/runtime/evidence.ts`, and `src/runtime/inspection.ts`
- `study.md` and `task.md` templates already exist, but they are embedded inside runtime orchestration code
- Real benchmark runs showed repeated friction around `evolution.yaml`, `artifact-candidates.yaml`, legal status values, and `## Skills` formatting
- QDD should stay lightweight: the new contract layer must clarify existing files, not add a heavy secondary runtime
