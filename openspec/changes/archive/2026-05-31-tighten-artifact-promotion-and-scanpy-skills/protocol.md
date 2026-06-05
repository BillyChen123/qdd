## Filesystem Contract

This slice tightens the shared storage contract around canonical artifact locations and layer-owned role policy.

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
│           ├── code/
│           ├── figures/
│           ├── tables/
│           ├── reports/
│           └── artifact-candidates.yaml
├── artifacts/
│   ├── index.yaml
│   ├── data/
│   ├── code/
│   ├── figures/
│   └── reports/
├── .qdd/
│   ├── instructions.md
│   ├── bootstrap.yaml
│   └── layer-policy.yaml
├── .codex/
│   └── skills/
└── .claude/
    ├── commands/
    └── skills/
```

Rules for this slice:

- Remove the separate root `data/` contract from init, instructions, and default docs.
- `artifacts/data/` becomes the shared project-local data surface for both linked dataset entrypoints and promoted reusable data outputs.
- Flat `artifacts/data/` is acceptable in this slice; collision avoidance should come from stable naming during bootstrap or promotion rather than nested directories.
- Only entries registered in `artifacts/index.yaml` count as formal reusable artifacts. A file merely existing under `artifacts/data/` does not make it a registry artifact.
- Study-local working outputs still live under `studies/STUDY-XXX/output/`.
- During promotion, reusable outputs move into canonical artifact directories:
  - `data` -> `artifacts/data/`
  - `code` -> `artifacts/code/`
  - `figure` -> `artifacts/figures/`
  - `report` -> `artifacts/reports/`
- After promotion, the original study-local path should remain auditable, preferably as a symlink or stable pointer to the canonical artifact path rather than a broken reference.
- `.qdd/layer-policy.yaml` is the editable truth source for layer -> role -> default-skill mapping.
- `qdd-close` targets one study but makes promotion and carry-forward judgments from the project decision layer.
- `qdd register-artifact` may remain as a manual exception path, but the normal reusable-evidence path is `artifact-candidates.yaml -> qdd-close`.

## Identifiers And Metadata

Identifiers retained in this slice:

- modes: `human`, `assist`, `auto`
- workflow surfaces: `qdd-start`, `qdd-propose`, `qdd-explore`, `qdd-apply`, `qdd-close`
- study IDs: `STUDY-XXX`
- task IDs: `TASK-XXX`
- artifact IDs: `ART-XXX`
- question delta types: `refinement`, `confirmation`, `pivot`, `dissolution`

Metadata rules added or tightened:

- Canonical promoted artifact names should be collision-safe and deterministic enough for review, for example `ART-003-cluster_markers.csv`.
- `artifact-candidates.yaml` remains the explicit promotion boundary for study outputs.
- Candidate `task_id` remains producer provenance; `scope` remains reuse boundary.
- Layers are fixed to `project`, `study`, and `task`.
- Roles are fixed to:
  - `project -> thesis-manager`
  - `study -> study-brain`
  - `task -> executor`
- `.qdd/layer-policy.yaml` defines required and optional local skills per layer, plus command mappings.
- Layer policy must only reference skills that exist under `.codex/skills/`.
- Layer policy must not list `qdd/*` workflow skills as task-consumed domain skills.
- Task frontmatter `skills:` and body `## Skills` remain the study-specific domain dependency list; layer policy adds role defaults around them rather than replacing them.
- Commands map to:
  - a `target` meaning “which object is being read/written”
  - a `decision_layer` meaning “which layer owns the final judgment”

Minimal layer-policy example:

```yaml
layers:
  project:
    role: thesis-manager
    required_skills: []
    optional_skills: []
  study:
    role: study-brain
    required_skills: []
    optional_skills: []
  task:
    role: executor
    required_skills:
      - env/fix-cache-layout
      - genomics/scanpy-core-workflow
    optional_skills:
      - genomics/scanpy-marker-annotation
      - plot/scanpy-embedding-panels
      - plot/scanpy-expression-panels

commands:
  qdd-start:
    target: project
    decision_layer: project
  qdd-propose:
    target: study
    decision_layer: study
  qdd-explore:
    target: study
    decision_layer: study
  qdd-apply:
    target: study
    decision_layer: task
  qdd-close:
    target: study
    decision_layer: project
```

## Status JSON

`qdd status --json` does not need a new top-level shape, but project status semantics tighten:

- the shared data surface is `artifacts/data/` rather than a root `data/` directory,
- canonical reusable outputs should be discoverable from the artifact registry even if they originated under a study output tree,
- and status should remain agnostic about whether a file under `artifacts/data/` is only a linked resource or a registered artifact.

No new top-level status object is required in this slice.

## Instructions JSON

`qdd instructions <id> --json` remains the machine-facing execution boundary, but it gains command-aware role resolution.

This slice adds:

- optional `--command <qdd-start|qdd-propose|qdd-explore|qdd-apply|qdd-close>` support,
- role and layer resolution from `.qdd/layer-policy.yaml`,
- `decision_layer` and `role` in the returned JSON,
- and non-empty `optional_skills` when the layer policy declares them.

Resolution rules:

- With `--command`, runtime should resolve:
  - the command's `target`
  - the command's `decision_layer`
  - the role attached to that decision layer
  - the layer-owned required and optional skills
- `PROJECT` instructions with `--command qdd-start` should include project-layer defaults from the policy.
- `STUDY-XXX` instructions with `--command qdd-propose` or `qdd-explore` should merge:
  - study-layer defaults
  - all matched study task skills when relevant
  - and optional study-layer skills
- `STUDY-XXX` instructions with `--command qdd-apply` should return:
  - `target = study`
  - `decision_layer = task`
  - `role = executor`
  - and the merged task-layer defaults plus study-local task skill requirements needed for within-study execution
- `TASK-XXX` instructions with `--command qdd-apply` should merge:
  - task-layer defaults
  - matched task skills
  - and optional task-layer skills
- `STUDY-XXX` instructions with `--command qdd-close` should return:
  - `target = study`
  - `decision_layer = project`
  - `role = thesis-manager`
  - and the project-layer skill defaults needed to judge promotion and carry-forward
- Without `--command`, instructions may preserve the current minimal behavior for compatibility, but prompts in this slice should explicitly pass the command name when they need layer defaults.

## Agent Usage Rules

- `qdd-start` should treat `artifacts/data/` as the dataset-entrypoint surface and prefer symlinks rather than copied raw data.
- `qdd-propose` should continue to write only concrete domain skills into task records, not workflow skills.
- `qdd-explore` should use command-aware instructions when evaluating whether the required local method surface really exists.
- `qdd-apply` should call command-aware instructions and load the required single-cell method guidance before choosing methods.
- For ordinary scRNA clustering, agents should prefer a scanpy-style graph workflow built around neighbors plus Leiden. `k-means` is not the default and requires explicit task-level justification.
- `qdd-close` should promote reusable files into canonical artifact directories before final closure state is written, but the judgment about what is worth promoting belongs to the project decision layer.
- `qdd register-artifact` should be treated as a non-core manual path. If used, it must still canonicalize the artifact path rather than bypass the canonical storage contract.
- Agents must treat official or primary method guidance as the source for domain skill content; do not fill gaps with arbitrary convenience heuristics when strong established practice exists.
