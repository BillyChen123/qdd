# QDD Code Prototype Map

> This is the live code-facing map for the current QDD prototype.
> It tracks the real `src/` layout and the current runtime protocol, not the full long-term product plan.

## Current Status

QDD now has a working TypeScript CLI plus bootstrap prompts and workflow skills for the first bounded research loop:

`qdd init -> qdd-start -> qdd-propose -> qdd-explore -> qdd-apply -> qdd-close`

The current project-state model is centered on four files:

- `contract.yaml`: stable project contract
- `evolution.yaml`: sparse study history plus current open/resolved boundaries
- `context/resources.md`: durable shared context
- `context/memory/STUDY-XXX.md`: per-study memory written at close time

More concretely, `evolution.yaml` now keeps only:

- `studies[].id`
- `studies[].question`
- `studies[].kind`
- `studies[].resolves`
- `studies[].opens`
- `studies[].candidates`
- `studies[].ts`
- `boundaries[].id`
- `boundaries[].text`
- `boundaries[].state`

`research-map.html` is derived from `evolution.yaml`. It is useful for review, but it is not a truth source.

`qdd boundaries` still exists, but it is only a compatibility surface derived from `evolution.yaml`. It is no longer the core governance path.

The current artifact lifecycle is also explicitly hardened:

- final study truth lives under `studies/STUDY-XXX/output/{data,code,figures,tables,reports}/`
- `studies/STUDY-XXX/output/tmp/` is scratch space only
- promotion candidates are explicit in `artifact-candidates.yaml`
- `qdd status --json` exposes close-preflight blockers such as unpackaged outputs or invalid candidate paths
- promoted truth lands in `artifacts/{data,code,figures,tables,reports}/`
- successful close removes heavy scratch leftovers such as temporary `.h5ad`

## Commands Implemented

- `qdd init`
- `qdd status --json`
- `qdd instructions <id> --command <qdd-start|qdd-propose|qdd-explore|qdd-apply|qdd-close> --json`
- `qdd validate`
- `qdd context --json`
- `qdd artifacts:list --json`
- `qdd skills suggest --domain <domain> --stage <stage> [--tag <tag>...] --json`
- `qdd add-study`
- `qdd add-task STUDY-XXX`
- `qdd register-artifact <path>`
- `qdd close-study STUDY-XXX`
- `qdd boundaries --json`
- `qdd boundaries apply --file <updates.yaml>`
- `qdd boundaries render --output <path>`
- `qdd boundaries score --targets <ids> --json`

## Bootstrap Installed By `qdd init`

- `.qdd/instructions.md`
- `.qdd/schema-reference.md`
- `.qdd/examples/*`
- `.qdd/bootstrap.yaml`
- `.qdd/layer-policy.yaml`
- `.qdd/skills-catalog.json`
- `.claude/commands/qdd-*.md`
- `.claude/skills/qdd/*`
- `.codex/skills/qdd/*`
- optional Codex global prompts under `$CODEX_HOME/prompts/`

The repository-root `domain-skills/` tree remains the source of truth for domain skills. Projects do not own local copies of those skills.

## Source Tree

```text
domain-skills/
├── brain/
│   └── singlecell/
├── singlecell/
│   ├── public-data/
│   ├── scatac/
│   └── scrna/
└── README.md

src/
├── file-contracts/
│   ├── artifact-candidates.ts
│   ├── artifact-index.ts
│   ├── contract.ts
│   ├── evolution.ts
│   ├── index.ts
│   ├── layer-policy.ts
│   ├── memory.ts
│   ├── public-data-request.ts
│   ├── resources.ts
│   ├── shared.ts
│   ├── study.ts
│   └── task.ts
├── cli/
│   └── index.ts
├── commands/
│   ├── add-study.ts
│   ├── add-task.ts
│   ├── artifacts-list.ts
│   ├── boundaries.ts
│   ├── close-study.ts
│   ├── context.ts
│   ├── init.ts
│   ├── instructions.ts
│   ├── register-artifact.ts
│   ├── skills-suggest.ts
│   ├── status.ts
│   └── validate.ts
├── runtime/
│   ├── bootstrap-prompts/
│   ├── bootstrap.ts
│   ├── boundaries.ts
│   ├── constants.ts
│   ├── defaults.ts
│   ├── discovery.ts
│   ├── evidence.ts
│   ├── evolution.ts
│   ├── inspection.ts
│   ├── instructions.ts
│   ├── layer-policy.ts
│   ├── lifecycle.ts
│   ├── local-skills.ts
│   ├── paths.ts
│   └── store.ts
├── test/
│   └── smoke.test.ts
├── utils/
│   ├── file-system.ts
│   └── yaml.ts
└── types.ts
```

