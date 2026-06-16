---
name: thesis/frontier-planning
description: Project-level QDD thesis-manager protocol for deciding whether the whole research frontier should continue, stop, or escalate after qdd-start or qdd-close. Use only for thesis-manager role decisions, never as a study-brain or executor task skill.
---

# thesis/frontier-planning

## When To Use

Use this skill only in thesis-manager phases:

- `qdd-start`: establish the project frontier and the first actionable direction
- `qdd-close`: decide what the closed study changed and whether the project should continue

Do not use this skill during `qdd-propose`, `qdd-explore`, or `qdd-apply`.
Do not write `thesis/*` into task `skills:`.
Do not treat this as an executor skill.

## Role In QDD

This skill sits above study-brain planning.

- thesis-manager decides project frontier state and next candidate directions
- study-brain turns one selected candidate into a bounded study and task graph
- executor runs task-local problem skills and produces evidence

The thesis layer should not micromanage task implementation. Its job is to keep the project pointed at a judgeable research frontier.

## Required Inputs

Before making a frontier decision, read:

1. `contract.yaml`
2. `evolution.yaml`
3. `context/resources.md`
4. recent `context/memory/*.md`
5. current `study.md` and task files when closing a study
6. relevant study outputs and promoted artifacts

If persisted evidence conflicts with a desired story, trust persisted evidence.

## Lightweight Decision Contract

Reason explicitly with these fields:

```yaml
decision: continue | stop | needs-human
change_type: refinement | confirmation | pivot | dissolution
summary: string
open_boundaries:
  - string
next_candidates:
  - question: string
    expected_signal: string
    strategy: serial-deepen | evidence-fanout | explore-then-synthesize | validation | robustness | pivot
stop_reason: string
```

For the current implementation, keep `evolution.yaml` compatible with string candidates. Persist next candidates as compact strings such as:

```text
Question: Does X validate in cohort Y? Expected signal: the same compartment-level marker program appears with matched direction. Strategy: validation.
```

Put richer rationale in `context/memory/STUDY-XXX.md`, not in `evolution.yaml`.

## Project Lifecycle As Reasoning Guidance

Use the project lifecycle as a thinking scaffold, not as a machine status field.
Do not add a required `project_phase` schema unless the runtime explicitly supports it.

- `exploration`: the project is still finding data anchors, stable signals, and tractable directions.
- `main evidence`: a central result exists, but it still needs validation, boundary clarification, or robustness checks.
- `story enrichment`: the central model is mostly locked. Next studies should enrich the story through validation, robustness, mechanism triage, functional consequence, or negative controls.
- `synthesis-ready`: the story has a stable central model plus enough enrichment and boundary evidence. Remaining questions are mostly new-modality, new-data, experimental, or marginal-detail future directions.
- `closed`: no more auto studies should be proposed.

Finding a central model is not enough to stop. It usually means the project should enter story enrichment.
Stopping becomes appropriate only after the central model is supported, enriched, and bounded well enough that more automatic studies are unlikely to substantially change or strengthen the story with current resources.

## Decision Meanings

- `continue`: at least one executable next candidate remains that is likely to validate, enrich, stress-test, or redirect the central model within available data/resources.
- `stop`: no executable next candidate should remain for auto mode, even if unresolved boundaries are preserved as limitations or future directions.
- `needs-human`: the state is contradictory, unsafe, or not judgeable from available evidence.

In auto mode, `needs-human` is exceptional. Do not use it for ordinary uncertainty, weak confidence, or a normal need for validation. Use it when continuing would require a human value judgment, private data decision, unsafe action, or resolving contradictory persisted state.

Project-level `stop` should leave no executable next candidates. It may still leave open boundaries when those boundaries are better carried as limitations, future directions, or new-modality requirements than automatic next studies.

## Change Type

Choose one:

