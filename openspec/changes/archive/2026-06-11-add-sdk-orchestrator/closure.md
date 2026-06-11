## Question Before

How should QDD provide auto-mode research orchestration by extending bootstrap prompts with fork instructions, without requiring a separate orchestrator runtime, SDK dependency, or CLI command?

## Question After

How should QDD provide auto-mode research orchestration through a runtime orchestrator plus Claude SDK sessions, while keeping command and skill surfaces as later thin launchers?

## Change Type

pivot

## Change Driver

The fork-chain model puts orchestration inside prompt text and depends on nested `/fork` support. The desired architecture is now runtime-owned orchestration: the runtime connects multiple isolated Claude SDK sessions, uses QDD files as the handoff bus, and computes the next phase from structured project status.

## Open Boundaries

- Whether the existing `src/runtime/orchestrator.ts` state detection is sufficient or needs a stricter phase classifier
- Whether the current `read/write/bash` tool surface is safe enough for auto mode without additional command guards
- Whether `qdd auto` should remain in this change as a CLI launcher or be deferred until after runtime validation
- How much of the existing `qdd-auto` skill content should be removed now versus rewritten later as a thin launcher
- Whether dry-run tests can cover enough phase sequencing without a real SDK call

## Evidence Summary

The proposal has pivoted from "prompt is the orchestrator" to "runtime is the orchestrator":

- Old model: append fork instructions to bootstrap prompts and let each agent spawn the next agent.
- New model: `runAuto` owns phase graph, termination, limits, and session creation.
- Old model: command/skills are the first-class automation mechanism.
- New model: command/skills are wrappers after the SDK runtime is proven.
- Old model: failure stops inside an agent chain.
- New model: every phase rereads filesystem state and can stop with a resumable runtime reason.

## Recommended Next Step

Apply this change by hardening the existing runtime and agent runner first, then remove prompt-level fork orchestration. After dry-run and real SDK validation pass, create a follow-up change to package the runtime into generic command or skill surfaces.
