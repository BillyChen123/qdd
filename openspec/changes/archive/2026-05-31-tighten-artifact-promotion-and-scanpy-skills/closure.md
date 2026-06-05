## Question Before

How should QDD flatten shared data storage under `artifacts/data/`, promote reusable outputs into canonical artifact locations at closure time, expose a layer-aware role policy to agents, and seed a first practical scanpy/plot skill baseline for single-cell studies?

## Question After

How should QDD use canonical artifact storage and layer-owned role defaults to make one single-cell study more reproducible, auditable, and methodologically disciplined without adding a heavier orchestration layer?

## Change Type

<!-- refinement | confirmation | pivot | dissolution -->

refinement

## Change Driver

The key driver is that data placement, promotion behavior, and skill loading are not separate implementation details. Together they determine whether study execution remains grounded in reusable evidence and credible domain defaults. The single-cell clustering example made this concrete: weak skill injection left room for an unprofessional default method choice.

## Open Boundaries

- Whether canonical promotion should use symlinks, hard links, or simple copy-then-delete fallback when cross-filesystem moves fail
- Whether command-aware instructions should remain backward-compatible without `--command` or require explicit command selection over time
- How far the first-wave single-cell skill set should go before adding scvi, batch integration, or trajectory-specific guidance
- Whether artifact index entries should later record the original pre-promotion path in addition to the canonical path

## Evidence Summary

This slice is expected to tighten four linked areas:

- one shared project-local data surface under `artifacts/data/`,
- true canonical relocation during artifact promotion,
- non-empty required and optional layer-owned skill exposure through `.qdd/layer-policy.yaml`,
- and first-wave scanpy/plot domain skills grounded in official single-cell practice.

If implemented cleanly, the result should reduce filesystem ambiguity, improve close-time evidence carry-forward, and make normal scRNA tasks less likely to drift into weak analysis choices.

## Recommended Next Step

Implement the change, then dogfood it on one realistic single-cell study that exercises:

- project onboarding into `artifacts/data/`,
- command-aware apply instructions,
- a scanpy clustering path,
- at least one promoted script and one promoted figure,
- and close-time canonical relocation into the artifact registry under project-layer judgment.
