## Question Before

QDD's implementation is readable only with too much cross-file context because major business logic is still concentrated in large runtime modules that mix state transitions, file rewriting, validation, rendering, and command-facing behavior.

## Question After

QDD keeps the same protocol and CLI semantics, but each major responsibility has a clear home: file contracts own managed-file structure, services own study/task/artifact/closure transitions, render owns research-map output, and commands stay thin.

## Change Type

refinement

## Change Driver

Repeated protocol work has exposed the real maintenance bottleneck: semantics are now clearer than the code structure that implements them. Without a source-level responsibility split, each new change keeps reopening the same large files and raises regression risk.

## Open Boundaries

- Whether `src/runtime/inspection.ts` should remain one aggregator or later be split further after this structural refactor lands
- Whether bootstrap prompt assets need a cleaner asset layer beyond the current runtime prompt directory
- Whether remaining runtime infrastructure helpers should later move under a dedicated `infra/` namespace

## Evidence Summary

This change should leave behind:

- explicit service ownership for study/task/artifact/closure logic,
- a dedicated research-map renderer,
- a split type surface with a stable barrel,
- thinner command modules,
- and managed-file defaults/examples living with file contracts instead of orchestration code.

The important negative guarantee is equally explicit: no protocol redesign, no new workflow semantics, and no CLI surface churn.

## Recommended Next Step

Implement the refactor in small, test-backed moves, then validate parity through build/tests and a quick code-map read-through before archiving.
