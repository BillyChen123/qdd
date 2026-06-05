## Context

The repository currently contains two layers:

- `docs/` describes QDD as a research-first framework centered on question evolution, artifact provenance, and study closure.
- `OpenSpec/` contains an existing, productionized tool integration base for agent skills, command adapters, config injection, and schema/template customization.

The key architectural decision is not whether QDD should look like OpenSpec. It should not. The decision is which OpenSpec subsystems are foundational infrastructure versus product-level workflow opinions.

## Goals / Non-Goals

**Goals:**

- Reuse the parts of OpenSpec that already solve agent interoperability well, especially Codex and Claude Code bootstrap.
- Keep QDD's product model research-native: `project -> study -> task -> run -> artifact -> question_delta`.
- Preserve project-local customization through `openspec/config.yaml`, schema selection, and template overrides.
- Keep the first slice small enough to implement without dragging in full workspace, archive, or software-spec lifecycle complexity.

**Non-Goals:**

- Rebranding OpenSpec commands into QDD while keeping the same underlying lifecycle.
- Requiring QDD users to adopt proposal/spec/design/tasks as their primary research objects.
- Building auto mode, domain plugins, or full TUI support in the bootstrap slice.
- Forking every OpenSpec feature before the minimal QDD protocol is validated.

## Decisions

### 1. Separate product model from agent foundation

QDD will own its research semantics and filesystem protocol. OpenSpec contributes reusable infrastructure only where it is already generic enough:

- tool registry and detection patterns (`skillsDir`, detection paths)
- command adapter projection for Codex, Claude Code, and similar agents
- project config context/rules injection
- schema/template customization model

Rationale: these are infrastructure concerns. They do not force QDD to inherit OpenSpec's software change lifecycle.

### 2. Keep QDD command surface minimal at bootstrap

The first QDD slice should focus on a small, stable set of research operations, likely around:

- `qdd init`
- `qdd status`
- `qdd add-study`
- `qdd add-task`
- `qdd instructions <id>`
- `qdd close-task`
- `qdd close-study`

Rationale: this is enough to validate the protocol without inventing extra ceremony.

### 3. Treat schema/template customization as a reusable mechanism

OpenSpec's strongest extensibility idea is not `/opsx:*`; it is the separation of:

- workflow schema (`schema.yaml`)
- artifact templates (`templates/*.md`)
- project context and rules (`openspec/config.yaml`)

QDD should reuse this pattern to define research artifacts and instructions, even if artifact names differ from OpenSpec's proposal/spec/design/tasks set.

### 4. Use selective vendoring for the first implementation slice

The first QDD implementation slice should use selective vendoring of workflow-agnostic OpenSpec modules rather than direct thin wrappers or an upfront extraction effort.

Initial vendoring candidates are:

- tool registry and detection metadata
- command adapter definitions for Codex, Claude Code, and similar agents
- project-local config and schema/template loading primitives

Rationale: direct wrappers would keep QDD coupled to OpenSpec's package layout and `opsx`-oriented content generation, while an extraction effort is too large for the bootstrap slice. Selective vendoring gives QDD stable ownership over the research product layer while still reusing proven infrastructure patterns.

### 5. Use a separate QDD command namespace

QDD should keep a distinct user-facing and generated command identity.

Baseline naming:

- user-facing slash/command namespace: `qdd:*`
- generated prompt or command identifiers: `qdd-<flow>`
- generated skill directories: `qdd-<flow>`

Rationale: the adapter layer should stay compatible with Codex and Claude Code, but the workflow identity must remain visibly separate from `opsx` so QDD does not read as a renamed software planning workflow.

## Validation Summary

Bootstrap scope was manually validated against the agreed boundary:

- QDD now has a project-local `qdd-bootstrap` schema under `openspec/schemas/`.
- That schema uses QDD-native artifacts (`project`, `protocol`, `study`, `task`, `closure`, `checklist`) rather than OpenSpec planning artifacts.
- Root config now defaults to `qdd-bootstrap`, making the QDD workflow the repository default.
- Agent bootstrap mapping preserves Codex and Claude Code compatibility while keeping a separate `qdd:*` identity.

Formal CLI validation was not executed in this slice because the vendored `OpenSpec/` package is not built in this environment.

## Risks / Trade-offs

- **OpenSpec internals may be more coupled than they look** -> Start with selective vendoring of the smallest reusable surface: tool registry, command adapters, config/schema loading, and content projection.
- **QDD may drift into a renamed OpenSpec workflow** -> Keep QDD specs and commands anchored to research objects, not software change artifacts.
- **Too much abstraction too early** -> Implement only enough indirection to support Codex/Claude bootstrap and local schema/template overrides.
- **Two `openspec/` meanings in one repo can confuse contributors** -> Document clearly that root `openspec/` is QDD's local planning area, while `OpenSpec/` is the upstream codebase being referenced and mined for reusable ideas.
