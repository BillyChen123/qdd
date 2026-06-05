# QDD Agent Bootstrap Mapping

## Reused OpenSpec Foundation

QDD should reuse these OpenSpec-style infrastructure pieces where possible:

- tool registry and detection metadata (`skillsDir`, detection paths)
- tool-specific command adapters for Codex, Claude Code, and similar agents
- generated instruction content written into agent-specific directories
- `openspec/config.yaml` context and artifact-rule injection
- project-local schema and template overrides under `openspec/schemas/`

## Not Reused As Product Workflow

QDD should not inherit these as default product semantics:

- `/opsx:*` software change workflow identity
- proposal/spec/design/tasks as the primary domain model
- archive and sync semantics tied to software capability diffs

## Codex And Claude Code Projection

QDD should preserve each tool's projection rules while changing the workflow content:

- Codex: write prompt files into `<CODEX_HOME>/prompts/` using Codex frontmatter.
- Claude Code: write command files into `.claude/commands/` using Claude frontmatter.

The key rule is compatibility at the adapter layer, not identity at the workflow layer.

## Command And Skill Identity

QDD should keep its own workflow namespace.

- user-facing namespace: `qdd:*`
- generated prompt and command identifiers: `qdd-<flow>`
- generated skill directories named for QDD flows, not `openspec-*`
- prompt content referring to QDD artifacts (`project`, `study`, `task`, `closure`) rather than OpenSpec planning artifacts

## Mapping `openspec/config.yaml`

QDD should continue using `openspec/config.yaml` as the project-local control plane for generated instructions.

- `context`: shared project constraints applied to every QDD artifact instruction
- `rules.project`: additional rules for research contract generation
- `rules.protocol`: rules for filesystem and JSON contract generation
- `rules.study`: rules for bounded question design
- `rules.task`: rules for evidence-producing execution units
- `rules.closure`: rules for `question_delta` and project judgment
- `rules.checklist`: rules for apply-phase tracking

This keeps customization local and versioned without tying QDD to OpenSpec's workflow semantics.
