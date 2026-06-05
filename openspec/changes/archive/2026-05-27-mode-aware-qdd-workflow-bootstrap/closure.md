## Question Before

How should QDD bootstrap its workflow surfaces when the current prompts are too thin, `qdd-explore` still feels like an immediate editing step, and the system blurs together artifact templates, workflow guidance, and hardcoded task scaffolds?

## Question After

QDD can bootstrap mode-aware workflow surfaces by treating `contract.yaml.mode` as the authority signal, making `qdd-propose` write the first-pass `study + initial task`, keeping `qdd-explore` discussion-first in `human` and `assist` mode, making `qdd-apply` execute the approved current `study/task` set, and separating template-constrained artifacts from long-form workflow guidance.

## Change Type

refinement

## Change Driver

Dogfood feedback from the first real prototype run, plus direct comparison against OpenSpec skills, showed that installed prompts, skills, and shared instructions were structurally close but behaviorally wrong at the workflow boundaries and too thin to be dependable.

## Open Boundaries

- whether `assist` should stay fully confirmation-gated or later gain a limited auto-apply path
- whether `qdd-apply` should ever be allowed to append a minimal new task during execution, or always return to `qdd-explore` in human/assist mode
- whether a future slice should add an explicit helper for confirming an explore plan
- separate follow-up work for artifact-registry simplification and context seeding

## Evidence Summary

The current repository already has the needed CLI and bootstrap infrastructure. The main gap is behavioral and structural: the generated assets do not yet encode the intended authority model, the prompts are too terse, `study/task` templates are not clearly separated from workflow guidance, and the default task checklist is hardcoded into every new task. Existing specs already support QDD-native bootstrap reuse, and the user feedback in `tmp/test_qdd/` plus the OpenSpec skill references give a concrete target for the correction.

## Recommended Next Step

Apply this change to rewrite the shared instructions, externalize and expand the workflow prompt source, realign the workflow boundaries, and weaken the default task checklist scaffold; then open a separate proposal for artifact simplification and project-context onboarding.
