## Question Before

How should QDD formalize every managed file as an explicit schema, template, and example surface so humans and agents can write the files correctly on the first pass?

## Question After

How should QDD use one source-level managed-file contract layer to drive scaffolding, validation, instructions, and examples without letting that layer drift from runtime behavior?

## Change Type

refinement

## Change Driver

The benchmark friction is real, but the right first move is narrower than a full runtime redesign. The immediate need is to make managed files explicit and readable, then let later proposals tighten lifecycle behavior and service boundaries on top of that clearer foundation.

## Open Boundaries

- How far to decompose runtime orchestration after the contract layer exists
- Whether `qdd instructions` should eventually expose contract metadata more structurally than simple read paths
- How much of the current long-form defaults/instructions text should move out of `src/runtime/defaults.ts` in the later runtime-decomposition slice
- Which lifecycle-specific fixes should follow immediately after the contract layer lands

## Evidence Summary

This proposal focuses the work onto one stable layer:

- explicit contract ownership for each managed file family
- generated schema references and copy-ready examples under `.qdd/`
- validator/template/instructions alignment
- clearer `task.md` skill-body formatting rules

It deliberately leaves runtime decomposition, artifact-lifecycle hardening, and evolution/memory semantic tightening to later slices.

## Recommended Next Step

Apply this change first. Once the managed-file layer is explicit and generated into projects, follow with the lifecycle-hardening slice and then the runtime-responsibility decomposition slice.
