# QDD Code Prototype Map

> This document is the live code-facing map for the current QDD prototype.
> It should track the real `src/` layout rather than the aspirational full product architecture.

## Current Status

The repository now has a **minimal executable CLI runtime** for Question-Driven Discovery plus a first installed bootstrap layer.

It is now strong enough for a **first human-mode end-to-end demo loop**:

`qdd init -> qdd-start -> qdd-propose -> qdd-explore -> qdd-apply -> qdd-close`

Under the hood, the current bootstrap still drives the existing CLI protocol:

`qdd init -> qdd add-study -> qdd add-task -> write outputs + maintain artifact-candidates -> qdd register-artifact/qdd close-study`

It is **not** yet at the point of smooth daily use across repeated projects or assist-mode planning.

Implemented commands:

- `qdd init`
- `qdd status --json`
- `qdd instructions <id> [--command qdd-start|qdd-propose|qdd-explore|qdd-apply|qdd-close] --json`
- `qdd add-study`
- `qdd add-task STUDY-XXX`
- `qdd register-artifact <path>`
- `qdd close-study STUDY-XXX`
- `qdd validate`
- `qdd artifacts:list --json`
- `qdd context --json`

Installed by `qdd init` today:

- `.qdd/instructions.md`
- `.qdd/bootstrap.yaml`
- categorized local skill inventory under `.codex/skills/`
- mirrored Claude skill surface under `.claude/skills/`
- all central domain skills from `domain-skills/` projected into project-local skill trees
- Claude command surfaces: `qdd-start`, `qdd-propose`, `qdd-explore`, `qdd-apply`, `qdd-close`
- Optional Codex global prompts via `qdd init --tool codex`

Not implemented yet:

- `qdd close-task`
- plugin loading
- TUI / auto mode
- assist-mode next-study planner

## Source Tree

```text
src/
├── cli/
│   └── index.ts
├── commands/
│   ├── add-study.ts
│   ├── add-task.ts
│   ├── artifacts-list.ts
│   ├── close-study.ts
│   ├── context.ts
│   ├── init.ts
│   ├── instructions.ts
│   ├── register-artifact.ts
│   └── status.ts
├── runtime/
│   ├── bootstrap.ts
│   ├── constants.ts
│   ├── defaults.ts
│   ├── discovery.ts
│   ├── evidence.ts
│   ├── inspection.ts
│   ├── instructions.ts
│   ├── lifecycle.ts
│   ├── local-skills.ts
│   ├── paths.ts
│   ├── status.ts
│   └── store.ts
├── test/
│   └── smoke.test.ts
├── utils/
│   ├── file-system.ts
│   └── yaml.ts
└── types.ts
```

## Module Topology

