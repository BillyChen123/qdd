## Filesystem Contract

This slice introduces a two-surface skill contract while keeping QDD's project/study/task filesystem readable and light.

```text
project-root/
├── contract.yaml
├── evolution.yaml
├── context/
│   └── resources.md
├── studies/
│   └── STUDY-XXX/
│       ├── study.md
│       ├── tasks/
│       │   └── TASK-XXX.md
│       └── output/
├── artifacts/
│   ├── index.yaml
│   ├── data/
│   ├── code/
│   ├── figures/
│   └── reports/
├── .qdd/
│   ├── instructions.md
│   ├── bootstrap.yaml
│   ├── layer-policy.yaml
│   └── skills-catalog.json
├── .codex/
│   └── skills/
│       ├── qdd/
│       ├── brain/
│       ├── singlecell/
│       └── spatial/
└── .claude/
    ├── commands/
    └── skills/
```

Rules for this slice:

- `brain/*` skills are study-layer planning guidance. They express research heuristics, checks, and decision prompts for humans and planning agents.
- Non-`brain/*` local skills are executor-facing problem-level skills unless explicitly marked otherwise.
- Problem-level skills are organized around analysis problems, not single primitive methods. One skill may document multiple underlying methods and their selection criteria.
- Task records may carry multiple problem-level skills when one evidence-producing task needs a coherent execution bundle.
- Candidate lookup happens during propose/explore planning, not during apply execution.
- Executor surfaces must not search the full skill catalog once task-local problem-level skills are already chosen.
- `.qdd/skills-catalog.json` is the machine-facing index of problem-level skill metadata used by the bounded suggestion CLI.
- The catalog is derived from the local problem-level skill inventory rather than hand-maintained free text.

## Identifiers And Metadata

Identifiers retained in this slice:

- modes: `human`, `assist`, `auto`
- workflow surfaces: `qdd-start`, `qdd-propose`, `qdd-explore`, `qdd-apply`, `qdd-close`
- study IDs: `STUDY-XXX`
- task IDs: `TASK-XXX`
- artifact IDs: `ART-XXX`
- question delta types: `refinement`, `confirmation`, `pivot`, `dissolution`

Problem-level skill metadata is intentionally minimal and controlled.

Required problem-skill metadata:

- `id`
- `domain`
- `stage`
- `tags`

Example tool-skill metadata entry:

```yaml
id: singlecell/batch-integration
domain: singlecell
stage: integration
tags:
  - scanpy
  - multi-sample
  - batch-correction
```

Contract rules:

- `domain` and `stage` must come from controlled vocabularies defined by QDD rather than arbitrary per-skill prose.
- `tags` are limited, reviewable helper discriminators, not a free-form dumping ground.
- Suggestion and persistence operate at the problem-skill level. A returned skill such as `singlecell/batch-integration` may document Harmony, BBKNN, scVI, or related alternatives internally.
- A task's `skills:` frontmatter must only reference concrete problem-level skills that exist locally.
- `brain/*` skills must not be written into task-local problem-skill lists.
- A task may carry a small related set of problem-level skills when they jointly support one evidence objective.

## Status JSON

`qdd status --json` does not need a brand-new top-level shape in this slice.

However, status semantics should be explicit enough that planning agents can inspect:

- installed study-brain skill groups,
- installed problem-skill groups,
- whether the problem-skill catalog is present and in sync,
- and which studies/tasks currently declare concrete problem-level skills.

No broad skill-routing state machine is introduced here.

## Instructions JSON

`qdd instructions <id> --json` remains the main machine-facing execution boundary.

This slice tightens its meaning:

- Study-layer instructions should load relevant study-brain guidance and planning rules.
- Task-layer instructions should resolve only the task's chosen problem-level skills plus layer defaults.
- `qdd-propose` and `qdd-explore` may call a bounded suggestion command to propose candidate problem-level skills before writing `task.skills`.
- `qdd-apply` should not perform fresh whole-library search once the task-local skill set has already been declared.

Suggested addition for planning flows:

- a machine-facing suggestion command such as:
  - `qdd skills suggest --domain <domain> --stage <stage> --tag <tag> --json`

Returned JSON should include:

- normalized query filters
- top candidate skill IDs
- matched tags
- simple reasons
- stable ordering

Low-confidence outcomes should return candidates without pretending a single automatic winner exists.

## Agent Usage Rules

- Study Brain should read human experience skills such as multi-sample integration checks, raw-count checks, or annotation-planning heuristics.
- Study Brain may decide that a study needs one or more analysis-problem classes, such as `integration`, `clustering`, or `annotation`.
- Study Brain should call the bounded suggestion command using controlled fields rather than unconstrained search text.
- Task planning may attach a small group of problem-level skills to one task when they serve one evidence objective.
- Executor should consume task-declared problem-level skills exactly as written and should not re-run broad catalog search during apply.
- If the suggestion surface returns multiple close candidates, propose/explore should keep the ambiguity explicit and write the chosen skill only after discussion or review.
- The first implementation should prefer deterministic filtering and simple tie-breaks over opaque semantic ranking.