## What Each Layer Does

### CLI Layer

File: [src/cli/index.ts](/data/chenyz/project/qdd/src/cli/index.ts)

- parses CLI input
- keeps command names stable
- routes to command handlers

This layer should stay thin.

### Command Layer

Files under [src/commands](/data/chenyz/project/qdd/src/commands)

- define one command surface each
- validate top-level command inputs
- delegate protocol work to runtime modules

### Managed File Contract Layer

Files under [src/file-contracts](/data/chenyz/project/qdd/src/file-contracts)

This is the explicit managed-file source layer added to make QDD readable from first inspection.

Core responsibilities:

- define the field-level contract for each managed file family
- own the default template or renderer for that file
- own one copy-ready example for project-local `.qdd/examples/*`
- provide shared parsing rules such as task `## Skills` normalization

Important modules:

- [contract.ts](/data/chenyz/project/qdd/src/file-contracts/contract.ts): `contract.yaml`
- [evolution.ts](/data/chenyz/project/qdd/src/file-contracts/evolution.ts): `evolution.yaml` contract with the new sparse study event shape
- [study.ts](/data/chenyz/project/qdd/src/file-contracts/study.ts): `study.md` template and example
- [task.ts](/data/chenyz/project/qdd/src/file-contracts/task.ts): `task.md` template, example, and `## Skills` parsing rules
- [artifact-candidates.ts](/data/chenyz/project/qdd/src/file-contracts/artifact-candidates.ts): promotion candidate schema
- [artifact-index.ts](/data/chenyz/project/qdd/src/file-contracts/artifact-index.ts): promoted artifact registry schema
- [resources.ts](/data/chenyz/project/qdd/src/file-contracts/resources.ts): `context/resources.md`
- [memory.ts](/data/chenyz/project/qdd/src/file-contracts/memory.ts): `context/memory/STUDY-XXX.md` as the only default study narrative report
- [layer-policy.ts](/data/chenyz/project/qdd/src/file-contracts/layer-policy.ts): `.qdd/layer-policy.yaml`
- [index.ts](/data/chenyz/project/qdd/src/file-contracts/index.ts): schema-reference and example projection

### Runtime Layer

Files under [src/runtime](/data/chenyz/project/qdd/src/runtime)

Core responsibilities:

- scaffold and refresh QDD projects
- read and write protocol files
- manage study and task lifecycle
- record and promote artifact candidates
- build role-aware instructions
- maintain the skills catalog
- derive `research-map.html`

Important modules:

- [constants.ts](/data/chenyz/project/qdd/src/runtime/constants.ts): canonical paths
- [defaults.ts](/data/chenyz/project/qdd/src/runtime/defaults.ts): thin default wrappers that now delegate to `src/file-contracts/*`
- [bootstrap.ts](/data/chenyz/project/qdd/src/runtime/bootstrap.ts): installs Claude/Codex workflow assets
- [evolution.ts](/data/chenyz/project/qdd/src/runtime/evolution.ts): reads and writes `evolution.yaml`, study memory, research map
- [lifecycle.ts](/data/chenyz/project/qdd/src/runtime/lifecycle.ts): create study/task, record candidates, run close preflight, promote canonical artifacts, clean scratch outputs, and close study
- [instructions.ts](/data/chenyz/project/qdd/src/runtime/instructions.ts): builds `qdd instructions ... --json`
- [status.ts](/data/chenyz/project/qdd/src/runtime/status.ts): builds `qdd status --json`, including close-preflight visibility
- [inspection.ts](/data/chenyz/project/qdd/src/runtime/inspection.ts): validate/context/artifact inspection
- [local-skills.ts](/data/chenyz/project/qdd/src/runtime/local-skills.ts): resolves domain skills and suggests executor skills
- [boundaries.ts](/data/chenyz/project/qdd/src/runtime/boundaries.ts): compatibility layer over the derived boundary view

### Shared Types And Helpers

- [src/types.ts](/data/chenyz/project/qdd/src/types.ts): runtime contracts
- [src/utils/file-system.ts](/data/chenyz/project/qdd/src/utils/file-system.ts): filesystem helpers
- [src/utils/yaml.ts](/data/chenyz/project/qdd/src/utils/yaml.ts): YAML parsing and serialization

## Runtime Project Layout

`qdd init` creates this minimal scaffold:

