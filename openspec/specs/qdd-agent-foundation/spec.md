# qdd-agent-foundation Specification

## Purpose

Define the reusable agent bootstrap boundary for QDD, including which OpenSpec-style infrastructure may be reused and how QDD keeps a distinct workflow identity while remaining compatible with tools such as Codex and Claude Code.

## Requirements

### Requirement: Reusable Agent Bootstrap Boundary

QDD SHALL reuse OpenSpec-style agent bootstrap infrastructure only where that infrastructure is workflow-agnostic.

#### Scenario: Reusing tool integration primitives

- **WHEN** QDD needs to support agents such as Codex or Claude Code
- **THEN** it SHALL be able to reuse tool detection, instruction projection, and tool-specific file formatting patterns
- **AND** it SHALL not be required to reuse OpenSpec's software change lifecycle to do so

#### Scenario: Limiting reuse to infrastructure concerns

- **WHEN** a reusable subsystem mainly encodes project bootstrap, config injection, command rendering, or schema/template loading
- **THEN** QDD MAY adopt or vendor that subsystem
- **AND** research semantics SHALL remain owned by QDD

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

### Requirement: Reusable Local Customization

QDD SHALL support project-local context, rules, and template customization for generated research instructions.

#### Scenario: Applying project context to QDD instructions

- **WHEN** QDD generates an artifact or instruction set
- **THEN** project-local context SHALL be injectable without editing QDD core code
- **AND** artifact-specific rules SHALL be attachable per QDD artifact type

#### Scenario: Overriding artifact templates

- **WHEN** a project needs a different research workflow or artifact structure
- **THEN** QDD SHALL support schema/template overrides in project-local files
- **AND** those overrides SHALL not require changes to the agent integration layer

### Requirement: Tool-Compatible Agent Projection

QDD SHALL preserve agent-specific file location and formatting compatibility when projecting its own workflow instructions.

#### Scenario: Projecting to Codex-compatible locations

- **WHEN** QDD generates Codex-facing prompts
- **THEN** it SHALL target Codex-compatible prompt locations and metadata formatting
- **AND** the prompt body MAY describe QDD-native workflows and artifacts

#### Scenario: Projecting to Claude Code-compatible locations

- **WHEN** QDD generates Claude Code-facing commands
- **THEN** it SHALL target Claude Code-compatible command locations and frontmatter formatting
- **AND** the command content MAY describe QDD-native workflows and artifacts
