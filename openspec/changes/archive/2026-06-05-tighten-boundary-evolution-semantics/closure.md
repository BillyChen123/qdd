## Question Before

How should QDD keep `evolution` and `boundaries` from drifting into overlapping or stale state as studies pivot?

## Question After

How should QDD treat `evolution` as current-question history, `boundaries` as the current frontier graph, and make close-time persistence plus planning prompts enforce that model end to end?

## Change Type

refinement

## Change Driver

Recent benchmark runs showed that the existing implementation had the right files but not yet the right semantics:

- studies could be framed as bounded slices of a broader question,
- but close still derived `question_before` from the study-local slice,
- boundary updates could be forgotten as a separate manual step,
- and score output was not explicit enough during planning discussions.

This slice narrows the model without adding new ontology:

- keep the same core QDD objects,
- fix their responsibilities,
- and harden runtime ordering so the visible protocol matches the intended research semantics.

## Open Boundaries

- Whether later validation should add lightweight heuristics for catching workflow-step-like boundary text
- Whether score output should later be captured as a structured study-local planning artifact
- Whether future slices need richer frontier rewrite actions than `add / narrow / resolve / dissolve`

## Evidence Summary

- The current runtime already has separate truth sources for `evolution` and `boundaries`.
- The main gap is semantic discipline plus close-time persistence.
- The user wants boundaries to be useful guidance, not decorative workflow metadata.
- Fixing the order and prompt contract is enough for the next thin slice.
