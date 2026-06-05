## Context

The repository already has:

- QDD product direction in `docs/`
- root-level QDD specs in `openspec/specs/`
- a project-local `qdd-bootstrap` schema in `openspec/schemas/`
- an empty root `src/` directory ready for implementation

What it does not yet have is executable QDD code. The next slice should start from the protocol layer, not the agent bootstrap layer.

## Goals / Non-Goals

**Goals:**

- Rename QDD to `Question-Driven Discovery` in QDD-owned project files.
- Add a root-level QDD CLI skeleton that owns the research protocol.
- Implement the smallest useful command set: `init`, `status --json`, `instructions <id> --json`.
- Keep the implementation independent from `OpenSpec/` package runtime.

**Non-Goals:**

- Implementing `add-study`, `add-task`, `close-task`, or `close-study` in this slice.
- Generating Codex/Claude bootstrap artifacts in this slice.
- Moving or refactoring upstream `OpenSpec/` source code.
- Building auto mode, plugin loading, or a TUI.

## Decisions

### 1. Root-level implementation owns QDD runtime

The first executable QDD code will live in the repository root, not in `OpenSpec/`.

Planned locations:

- `src/` for QDD runtime and commands
- `bin/qdd.js` for CLI entry

Rationale: QDD is now a separate product layer. Reusing `OpenSpec/` implementation ideas does not require implementing inside the upstream package tree.

### 2. Protocol-first command order

The first three commands should be implemented in this order:

1. `qdd init`
2. `qdd status --json`
3. `qdd instructions <id> --json`

Rationale: `init` establishes the filesystem contract, `status` proves the read model, and `instructions` proves the agent-facing execution interface.

### 3. Minimal file contract for bootstrap

`qdd init` should only create the minimal protocol state needed for the above commands to work.

Initial bootstrap set:

- `qdd.yaml`
- `control/research_contract.yaml`
- `control/mode.yaml`
- `questions/evolution_trail.yaml`
- `artifacts/index.yaml`
- base directories for `studies/`, `artifacts/data`, `artifacts/code`, `artifacts/figures`, `artifacts/reports`, `prompts/roles`, and `prompts/commands`

Rationale: avoid generating speculative study/task artifacts before the runtime exists to manage them.

### 4. `instructions` starts narrow

In this slice, `qdd instructions <id> --json` may support only well-formed study or task IDs that already exist on disk.

Rationale: it is enough to prove the interface without inventing planning-time artifact generation.

### 5. Agent bootstrap remains downstream of protocol stability

The `qdd:*` / `qdd-*` command and skill generation work should wait until these CLI surfaces stabilize.

Rationale: otherwise the project would generate agent artifacts against interfaces that do not yet exist in code.

## Risks / Trade-offs

- **Name replacement may be incomplete** -> Limit this slice to QDD-owned root project files and specs, and avoid broad search/replace in upstream `OpenSpec/`.
- **Protocol may still evolve after first code lands** -> Keep the command surface minimal so revisions stay cheap.
- **No package/runtime config exists yet at root** -> This slice likely needs package metadata and a lightweight TypeScript or Node runtime setup before commands can run.
- **Instructions scope may be too narrow at first** -> Accept that constraint; it is better than pretending broader workflow coverage already exists.
