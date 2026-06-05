## Question

How should QDD make study execution and closure deterministic enough that reusable data, code, figures, and tables reliably survive into canonical artifacts, while scratch-heavy execution remains possible during apply?

## Hypothesis / Expectation

If QDD hardens the apply/close boundary around one explicit final output surface, explicit artifact candidates, direct close after preflight, and canonical promotion into `artifacts/*`, then real studies will stop losing reusable evidence to scratch folders, missed promotion, or manual closure friction.

## Inputs

- Real benchmark feedback showing:
  - close still depended on human interruption,
  - code and data promotion were incomplete,
  - temporary h5ad files accumulated in study scratch space,
  - tables lacked a first-class artifact type,
  - final study outputs were not consistently packed into one clean structure
- Current runtime modules for:
  - evidence packaging
  - artifact registration and promotion
  - close-study preflight and execution
  - instruction and prompt generation
- Current managed-file contracts and generated examples

## Evidence Plan

This study should produce:

- one explicit protocol for canonical study output packaging and close-time promotion
- one implementation checklist covering contract, runtime, prompt, and cleanup work
- clear treatment of `table` as a first-class artifact type
- explicit rejection of `tmp/` candidates
- verification that close can run end to end without an extra manual confirmation step

## Blockers

- The current lifecycle is split across prompts, runtime checks, and artifact helpers, so the change must stay coherent across all three.
- Back-link preservation after promotion needs one concrete implementation choice, but the proposal should stay outcome-oriented instead of prematurely locking the exact mechanism.
- Scratch cleanup must be aggressive enough to remove heavy leftovers without deleting final truth.

## Exit Signal

This study is ready to move into apply when the change artifacts make these targets explicit:

- apply must package final truth into canonical study output folders
- close must promote only explicit candidates and reject scratch paths
- close must run directly after preflight
- successful close must leave canonical artifacts plus a readable study-local trail, not a broken or bloated output tree
