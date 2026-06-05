## 1. Bootstrap Surface

- [x] 1.1 Make `qdd init` install the stable project scaffold plus bootstrap metadata without relying on an agent conversation.
- [x] 1.2 Define the minimum installed QDD-native bootstrap assets needed for Codex and the first project-local command surface.
- [x] 1.3 Ensure generated bootstrap content references the implemented QDD CLI commands rather than hypothetical or `opsx`-derived commands.
- [x] 1.4 Keep the bootstrap layer aligned with the single-file prompt structure described in `docs/01-development-prototype.md`.

## 2. Runtime Projection

- [x] 2.1 Add runtime or generator helpers that project current QDD workflow guidance into agent-compatible locations.
- [x] 2.2 Reuse workflow-agnostic bootstrap patterns only; do not reintroduce OpenSpec software-lifecycle semantics.
- [x] 2.3 Generate the four installed workflow surfaces: `qdd-propose`, `qdd-explore`, `qdd-apply`, and `qdd-close`.
- [x] 2.4 Encode first-run bootstrap through `qdd init` and `qdd-propose` rather than through a separate `qdd-project` wrapper.
- [x] 2.5 Make project-local context and instruction updates refreshable without changing core QDD logic.
- [x] 2.6 Verify that generated assets preserve current truth sources and command boundaries.

## 3. Validation And Docs

- [x] 3.1 Add tests or smoke checks for generated bootstrap files and their key contents.
- [x] 3.2 Verify that `qdd-explore` is structured, study-anchored, and converges to a resource-supported plan rather than behaving like free-form brainstorming.
- [x] 3.3 Update [docs/02-code-prototype-map.md](/data/chenyz/project/qdd/docs/02-code-prototype-map.md) to reflect the new bootstrap layer once implemented.
- [x] 3.4 Document how a real QDD project should use the generated bootstrap layer in human mode.
- [x] 3.5 Verify that this slice remains a thin installed projection layer rather than a second workflow engine.
