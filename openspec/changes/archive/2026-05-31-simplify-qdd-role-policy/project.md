## Theme

Simplify QDD's command-to-role policy so workflow prompts, instructions, and validation expose only the role boundaries that actually matter, while preserving `thesis-manager` as the closure authority for artifact promotion and project carry-forward.

## Initial Question

How should QDD replace the current layer-heavy `.qdd/layer-policy.yaml` with a lighter command-and-role policy that keeps `qdd-start` and `qdd-close` under `thesis-manager`, keeps planning defaults on `study-brain`, and leaves executor-time skill loading fully task-local?

## Mode

`human`

Humans still own protocol truth, role semantics, and any domain brain content. Agents may simplify runtime policy, prompts, and validation behavior, but must not silently redesign study/task semantics or invent new hidden routing layers.

## Scope

### In Scope

- Replace the current `.qdd/layer-policy.yaml` layer-oriented contract with a lighter command-to-role policy.
- Keep the command surface explicit:
  - `qdd-start -> thesis-manager`
  - `qdd-propose -> study-brain`
  - `qdd-explore -> study-brain`
  - `qdd-apply -> executor`
  - `qdd-close -> thesis-manager`
- Keep a role-level `default_skills` surface so `study-brain` can receive planning defaults without reintroducing layer-owned task defaults.
- Preserve `thesis-manager` as the authority for `qdd-close`, especially for artifact promotion, context carry-forward, and next-step framing.
- Ensure executor behavior no longer depends on policy-owned default execution skills.
- Update instruction generation, bootstrap scaffolds, and validation so they reflect the new command/role contract.
- Keep the current bounded `qdd skills suggest` surface available as planning-time support if present, without making it the executor path.

### Out Of Scope

- Defining the actual content of domain brain skills; that will be authored separately.
- Redesigning task-local executor skill metadata or the current executor skill catalog in this slice.
- Introducing a new planner object, router service, or hidden orchestration layer.
- Changing study/task Markdown semantics beyond the policy and instruction boundary needed here.

## Evidence Standard

This change is successful when:

- `.qdd/layer-policy.yaml` becomes materially simpler and easier to read,
- `qdd-start` and `qdd-close` both clearly resolve to `thesis-manager`,
- `qdd-propose` and `qdd-explore` clearly resolve to `study-brain`,
- `qdd-apply` clearly resolves to `executor`,
- study-planning defaults can still be injected through role-level skill defaults,
- executor-time instructions no longer depend on policy-level required or optional execution skills,
- and validation plus tests enforce the new contract without leaving stale layer semantics behind.

## Shared Context

- The current implementation still treats `.qdd/layer-policy.yaml` as a layer-oriented truth source with `project`, `study`, and `task` sections plus command mappings.
- In practice, that policy mainly feeds `instructions.ts` and `validate` rather than driving a real orchestration engine.
- The user wants to keep `thesis-manager` as the closure authority because closure is where artifact promotion and project-level carry-forward judgment actually happen.
- The user does not want to couple domain brain content tightly to QDD internals.
- Planning defaults are useful; executor defaults are not. Task execution should depend on `task.md` skill declarations, not on broad policy-owned execution bundles.
