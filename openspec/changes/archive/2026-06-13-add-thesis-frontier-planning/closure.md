## Question Before

Should QDD auto mode rely on runtime heuristics over `last_kind`, open boundaries, and next candidates to decide whether to continue?

## Question After

Should QDD auto mode rely on a thesis-manager frontier decision, with runtime limited to validating that the decision is executable and safe?

## Change Type

refinement

## Change Driver

The current auto gate tries to infer research intent from sparse fields. This creates brittle edge cases:

- dataset-discovery studies may produce clear next candidates without formal open boundaries
- study-local confirmation may still leave follow-up work
- runtime cannot distinguish "the project is done" from "this study stabilized one result"

The thesis-manager is the right role to decide continuation because it already owns `qdd-start` and `qdd-close`, and those phases see the broadest project context.

## Open Boundaries

- Whether a later change should extend `evolution.yaml` candidates from strings to structured candidate objects.
- Whether a later `qdd steer` command should safely edit thesis decisions.
- Whether thesis decisions should eventually be exposed as a separate read-only status field.

These are deliberately out of scope for the first implementation.

## Evidence Summary

The new direction keeps the system lightweight:

- no new managed decision file
- no new auto phase
- no replacement for study-brain
- no heavy research-governance system

The main addition is a thesis skill that forces close-time reasoning to answer:

- should the project continue, stop, or escalate
- what did this study change
- what remains open
- what next question is judgeable
- what expected signal would make the next study meaningful

## Recommended Next Step

Apply this change by implementing `thesis/frontier-planning`, wiring it into thesis-manager instructions, updating close guidance, and reducing runtime gate behavior to decision validation plus operational safety checks.
