## Question

How should QDD add its first high-quality scATAC planning and executor skill set so that h5ad-based ATAC studies can be proposed, refined, and executed with clearer scientific boundaries and more reusable outputs?

## Hypothesis / Expectation

If QDD adds one strong scATAC planning skill plus a small set of concrete executor skills, then agents will be able to:

- distinguish matrix-only, mixed multiome, and fragment-aware ATAC inputs,
- plan tasks against one stable four-stage ATAC protocol,
- execute the common h5ad-first ATAC path with clearer outputs,
- and avoid overstating fragment-level guarantees when only matrix-style inputs exist.

## Inputs

- Existing scRNA reference skills under:
  - `domain-skills/brain/singlecell/scrna-planning`
  - `domain-skills/singlecell/scrna/*`
- Existing QDD skill metadata and suggestion pipeline under:
  - `src/types.ts`
  - `src/runtime/local-skills.ts`
  - `src/commands/skills-suggest.ts`
- The benchmark-style mixed multiome example:
  - `GSE192780.h5ad`
- User requirement that the first ATAC slice should stay lightweight, h5ad-first, and skill-oriented rather than becoming a heavy framework wrapper.
- Current environment reality that full fragment-aware stacks are not yet the base assumption for QDD execution.

## Evidence Plan

This study should produce:

- one scATAC planning brain skill with a readable, durable protocol,
- a bounded first batch of executor skills with runnable scripts,
- explicit metadata requirements so `qdd skills suggest` can retrieve those skills,
- a documented contract for one reusable pre-downstream ATAC object,
- and clear documentation about where matrix-only analysis ends and fragment-aware requirements would begin.

## Blockers

- Current ATAC inputs may mix RNA and peaks in the same h5ad and need repair before downstream work.
- The controlled skill tag set may need extension before the new skills can be surfaced cleanly.
- The current Python analysis environments are not yet guaranteed to provide a clean, fragment-native ATAC stack.
- A first slice must stay narrow enough to implement well, rather than pretending to cover the whole ATAC ecosystem.

## Exit Signal

This study is ready to move into closure when:

- the scATAC planning brain skill is written at the same quality bar as the current scRNA planning skill,
- the first executor skills are concrete enough to run and inspect,
- the metadata and retrieval path for those skills are explicit,
- and the study makes the h5ad-first ATAC boundary scientifically honest instead of vague.