```text
CLI
  src/cli/index.ts
    -> commands/add-study.ts
    -> commands/add-task.ts
    -> commands/artifacts-list.ts
    -> commands/register-artifact.ts
    -> commands/close-study.ts
    -> commands/context.ts
    -> commands/init.ts
    -> commands/status.ts
    -> commands/instructions.ts
    -> commands/validate.ts

Commands
  add-study.ts
    -> runtime/lifecycle.ts
    -> runtime/paths.ts

  add-task.ts
    -> runtime/lifecycle.ts
    -> runtime/paths.ts

  artifacts-list.ts
    -> runtime/inspection.ts
    -> runtime/paths.ts

  register-artifact.ts
    -> runtime/lifecycle.ts
    -> runtime/paths.ts

  close-study.ts
    -> runtime/lifecycle.ts
    -> runtime/paths.ts

  context.ts
    -> runtime/inspection.ts
    -> runtime/paths.ts

  init.ts
    -> runtime/bootstrap.ts
    -> runtime/constants.ts
    -> runtime/defaults.ts
    -> runtime/store.ts
    -> utils/file-system.ts

  status.ts
    -> runtime/paths.ts
    -> runtime/status.ts

  instructions.ts
    -> runtime/paths.ts
    -> runtime/instructions.ts

  validate.ts
    -> runtime/inspection.ts
    -> runtime/paths.ts

Runtime
  bootstrap.ts
    -> runtime/constants.ts
    -> runtime/local-skills.ts
    -> runtime/store.ts
    -> utils/file-system.ts
    -> types.ts

  status.ts
    -> runtime/discovery.ts
    -> runtime/store.ts
    -> runtime/constants.ts
    -> types.ts

  instructions.ts
    -> runtime/local-skills.ts
    -> runtime/store.ts
    -> runtime/constants.ts
    -> utils/file-system.ts
    -> types.ts

  inspection.ts
    -> runtime/discovery.ts
    -> runtime/lifecycle.ts
    -> runtime/local-skills.ts
    -> runtime/store.ts
    -> runtime/constants.ts
    -> utils/file-system.ts
    -> types.ts

  lifecycle.ts
    -> runtime/evidence.ts
    -> runtime/discovery.ts
    -> runtime/store.ts
    -> runtime/constants.ts
    -> utils/file-system.ts
    -> types.ts

  evidence.ts
    -> runtime/constants.ts
    -> runtime/defaults.ts
    -> runtime/store.ts
    -> utils/file-system.ts
    -> types.ts

  discovery.ts
    -> utils/yaml.ts
    -> types.ts

Shared
  store.ts
    -> utils/file-system.ts
    -> utils/yaml.ts

  defaults.ts
    -> types.ts
```

## What Each Layer Does

### 1. CLI Layer

File: [src/cli/index.ts](/data/chenyz/project/qdd/src/cli/index.ts)

Responsibility:

- parse command-line input
- route to command handlers
- keep user-facing command names stable

This layer should stay thin. It should not contain filesystem protocol logic.

### 2. Command Layer

Files:

- [src/commands/add-study.ts](/data/chenyz/project/qdd/src/commands/add-study.ts)
- [src/commands/add-task.ts](/data/chenyz/project/qdd/src/commands/add-task.ts)
- [src/commands/artifacts-list.ts](/data/chenyz/project/qdd/src/commands/artifacts-list.ts)
- [src/commands/close-study.ts](/data/chenyz/project/qdd/src/commands/close-study.ts)
- [src/commands/context.ts](/data/chenyz/project/qdd/src/commands/context.ts)
- [src/commands/init.ts](/data/chenyz/project/qdd/src/commands/init.ts)
- [src/commands/status.ts](/data/chenyz/project/qdd/src/commands/status.ts)
- [src/commands/instructions.ts](/data/chenyz/project/qdd/src/commands/instructions.ts)
- [src/commands/register-artifact.ts](/data/chenyz/project/qdd/src/commands/register-artifact.ts)
- [src/commands/validate.ts](/data/chenyz/project/qdd/src/commands/validate.ts)

Responsibility:

- implement one user-visible command each
- validate high-level command preconditions
- delegate read/write work to the runtime layer

### 3. Runtime Layer

Files:

- [src/runtime/constants.ts](/data/chenyz/project/qdd/src/runtime/constants.ts)
- [src/runtime/bootstrap.ts](/data/chenyz/project/qdd/src/runtime/bootstrap.ts)
- [src/runtime/defaults.ts](/data/chenyz/project/qdd/src/runtime/defaults.ts)
- [src/runtime/discovery.ts](/data/chenyz/project/qdd/src/runtime/discovery.ts)
- [src/runtime/evidence.ts](/data/chenyz/project/qdd/src/runtime/evidence.ts)
- [src/runtime/inspection.ts](/data/chenyz/project/qdd/src/runtime/inspection.ts)
- [src/runtime/instructions.ts](/data/chenyz/project/qdd/src/runtime/instructions.ts)
- [src/runtime/lifecycle.ts](/data/chenyz/project/qdd/src/runtime/lifecycle.ts)
- [src/runtime/local-skills.ts](/data/chenyz/project/qdd/src/runtime/local-skills.ts)
- [src/runtime/paths.ts](/data/chenyz/project/qdd/src/runtime/paths.ts)
- [src/runtime/status.ts](/data/chenyz/project/qdd/src/runtime/status.ts)
- [src/runtime/store.ts](/data/chenyz/project/qdd/src/runtime/store.ts)

