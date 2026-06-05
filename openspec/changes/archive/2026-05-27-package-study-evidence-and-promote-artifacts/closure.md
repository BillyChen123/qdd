## Question Before

QDD can already complete a study structurally, but a finished study may still lack the executable script and figure evidence needed for reproducibility, and closure does not currently promote important evidence into the reusable artifact registry.

## Question After

QDD should package study evidence by default and let `qdd close-study` promote only explicitly selected reusable outputs before final closure.

## Change Type

refinement

## Change Driver

Dogfood use exposed that the main gap is not missing lifecycle commands anymore; it is missing evidence packaging discipline and missing closure-time artifact promotion.

## Open Boundaries

- Whether a later slice should mirror promoted artifacts into canonical `artifacts/<type>/` directories rather than keeping their original study-local paths.
- Whether validation should eventually warn on missing scripts or figures before closure, or stay prompt-driven for now.
- Whether apply-time helpers should auto-create candidate entries, or whether prompt-guided manual maintenance is sufficient in the first slice.

## Evidence Summary

The current dogfood study under `tmp/test_qdd` produced reports and tables, but it did not leave behind the expected analysis script or figure output for the main biological judgment, and closure only updated study state plus `evolution.yaml`. The next thin slice should therefore focus on evidence packaging and explicit promotion rather than expanding the workflow model.

## Recommended Next Step

Implement output packaging conventions first, then add candidate-manifest-driven promotion inside `qdd close-study`, and finally dogfood the same study path again to verify that the artifact registry remains selective but reproducible.
