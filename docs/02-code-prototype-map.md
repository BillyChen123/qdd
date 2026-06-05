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

`research-map.html` is derived from `evolution.yaml`. It is useful for review, but it is not a truth source.

`qdd boundaries` still exists, but it is only a compatibility surface derived from `evolution.yaml`. It is no longer the core governance path.

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
- [defaults.ts](/data/chenyz/project/qdd/src/runtime/defaults.ts): default scaffold content
- [bootstrap.ts](/data/chenyz/project/qdd/src/runtime/bootstrap.ts): installs Claude/Codex workflow assets
- [evolution.ts](/data/chenyz/project/qdd/src/runtime/evolution.ts): reads and writes `evolution.yaml`, study memory, research map
- [lifecycle.ts](/data/chenyz/project/qdd/src/runtime/lifecycle.ts): create study/task, record candidates, close study
- [instructions.ts](/data/chenyz/project/qdd/src/runtime/instructions.ts): builds `qdd instructions ... --json`
- [status.ts](/data/chenyz/project/qdd/src/runtime/status.ts): builds `qdd status --json`
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
│   └── reports/
├── .claude/
│   ├── commands/
│   └── skills/qdd/
├── .codex/
│   └── skills/qdd/
└── .qdd/
    ├── instructions.md
    ├── bootstrap.yaml
    ├── layer-policy.yaml
    └── skills-catalog.json
```

Study outputs still live under `studies/STUDY-XXX/output/`. Promotion-worthy outputs are listed in `artifact-candidates.yaml`, then promoted into `artifacts/index.yaml` and moved into canonical artifact folders at close time.

## Practical Reading Order

If you want to understand the current code quickly, read in this order:

1. [src/types.ts](/data/chenyz/project/qdd/src/types.ts)
2. [src/runtime/constants.ts](/data/chenyz/project/qdd/src/runtime/constants.ts)
3. [src/runtime/defaults.ts](/data/chenyz/project/qdd/src/runtime/defaults.ts)
4. [src/runtime/evolution.ts](/data/chenyz/project/qdd/src/runtime/evolution.ts)
5. [src/runtime/lifecycle.ts](/data/chenyz/project/qdd/src/runtime/lifecycle.ts)
6. [src/runtime/instructions.ts](/data/chenyz/project/qdd/src/runtime/instructions.ts)
7. [src/runtime/status.ts](/data/chenyz/project/qdd/src/runtime/status.ts)
8. [src/runtime/local-skills.ts](/data/chenyz/project/qdd/src/runtime/local-skills.ts)
9. [src/cli/index.ts](/data/chenyz/project/qdd/src/cli/index.ts)
10. [src/test/smoke.test.ts](/data/chenyz/project/qdd/src/test/smoke.test.ts)

That order shows:

- the data model first
- then the filesystem contract
- then project-state semantics
- then lifecycle behavior
- then the CLI surface and smoke coverage

## Progress Map

### Implemented

- CLI scaffold and package wiring
- `qdd init`
- project root detection
- default contract/evolution/context scaffold
- workflow bootstrap for Claude and Codex
- central domain-skill resolution from `domain-skills/`
- skills catalog generation and `qdd skills suggest`
- study creation and task creation
- study-local artifact candidate recording
- artifact promotion and registration
- close-time study memory writing
- close-time `evolution.yaml` update
- derived `research-map.html` rendering
- status, instructions, validate, context, and artifacts inspection
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
