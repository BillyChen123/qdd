## Filesystem Contract

This slice adds one project-level question-state file and one project-local visualization output, while keeping study tasks as local execution structure rather than turning them into the project's primary planning graph.

```text
project-root/
├── contract.yaml
├── boundaries.yaml
├── evolution.yaml
├── boundary-graph.html
├── context/
│   └── resources.md
├── studies/
│   └── STUDY-XXX/
│       ├── study.md
│       ├── tasks/
│       │   └── TASK-XXX.md
│       └── output/
│           ├── artifact-candidates.yaml
│           ├── boundary-updates.yaml
│           ├── code/
│           ├── data/
│           ├── figures/
│           ├── reports/
│           └── tables/
├── artifacts/
│   ├── index.yaml
│   ├── code/
│   ├── data/
│   ├── figures/
│   └── reports/
└── .qdd/
    ├── instructions.md
    ├── bootstrap.yaml
    └── layer-policy.yaml
```

Rules for this slice:

- `boundaries.yaml` is the current project question-state truth source.
- `contract.yaml` remains the stable project scope contract; it does not replace `boundaries.yaml`.
- `evolution.yaml` remains the question-history truth source; it does not replace `boundaries.yaml`.
- `boundary-graph.html` is a derived project-local report, not a truth source.
- `study.md` remains one bounded unit of inquiry and must not be replaced by a project-wide task graph.
- `studies/STUDY-XXX/output/boundary-updates.yaml` is the study-local handoff file used by `qdd-close` before project boundary state is updated.
- `qdd-start` and `qdd-close` are the only workflow surfaces that may mutate `boundaries.yaml`, and they must do so through the CLI rather than by raw file editing.

## Identifiers And Metadata

Identifiers retained or added in this slice:

- modes: `human`, `assist`, `auto`
- workflow commands: `qdd-start`, `qdd-propose`, `qdd-explore`, `qdd-apply`, `qdd-close`
- roles: `thesis-manager`, `study-brain`, `executor`
- study IDs: `STUDY-XXX`
- task IDs: `TASK-XXX`
- boundary IDs: `B001`, `B002`, ...
- question delta types: `refinement`, `confirmation`, `pivot`, `dissolution`
- boundary statuses: `open`, `narrowed`, `resolved`, `dissolved`
- boundary update actions: `add`, `narrow`, `resolve`, `dissolve`

`boundaries.yaml` should use one minimal object shape:

```yaml
boundaries:
  - id: B001
    text: Current multi-sample embedding may be dominated by batch rather than biology
    depends_on: []
    weight: 5
    status: open
```

Metadata rules tightened by this slice:

- `id` must be stable and unique within the project.
- `text` describes the unresolved scientific or methodological boundary, not a task or a method name.
- `depends_on` links one boundary to upstream boundaries that must be clarified first.
- `weight` is a small human-owned priority weight used later for project-level scoring and prioritization.
- `status` describes the current state of the boundary in the project view; it is not a study-local run result.
- `study.md` frontmatter should add `target_boundaries: []` so each proposed study declares which project boundaries it tries to compress.
- `evolution.yaml` entries should remain centered on `question_delta`, but each closure entry may also record a compact `boundary_updates` summary for auditability.

`studies/STUDY-XXX/output/boundary-updates.yaml` should be a thin controlled mutation file:

```yaml
updates:
  - action: resolve
    id: B001

  - action: narrow
    id: B002
    text: Progenitor/TRM annotation remains plausible only after integration-aware reclustering

  - action: add
    boundary:
      id: B003
      text: Progression signal may remain confounded by patient composition after annotation repair
      depends_on:
        - B002
      weight: 3
      status: open
```

## Status JSON

`qdd status --json` should stay small, but it must expose enough boundary state to keep project decisions grounded.

This slice adds:

- `boundary_summary`
  - `total`
  - `open`
  - `narrowed`
  - `resolved`
  - `dissolved`
- `active_boundary_ids`
  - boundary IDs whose status is `open` or `narrowed`

No larger graph payload is required in status output because `qdd boundaries --json` is the dedicated inspection surface.

## Instructions JSON

`qdd instructions <id> --json` remains the machine-facing workflow boundary.

This slice clarifies boundary-state usage:

- `PROJECT` with `--command qdd-start`
  - must read `contract.yaml`, `boundaries.yaml`, `context/resources.md`, and current status output
  - may write project context normally
  - may update boundary state only by preparing updates and invoking `qdd boundaries apply --file <path>`
- `STUDY-XXX` with `--command qdd-propose`
  - must read `boundaries.yaml` or `qdd boundaries --json` before writing the study
  - must record `target_boundaries` in the study contract
  - must not mutate project boundary state
- `STUDY-XXX` with `--command qdd-explore`
  - may refine which boundaries the study should target
  - must not mutate project boundary state
- `STUDY-XXX` or `TASK-XXX` with `--command qdd-apply`
  - may read current boundary state to stay question-aligned
  - must not mutate project boundary state
- `STUDY-XXX` with `--command qdd-close`
  - must read current boundary state and study outputs
  - must prepare `studies/STUDY-XXX/output/boundary-updates.yaml`
  - must invoke `qdd boundaries apply --file studies/STUDY-XXX/output/boundary-updates.yaml` before final closure
  - may then write `question_delta` and carry forward stable context

`qdd boundaries` becomes the dedicated machine interface for question-state work:

- `qdd boundaries --json`
  - returns the current boundary-state view
- `qdd boundaries apply --file <updates.yaml>`
  - validates and applies controlled boundary updates to `boundaries.yaml`
- `qdd boundaries render --output <path>`
  - renders a project-local HTML report; the default output for this slice should be `boundary-graph.html` at project root

## Agent Usage Rules

- Treat project boundaries as the durable research state and study tasks as temporary execution structure.
- Do not treat methods such as Harmony, Leiden, or differential expression as boundaries; boundaries are unresolved question constraints.
- `qdd-start` should seed the first real project boundary state conservatively from the project theme, scope, and known resources.
- `qdd-propose` should choose a small subset of current boundaries and declare them in `target_boundaries` rather than expanding into a global task tree.
- `qdd-apply` should produce evidence for the current study and leave project-state mutation to `qdd-close`.
- `qdd-close` should update project boundary state explicitly and honestly: resolve what is resolved, narrow what became clearer, dissolve what no longer represents a valid question, and add newly exposed boundaries when the evidence reveals them.
- Agents must not edit `boundaries.yaml` directly when a controlled CLI update surface exists.
- The first slice should stay light: one truth source, one update surface, one renderer, and no hidden planner database.
