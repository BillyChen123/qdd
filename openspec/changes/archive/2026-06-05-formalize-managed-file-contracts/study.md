## Question

How can QDD make every managed file legible to humans and agents from first read, without adding a heavier runtime or changing the research workflow model?

## Hypothesis / Expectation

If QDD extracts each managed file contract into an explicit source module and projects readable references into `.qdd/`, then agent write failures and human code-reading friction will both drop while the CLI surface stays stable.

## Inputs

- Current managed-file logic scattered across:
  - `src/types.ts`
  - `src/runtime/defaults.ts`
  - `src/runtime/lifecycle.ts`
  - `src/runtime/evolution.ts`
  - `src/runtime/evidence.ts`
  - `src/runtime/inspection.ts`
- Existing project scaffold produced by `qdd start`
- Real benchmark friction around:
  - `evolution.yaml`
  - `artifact-candidates.yaml`
  - legal status values
  - task `## Skills` formatting

## Evidence Plan

This study should produce:

- one explicit inventory of QDD managed files and their owning source modules
- a source-level contract layer for those files
- generated `.qdd/schema-reference.md` and `.qdd/examples/*`
- aligned validation/template behavior proving that the same contracts drive both writing and checking

## Blockers

- The slice must stay scoped; it should not silently absorb runtime service decomposition
- The contract layer must not become a second hidden protocol separate from the real CLI/runtime
- The generated examples need to stay synchronized with the actual validators, or the change will create new confusion instead of removing it

## Exit Signal

The study is ready to close when:

- a reader can inspect `src` and clearly find the contract for each managed file
- `qdd start` writes readable schema/examples into the project
- validators and templates consume the same contract definitions
- the main benchmark pain points can be answered by reading generated references instead of reverse-engineering runtime code
