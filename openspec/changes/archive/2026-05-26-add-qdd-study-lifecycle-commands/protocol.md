## Filesystem Contract

This slice keeps the current QDD root layout as the authoritative project protocol:

```text
project-root/
├── contract.yaml
├── evolution.yaml
├── context/
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
└── .qdd/
    └── instructions.md
```

The new lifecycle commands operate inside that layout instead of introducing a second project model.

- `qdd add-study` creates `studies/STUDY-XXX/`, `study.md`, `tasks/`, and `output/`.
- `qdd add-task STUDY-XXX` creates `studies/STUDY-XXX/tasks/TASK-XXX.md` and links the task back into the study frontmatter.
- `qdd register-artifact <path>` appends a structured entry to `artifacts/index.yaml`.
- `qdd close-study STUDY-XXX` appends a `question_delta` entry to `evolution.yaml` and marks the study record closed.

Dedicated `runs/` directories, per-task close commands, and per-study `closure.md` runtime files remain deferred. In this slice, provenance is tracked at least to the study and task level through Markdown state plus `produced_by` links in the artifact index.

## Identifiers And Metadata

Identifiers stay machine-readable and globally unique inside one QDD project:

- Study IDs: `STUDY-001`, `STUDY-002`, ...
- Task IDs: `TASK-001`, `TASK-002`, ...
- Artifact IDs: `ART-001`, `ART-002`, ...

Required `study.md` frontmatter for this slice:

```yaml
study_id: STUDY-001
question: string
hypothesis: string
status: created | running | blocked | completed | closed
task_ids: []
```

Optional study metadata may include `blockers`, `input_context`, `expected_artifacts`, and `closed_at`.

Required `TASK-XXX.md` frontmatter for this slice:

```yaml
task_id: TASK-001
study_id: STUDY-001
goal: string
status: pending | running | blocked | completed
expected_outputs: []
```

Optional task metadata may include `depends_on`, `skills`, `artifact_ids`, `result_summary`, `blocker_reason`, and `updated_at`.

Artifact registry entries continue to use the existing schema, but `produced_by` should now capture provenance at least to the study and task, for example `STUDY-001/TASK-002`.

For this slice, the human-readable Markdown body is intentionally shaped by `docs/01-development-prototype.md`, while frontmatter remains the machine-facing authority.

Generated `study.md` body sections should be:

- `## Question`
- `## Hypothesis`
- `## Blockers`
- `## Tasks`
- `## Expected Artifacts`

Generated `TASK-XXX.md` body sections should be:

- `## Depends On`
- `## Input`
- `## Expected Output`
- `## Checklist`
- `## Skills`

State transition rules for this slice:

- `add-study` writes `status: created`
- `add-task` writes `status: pending`
- during execution, the agent may update task frontmatter and Markdown checklist directly to move a task from `pending` to `running`, `completed`, or `blocked`
- `register-artifact` appends reusable outputs to `artifacts/index.yaml` and may be accompanied by direct task/study Markdown updates
- a study becomes `blocked` if any linked task is blocked and the study is not yet closed
- a study becomes `completed` when every linked task is resolved as `completed` or `blocked`
- `close-study` is allowed only when no linked task remains `pending` or `running`

## Status JSON

`qdd status --json` should remain stable but become lifecycle-aware. The output should still group state by project, studies, tasks, artifacts, and question evolution, while expanding task and study summaries to reflect the new write commands.

Target shape for this slice:

```json
{
  "project": {
    "theme": "...",
    "mode": "human",
    "current_question": "..."
  },
  "studies": {
    "active": ["STUDY-001"],
    "blocked": [],
    "completed": [],
    "closed": []
  },
  "tasks": {
    "pending": ["TASK-001"],
    "running": [],
    "blocked": [],
    "completed": []
  },
  "artifacts": {
    "count": 0,
    "latest": []
  },
  "question_state": {
    "last_change_type": null,
    "open_boundaries": []
  }
}
```

Additional fields may be added conservatively, but the existing top-level contract should not be replaced.

## Instructions JSON

`qdd instructions <id> --json` remains the main machine-facing guidance surface for agents. This slice should keep the current shape but make read and write targets reflect the new lifecycle behavior.

For a study target, `write` should include:

- `studies/STUDY-XXX/study.md`
- `studies/STUDY-XXX/tasks/`
- `studies/STUDY-XXX/output/`
- `artifacts/index.yaml`

For a task target, `write` should include:

- `studies/STUDY-XXX/tasks/TASK-XXX.md`
- `studies/STUDY-XXX/output/`
- `artifacts/index.yaml`

Both target kinds should continue reading:

- `contract.yaml`
- `evolution.yaml`
- `.qdd/instructions.md`
- all `context/*.yaml`
- the relevant study/task records
- `artifacts/index.yaml`

The JSON surface should keep `required_skills`, `optional_skills`, and `rules`, but those fields stay advisory and must not hardcode domain-specific context file names.

## Agent Usage Rules

Agents should use these commands to manage structured state instead of inventing IDs or mutating index files ad hoc.

- Use `qdd add-study` to allocate study IDs and scaffold the study directory.
- Use `qdd add-task` to allocate task IDs and keep `task_ids` linked from the study record.
- During execution, update `study.md` and `TASK-XXX.md` directly using the generated Markdown protocol instead of relying on a separate `close-task` command.
- Use `qdd register-artifact` to add reusable outputs to `artifacts/index.yaml`.
- Use `qdd close-study` to write `question_delta` into `evolution.yaml` and close the study.

Agents must not invent new root-level directories, reintroduce OpenSpec proposal/spec/design/task terminology into QDD records, or hardcode `context/` filenames beyond scanning the directory for YAML resources.
