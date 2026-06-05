## Core Semantic Contract

QDD should use these meanings consistently:

- `theme`
  - broad project research field, resources, and long-range scope
  - should remain valid across local pivots
- `evolution`
  - append-only history of the current working question
  - the latest `question_after` is the current project question pointer
- `boundaries`
  - current unresolved frontier graph around the current working question
  - not a history graph
  - not a workflow-step list
- `score`
  - local ranking of a proposed study against the current frontier
  - not a global optimality guarantee

## Lifecycle Order

Two different orders matter:

### Reasoning Order

This is the semantic order the agent should reason in:

1. identify the current working question
2. identify the current unresolved frontier around that question
3. choose or score a study against that frontier
4. execute and gather evidence
5. decide whether the working question changed
6. rewrite the frontier around the resulting question

### Persistence Order

This is the runtime order required to avoid half-closed state:

1. validate closure readiness
2. promote reusable outputs
3. read and validate study-local boundary updates
4. apply project boundary updates
5. append `question_delta`
6. mark the study closed

Reasoning order stays question-first.
Persistence order stays state-safe.

## Boundary Rules

Every boundary should satisfy all of these:

1. it is an unresolved question or constraint
2. answering it would change what can be claimed or what should be done next
3. `depends_on` means scientific prerequisite, not execution order
4. its text should not be a method step such as QC, UMAP, or DEG

Good examples:

- Is the current dataset sufficient to support this comparison?
- Can the target cell state be identified stably enough to study?
- Could the observed effect still be explained by batch or composition confounding?

Bad examples:

- Run QC
- Run UMAP
- Recluster the object

## Evolution Rules

Write a new `question_delta` when the current working question itself changes.

That includes changes in:

- main target cell or state
- main biological factor or driver
- core comparison object
- whether the next study is still answering the same question

Do not write `question_delta` just because one frontier question narrowed while the main working question stayed the same.

## Workflow Implications

### `qdd-propose`

- should read the current project question from status / evolution
- should treat study creation as selecting one executable slice against the current frontier
- must show the score result explicitly, including:
  - `legal`
  - `suggested_frontier`
  - `quality_score`
  - `priority_score`

### `qdd-explore`

- should refine or stress-test a study against the same current-frontier model
- must also show the score result explicitly each round
- must not mutate project boundary state

### `qdd-close`

- should first decide the resulting question in reasoning
- should then prepare the next frontier update around that resulting question
- must apply boundary updates before the final `qdd close-study` write path completes

## Verification Targets

- close-time smoke coverage that proves boundary updates are persisted automatically before `question_delta` is written
- smoke coverage that proves `question_before` comes from project current-question state
- prompt / bootstrap coverage that proves score visibility is part of propose / explore
