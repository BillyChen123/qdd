## Question Before

How should QDD align `evolution.yaml` and `boundaries.yaml` so the current working question and the current frontier graph stay semantically correct during propose, explore, and close?

## Question After

How should QDD keep one thin `evolution.yaml` for question-and-boundary state, move study narrative into `context/memory/STUDY-XXX.md`, and derive a readable research map without a separate boundary-governance truth source?

## Change Type

pivot

## Change Driver

Recent discussion exposed a real protocol paradox:

- human propose should remain the highest semantic authority,
- but the current system tries to evaluate propose quality through boundaries,
- while those same boundaries are themselves produced by earlier propose/close choices.

That makes the current score-centered boundary model heavier and less trustworthy than intended. The user still wants explicit project memory and visible boundaries, but no longer wants them to function as a second governance loop. This slice therefore pivots from boundary governance toward lighter state plus stronger memory.

## Open Boundaries

- Whether `contract.yaml` should later become `contract.md`
- How project-level auto mode should decide when to stop proposing new studies
- Whether QDD should later expose a thin migration command for old projects rather than breaking them outright

## Evidence Summary

- The current benchmark feedback values readable project history more than computed frontier scores.
- A per-study memory file is missing and would improve both human review and future agent carry-forward.
- The visualization remains valuable, but only if it is derived from one sparse truth source.
- The user explicitly prefers semantic simplification over preserving the current boundary-heavy runtime for compatibility.

## Recommended Next Step

Implement the simplified evolution-plus-memory model first. Revisit project-level auto-stop only after the lighter project state is working in practice.
