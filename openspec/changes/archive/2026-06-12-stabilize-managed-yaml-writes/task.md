## Task Goal

Implement a lightweight guardrail set that keeps QDD managed Markdown/YAML writable by agents but prevents malformed frontmatter or managed YAML from corrupting auto-mode state.

## Study Link

Supports the study question: "Can QDD make auto-mode managed-file writes robust against malformed YAML frontmatter without adding broad structured update commands?"

## Method

1. Update managed-file contract guidance and examples.
2. Update workflow prompts and instruction rules that agents actually read during propose/apply.
3. Add write-time parse preflight for managed paths in the auto runner.
4. Add focused tests for the new behavior.

## Expected Outputs

- Updated `src/file-contracts/shared.ts` schema-reference rendering with general safe YAML guidance.
- Updated `src/file-contracts/task.ts` with `## Result Summary` in task bodies and clearer `result_summary` semantics.
- Updated `src/file-contracts/study.ts` notes distinguishing short frontmatter from body narrative.
- Updated `src/file-contracts/artifact-candidates.ts` notes/examples for safe natural-language YAML values.
- Updated `src/runtime/bootstrap-prompts/qdd-propose.md` and `src/runtime/bootstrap-prompts/qdd-apply.md`.
- Updated `src/services/instructions.ts` runtime rules.
- Updated `src/runtime/agent-runner.ts` to reject invalid managed writes before writing to disk.
- Updated `src/test/smoke.test.ts` coverage.
- Regenerated `dist/` through `npm run build`.

## Run Contract

Implementation must preserve existing CLI behavior unless a managed write is syntactically invalid.

The managed write preflight should:

- apply only to QDD managed paths, not all files
- parse Markdown frontmatter for managed `.md` files
- parse YAML for managed `.yaml` files
- reject invalid content with an actionable parser error
- avoid writing invalid content to disk

Verification should include:

- `npm run build`
- `npm test`
- `git diff --check`

## Failure / Blocker Conditions

- The implementation changes generated `.qdd/instructions.md` checklist content despite the explicit scope exclusion.
- The implementation adds broad structured update CLI commands.
- Ordinary research outputs such as scripts, tables, reports, and figures are blocked by the managed-write validator.
- Strict `qdd status` or `qdd validate` behavior is weakened.
- Existing tests fail without a deliberate and justified test update.
