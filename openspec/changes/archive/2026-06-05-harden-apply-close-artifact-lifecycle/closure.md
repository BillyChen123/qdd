## Question Before

How should QDD prevent apply/close from feeling unreliable when final outputs remain in scratch space, reusable evidence is not promoted cleanly, and closure still depends on manual interruption?

## Question After

How should QDD treat apply and close as one explicit artifact lifecycle in which apply packages final truth, close promotes only explicit canonical candidates, and successful closure cleans scratch state automatically?

## Change Type

refinement

## Change Driver

Recent real-case testing exposed one concrete contract gap rather than several unrelated bugs:

- final truth was not always packaged into canonical study output directories,
- close-time promotion did not fully elevate code/data/table evidence,
- temporary h5ad files accumulated in scratch locations,
- and closure still depended on an extra human approval edge.

These failures all live on the same boundary: the apply-to-close artifact lifecycle.

## Open Boundaries

- The exact study-local back-link mechanism after promotion still needs an implementation choice.
- Cleanup rules should focus on large scratch truth such as temporary h5ad outputs first; later proposals may extend cleanup heuristics.
- This slice hardens the generic lifecycle, not domain-specific skill output conventions beyond the required packaging targets.

## Evidence Summary

- QDD already has canonical study output folders and explicit artifact candidates, so this slice can refine behavior instead of introducing a new architecture.
- Real studies currently lose reliability when final truth stays in `tmp/`, when `table` is not treated as first-class, and when close cannot finish end to end.
- The requested fix is narrow and practical: stronger contracts, stronger promotion, direct close after preflight, and scratch cleanup.

## Recommended Next Step

Apply this slice by:

- adding `table` to artifact contracts,
- hardening candidate-path and promotion rules,
- removing the extra close confirmation gate,
- canonicalizing promoted outputs into `artifacts/*`,
- and cleaning heavy scratch leftovers after successful close.
