# QDD Machine Interfaces

## `qdd status --json`

The minimal status surface should expose enough state for an agent to know what exists, what is active, and what remains open.

```json
{
  "project": {
    "theme": "...",
    "mode": "human",
    "current_question": "..."
  },
  "studies": {
    "active": ["STUDY-001"],
    "closed": []
  },
  "tasks": {
    "pending": ["TASK-001"],
    "running": [],
    "blocked": []
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

### Requirements

- Output must be stable enough for agents to parse directly.
- It must identify the current question state without forcing agents to read every study file.
- It must expose blockers and open boundaries explicitly.

## `qdd instructions <id> --json`

The minimal instructions surface should tell an agent what to read, what artifact it is producing, and where outputs should be written.

```json
{
  "target": {
    "kind": "study",
    "id": "STUDY-001"
  },
  "read": [
    "control/research_contract.yaml",
    "questions/evolution_trail.yaml",
    "studies/STUDY-001/study.md"
  ],
  "write": [
    "studies/STUDY-001/tasks/TASK-001/task.md"
  ],
  "required_skills": [],
  "optional_skills": [],
  "rules": [
    "Do not redefine the project theme",
    "Record blockers explicitly"
  ]
}
```

### Requirements

- Output must name concrete read and write paths.
- It must separate required from optional skills.
- It must expose protocol rules as constraints, not free-form chat guidance.
- It must stay compatible with human mode; no SDK runtime is required.

## `question_delta` Contract

```yaml
question_delta:
  question_before: string
  question_after: string
  change_type: refinement | confirmation | pivot | dissolution
  change_driver: string
  open_boundaries: []
```

### Semantics

- `refinement`: same direction, tighter boundary
- `confirmation`: sufficient answer reached
- `pivot`: better question replaces current one within the same theme
- `dissolution`: not decidable within current constraints
