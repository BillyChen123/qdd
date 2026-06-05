## ADDED Requirements

### Requirement: Boundary-Native Proposal Scoring

QDD SHALL expose a deterministic proposal-scoring surface derived from current project boundary state.

#### Scenario: Scoring an explicit target set

- **WHEN** a user or agent runs `qdd boundaries score --targets <ids> --json`
- **THEN** QDD SHALL compute the requested target set against the current active boundary graph
- **AND** it SHALL return legality, missing active ancestors, suggested frontier boundaries, closure and frontier structure, and machine-readable score fields

#### Scenario: Scoring an existing study

- **WHEN** a user or agent runs `qdd boundaries score --study <study-id> --json`
- **THEN** QDD SHALL read the study's `target_boundaries`
- **AND** it SHALL return the same structural and score outputs used for explicit target sets

#### Scenario: Keeping narrowed boundaries structurally active

- **WHEN** QDD computes legality, closure, frontier, or reachable active mass
- **THEN** boundaries with status `narrowed` SHALL be treated as active
- **AND** any reduction in their remaining importance SHALL come from updated `weight`, not from a hard-coded runtime discount

### Requirement: Frontier-Aware Study Planning

QDD SHALL distinguish a user's long-range target from the current executable study when unresolved active ancestors remain.

#### Scenario: Preserving human-mode target semantics

- **WHEN** `qdd-propose` runs in `human` mode for a target that still depends on unresolved active ancestors
- **THEN** it SHALL preserve the user's long-range scientific goal in its explanation
- **AND** it SHALL recommend a smaller current study built from the executable frontier instead of silently rewriting the user's intent

#### Scenario: Preventing oversized current studies

- **WHEN** a requested target spans multiple unresolved active boundary layers
- **THEN** QDD SHALL not treat “add more tasks” as the default fix for that scope problem
- **AND** it SHALL instead downshift the current study to the executable frontier or explicitly discuss that resize in `qdd-explore`
