---
tracker:
  kind: linear
  project_slug: "qdd-5bbf8f2a81d1"
  required_labels:
    - qdd-conclude
  active_states:
    - Todo
    - In Progress
    - Rework
  terminal_states:
    - Done
    - Closed
    - Cancelled
    - Canceled
    - Duplicate
polling:
  interval_ms: 30000
workspace:
  root: ~/code/qdd-symphony-workspaces
hooks:
  after_create: |
    git clone git@github.com:BillyChen123/qdd.git .
    npm install
    npm run build
agent:
  max_concurrent_agents: 1
  max_turns: 8
  max_retry_backoff_ms: 300000
codex:
  command: codex --config shell_environment_policy.inherit=all --config 'model="gpt-5.4"' --config model_reasoning_effort=xhigh app-server
  approval_policy: never
  thread_sandbox: workspace-write
  turn_sandbox_policy:
    type: workspaceWrite
    networkAccess: true
---

You are working on a Linear issue for the QDD repository.

Issue:
- Identifier: {{ issue.identifier }}
- Title: {{ issue.title }}
- Current state: {{ issue.state }}
- Labels: {{ issue.labels }}
- URL: {{ issue.url }}

Description:
{% if issue.description %}
{{ issue.description }}
{% else %}
No description provided.
{% endif %}

{% if attempt %}
Continuation context:
- This is retry or continuation attempt #{{ attempt }}.
- Resume from the current workspace state.
- Do not repeat completed investigation unless the latest repository state requires it.
{% endif %}

## Mission

Implement the QDD `conclude` skill described in `docs/09-qdd-conclude-prd.md`.

This workflow is intentionally conservative for learning Symphony:

- Work on one issue at a time.
- Keep each issue small enough to review.
- Prefer a focused, verifiable slice over broad speculative implementation.
- Do not expand scope beyond the Linear issue and the PRD.
- If the issue conflicts with the PRD, follow the PRD and record the conflict in the workpad.

## Repository Context

QDD is a TypeScript CLI and local skill framework for Question-Driven Discovery.

Important paths:

- `docs/09-qdd-conclude-prd.md`: source PRD for the conclude skill.
- `.codex/skills/`: workflow skill surfaces used by Codex.
- `domain-skills/`: QDD domain-level skills and scripts.
- `src/`: QDD CLI implementation.
- `openspec/`: existing OpenSpec planning artifacts.
- `package.json`: build and test commands.

Use the repository's existing patterns. Do not introduce a new framework or unrelated runtime.

## Symphony Runtime Constraints

This workflow runs inside raw Codex app-server through Symphony, not inside the API-based coding harness.

- Do not call API-only wrapper tool names such as `functions.exec_command`, `multi_tool_use.parallel`, `functions.apply_patch`, `functions.write_stdin`, or similar wrapper namespaces.
- Use Codex's built-in shell and file-editing capabilities directly.
- For Linear operations, use the injected `linear_graphql` tool directly.
- If a required tool is unavailable, explain the exact missing capability in the final response and stop instead of repeatedly retrying invented tool names.

When using `linear_graphql`, keep operations narrow and explicit:

- Query only the fields you need.
- Treat a top-level GraphQL `errors` array as a real failure.
- Use it for issue reads, state updates, and the single persistent `## Codex Workpad` comment.

## Expected Development Posture

1. Read `docs/09-qdd-conclude-prd.md` before making changes.
2. Read the files directly related to the issue.
3. Create or update a single persistent Linear comment headed `## Codex Workpad`.
4. Keep the workpad current with:
   - plan
   - acceptance criteria
   - validation evidence
   - blockers or confusions
5. Implement only the issue's slice.
6. Run targeted validation before handoff.
7. Open or update a PR when code changes are ready.
8. Move the issue to human review only after validation passes and the workpad is current.
9. Write Linear workpad updates, PR summaries, handoff notes, and final reports in Chinese unless the issue explicitly requests English.

If Linear comment editing, GitHub push, or PR creation is unavailable, continue as far as possible in the local workspace, then record the exact blocker in the final response and workpad if available.

## Conclude PRD Guardrails

The `conclude` skill must preserve these product constraints:

- It turns accumulated QDD research evidence into an auditable manuscript-oriented package.
- It must generate 2-3 story candidates before drafting.
- It must stop for user story selection before producing the final manuscript.
- It must use existing QDD evidence rather than inventing new analysis results.
- It must treat negative, dissolved, blocked, or downgraded studies as useful boundary evidence.
- It must explicitly downgrade weak biological claims.
- It must preserve PaperSpine upstream license and provenance if vendored.
- It must report missing TeX or pandoc tooling as blocked rendering status, not success.

Do not silently convert associative evidence into causal or mechanistic claims.

## Recommended Issue Slices

Use these as the intended decomposition unless the Linear issue states a narrower slice:

1. Scaffold the `conclude` skill and PaperSpine vendor provenance.
2. Implement QDD preflight and evidence harvesting.
3. Generate and score story candidates with a selection gate.
4. Generate manuscript-planning artifacts after story selection.
5. Generate TeX/BibTeX outputs and rendering status audit.

## Validation

Use the smallest validation set that proves the issue slice:

- `npm run build`
- `npm test` when code paths are changed
- targeted fixture or smoke test when new parsing, harvesting, or rendering behavior is added

If validation cannot run because dependencies or tools are missing, report the missing dependency and the command that failed.

## Workpad Template

Use this structure for the persistent Linear workpad comment:

```md
## Codex Workpad

### Plan

- [ ] Read PRD and related source files
- [ ] Define acceptance criteria for this issue
- [ ] Implement focused slice
- [ ] Validate
- [ ] Prepare handoff

### Acceptance Criteria

- [ ] The issue scope is implemented without broad unrelated changes
- [ ] Behavior aligns with `docs/09-qdd-conclude-prd.md`
- [ ] Validation evidence is recorded

### Validation

- [ ] `npm run build`
- [ ] Additional targeted command, if needed

### Notes

- Pending.

### Confusions

- None yet.
```
