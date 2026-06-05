## 1. Evidence Packaging

- [x] 1.1 Define the study output convention for `code/`, `figures/`, `tables/`, and `reports/` under `studies/STUDY-XXX/output/`.
- [x] 1.2 Update task scaffolds and `qdd-apply` guidance so substantive analyses preserve scripts and visual claims preserve key figures.
- [x] 1.3 Update default instructions so agents understand the difference between local study outputs and promoted artifacts.

## 2. Artifact Candidate Promotion

- [x] 2.1 Add a machine-readable `studies/STUDY-XXX/output/artifact-candidates.yaml` contract for explicit promotion candidates.
- [x] 2.2 Add runtime helpers to read, validate, and deduplicate candidate entries by normalized project-relative path.
- [x] 2.3 Extend `qdd close-study` to register missing reusable candidates before finalizing `question_delta` and study closure.
- [x] 2.4 Keep promotion explicit and selective; do not blind-scan or auto-register every file in `output/`.

## 3. Validation And Dogfood

- [x] 3.1 Extend tests or smoke coverage for packaged scripts, figures, and closure-time promotion.
- [x] 3.2 Update `docs/02-code-prototype-map.md` and related usage notes to explain the new evidence packaging flow.
- [x] 3.3 Re-run the `tmp/test_qdd` style dogfood loop and verify that the study output is reviewable and `artifacts/index.yaml` captures only the promoted evidence.
