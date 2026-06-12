## Question

Can QDD make auto-mode managed-file writes robust against malformed YAML frontmatter without adding broad structured update commands?

## Hypothesis / Expectation

Yes. The failure mode is mostly caused by free-form natural language being written into YAML frontmatter or managed YAML without safe quoting. A small change that combines clearer schema examples, prompt guidance, and write-time parse checks should prevent the common failures while preserving QDD's lightweight editing model.

## Inputs

- Current managed-file contract sources under `src/file-contracts/`.
- Workflow prompts under `src/runtime/bootstrap-prompts/`.
- Agent runner write tool in `src/runtime/agent-runner.ts`.
- Existing validation behavior in `src/services/inspection.ts`.
- Existing tests in `src/test/smoke.test.ts`.
- User constraint: do not modify the generated `.qdd/instructions.md` checklist in this change.
- User preference: avoid adding heavy `update-task` / `update-study` CLI commands unless later evidence shows prompt/schema/runtime guardrails are insufficient.

## Evidence Plan

The implementation should produce:

- task schema/example with a body-level `## Result Summary` section.
- schema notes that distinguish short machine frontmatter from long Markdown narrative.
- artifact candidate guidance/examples that show safe natural-language YAML values.
- workflow prompt updates for `qdd-propose` and `qdd-apply`.
- instruction-rule updates from `src/services/instructions.ts`, excluding generated `.qdd/instructions.md` checklist edits.
- auto runner managed-write preflight validation.
- tests proving invalid managed writes are rejected before they corrupt project state.

## Blockers

- Need to keep compatibility with existing projects that already contain `result_summary` in task frontmatter.
- Need to avoid over-validating ordinary analysis outputs such as CSV, JSON, scripts, figures, or reports.
- Need to avoid weakening strict status/validation gates.

## Exit Signal

The study is complete when the implementation plan is precise enough for apply mode and the resulting task list can be executed without open design ambiguity.
