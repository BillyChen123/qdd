## MODIFIED Requirements

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

#### Scenario: Using discovery language in product-facing identity

- **WHEN** QDD expands its name in QDD-owned product-facing files
- **THEN** it SHALL use `Question-Driven Discovery`
- **AND** it SHALL not present `development` as the primary expansion of the QDD name

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

#### Scenario: Bootstrapping the filesystem contract

- **WHEN** a user runs `qdd init`
- **THEN** QDD SHALL create the minimal project control files and directories required by the bootstrap protocol
- **AND** it SHALL not require study, task, or run artifacts to exist before the project root is considered initialized

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

#### Scenario: Serving bootstrap interfaces through CLI commands

- **WHEN** a user runs `qdd status --json` or `qdd instructions <id> --json`
- **THEN** QDD SHALL expose those machine-readable interfaces through the CLI
- **AND** the JSON surface SHALL remain aligned with the documented bootstrap protocol