Responsibility:

- define the filesystem protocol
- install and refresh tool-facing bootstrap assets
- maintain the categorized local skill contract under `.codex/skills/` and mirrored `.claude/skills/`
- project all central domain skills from `domain-skills/` into new projects
- read and write core YAML state plus open `context/` resources
- expose project-level onboarding instructions through `PROJECT`
- read study/task Markdown frontmatter
- scaffold study/task Markdown templates
- maintain study-local evidence packaging rules and promotion candidates
- allocate IDs and append artifact/question-delta state
- aggregate protocol state into JSON surfaces
- validate and inspect existing state without mutating it

Important current rule:

- project-level control state = YAML (`contract.yaml`, `evolution.yaml`, `artifacts/index.yaml`)
- project-level reusable context = Markdown-first `context/` resources, with optional YAML sidecars
- study/task truth source = Markdown frontmatter

### 4. Shared Utilities And Types

Files:

- [src/types.ts](/data/chenyz/project/qdd/src/types.ts)
- [src/utils/file-system.ts](/data/chenyz/project/qdd/src/utils/file-system.ts)
- [src/utils/yaml.ts](/data/chenyz/project/qdd/src/utils/yaml.ts)

Responsibility:

- keep type contracts explicit
- isolate filesystem helpers
- isolate YAML serialization/parsing

## Runtime Project Layout Implemented Today

`qdd init` now bootstraps this minimal structure plus bootstrap metadata:

```text
project-root/
├── domain-skills/                  # central source tree in this repository
│   └── <category>/<skill>/SKILL.md
│       ...
│
├── [target project created by qdd init]
│   ├── contract.yaml
│   ├── evolution.yaml
│   ├── context/
│   │   └── resources.md
│   ├── studies/
│   ├── artifacts/
│   │   ├── index.yaml
│   │   ├── data/
│   │   ├── code/
│   │   ├── figures/
│   │   └── reports/
│   ├── .codex/
│   │   └── skills/
│   │       ├── qdd/
│   │       └── <category>/<skill>/
│   ├── .claude/
│   │   ├── commands/
│   │   └── skills/
│   │       ├── qdd/
│   │       └── <category>/<skill>/
│   └── .qdd/
│       ├── instructions.md
│       ├── bootstrap.yaml
│       └── layer-policy.yaml
```

Depending on selected tools, `qdd init` also writes bootstrap assets to locations such as:

```text
.claude/commands/qdd-start.md
.claude/commands/qdd-propose.md
.claude/commands/qdd-explore.md
.claude/commands/qdd-apply.md
.claude/commands/qdd-close.md
<CODEX_HOME>/prompts/qdd-propose.md
...
```

Future study/task records are expected to look like:

```text
studies/
└── STUDY-001/
    ├── study.md
    ├── tasks/
    │   └── TASK-001.md
    └── output/
        ├── artifact-candidates.yaml
        ├── code/
        ├── figures/
        ├── reports/
        └── tables/
```

`artifact-candidates.yaml` is now the explicit promotion boundary between study-local outputs and reusable artifacts. `artifacts/index.yaml` should contain only promoted evidence, not every file in `output/`.

## Progress Map

### Implemented

