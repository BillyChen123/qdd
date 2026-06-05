## Filesystem Contract

This slice separates the QDD-owned central skill library from the per-project research workspace.

```text
qdd-root/
├── domain-skills/
│   └── <domain>/<subdomain>/<skill-name>/
│       ├── SKILL.md
│       ├── parameters.yaml
│       └── scripts/
└── ...

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
│           ├── data/
│           ├── code/
│           ├── figures/
│           ├── tables/
│           ├── reports/
│           ├── tmp/
│           └── artifact-candidates.yaml
├── artifacts/
│   ├── index.yaml
│   ├── data/
│   ├── code/
│   ├── figures/
│   └── reports/
├── .qdd/
├── .codex/
│   └── skills/
│       └── qdd/
└── .claude/
    ├── commands/
    └── skills/
        └── qdd/
```

Rules for this slice:

- `domain-skills/` under the QDD root is the canonical source for domain skills.
- Project-local tool directories keep QDD workflow assets only. They are not the source of domain skills.
- `task.skills` stores canonical skill IDs such as `singlecell/scrna/sc-clustering`, not local paths.
- When a task uses a domain skill, runtime and prompts should resolve that ID against `qdd-root/domain-skills/`.
- The study-local executed script remains under `studies/STUDY-XXX/output/code/`. That is the code surface eligible for promotion.
- `artifact-candidates.yaml` remains the only explicit promotion boundary. `qdd-close` should not scan `domain-skills/` and should not promote upstream library files directly.
- Promoted code artifacts land in `artifacts/code/`, leaving the study-local output surface auditable.

## Identifiers And Metadata

Identifiers unchanged in this slice:

- workflow surfaces: `qdd-start`, `qdd-propose`, `qdd-explore`, `qdd-apply`, `qdd-close`
- study IDs: `STUDY-XXX`
- task IDs: `TASK-XXX`
- artifact IDs: `ART-XXX`
- artifact types: `data`, `code`, `figure`, `report`

Metadata rules tightened here:

- Domain skill IDs map to `qdd-root/domain-skills/<skill-id>/SKILL.md`.
- Workflow skill IDs remain under local `qdd/...` bootstrap surfaces where tool UX expects them.
- If a task runs substantive analysis code, apply must either:
  - record a `type: code` candidate for the main study-local script, or
  - directly register that script as a `code` artifact.
- The preferred default is candidate-driven promotion, not immediate registration.
- A `code` candidate path must point to the study-local execution copy under `studies/STUDY-XXX/output/code/`, never to the upstream QDD root skill library.
- Candidate `task_id` remains the producer provenance and must be preserved on promotion.

## Status JSON

`qdd status --json` does not need a new top-level shape in this slice.

Its meaning tightens in two places:

- project bootstrap health should not expect project-local domain skill mirrors,
- and task promotion state remains the authoritative signal for whether reusable outputs, including code, were explicitly reviewed.

No new runtime registry or separate skill-state file is introduced.

## Instructions JSON

`qdd instructions ... --json` remains the machine-facing contract.

This slice tightens what it should expose:

- `qdd instructions ... --command qdd-propose|qdd-explore|qdd-apply` should resolve domain skill read paths from the QDD root `domain-skills/` library.
- Workflow reads may still point at local `.codex/skills/qdd/...` or `.claude/skills/qdd/...` where tool compatibility requires them.
- Missing domain skills should be surfaced as blockers against the central QDD root library, not against missing project-local mirrors.
- Apply-facing instructions should explicitly say that substantive final scripts belong in `studies/STUDY-XXX/output/code/` and normally become `code` candidates.
- Close-facing instructions should explicitly say that `code` promotion comes from `artifact-candidates.yaml`, not from guessing over `output/code/` or the upstream skill library.

## Agent Usage Rules

- `qdd-propose` and `qdd-explore` write skill IDs only; they do not write filesystem paths into task records.
- `qdd-apply` reads declared domain skills from the central QDD root library, but preserves the actually executed study-local script under `output/code/`.
- If a reusable script came from adapting a domain skill script, the promotable artifact is still the study-local execution copy, not the untouched upstream library script.
- `qdd-close` promotes explicit code candidates just like data, figures, and reports.
- Do not mirror the whole domain skill tree into each project just to satisfy apply-time reading.
- Keep the system lightweight: central skill sourcing plus explicit candidate-driven promotion, without a new orchestration engine.
