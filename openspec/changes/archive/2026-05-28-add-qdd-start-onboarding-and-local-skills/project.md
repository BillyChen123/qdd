## Theme

Make `qdd init` actually usable as the project entrypoint by adding a real onboarding surface for project resources and a repo-local skill boundary that later study execution can trust.

## Initial Question

How should QDD bootstrap project theme, biological background, runtime environment, dataset links, and project-local skills so onboarding is explicit, lightweight, and compatible with the existing study loop?

## Mode

`human`.

Humans still provide the project facts and decide what belongs in scope. Agents may structure those facts, write them into QDD truth sources, and later consume only the project-local skill set that QDD exposes.

## Scope

### In Scope

- Add a project-onboarding workflow surface named `qdd-start` alongside the existing study-loop surfaces.
- Keep `qdd init` as the filesystem/bootstrap command, but make the generated onboarding skill usable immediately after scaffold creation.
- Extend the scaffold with a durable `data/` directory for project-local dataset entrypoints.
- Define how onboarding writes `contract.yaml` and `context/resources.md` from human-provided research theme, biological background, runtime environment, and data availability.
- Define a minimal dataset-linking convention that uses symlinks under `data/` instead of copying raw data.
- Introduce `.agents/skills/` as the repo-local skill registry or allowlist that QDD instructions trust.
- Make later study/task instructions suggest only skills that exist in the local registry.
- Keep `.claude/` and `.codex/` bootstrap projections compatible, but treat them as generated outputs rather than the project skill truth source.

### Out Of Scope

- Building a separate `qdd-project` command family or project manager.
- Auto-detecting Python, R, or package state perfectly across every machine.
- Copying or moving large raw datasets instead of linking them.
- Implementing remote storage, dataset versioning, or data catalog search.
- Designing a full plugin marketplace or skill package manager.
- Reworking the current propose/explore/apply/close study loop beyond the onboarding boundary needed here.

## Evidence Standard

This change is successful when a fresh QDD project can:

- run `qdd init` to get the scaffold plus generated onboarding assets,
- use `qdd-start` to fill `contract.yaml` and `context/resources.md` with real project facts,
- create stable symlinks under `data/` for declared datasets,
- expose a repo-local skill inventory that later QDD workflows can reference,
- and prevent later workflow prompts from casually depending on skills that are not present in the project.

## Shared Context

- Current `qdd init` creates placeholders, but not a real onboarding workflow.
- `context/resources.md` is already the intended human-readable context root in the docs.
- The current bootstrap installs `.claude/` and `.codex/` assets, but there is no `.agents/skills/` authority boundary yet.
- `qdd instructions` currently works only for `STUDY-XXX` and `TASK-XXX`, and its skill arrays are effectively empty.
- The user wants dataset resources linked into the project through symlinks rather than duplicated storage.
- The user also wants the agent to stay inside project-owned skills, similar to a local `.agents/skills/` pattern used elsewhere.
