# QDD

QDD is a lightweight research orchestration CLI for **Question-Driven Discovery**. It keeps project state readable for both humans and agents: one stable contract, one sparse evolution file, one shared resource note, bounded studies, explicit tasks, and promoted artifacts.

## Core Loop

The current minimal workflow is:

1. `qdd init .`
2. `qdd-start`
3. `qdd-propose`
4. `qdd-explore`
5. `qdd-apply`
6. `qdd-close`

`qdd boundaries` still exists, but it is now only a compatibility view derived from `evolution.yaml`. It is no longer the main truth source.

## Project Layout

After `qdd init`, a project looks like this:

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
└── .qdd/
```

Key files:

- `contract.yaml`: stable project contract, theme, scope, and mode
- `evolution.yaml`: sparse study history plus current open/resolved boundaries
- `context/resources.md`: durable shared context
- `context/memory/STUDY-XXX.md`: per-study memory written at close time
- `research-map.html`: derived visualization, never a truth source

## CLI Surfaces

Useful commands:

- `qdd status --json`
- `qdd instructions PROJECT --command qdd-start --json`
- `qdd instructions STUDY-001 --command qdd-apply --json`
- `qdd validate --json`
- `qdd artifacts:list --json`
- `qdd context --json`

## Skills And Bootstrap

Workflow assets are bootstrapped into:

- `.codex/skills/qdd/`
- `.claude/skills/qdd/`

Reusable domain skills live in the repository-level `domain-skills/` tree. Planning skills under `brain/*` guide propose/explore. Executor skills such as `singlecell/...` are referenced from task `skills:`.

## Install

Requirements:

- Node `>=20.19.0`

Typical local install:

```bash
npm install
npm run build
npm install -g .
```

Then initialize a project anywhere:

```bash
mkdir my-qdd-project
cd my-qdd-project
qdd init .
```

More detail is in [docs/04-installation-guide.md](/data/chenyz/project/qdd/docs/04-installation-guide.md).
