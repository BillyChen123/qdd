## Question Before

How should QDD manage role defaults and closure authority without overcomplicating policy?

## Question After

How should QDD keep a minimal command-to-role policy where planning defaults belong to `study-brain`, execution stays task-local, and closure authority remains `thesis-manager`?

## Change Type

refinement

## Change Driver

The current layer-heavy policy model carries more abstraction than the runtime truly needs. The user wants to preserve `thesis-manager` for closure and keep planning defaults, but does not want layer-level execution policy complexity.

## Open Boundaries

- The exact content and directory structure of domain brain skills remains intentionally out of scope for this change.
- The planning-time skill suggestion surface may remain as-is in this slice, so long as it stays outside executor-time execution.
- Future protocol cleanup may rename `.qdd/layer-policy.yaml` itself, but this change only simplifies its semantics.

## Evidence Summary

- Runtime inspection shows the current policy mostly feeds `instructions.ts` and validation rather than a deep orchestration engine.
- The user explicitly wants `thesis-manager` preserved for closure authority.
- The user also explicitly prefers default planning skill injection only at the brain layer, not broad executor defaults.

## Recommended Next Step

Implement the simplified role policy first, then let the user draft domain-specific brain skill content against the cleaner contract.
