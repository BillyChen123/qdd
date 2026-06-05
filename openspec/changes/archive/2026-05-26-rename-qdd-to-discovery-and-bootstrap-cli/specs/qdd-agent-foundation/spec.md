## MODIFIED Requirements

### Requirement: Separate QDD Command Identity

QDD SHALL keep its agent-facing command and instruction identity distinct from OpenSpec's `opsx` workflow identity.

#### Scenario: Generating QDD agent instructions

- **WHEN** QDD installs or refreshes agent-facing instructions
- **THEN** those instructions SHALL identify QDD workflows and artifacts using QDD-specific names
- **AND** they SHALL not present QDD operations as renamed `opsx` software change commands

#### Scenario: Preserving Codex and Claude Code compatibility

- **WHEN** QDD targets Codex or Claude Code
- **THEN** it SHALL preserve each tool's required directory and frontmatter conventions
- **AND** it MAY change only the workflow content and naming projected into those locations

#### Scenario: Deferring agent bootstrap until CLI protocol exists

- **WHEN** QDD has not yet implemented the minimal CLI protocol surfaces in code
- **THEN** QDD SHALL defer generating its own agent bootstrap commands and skills
- **AND** the CLI protocol SHALL land before QDD-specific bootstrap generation is treated as complete
