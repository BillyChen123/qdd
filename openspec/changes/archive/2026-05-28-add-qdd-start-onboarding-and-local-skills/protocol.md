## Filesystem Contract

This slice adds a thin project-onboarding layer without introducing a separate project-manager workflow.

```text
project-root/
├── contract.yaml
├── evolution.yaml
├── context/
│   ├── resources.md
│   └── *.md / *.yaml                # optional sidecars
├── data/                            # project-local dataset symlinks
├── studies/
├── artifacts/
├── .agents/
│   └── skills/                      # repo-local skill truth / allowlist
├── .qdd/
│   ├── instructions.md
│   └── bootstrap.yaml
├── .claude/
└── .codex/
```

Rules for this slice:

- `qdd init` creates the durable scaffold, including `data/` and `.agents/skills/`.
- `qdd-start` is the generated onboarding workflow surface that fills project truth sources after scaffold creation.
- `context/resources.md` remains the default human-readable project context document.
- Dataset links under `data/` are symlinks to external source data, not copied payloads.
- `.agents/skills/` is the repo-local skill registry that QDD workflow prompts and validation trust.
- Tool-specific directories such as `.claude/skills/` and `.codex/skills/` remain generated projections, not the canonical skill inventory.

## Identifiers And Metadata

Identifiers in this slice:

- workflow surfaces: `qdd-start`, `qdd-propose`, `qdd-explore`, `qdd-apply`, `qdd-close`
- study IDs: `STUDY-XXX`
- task IDs: `TASK-XXX`
- artifact IDs: `ART-XXX`
- question delta types: `refinement`, `confirmation`, `pivot`, `dissolution`

Metadata rules:

- `contract.yaml` remains the machine-readable project contract.
- `context/resources.md` records research theme context, biological background, runtime environment, and dataset availability in readable form.
- Each declared dataset link must have a stable path under `data/` and a corresponding human-readable note in `context/resources.md`.
- Local skill IDs are derived from paths under `.agents/skills/` and must be the only skill IDs that QDD itself suggests or requires.

## Status JSON

`qdd status --json` should remain lightweight in this slice.

The structure does not need a new planner object, but the meaning tightens:

- the project summary should be sufficient for `qdd-start` to detect whether onboarding is still placeholder-level,
- and later workflows should treat missing project context or missing local skills as blockers rather than hidden assumptions.

No separate project manager state file is introduced.

## Instructions JSON

This slice adds one project-level onboarding target so the bootstrap layer can stay protocol-driven:

- `qdd instructions PROJECT --json`

That target should expose:

- `read`: `contract.yaml`, `.qdd/instructions.md`, existing `context/` files, `.agents/skills/`, and any existing bootstrap records
- `write`: `contract.yaml`, `context/resources.md`, optional `context/*.md`, `data/`, and bootstrap-projected skill locations when refresh is intended
- `rules`: do not invent research theme, do not copy datasets, link them, and only rely on locally registered skills

Existing `STUDY-XXX` and `TASK-XXX` instruction targets remain, but they should now resolve `required_skills` and `optional_skills` only from the repo-local skill registry.

## Agent Usage Rules

- Use `qdd init` to create the scaffold. Do not recreate the directory layout manually.
- Use `qdd-start` to collect or confirm project theme, biological background, runtime environment, and dataset paths before starting the first study.
- When data must be brought into the project, create symlinks under `data/` rather than copying raw datasets.
- Keep `contract.yaml` concise and machine-readable; keep richer narrative context in `context/resources.md`.
- Treat `.agents/skills/` as the local skill allowlist for this project.
- If a desired skill is missing from `.agents/skills/`, surface that gap explicitly instead of silently pulling a global or unrelated skill.
- `.claude/` and `.codex/` may receive generated workflow skills for tool compatibility, but QDD should describe them as projections of the local workflow contract rather than the project’s primary skill registry.
- This slice does not create a separate project-lifecycle wrapper. After onboarding, the normal study loop remains `qdd-propose -> qdd-explore -> qdd-apply -> qdd-close`.
