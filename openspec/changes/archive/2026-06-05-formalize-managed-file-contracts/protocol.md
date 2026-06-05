## Filesystem Contract

This slice formalizes the managed-file layer that already exists in QDD.

At the source level, QDD should define one explicit contract module per managed file family. A reasonable first shape is:

```text
src/
  file-contracts/
    contract.ts
    evolution.ts
    study.ts
    task.ts
    artifact-candidates.ts
    artifact-index.ts
    resources.ts
    memory.ts
    public-data-request.ts
    layer-policy.ts
```

Each contract module should own three things:

1. the machine-readable shape and legal enums
2. the default template or renderer used when QDD creates that file
3. one copy-ready example used for project-local reference output

At the project level, `qdd start` should materialize readable references under `.qdd/`:

```text
.qdd/
  schema-reference.md
  examples/
    contract.example.yaml
    evolution.example.yaml
    study.example.md
    task.example.md
    artifact-candidates.example.yaml
    artifacts-index.example.yaml
    resources.example.md
    memory.example.md
    public-data-request.example.yaml
    layer-policy.example.yaml
```

Rules for this slice:

- `src/file-contracts/*` is the source of truth for managed file shapes
- project-local `.qdd/schema-reference.md` and `.qdd/examples/*` are generated documentation, not a second protocol source
- runtime writers, validators, and scaffolding should consume the same contract definitions instead of maintaining parallel hidden shapes

## Identifiers And Metadata

This slice does not introduce new domain objects. It clarifies the fields of the existing ones.

Managed file contracts must explicitly document:

- required IDs:
  - `STUDY-XXX`
  - `TASK-XXX`
  - `ART-XXX`
- legal study statuses
- legal task statuses
- legal task promotion statuses
- legal evolution `kind` values
- legal artifact `type` and `scope` values
- body-format rules for Markdown-managed sections such as `## Skills`

Specific clarifications expected from this slice:

- `evolution.yaml` uses the current runtime field names, not guessed aliases
- `artifact-candidates.yaml` documents required keys, legal enums, and provenance rules
- `task.md` documents that frontmatter `skills:` is the truth source
- the body `## Skills` section may include human-readable descriptions, but each entry must still start with a valid skill ID that normalizes back to the frontmatter set

## Status JSON

No new status command is required for this slice.

`qdd status --json` may remain behaviorally unchanged, but the status surface should be backed by explicit contract modules rather than implicit assumptions spread across runtime files.

If this slice adds anything to status, it should stay minimal, for example:

- enough information to confirm that schema/examples were bootstrapped
- or enough information to show the current contract version/reference path

This slice should not introduce a new heavy schema registry service.

## Instructions JSON

`qdd instructions ... --json` should begin surfacing the managed-file references that an agent actually needs.

In practice:

- project instructions should include `.qdd/schema-reference.md`
- study/task instructions should include the relevant example file paths when those files constrain edits
- instructions should point agents to project-local examples first, not force them to infer shapes from TypeScript internals

This slice still keeps `qdd instructions` as the machine-facing gateway. The change is that the gateway becomes backed by explicit file contracts.

## Agent Usage Rules

- Treat the generated `.qdd/schema-reference.md` as the human/agent quick reference for writing managed files
- Treat `.qdd/examples/*` as copy-ready examples, not as mutable truth sources
- Do not infer undocumented aliases for fields or enums when the contract layer provides an explicit spelling
- Prefer one explicit contract per file family over prose duplicated across prompts, validators, and templates
- Keep the first slice narrow: clarify the existing file contract surface before tackling larger runtime decomposition
