Enter QDD start mode.

Onboard a fresh QDD project before the first study begins.

Turn scaffold placeholders into usable project context, create dataset entrypoints under `artifacts/data/`, and keep skill usage inside the categorized local skill trees under `.codex/skills/` and `.claude/skills/`.

**IMPORTANT: Start writes project truth sources.** This workflow is allowed to update `contract.yaml`, `context/resources.md`, optional `context/` sidecars, and dataset symlinks under `artifacts/data/`.

**This is onboarding, not study planning.** Do not create `STUDY-XXX` or `TASK-XXX` artifacts here unless the user explicitly redirects into `qdd-propose`.

---

## Input

The argument after `qdd-start` is usually a short project description or one missing onboarding fact.

Examples:

- `qdd-start set up a skin scRNA project around barrier-state keratinocytes`
- `qdd-start link the existing h5ad files and capture our Python / R environment`
- `qdd-start fill the biological background and runtime context before we propose the first study`

---

## What Start Owns

- confirm or write the project theme and initial question in `contract.yaml`
- structure shared project context in `context/resources.md`
- record biological background, runtime environment, and available datasets
- create dataset entrypoints under `artifacts/data/` using symlinks
- keep skill usage inside `.codex/skills/`
- leave the project ready for `qdd-propose`

## What Start Does Not Own

- proposing the first bounded study
- creating the first task tree
- executing analysis code
- closing a study or deciding `question_delta`

---

## Preflight

1. If the current directory is not a QDD project, run `qdd init` first.
2. Read `.qdd/instructions.md`.
3. Run `qdd status --json`.
4. Run `qdd instructions PROJECT --command qdd-start --json`.
5. Read the current `contract.yaml`, `context/resources.md`, and any existing `context/` sidecars.
6. Inspect `.codex/skills/` before mentioning domain skills.

If the user already filled part of the project context, preserve it and refine it instead of overwriting it blindly.

---

## Procedure

### 1. Confirm what the project is actually about

You need enough fact to fill:

- project theme
- initial question
- biological background
- runtime environment
- data availability

If a fact is missing and it matters, ask for it directly.

Do not invent project facts just to keep momentum.

### 2. Make `contract.yaml` minimally real

`contract.yaml` should stay concise and machine-readable.

At minimum, confirm or rewrite:

- `theme`
- `initial_question`
- `mode`
- `scope.in_scope`
- `scope.out_of_scope`

Keep it compact. Richer narrative belongs in `context/resources.md`.

### 3. Make `context/resources.md` useful to a later agent

Fill the project resources document with concrete facts.

Make sure it clearly covers:

- research theme notes
- biological system and assumptions
- what data already exists
- Python / R / external tool environment
- which dataset entrypoints are linked under `artifacts/data/`
- durable analyst preferences that should bias future studies
- what local skills are already available

If the user has additional reusable context that does not fit well in the main document, create a small `context/*.md` sidecar instead of bloating `resources.md`.

Keep `resources.md` readable and stable:

- put project facts and durable analyst preferences in separate sections
- do not turn it into a task-by-task execution log
- do not store transient blockers or troubleshooting scraps there unless they have become stable reusable context

### 4. Create dataset entrypoints under `artifacts/data/`

When the user points to existing datasets, do **not** copy raw data into the project by default.

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

Treat `.codex/skills/` as the project-local skill validation inventory. When `.claude/skills/` is installed, it should mirror the same relative IDs.

Good behavior:

- reference only domain skills that actually exist there
- surface missing skills explicitly
- keep domain skill discussion grounded in the local registry

Bad behavior:

- assuming a global skill is acceptable just because your tool runtime knows about it
- writing task skill references that do not exist in the project
- writing `qdd/*` workflow skills into task `skills:`

### 6. Stop when the project is ready for study proposal

Start mode is done when:

- the project theme is legible
- the shared context is no longer placeholder-only
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
- You may draft more structure, but still anchor every project fact in the user's input or existing files.

### auto

- If the required facts are already available in files or user input, structure them directly.
- If they are not available, stop and surface the missing facts instead of inventing them.

---

## When To Ask The User

Ask when:

- the theme or initial question is too vague to write honestly
- a dataset path is missing
- the runtime environment matters and is unknown
- a claimed skill does not exist under `.codex/skills/`
- there are multiple incompatible ways to frame project scope

Otherwise, write the onboarding state directly and keep moving.

---

## Example Entry Points

**User has a fresh project but no written context**

```text
User: Start a keratinocyte differentiation project around our skin scRNA data.

You:
1. Read qdd status and qdd instructions PROJECT --command qdd-start --json
2. Fill contract.yaml
3. Fill context/resources.md
4. Ask for dataset paths if they are missing
5. Link datasets under artifacts/data/
```

**User only wants to link data and environment**

```text
User: The theme is already written. Just add the h5ad files and Python / R environment.

You:
- preserve the current theme
- update runtime and data sections
- create artifacts/data/ symlinks
- report what was linked
```

**User mentions a skill that is not local**

```text
User: We should use a custom marker-enrichment skill.

You:
- inspect .codex/skills/
- if the skill is missing, say so clearly
- record the gap instead of pretending the skill exists
```

---

## What To Report Back

When start work is done, report succinctly:

- what changed in `contract.yaml`
- what changed in `context/resources.md`
- which durable analyst preferences were added or updated
- which dataset entrypoints were linked under `artifacts/data/`
- which local skills are available
- any missing environment, dataset, or skill blocker
- whether the next step is `qdd-propose`

---

## Guardrails

- Do not invent project facts.
- Do not copy large raw datasets into `artifacts/data/` when a symlink is sufficient.
- Do not create study/task artifacts here unless the user explicitly redirects you.
- Do not reference skills outside `.codex/skills/` as if they were project-approved.
- Do not create a parallel memory subsystem when `context/resources.md` is enough.
- Keep `contract.yaml` concise and `context/resources.md` readable.
- Leave the project ready for the first bounded study proposal.
