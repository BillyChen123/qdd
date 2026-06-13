## Question Before

Should auto mode stop whenever the latest close event has `kind: dissolution`, even if the thesis-manager preserved executable next candidates or open boundaries?

## Question After

Should auto mode treat `dissolution` as terminal only when no executable continuation remains?

## Change Type

refinement

## Change Driver

The UC anti-TNF test exposed a mismatch between scientific closure and runtime routing.

`STUDY-004` correctly rejected a local hypothesis: a discrete `NOTCH+stem` epithelial subpopulation was not supported. The close agent also preserved meaningful next candidates: validation in `GSE282122`, integration robustness, and a pivot to the stronger `FN1+` stromal signal.

Runtime then stopped because it treated `dissolution + continuation signals` as contradictory. That is too strict for open-ended research. In QDD, a local hypothesis can dissolve while the project continues through validation, robustness, or pivot.

## Open Boundaries

- Whether future work should add structured candidate objects instead of string candidates.
- Whether future work should add a manual `qdd steer` command to reorder or rewrite next candidates.
- Whether future work should add long-task monitoring or auto resume.

These are not required to fix the current false terminal behavior.

## Evidence Summary

Current implementation evidence:

- `checkTermination()` contains a special case that terminal-stops on `last_kind === 'dissolution'` when continuation signals exist.
- `thesis/frontier-planning` already says `dissolution` is usually terminal unless the next candidate clearly pivots away from the dissolved question.
- The UC project has exactly that pattern: `dissolution` plus candidates for validation, robustness, and pivot.
- `qdd status --json` already exposes all required fields; no new file shape is needed.

The correct minimal fix is to align runtime with the thesis skill:

```text
dissolution + candidates/open boundaries -> continue
dissolution + none -> stop
```

Prompt updates should reduce bad continuations by telling agents not to keep digging in the rejected premise.

## Recommended Next Step

Apply this change by modifying runtime termination logic, updating thesis/close/propose guidance, and adding regression tests plus the UC dry-run check.
