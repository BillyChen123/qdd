# QDD Filesystem Contract

## Purpose

This document defines the minimal filesystem contract for the first QDD bootstrap slice. It is intentionally small: enough for human mode and agent-assisted execution, without introducing extra project machinery.

## Layout

```text
.
├── qdd.yaml
├── control/
│   ├── research_contract.yaml
│   └── mode.yaml
├── questions/
│   └── evolution_trail.yaml
├── studies/
│   └── STUDY-001/
│       ├── study.yaml
│       ├── study.md
│       ├── closure.yaml
│       └── tasks/
│           └── TASK-001/
│               ├── task.yaml
│               ├── task.md
│               └── runs/
│                   └── RUN-001/
│                       ├── run.yaml
│                       ├── candidate/
│                       └── artifacts/
├── artifacts/
│   ├── index.yaml
│   ├── data/
│   ├── code/
│   ├── figures/
│   └── reports/
└── prompts/
    ├── roles/
    └── commands/
```

## Contract Rules

- `qdd.yaml` identifies the directory as a QDD project root.
- `control/` stores project-level control state, not study execution details.
- `questions/evolution_trail.yaml` is the durable history of question movement across studies.
- Each study owns its `tasks/` subtree.
- Each task owns its `runs/` subtree.
- Every reusable output is registered in `artifacts/index.yaml` with provenance back to study, task, and run.

## Minimal Required Records

- `research_contract.yaml`: theme, initial question, mode, scope, evidence standard.
- `study.yaml`: study ID, question, status, linked task IDs.
- `task.yaml`: task ID, goal, expected outputs, status.
- `run.yaml`: run ID, task ID, execution summary, produced artifact IDs, blockers.
- `closure.yaml`: `question_delta`, evidence summary, open boundaries, next-step recommendation.

## Deferred For Later Slices

- domain-specific plugin directories
- cache policy and environment snapshotting beyond minimal metadata
- multi-user coordination and permission models
- autonomous loop runtime beyond the filesystem contract
