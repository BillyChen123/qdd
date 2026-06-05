Enter QDD start mode.

Onboard a fresh QDD project before the first study begins.

Turn scaffold placeholders into usable shared project context. The goal is to make later `qdd-propose` and `qdd-apply` runs read the same durable facts instead of reconstructing them from chat.

**IMPORTANT: Start writes project truth sources.** It may update `contract.yaml`, `context/resources.md`, optional `context/*.md` sidecars, and dataset entrypoints under `artifacts/data/`.

**This is onboarding, not study planning.** Do not create `STUDY-XXX` or `TASK-XXX` artifacts here unless the user explicitly redirects into `qdd-propose`.

---

## What Start Owns

- confirm or rewrite the project theme and initial question in `contract.yaml`
- structure shared project context in `context/resources.md`
- record biological background, runtime environment, data resources, and durable analyst preferences
- create dataset entrypoints under `artifacts/data/` using symlinks
- inspect the central QDD root `domain-skills/` library so later task skills stay grounded in what really exists
- leave the project ready for `qdd-propose`

## What Start Does Not Own

- proposing the first bounded study
- creating the first task graph
- executing analysis code
- closing a study

---

## Preflight

1. If the current directory is not a QDD project, run `qdd init` first.
2. Read `.qdd/instructions.md`.
3. Run `qdd status --json`.
4. Run `qdd instructions PROJECT --command qdd-start --json`.
5. Read the current `contract.yaml`, `context/resources.md`, and any existing `context/` sidecars.
6. Inspect the QDD root `domain-skills/` library before promising any local domain skill.

If the user already filled part of the project context, preserve and refine it instead of overwriting it blindly.

---

## Procedure

### 1. Confirm the durable project facts

You need enough fact to fill:

- project theme
- initial question
- biological background
- data availability
- runtime environment

If a fact is missing and matters, ask for it directly. Do not invent project facts.

### 2. Make `contract.yaml` minimally real

Keep `contract.yaml` concise and machine-readable.

At minimum, confirm or rewrite:

- `theme`
- `initial_question`
- `mode`
- `scope.in_scope`
- `scope.out_of_scope`

Richer narrative belongs in `context/resources.md`.

### 3. Make `context/resources.md` useful

Write concrete facts, not vague placeholders.

Make sure it clearly covers:

- research theme notes
- biological system and assumptions
- what data already exists
- Python / R / external tool environment
- which dataset entrypoints are linked under `artifacts/data/`
- durable analyst preferences that should bias later studies
- what local domain skills are already available

Keep `resources.md` stable and readable:

- project facts and analyst preferences belong here
- transient debugging scraps do not
- per-study narrative belongs later in `context/memory/STUDY-XXX.md`

### 4. Create dataset entrypoints under `artifacts/data/`

When the user points to existing datasets, do not copy raw data into the project by default.

Create stable entrypoints under:

```text
artifacts/data/
```

Prefer symlinks, for example:

```bash
ln -s /abs/path/to/source.h5ad artifacts/data/source.h5ad
```

If a link already exists and should be refreshed, prefer a safe replace such as:

```bash
ln -sfn /abs/path/to/new-source.h5ad artifacts/data/source.h5ad
```

Record the linked path and its role in `context/resources.md`.

### 5. Respect the local skill boundary

Treat the QDD root `domain-skills/` library as the domain-skill validation inventory.

Treat `.claude/skills/qdd/` and `.codex/skills/qdd/` as workflow bootstrap surfaces, not as the source of domain skills.

Good behavior:

- reference only domain skills that actually exist
- surface missing skills explicitly
- keep domain skill discussion grounded in the local registry

Bad behavior:

- assuming a global skill is acceptable just because your runtime knows about it
- writing task skill references that do not exist in the project
- writing `qdd/*` workflow skills into task `skills:`

### 6. Stop when the project is ready for proposal

Start mode is done when:

- the project theme is legible
- shared context is no longer placeholder-only
- relevant datasets are linked or explicitly missing
- local skill gaps are explicit
- the next sensible step is `qdd-propose`

---

## Mode Handling

### human

- Ask for missing facts.
- Structure them conservatively.
- Do not pretend unclear environment or data facts are settled.

### assist

- Same fact boundary as `human`.
- You may draft more structure, but still anchor every project fact in user input or existing files.

### auto

- If the required facts are already available, structure them directly.
- If they are not available, stop and surface the missing facts instead of inventing them.
