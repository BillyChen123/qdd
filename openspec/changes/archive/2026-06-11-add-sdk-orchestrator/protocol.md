## Filesystem Contract

The SDK runtime must communicate only through existing QDD-managed files:

```text
contract.yaml
context/resources.md
context/memory/STUDY-XXX.md
evolution.yaml
studies/STUDY-XXX/study.md
studies/STUDY-XXX/tasks/TASK-XXX.md
studies/STUDY-XXX/output/**
studies/STUDY-XXX/artifact-candidates.yaml
artifacts/index.yaml
artifacts/**
```

No chat transcript is a required handoff artifact. Every new agent session reconstructs state from files and structured instructions.

## Runtime Contract

```text
runAuto(projectRoot, options)
  read qdd status
  compute initial phase
  while under maxIterations:
    build qdd instructions for target + command
    load matching bootstrap prompt
    run one isolated Claude SDK agent session
    reread qdd status
    compute next phase or terminal reason
  return structured AutoResult
```

Required runtime options:

- `model`
- `maxIterations`
- `maxTurnsPerAgent`
- `dryRun`
- `json`

Required run result fields:

- current phase, command, target, and role
- turns and tool call count for each agent session
- normal completion flag
- final message or failure reason
- terminal reason when the loop stops

## Phase Graph

```text
start(PROJECT, qdd-start)
  -> propose(STUDY-NNN, qdd-propose)
  -> apply(STUDY-NNN, qdd-apply)
  -> close(STUDY-NNN, qdd-close)
  -> propose(next STUDY-NNN, qdd-propose) or stop
```

The runtime computes the starting phase from current project state:

- no studies -> `start(PROJECT)`
- active study without tasks -> `propose(study)`
- active study with pending or running tasks -> `apply(study)`
- active study with all tasks done -> `close(study)`
- no active study but non-terminal project state -> `propose(next study)`

## Agent Session Contract

Each phase creates a fresh Claude SDK session with:

- the role bootstrap prompt as the system prompt
- formatted `qdd instructions --json` as user/task context
- project-root-scoped tools for reading files, writing files, and bounded shell execution
- a completion convention that lets the runner distinguish normal completion from max-turn exhaustion

The next phase must not receive the prior session transcript.

## Termination Judgment

The runtime stops when structured QDD status indicates:

| Condition | Runtime Behavior |
| --- | --- |
| `change_type = confirmation` | report answered/confirmed, stop |
| `change_type = dissolution` | report dissolved/undecidable boundary, stop |
| `open_boundary_ids = []` | report no open boundaries, stop |
| `next_candidates = []` | report no credible follow-up directions, stop |
| max iterations reached | report limit reached, stop resumably |
| phase required files missing | report resumable failure, stop |

If none of the stop conditions apply after close, the runtime selects the next `STUDY-NNN` and invokes `qdd-propose`.

## Command And Skill Boundary

Command and skill surfaces are launchers only:

```text
generic agent command/skill -> qdd auto -> runAuto -> Claude SDK sessions
```

They must not duplicate:

- phase transition logic
- termination logic
- study ID selection
- retry or failure handling

This keeps the orchestration testable outside any one agent tool.
