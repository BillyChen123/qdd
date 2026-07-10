# Parkinson Conclude Oracle

This fixture is a versioned quality oracle for conclude. It is intentionally smaller than the full local Parkinson QDD project and does not prescribe a single correct manuscript.

## Contents

- `oracle.json`: expected scientific facts, story relationships, claim limits, required signals, and hard failures.
- `story-shape.md`: a good narrative pattern derived from the project report `ART-166`.
- `bad-draft-excerpts.md`: excerpts from a known failed conclude draft and why each excerpt must fail.

## Source Lineage

The initial oracle was curated from these local evaluation sources on 2026-07-10:

- `/data/chenyz/project/panrank_tmp/project/case/Parkinson/artifacts/reports/ART-166-parkinson_rna_processing_storyline_draft_bilingual.md`
- `/data/chenyz/project/panrank_tmp/project/case/Parkinson/conclusions/eval-2026-07-07T15-07-41-045Z/paper_rewriting_output/final_paper/main.tex`
- `/data/chenyz/project/panrank_tmp/project/case/Parkinson/conclusions/eval-2026-07-07T15-07-41-045Z/conclude_eval.md`

Those paths document provenance; CI must not require them. The repository copies are the stable review surface.

## Evaluation Rule

The full Parkinson project is an end-to-end input, not the oracle. A future evaluator should compare generated claims and visible manuscript prose against this fixture.

- Deterministic checks should catch forbidden identifiers, placeholders, fragments, citation mismatches, and missing figure/value support.
- Semantic review should assess whether the expected relationships form a coherent contribution and whether claim limits are respected.
- Hard failures override aggregate scores.
- Exact wording and section length must not be scored as golden-text similarity.

`ART-166` is a story-structure reference rather than a perfect paper. Nature-family papers may be used during human calibration, but should not be copied into this fixture or treated as domain-independent expected output.
