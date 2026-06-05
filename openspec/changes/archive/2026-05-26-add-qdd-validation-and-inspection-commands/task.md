## Task Goal

Define and implement the next non-core QDD command slice: validation and inspection.

## Study Link

This task supports making the current QDD lifecycle safer and easier to inspect during real usage and future agent integration.

## Method

- Add one command for validation and two commands for inspection.
- Reuse existing runtime discovery and store helpers.
- Keep all outputs derived directly from current truth sources.
- Avoid introducing new root files, caches, or snapshot layers.

## Expected Outputs

- `qdd validate`
- `qdd artifacts list --json`
- `qdd context`
- runtime helpers for validation and inspection
- smoke tests for command behavior and invalid-state detection
- documentation updates describing when these commands are useful and when they are non-core

## Run Contract

Each implementation attempt should:

- validate a real initialized QDD project
- exercise inspection commands against real context files and registered artifacts
- confirm malformed input is reported clearly
- confirm the new commands do not mutate project state

## Failure / Blocker Conditions

- If validation starts requiring a full schema language or major schema engine, the slice is too large
- If inspection commands require maintaining duplicated summary files, the approach is wrong
- If `qdd context` begins hardcoding domain-specific context schemas into core runtime, stop and narrow scope
