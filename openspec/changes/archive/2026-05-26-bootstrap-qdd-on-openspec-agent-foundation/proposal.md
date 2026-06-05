## Why

QDD is not a software-spec workflow variant of OpenSpec. It is a higher-level research operating model for question evolution, evidence production, and artifact reuse. Reusing OpenSpec's planning lifecycle as-is would pull QDD toward software change management instead of research orchestration.

What is worth reusing is the agent/tooling foundation OpenSpec already solved well: Codex and Claude Code bootstrap, command/skill projection per tool, project-local customization via `openspec/config.yaml`, and schema/template-based extensibility. That lets QDD stay lightweight, indirect, and extensible without rebuilding agent integration from scratch.

## What Changes

- Define QDD as a research-first orchestration layer that reuses OpenSpec's agent bootstrap and customization mechanisms, not its default software delivery workflow.
- Establish a minimal QDD core around project, study, task, run, artifact, and `question_delta`.
- Treat OpenSpec-style schemas and templates as reusable infrastructure for QDD command/instruction generation.
- Prefer a small set of QDD commands and artifacts first, while keeping Codex and Claude Code configuration compatible with existing OpenSpec patterns.
- Keep domain plugins and richer automation out of the bootstrap slice.

## Capabilities

### New Capabilities

- `qdd-agent-foundation`: Reuse OpenSpec-style agent binding, command projection, and local customization for QDD.
- `qdd-research-orchestration`: Define the research-native QDD object model and filesystem protocol independent of OpenSpec's software change lifecycle.

### Modified Capabilities

- None.

## Impact

- New root-level QDD specs under `openspec/specs/`.
- New QDD bootstrap design covering reuse boundaries and non-goals.
- Likely future implementation areas: QDD CLI entrypoints, filesystem schemas, prompt/templates, and thin adapters around reusable OpenSpec agent infrastructure.
- No commitment yet to fork or rewrite OpenSpec core; this proposal only fixes architectural direction and bootstrap scope.
