## Question

How should QDD ensure that a finished study preserves reproducible analysis evidence locally and promotes only the key subset into reusable artifacts at closure?

## Hypothesis / Expectation

If QDD adds a small output packaging convention plus an explicit artifact-candidate manifest, then a study can remain readable and reproducible without flooding `artifacts/index.yaml` with every intermediate file.

## Inputs

- Current lifecycle code in `src/runtime/lifecycle.ts`
- Current bootstrap prompts in `src/runtime/bootstrap-prompts/qdd-apply.md` and `qdd-close.md`
- Current instructions defaults in `src/runtime/defaults.ts` and `src/runtime/instructions.ts`
- Dogfood evidence from `tmp/test_qdd/studies/STUDY-001/`
- Product intent in `docs/00-product-requirements-document.md`

## Evidence Plan

- Define the required study-local evidence shape for code, figures, tables, and reports.
- Define the explicit promotion boundary between local outputs and reusable artifacts.
- Specify the `artifact-candidates.yaml` contract and close-study promotion behavior.
- Update prompts, instructions, and scaffolds so agents actually produce the expected evidence.
- Add tests proving that a study can close with packaged evidence and promoted artifacts.

## Blockers

- Whether promoted artifacts should continue pointing at study-local paths in this slice, or whether a later slice should mirror them into `artifacts/code`, `artifacts/figures`, and related directories.
- How strict validation should be when a task legitimately has no figure requirement.

## Exit Signal

This study is complete when the implementation path is clear enough to make one dogfood study leave behind a reproducible script, the necessary figure/report evidence, and a concise promoted artifact set during closure.