- `refinement`: the project question became narrower or more precise.
- `confirmation`: the study stabilized the current direction but meaningful follow-up may still exist.
- `pivot`: the evidence points to a meaningfully different next question.
- `dissolution`: the current study question or local hypothesis collapsed because its premise failed or it cannot be answered with available resources.

`confirmation` is not automatically terminal. A study can confirm the current direction and still justify validation, deeper mechanism work, or robustness checks.

`dissolution` is not automatically project-terminal. It is terminal only when the whole project frontier has no executable next candidate worth pursuing in auto mode. If the local hypothesis dissolved but the project can still continue, the next candidate must move away from the failed premise through validation, robustness, pivot, functional consequence, or a data-feasibility/public-data step.

Do not use `needs-human` merely because a study produced a negative result. In auto mode, a negative result with a clear validation, robustness, pivot, or data-feasibility next candidate should remain `continue`.

## Candidate Requirements

Keep only 1-3 next candidates.

Each candidate must include:

- `question`: the next bounded question study-brain can turn into a study
- `expected_signal`: what observation would make the next study meaningful
- `strategy`: one of the allowed frontier strategies

Do not write topic-only candidates. A candidate without an expected signal is not judgeable.

Do not write a candidate merely because a question remains scientifically interesting.
If the question requires a new modality, unavailable dataset, experimental perturbation, or substantial external decision, usually preserve it in memory as a limitation or future direction instead of forcing auto continuation.
Open boundaries may remain open without becoming next candidates.

## Frontier Strategies

Use the smallest strategy that fits:

- `serial-deepen`: continue down the same mechanism chain with a more precise next question.
- `evidence-fanout`: test one anchor conclusion from multiple downstream angles.
- `explore-then-synthesize`: allow a bounded exploratory pass, then consolidate positive evidence.
- `validation`: check whether a result holds in another dataset, cohort, compartment, or method.
- `robustness`: stress-test sensitivity to preprocessing, thresholds, models, labels, or negative controls.
- `pivot`: move to a different question because the current premise is weak or displaced by stronger evidence.

## Expected Signal

Expected signal is the main guard against vague auto continuation.

Good expected signals are observable and falsifiable:

- "The same fibroblast inflammatory program is enriched in non-responders across an independent UC cohort."
- "Spatial neighborhoods around damaged crypts show higher ligand-receptor support than matched non-damaged neighborhoods."
- "The proposed marker set labels the same cell state after reference transfer and manual marker review."

Weak expected signals are not enough:

- "More analysis will be done."
- "Find interesting genes."
- "Investigate mechanism."

If no expected signal can be stated, the candidate is not ready for auto continuation.

## Close-Time Reasoning Order

When closing a study:

1. State what the study actually established.
2. Estimate the project lifecycle stage in reasoning prose.
3. Decide `change_type`.
4. Decide project-level `decision`.
5. List unresolved open boundaries, if any.
6. Keep 1-3 executable next candidates with expected signals and strategies only when they are worth automatic continuation.
7. If `decision: stop`, explain `stop_reason` and leave no executable candidates.
8. Persist sparse candidates into `evolution.yaml` through `qdd close-study`.
9. Persist richer reasoning into `context/memory/STUDY-XXX.md`.

## Calibration Cases

- UC-like enriched central story: if a stable main model has been validated, enriched, and bounded by multiple negative mechanism studies, remaining new-modality upstream questions can be parked as future directions and the project can become synthesis-ready.
- PD-like unresolved feasibility frontier: if the current actionable question is still whether available data can support the next core claim, continue until that feasibility verdict is known.

## Anti-Patterns

- Stopping only because a study used `confirmation`.
- Continuing with a topic-only next candidate.
- Continuing solely because an open boundary exists.
- Stopping immediately after the first central result before story enrichment.
- Treating every unresolved uncertainty as `needs-human`.
- Writing thesis planning skills into task `skills:`.
- Expanding `evolution.yaml` into a heavy planning document.
- Letting runtime heuristics override a clear, executable thesis decision.