```text
project-root/
├── contract.yaml
├── evolution.yaml
├── research-map.html
├── context/
│   ├── resources.md
│   └── memory/
├── studies/
├── artifacts/
│   ├── index.yaml
│   ├── data/
│   ├── code/
│   ├── figures/
│   ├── tables/
│   └── reports/
├── .claude/
│   ├── commands/
│   └── skills/qdd/
├── .codex/
│   └── skills/qdd/
└── .qdd/
    ├── instructions.md
    ├── schema-reference.md
    ├── examples/
    ├── bootstrap.yaml
    ├── layer-policy.yaml
    └── skills-catalog.json
```

Study outputs still live under `studies/STUDY-XXX/output/`. Promotion-worthy outputs are listed in `artifact-candidates.yaml`, then promoted into `artifacts/index.yaml` and moved into canonical artifact folders at close time.

Current lifecycle rules:

- final promoted candidates must come from `output/{data,code,figures,tables,reports}/`
- `output/tmp/` is scratch only and cannot be promoted
- successful close leaves study-local back-links after promotion
- successful close cleans heavy scratch leftovers such as temporary `.h5ad`
- `qdd status --json` surfaces both unpackaged outputs and invalid candidate paths before close

The new rule is:

- `src/file-contracts/*` is the source of truth
- `.qdd/schema-reference.md` and `.qdd/examples/*` are generated references
- validators, scaffold writers, and `qdd instructions` should all agree with those same contracts

## Practical Reading Order

If you want to understand the current code quickly, read in this order:

1. [src/types.ts](/data/chenyz/project/qdd/src/types.ts)
2. [src/runtime/constants.ts](/data/chenyz/project/qdd/src/runtime/constants.ts)
3. [src/file-contracts/index.ts](/data/chenyz/project/qdd/src/file-contracts/index.ts)
4. [src/file-contracts/study.ts](/data/chenyz/project/qdd/src/file-contracts/study.ts)
5. [src/file-contracts/task.ts](/data/chenyz/project/qdd/src/file-contracts/task.ts)
6. [src/runtime/defaults.ts](/data/chenyz/project/qdd/src/runtime/defaults.ts)
7. [src/runtime/evolution.ts](/data/chenyz/project/qdd/src/runtime/evolution.ts)
8. [src/runtime/lifecycle.ts](/data/chenyz/project/qdd/src/runtime/lifecycle.ts)
9. [src/runtime/instructions.ts](/data/chenyz/project/qdd/src/runtime/instructions.ts)
10. [src/runtime/inspection.ts](/data/chenyz/project/qdd/src/runtime/inspection.ts)
11. [src/runtime/status.ts](/data/chenyz/project/qdd/src/runtime/status.ts)
12. [src/test/smoke.test.ts](/data/chenyz/project/qdd/src/test/smoke.test.ts)

That order shows:

- the data model first
- then the filesystem contract
- then the managed-file contract layer
- then how runtime consumes that layer
- then validation/instructions behavior
- then smoke coverage

## Progress Map

### Implemented

- CLI scaffold and package wiring
- `qdd init`
- project root detection
- default contract/evolution/context scaffold
- explicit managed-file contract layer under `src/file-contracts/`
- generated `.qdd/schema-reference.md` and `.qdd/examples/*`
- workflow bootstrap for Claude and Codex
- central domain-skill resolution from `domain-skills/`
- skills catalog generation and `qdd skills suggest`
- study creation and task creation
- study-local artifact candidate recording
- artifact promotion and registration
- close-preflight visibility for unpackaged outputs and invalid candidate paths
- table artifacts and `artifacts/tables/`
- scratch cleanup after successful close while preserving final packaged truth
- close-time study memory writing with promoted artifacts, reused materials, used skills, ad hoc scripts, and next candidates
- close-time `evolution.yaml` update
- derived `research-map.html` rendering
- status, instructions, validate, context, and artifacts inspection
- task `## Skills` body parsing with optional human-readable descriptions after the skill ID
- smoke coverage for the new evolution + memory model

### Partially Implemented

- `qdd boundaries` remains available, but it is no longer the primary workflow contract
- task progression still relies on direct Markdown updates; there is no dedicated `qdd close-task`
- multi-tool bootstrap exists, but the workflow still needs more dogfooding

### Not Implemented

- dedicated task close command
- plugin system
- richer TUI or auto-runner layer
- project-level multi-study stop-gate automation

## Current Interpretation

QDD is now usable for a bounded prototype workflow. The key thing to understand is that the project no longer revolves around a separate `boundaries.yaml` governance file. The main truth is:

- stable contract
- sparse evolution
- durable shared resources
- per-study memory
- promoted artifacts

Everything else is derived or auxiliary.
