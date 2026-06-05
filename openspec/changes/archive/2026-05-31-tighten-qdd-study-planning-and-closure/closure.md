## Question Before

QDD currently blurs together three different situations: one study with one real hypothesis, one incomplete starter-task scaffold, and one execution loop that may need more within-study work before closure. That makes it unclear when more tasks should have been planned up front, when apply may continue on its own, and when closure should be allowed to record a refined question.

## Question After

QDD should treat one study as one bounded hypothesis package, plan the full first-pass task graph up front, keep ordinary within-study continuation inside `qdd-apply`, and allow `qdd-close` to finalize a study once the question has been explicitly updated, even if the original claim was only partially proven.

## Change Type

refinement

## Change Driver

Dogfood feedback from the HGSOC benchmark case exposed that the current semantics are internally inconsistent: propose under-plans the study, apply performs more work than the declared task graph says, close becomes too conservative to register artifacts and write `question_delta`, and the resulting provenance is weaker than the user expects for real research review.

## Open Boundaries

- Whether future slices should add a dedicated command for appending approved new tasks inside an already-open study, rather than keeping that behavior entirely inside prompt guidance.
- Whether closure should eventually warn when a multi-task study never advanced beyond its preparatory tasks.
- How aggressively old projects should be refreshed when their bootstrapped prompts still encode the one-starter-task default.
- Whether task-level provenance should remain optional in a few legitimate multi-producer cases or become mandatory for every promoted candidate.

## Evidence Summary

The current runtime already contains most of the needed machinery: task records, study-local output packaging, candidate-driven promotion, and explicit `question_delta` writing. The main gaps are lifecycle semantics and prompt discipline. The next thin slice should therefore realign propose/apply/close around a complete first-pass task graph, explicit refinement-capable closure, provenance-rich promotion, and clearer commented runtime logic rather than introducing a new planner model.

## Recommended Next Step

Apply this change to tighten the prompts, shared instructions, lifecycle/runtime behavior, artifact candidate provenance rules, and Chinese code comments; then re-run the HGSOC-style dogfood path to verify that one bounded hypothesis can be planned, executed, refined, and closed without falling back into implicit replanning.
