## Why

The current expansion of QDD as `Question-Driven Development` pulls the project back toward software delivery language. That weakens the research positioning and obscures the core idea: question evolution, evidence accumulation, and boundary refinement. `Question-Driven Discovery` fits the actual product better while preserving the `QDD` shorthand.

At the same time, the project now has specs, schema, and protocol definitions but no executable QDD code. Without a minimal CLI foundation, the protocol remains conceptual. The next slice should therefore do two things together: fix the name and turn the bootstrap protocol into a small working CLI.

## What Changes

- Rename QDD's expansion from `Question-Driven Development` to `Question-Driven Discovery` across product-facing project files.
- Create the first root-level QDD code skeleton under `src/` and `bin/` without modifying `OpenSpec/` itself.
- Implement `qdd init` to create the minimum QDD project structure and seed control/state files.
- Implement `qdd status --json` to expose the minimal machine-readable project state defined in the protocol.
- Implement `qdd instructions <id> --json` to expose minimal machine-readable read/write guidance for study/task targets.
- Defer agent bootstrap generation (`qdd:*`, `qdd-*`) until the CLI protocol surfaces exist and are stable.

## Capabilities

### New Capabilities

- `qdd-cli-foundation`: Root-level QDD CLI entrypoint and minimal protocol implementation for init, status, and instructions.

### Modified Capabilities

- `qdd-research-orchestration`: Rename product-facing expansion to `Question-Driven Discovery` and add executable bootstrap command behavior.
- `qdd-agent-foundation`: Clarify that agent bootstrap attaches after the minimal CLI protocol surfaces are in place.

## Impact

- Root-level docs and config language describing QDD.
- New root-level implementation files under `src/` and likely `bin/`.
- New tests or smoke checks for `qdd init`, `qdd status --json`, and `qdd instructions <id> --json`.
- No changes to upstream `OpenSpec/` package code in this slice.
