## Question Before

How should QDD harden its core scRNA and spatial executor skills so heavy graph-based analyses are explicit about dependencies, can use multiple CPU cores predictably, and stop bloating saved AnnData outputs through `.raw` duplication?

## Question After

How should QDD keep its executor skills explicit, graph-first, and memory-bounded while still leaving room for targeted compatibility reads from externally supplied objects when needed?

## Change Type

refinement

## Change Driver

The main driver is that three issues that look separate in code are actually one operational boundary: hidden fallback backends, weak threading control, and `.raw` duplication all make executor behavior harder to predict. Tightening them together produces a smaller, clearer contract than patching each one opportunistically.

## Open Boundaries

- Whether all remaining `.raw`-aware downstream options should stay as compatibility-only reads or be deprecated more aggressively in a later slice
- Whether the P0 thread bootstrap should become a shared helper module instead of repeated script-local logic
- Whether additional heavy skills outside the current P0 set should adopt the same thread contract immediately after this slice
- Whether QDD should later expose a more explicit environment validation step for skills that require shipped dependencies such as `squidpy` or `scvelo`

## Evidence Summary

This slice is expected to produce a narrower and more honest executor contract:

- spatial graph skills use one intended backend instead of hidden homemade fallbacks,
- heavy graph workflows expose auditable thread controls and optional UMAP skipping,
- and QDD-generated outputs stop duplicating matrices into `.raw`.

If implemented cleanly, that should reduce environment-dependent divergence, improve runtime behavior on multi-core machines, and prevent avoidable memory inflation in saved `h5ad` artifacts.

## Recommended Next Step

Implement the change, then validate it on at least one realistic scRNA path and one realistic spatial path that exercise:

- graph clustering without mandatory UMAP,
- explicit multi-thread execution,
- a spatial graph skill that now requires `squidpy`,
- and output inspection confirming that `.raw` is not authored or propagated by QDD-generated objects.
