## 1. Contract And Example Guidance

- [x] 1.1 Update `src/file-contracts/shared.ts` so generated schema references include a general YAML/frontmatter safety note for managed files.
- [x] 1.2 Update `src/file-contracts/task.ts` so task bodies include a `## Result Summary` section and `result_summary` is documented as a short optional frontmatter field.
- [x] 1.3 Update `src/file-contracts/study.ts` notes to keep long question, hypothesis, blocker, and evidence prose in Markdown body sections rather than expanding frontmatter.
- [x] 1.4 Update `src/file-contracts/artifact-candidates.ts` notes and example data so hand-written natural-language `description` and `schema` values are clearly safe to serialize.

## 2. Agent Prompt And Instruction Rules

- [x] 2.1 Update `src/runtime/bootstrap-prompts/qdd-propose.md` to keep long narrative text in Markdown body sections and use quoted or block-scalar YAML when frontmatter must contain natural language.
- [x] 2.2 Update `src/runtime/bootstrap-prompts/qdd-apply.md` with the same task/status/result-summary guidance.
- [x] 2.3 Update `src/services/instructions.ts` runtime rules so auto agents receive the same guidance through `qdd instructions ... --json`.
- [x] 2.4 Do not update the generated `.qdd/instructions.md` validation checklist in this change.

## 3. Managed Write Preflight

- [x] 3.1 Add managed-path detection in `src/runtime/agent-runner.ts` for `contract.yaml`, `evolution.yaml`, `artifacts/index.yaml`, `studies/*/study.md`, `studies/*/tasks/*.md`, and `studies/*/output/artifact-candidates.yaml`.
- [x] 3.2 Before accepting a `write` tool call to a managed Markdown file, parse the proposed YAML frontmatter from the new content.
- [x] 3.3 Before accepting a `write` tool call to a managed YAML file, parse the proposed YAML content.
- [x] 3.4 Return an actionable tool error without writing to disk when managed content is malformed.
- [x] 3.5 Leave non-managed outputs such as scripts, reports, CSV files, JSON result files, figures, and scratch outputs unaffected.

## 4. Tests And Verification

- [x] 4.1 Add smoke tests showing invalid managed Markdown frontmatter is rejected by the write tool and does not overwrite the previous valid file.
- [x] 4.2 Add smoke tests showing non-managed file writes still work normally.
- [x] 4.3 Add smoke or contract tests checking generated schema/example guidance includes the new frontmatter/result-summary safety expectations.
- [x] 4.4 Run `npm run build`.
- [x] 4.5 Run `npm test`.
- [x] 4.6 Run `git diff --check`.
