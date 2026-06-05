## 1. Contract Inventory

- [x] 1.1 Inventory the managed file families currently owned by QDD and map where their shapes are scattered in `src`
- [x] 1.2 Define the target source layout for managed file contracts, including schema, template, and example ownership per file family
- [x] 1.3 Decide which existing file families are in scope for this slice and which ones stay for later proposals

## 2. Source Contract Layer

- [x] 2.1 Extract explicit contract modules for the currently managed QDD files
- [x] 2.2 Move hidden enum and field-name rules into those contract modules
- [x] 2.3 Encode `study.md` and `task.md` templates as first-class managed file contracts instead of leaving them embedded inside orchestration code
- [x] 2.4 Encode readable examples for YAML and Markdown managed files from the same source contract layer

## 3. Project Projection

- [x] 3.1 Make `qdd start` generate `.qdd/schema-reference.md`
- [x] 3.2 Make `qdd start` generate `.qdd/examples/*` for the managed file set
- [x] 3.3 Ensure generated project references stay refreshable without creating a second hidden truth source

## 4. Runtime Alignment

- [x] 4.1 Rewire validators to consume the explicit managed file contracts
- [x] 4.2 Rewire scaffold/default writers to consume the same contracts
- [x] 4.3 Rewire `qdd instructions` to surface project-local schema/example references where they constrain edits
- [x] 4.4 Tighten task `## Skills` parsing so skill IDs remain machine-stable while allowing optional human-readable descriptions

## 5. Verification

- [x] 5.1 Add or update tests for generated schema/example outputs during project initialization
- [x] 5.2 Add or update tests that documented valid examples pass validation
- [x] 5.3 Add or update tests that documented invalid shapes fail for the expected reasons
- [x] 5.4 Update docs or prototype maps so readers can find the new managed-file contract layer quickly
