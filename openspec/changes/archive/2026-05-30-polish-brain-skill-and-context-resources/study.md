## Question

How should QDD represent domain prior knowledge and durable analyst preferences so the first single-cell planning brain becomes more usable and `qdd-start` can populate one readable context document without creating a second memory system?

## Hypothesis / Expectation

If QDD keeps workflow semantics inside `qdd-propose` and `qdd-explore`, rewrites the brain skill as a domain-prior and executor-skill selection guide, and expands `context/resources.md` into a clearer project-facts-plus-preferences scaffold, then planning will stay more legible, domain guidance will be easier to maintain, and future skills will have one obvious context file to read.

## Inputs

- The current `domain-skills/brain/study-planning-core/SKILL.md` draft
- The current `context/resources.md` scaffold defined in runtime defaults
- Existing `qdd-start`, `qdd-propose`, and `qdd-explore` prompt semantics
- Current tests and inspections that already require `context/resources.md`

## Evidence Plan

- A revised change contract that clearly separates QDD workflow semantics from brain-skill domain priors
- A concrete target shape for `context/resources.md` with explicit project-fact and analyst-preference sections
- An implementation checklist that updates defaults, prompts, and tests consistently

## Blockers

- The repository currently encodes `resources.md` section names in tests and defaults, so any scaffold change must be reflected consistently.
- The brain skill is still sparse and informal, so tightening it requires choosing a content boundary before wording can be polished.
- If the change overreaches into workflow semantics, it will recreate the same overlap the user is trying to avoid.

## Exit Signal

This study is ready to move into apply when the change artifacts make these implementation targets explicit:

- `study-planning-core` becomes a sidecar domain-prior skill rather than workflow duplication
- `context/resources.md` gains a stable section layout for facts plus durable preferences
- `qdd-start` and associated tests are updated to reflect the new scaffold without introducing a new memory subsystem