- root package/runtime scaffold
- CLI entrypoint
- project initialization
- project root detection
- YAML store helpers
- Markdown-first context bootstrap (`context/resources.md`)
- central `domain-skills/` source tree for reusable domain skills
- categorized task-skill inventory under `.codex/skills/`
- mirrored Claude skill surface under `.claude/skills/`
- projection of all central domain skills into initialized projects
- Markdown document read/write helpers
- study/task frontmatter discovery
- study creation command
- task creation command
- artifact registration command
- study closure/question_delta writing command
- validation command
- artifact inspection command
- context inspection command
- status JSON aggregation
- instructions JSON for `PROJECT`, study, and task records
- validation and inspection runtime helpers
- bootstrap installation/runtime helpers
- lifecycle smoke test covering init -> study -> task -> artifact -> closure
- study output packaging scaffold (`code/`, `figures/`, `tables/`, `reports/`)
- explicit artifact-candidate manifest under each study output directory
- closure-time promotion from `artifact-candidates.yaml` into `artifacts/index.yaml`
- smoke tests for validation and inspection behavior
- smoke tests for init/status/instructions
- smoke tests for installed bootstrap assets and refresh behavior

### Partially Implemented

- task progression still happens by direct Markdown updates; there is no dedicated `qdd close-task`
- the bootstrap layer currently targets Claude by default and Codex optionally; richer multi-tool support is still narrow
- `artifacts:list` and `context` currently expose whole-file inspection surfaces; there is no richer filtering yet
- canonical promoted artifacts now move into `artifacts/{data,code,figures,reports}/`, but higher-level artifact browsing is still intentionally simple

### Not Implemented

- dedicated task close command
- plugin system

## Milestone Fit

If you compare the current code to [docs/01-development-prototype.md](/data/chenyz/project/qdd/docs/01-development-prototype.md), the prototype is roughly here:

- **M1: Core Filesystem Protocol** - done for the current prototype slice
  - done: `qdd init`, root layout, control-YAML + context-resources split, `qdd validate`
- **M2: Study Workflow** - largely done for human-mode manual use
  - done: `qdd add-study`, `qdd add-task`, `qdd instructions`, study/task Markdown scaffolds
  - missing: more ergonomic inspection and task-resolution workflow
- **M3: Artifact System** - partially done
  - done: `qdd register-artifact`, `artifacts/index.yaml`, `qdd artifacts:list --json`, `qdd close-study`, `evolution.yaml`, explicit `artifact-candidates.yaml` promotion path
  - missing: stronger provenance tooling, optional artifact filtering, quality-check logic from the prototype notes

In short: the core loop exists, but the usability and hardening layer is still thin.

## Practical Readiness

### What You Can Already Do Today

You can already run one bounded study manually:

1. `qdd init`
2. run `qdd-start`, or manually fill `contract.yaml`, `context/resources.md`, `artifacts/data/`, `.qdd/layer-policy.yaml`, and the local skill trees under `.codex/skills/`
3. `qdd add-study --question ... --hypothesis ...`
4. `qdd add-task STUDY-001 --goal ...`
5. let the agent read `qdd instructions PROJECT --command qdd-start --json` and `qdd instructions STUDY-001 --command qdd-apply --json`
6. update `TASK-XXX.md` and write outputs into `studies/STUDY-001/output/{code,figures,tables,reports}/` as appropriate
7. keep promotion-worthy outputs in `studies/STUDY-001/output/artifact-candidates.yaml`
8. optionally `qdd register-artifact ...` immediately for outputs that should be registered now
9. `qdd close-study STUDY-001 --question-after ... --change-type ... --change-driver ...`

That is enough for a controlled prototype demo and for testing whether the filesystem protocol feels right.

You can now also:

10. `qdd validate`
11. `qdd artifacts:list --json`
12. `qdd context --json`

### What Still Makes Real Practice Frictional

- no dedicated `qdd close-task`, so task progression depends on direct Markdown edits
- the installed bootstrap still needs real dogfooding before its workflow wording should be treated as stable
- promoted outputs still rely on explicit candidate maintenance rather than richer provenance capture
- no plugin layer yet, so domain-specific help still lives outside the CLI core

## Gap To Real Use

Before this becomes comfortable for repeated real-world research work, the remaining gaps are roughly:

1. **Inspection ergonomics**
   - optionally add filtering to `qdd artifacts:list` and `qdd context`
   - reduce the need to open low-level control files by hand even further

