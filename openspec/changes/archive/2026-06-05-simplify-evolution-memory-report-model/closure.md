## Question Before

How should QDD represent question evolution, study narrative, and research-map rendering without confusing `evolution`, `memory`, and `report` responsibilities?

## Question After

How should QDD keep `evolution.yaml` as a sparse project truth source while making `context/memory/STUDY-XXX.md` the only default study narrative report and deriving `research-map.html` from that sparse state alone?

## Change Type

pivot

## Change Driver

Recent benchmark feedback showed that the current project-state model is carrying too many overlapping responsibilities:

- `evolution.yaml` mixes structured history with narrative intent
- default study reporting is not clearly anchored to one file
- research-map rendering is not reliably tied to the right truth source

The user explicitly wants semantic simplification, not another round of compatibility-driven patching.

## Open Boundaries

- Whether `contract.yaml` should later move to a markdown-first contract surface
- Whether project-level auto mode needs a future stop-gate model beyond per-study closure
- How much legacy migration support QDD should provide for projects created under older evolution semantics

## Evidence Summary

- The user wants `evolution.yaml` to record sparse question and boundary state only
- The user wants `context/memory/STUDY-XXX.md` to carry close-time narrative, promoted artifacts, reused context, used skills, and next-study suggestions
- The user does not want a separate default report artifact competing with memory
- The research map remains useful, but only if it renders purely from the simplified structured source

## Recommended Next Step

Implement the simplified evolution-memory-report model first, then validate the new close-time outputs against a real QDD benchmark project before revisiting any larger project-level control logic.
