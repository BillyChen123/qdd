## ADDED Requirements

### Requirement: Research-Native Object Model

QDD SHALL model research work using research-native objects rather than software change artifacts.

#### Scenario: Representing active research state

- **WHEN** QDD stores project state
- **THEN** it SHALL use research objects including project, study, task, run, artifact, and closure information
- **AND** those objects SHALL be the primary workflow surface for users and agents

#### Scenario: Avoiding software workflow leakage

- **WHEN** QDD defines its core protocol
- **THEN** proposal, spec, design, and task documents from OpenSpec SHALL not be treated as QDD's primary research entities
- **AND** any use of similar planning artifacts SHALL remain subordinate to QDD's research model

### Requirement: Durable Filesystem Protocol

QDD SHALL use a durable filesystem protocol that preserves project, study, task, run, artifact, and closure lineage.

#### Scenario: Recognizing a QDD project layout

- **WHEN** QDD initializes or reads a project
- **THEN** it SHALL use a stable project layout for project control state, study state, task state, run state, and reusable artifacts
- **AND** agents SHALL be able to find those locations without inferring an ad hoc directory model from chat context

#### Scenario: Preserving provenance for reusable outputs

- **WHEN** a task run produces reusable outputs
- **THEN** QDD SHALL preserve provenance linking those outputs back to the originating study, task, and run
- **AND** reusable artifacts SHALL remain discoverable independently of any one chat session

### Requirement: Question Evolution As First-Class State

QDD SHALL treat question evolution as explicit structured state.

#### Scenario: Closing a study

- **WHEN** a study is closed
- **THEN** QDD SHALL record a structured `question_delta`
- **AND** that record SHALL include at least the prior question, resulting question, change type, change driver, and remaining open boundaries

#### Scenario: Distinguishing kinds of research movement

- **WHEN** QDD records a `question_delta`
- **THEN** the change type SHALL distinguish at least refinement, confirmation, pivot, and dissolution
- **AND** downstream project judgment SHALL be able to inspect that structured value directly

### Requirement: Minimal Indirect Workflow

QDD SHALL keep the bootstrap workflow indirect, lightweight, and extensible.

#### Scenario: Bootstrapping a QDD project

- **WHEN** a user initializes a QDD project
- **THEN** the system SHALL create only the minimum structure needed to manage research state and agent instructions
- **AND** it SHALL avoid introducing lifecycle ceremony not needed for the first research loop

#### Scenario: Extending toward domain plugins or automation later

- **WHEN** future plugins, domain rules, or auto mode are added
- **THEN** the bootstrap protocol SHALL remain extensible enough to host them
- **AND** the initial slice SHALL not require those capabilities to operate

### Requirement: Minimal Machine Interfaces

QDD SHALL define machine-readable interfaces for research state inspection and execution guidance.

#### Scenario: Inspecting current research state

- **WHEN** an agent or user requests structured status
- **THEN** QDD SHALL provide a stable machine-readable status surface
- **AND** that surface SHALL expose active studies, task state, artifact state, and open question boundaries

#### Scenario: Requesting execution guidance

- **WHEN** an agent requests structured instructions for a study, task, or closure target
- **THEN** QDD SHALL provide machine-readable read paths, write paths, and execution constraints
- **AND** the response SHALL not require the agent to infer core protocol paths from chat context alone