2. **Task lifecycle decision**
   - either keep direct Markdown task updates as the official model
   - or add a thin `qdd close-task` later
   - this is still the main unresolved workflow choice

3. **Bootstrap hardening**
   - dogfood the generated `qdd-propose / qdd-explore / qdd-apply / qdd-close` loop
   - refine tool targeting and refresh semantics if real use shows drift

4. **Dogfooding on one real project**
   - run one real small study from start to close
   - verify that study-local scripts/figures are preserved and promoted artifacts stay selective
   - use that run to trim any command or file-shape problems

## Recommended Next Direction

The best next direction is **not** plugins or auto mode.

The best next direction is:

1. run one real small QDD study through the installed bootstrap loop
2. use `qdd validate`, `qdd artifacts:list --json`, and `qdd context --json` during that run
3. then decide whether `qdd close-task` should exist
4. then decide whether assist-mode planning should become a first-class surface

Why this order:

- the core loop now exists
- the biggest remaining risk is no longer missing bootstrap installation, but unresolved real-world workflow friction
- one real dogfood run will tell you whether the installed loop is actually usable before you widen the planner layer around it

## Fast Reading Guide

If you want to understand the current code quickly, read in this order:

1. [src/types.ts](/data/chenyz/project/qdd/src/types.ts)
   Why: this tells you what data the runtime believes exists.

2. [src/runtime/constants.ts](/data/chenyz/project/qdd/src/runtime/constants.ts)
   Why: this tells you where the runtime expects that data to live on disk.

3. [src/commands/init.ts](/data/chenyz/project/qdd/src/commands/init.ts)
   Why: this shows the minimum project layout the CLI actually creates.

4. [src/runtime/discovery.ts](/data/chenyz/project/qdd/src/runtime/discovery.ts)
   Why: this shows how study/task records are discovered from Markdown frontmatter.

5. [src/runtime/store.ts](/data/chenyz/project/qdd/src/runtime/store.ts)
   Why: this shows how Markdown frontmatter, core YAML state, and optional context sidecars are read and written.

6. [src/runtime/lifecycle.ts](/data/chenyz/project/qdd/src/runtime/lifecycle.ts)
   Why: this is the write-side runtime for study/task scaffolding, artifact registration, and study closure.

7. [src/runtime/evidence.ts](/data/chenyz/project/qdd/src/runtime/evidence.ts)
   Why: this is the thin helper layer for output packaging and artifact-candidate normalization.

8. [src/runtime/inspection.ts](/data/chenyz/project/qdd/src/runtime/inspection.ts)
   Why: this is the non-core guard/query runtime for validation, artifact inspection, and context inspection.

9. [src/runtime/status.ts](/data/chenyz/project/qdd/src/runtime/status.ts)
   Why: this is the main read-model aggregator.

10. [src/runtime/instructions.ts](/data/chenyz/project/qdd/src/runtime/instructions.ts)
   Why: this is the current agent-facing contract generator.

11. [src/cli/index.ts](/data/chenyz/project/qdd/src/cli/index.ts)
   Why: this is just the routing layer once you understand the runtime.

12. [src/test/smoke.test.ts](/data/chenyz/project/qdd/src/test/smoke.test.ts)
   Why: this shows the smallest end-to-end examples of expected behavior.

## Review Checklist

When reviewing future code in `src/`, ask these questions in order:

1. Does this change preserve the agreed project layout?
2. Does it keep control state in YAML, context defaulting to readable Markdown, and study/task truth in frontmatter?
3. Is the command layer still thin, or is runtime logic leaking upward?
4. Are new domain assumptions being added to core runtime by mistake?
5. Does the JSON output remain stable for agents?
6. Is the boundary between local study outputs and promoted artifacts still explicit?
7. Is this adding bootstrap/runtime behavior, or should it live in a later plugin/bootstrap layer?

## Maintenance Note

Keep this file updated whenever:

- a new command is added
- the project layout changes
- study/task truth-source rules change
- a new runtime module is introduced
- agent bootstrap moves from deferred to implemented
