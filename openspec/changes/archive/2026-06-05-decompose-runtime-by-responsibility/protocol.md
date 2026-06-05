## Filesystem Contract

This change reorganizes source ownership inside `src/` without changing project-level QDD files or CLI surfaces.

Target source layout:

```text
src/
  cli/
  commands/               # thin argument parsing + command dispatch only
  file-contracts/         # managed-file schemas, enums, templates, examples, renderers
  services/               # study/task/artifact/closure state transitions
  render/                 # derived reports such as research-map HTML
  runtime/                # infrastructure helpers only: paths, store, bootstrap, local-skills, constants
  types/                  # split type definitions with index barrel
  utils/
```

Responsibility rules for the end state:

1. `src/file-contracts/*`
   - owns managed-file enums, shapes, Markdown/YAML templates, examples, and parsing helpers tied to those files
   - may be used by services, validators, bootstrap, and instructions
   - must not depend on CLI commands

2. `src/services/studies.ts`
   - owns study creation, reading, updating, and study-local document synchronization
   - may call file-contract parsers/renderers and infrastructure helpers

3. `src/services/tasks.ts`
   - owns task creation, reading, checklist/body synchronization, skill normalization, and task-state updates

4. `src/services/artifacts.ts`
   - owns artifact candidate reading/validation, registry updates, promotion path rules, and canonical artifact writes

5. `src/services/closure.ts`
   - owns close preflight, close execution, evolution updates, memory writing, and cleanup orchestration
   - may depend on studies/tasks/artifacts services

6. `src/render/research-map.ts`
   - owns HTML rendering for `research-map.html`
   - accepts normalized evolution/memory data and returns derived presentation output

7. `src/runtime/*`
   - remains only for infrastructure concerns such as filesystem paths, YAML/Markdown store helpers, bootstrap install, local-skill discovery, and low-level shared constants
   - must not remain the home of large business workflows after this change

8. `src/commands/*`
   - parse CLI input
   - call one service entrypoint
   - print result or error
   - must not own lifecycle decisions, parsing rules, or promotion logic

Temporary compatibility wrappers are acceptable only if they stay thin and are removed or reduced to re-export shims by the end of the change.

## Identifiers And Metadata

This slice does not change any external identifiers or managed-file metadata rules.

The following must stay semantically unchanged:

- command names:
  - `qdd init`
  - `qdd status`
  - `qdd instructions`
  - `qdd validate`
  - `qdd close-study`
  - and the existing study/task/artifact commands
- managed-file IDs and enums:
  - `STUDY-XXX`
  - `TASK-XXX`
  - `ART-XXX`
  - artifact `type` / `scope`
  - study and task status values
  - evolution `kind`
- project bootstrap layout and `.qdd/` reference outputs

Type-system refactor rules:

- split `src/types.ts` into concern-based modules under `src/types/`
- keep one stable barrel at `src/types/index.ts`
- callers should import from the barrel or a clearly owned submodule
- do not create duplicate competing type definitions during migration

## Status JSON

`qdd status --json` must remain behaviorally equivalent.

This change may redirect status computation to service-owned readers, but it must not introduce new required fields, rename current fields, or shift semantic meaning. Any status refactor should preserve:

- project contract inspection
- study/task discovery
- promotion/preflight signals
- evolution summary
- context/artifact overview

If internal data gathering is split apart, aggregation should still happen through one stable command-facing adapter.

## Instructions JSON

`qdd instructions ... --json` must remain behaviorally equivalent.

Internal refactor expectations:

- instruction builders may read from file contracts and service helpers instead of large runtime modules
- role resolution and skill-path resolution may stay in runtime infrastructure if that remains the cleanest home
- managed-file reference paths should keep coming from `src/file-contracts/*`
- no command should need to understand the whole project model to return instruction JSON

This change should reduce hidden coupling between instruction assembly and unrelated lifecycle code, not add new instruction concepts.

## Agent Usage Rules

- Treat this change as a structural refactor only.
- Do not smuggle protocol redesign into service extraction.
- Move code toward the narrowest responsible module instead of creating another large “shared” bucket.
- Prefer pure helper extraction before moving stateful orchestration code.
- Preserve tests or add focused tests as modules move so behavior stays pinned.
- When a piece of logic writes or validates a managed file, prefer `src/file-contracts/*` as the authority source.
- When a piece of logic changes study/task/artifact/closure state, prefer `src/services/*` as the authority source.
- When a piece of logic only formats HTML or other derived reports, prefer `src/render/*`.
