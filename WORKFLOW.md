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
    - Merging
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
  max_turns: 20
  max_retry_backoff_ms: 300000
codex:
  command: codex --config shell_environment_policy.inherit=all --config 'model="gpt-5.6-sol"' --config model_reasoning_effort=xhigh app-server
  approval_policy: never
  read_timeout_ms: 30000
  thread_sandbox: danger-full-access
  turn_sandbox_policy:
    type: dangerFullAccess
    networkAccess: true
---

You are working on one Linear issue for the QDD repository.

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
- Resume from the current workspace and workpad state.
- Recheck changed repository or issue state, but do not repeat completed work without reason.
{% endif %}

## Mission

Implement only the executable slice described by the Linear issue.

- Keep issue scope bounded.
- Use Chinese for workpad updates, handoffs, PR summaries, and final reports unless the issue requests English.
- If the issue conflicts with a repository source of truth, stop the conflicting work and record the conflict.
- Do not invent product requirements in this workflow file.

## Required Reading

Before implementation, read:

1. the root `AGENTS.md`
2. the Linear issue, acceptance criteria, and dependency relations
3. files named in the issue's `References` or `Required Reading`
4. for conclude work, `docs/09-qdd-conclude-prd.md` and `src/runtime/bootstrap-prompts/qdd-conclude.md`
5. the code and tests directly related to the requested slice

Repository product truth priority is:

1. `AGENTS.md` project invariants
2. feature contracts and repository specifications
3. current Linear issue execution contract
4. nearby code and tests

This workflow is the execution control plane rather than a product specification. An issue may change a higher-priority contract only when that contract update is explicit scope and ships in the same change. Otherwise, record the conflict and follow the higher-priority source.

## Context Receipt

Create or update one persistent Linear comment headed `## Codex Workpad`. Before editing, record a compact context receipt:

- issue identifier, state, and unresolved blockers
- base branch and base SHA from `origin/main`
- issue branch and current SHA
- required-reading paths actually read
- the acceptance slice being implemented
- planned validation commands

Git-tracked documents are bound by the recorded SHA; do not add separate file hashes unless the issue specifically requires them. If the issue description, dependency state, or base branch changes materially, refresh the receipt before continuing.

## State And Dependency Protocol

- `Todo`, `In Progress`, and `Rework`: implement or revise the issue slice.
- `Human Review`: pause; do not perform active work.
- `Merging`: add no feature scope. Complete only merge preparation, validation, merge, and final status updates.
- `Done`, `Closed`, `Cancelled`, `Canceled`, `Duplicate`: terminal; do not work.
- Respect real Linear `Blocked by` / `Blocks` relations. Prose-only dependency notes are not sufficient.
- A downstream issue may start only after all blockers are terminal and their required changes are present in `main`.

If an active issue has a non-terminal blocker, record it in the workpad and do not implement around it.

## Repository And Branch Protocol

- Canonical repository: `https://github.com/BillyChen123/qdd`
- Clone remote: `git@github.com:BillyChen123/qdd.git`
- Base branch: `main`
- One branch per Linear issue.
- Branch names begin with the lower-case issue identifier, for example `bil-20-...`.
- Open PRs against `main`.
- Preserve unrelated user or workspace changes.
- Never commit credentials or secret values.

Before implementation:

1. fetch `origin`
2. confirm the recorded base SHA
3. create or resume the issue branch
4. inspect the current worktree and existing workpad

## Execution And Workpad Protocol

Keep the workpad current with:

- concise plan and progress
- acceptance criteria status
- decisions or contract conflicts
- blockers and missing tools
- commits and PR URL
- exact validation evidence

Implement the smallest coherent change that satisfies the issue. Follow existing repository patterns and do not introduce unrelated frameworks or refactors.

## Validation Provenance

Use the issue's `Validation` section and the relevant repository contract to choose tests. The workflow defines how validation is proven, not feature-specific test cases.

Final validation must be run against the committed handoff state. Record these five items in the workpad and PR summary:

1. issue identifier and base SHA
2. tested SHA
3. clean-worktree result from `git status --short`
4. exact commands, including the resolved binary path and any case/input path
5. result plus generated output/report paths

If validation uses external project data, also record its resolved path and the output directory. If code or tracked test inputs change after validation, commit the change and rerun the affected validation; the previous tested SHA is no longer valid.

Do not report a local run as evidence for a cloud commit unless the local checkout was at the same tested SHA. Do not report a generated score without the exact command and output path that produced it.

If validation cannot run, record the failed command, missing dependency or credential, and the unverified acceptance criteria. Do not translate a skipped or blocked test into success.

For conclude live evaluation, use `deepseek-v4-pro` through the configured Anthropic-compatible endpoint unless the issue explicitly changes the target model. Fake evaluation may validate harness contracts, but it is not a substitute for required live evidence.

Conclude live evaluation is capability-aware. The writer and mechanical harness determine whether the generated synthesis and story are ready for `Human Review`; a model-based semantic reviewer is advisory and must not act as a hard gate. In particular:

- when the configured model cannot inspect image pixels, the writer may select and cite figures from captions, study outputs, reports, and provenance
- record visual verification as unavailable and defer it to human review; do not claim visual observations that are unsupported by the textual evidence
- reviewer outcomes such as `revision_required`, `blocked`, or `cannot_assess` are diagnostic findings, not live-evaluation failure, when they result from model capability limits
- lack of model vision must not block `Human Review`, trigger autonomous retries, or cause production-code changes

Before any paid conclude live evaluation, complete build, deterministic tests, fixture checks, credential checks, and provider-availability checks that can fail without a model call. Reuse an existing accepted `story.md` when the issue tests only downstream rendering or validation. A renderer-only issue must not rerun the full synthesis, two-gate writer, or semantic-review flow.

Do not repeat a paid writer run merely to improve an advisory reviewer outcome. A live retry is allowed only for a concrete writer or harness defect that the issue is in scope to fix; record the reason before retrying. Model vision limitations and unchanged provider failures are not retry reasons.

PDF compilation is capability-aware and optional. Probe once for an existing local TeX compiler, but do not install, download, or configure a TeX distribution during a Symphony issue unless the issue explicitly scopes that environment work. If no compiler is available, validate `main.tex`, `references.bib`, figures, paths, references, citations, and story coverage mechanically; report PDF status as `unavailable`. Missing local TeX tooling must not fail the issue, block `Human Review`, trigger retries, or consume model calls.

Before moving a conclude issue to `Human Review`, render its primary human-review output directly in the Linear workpad. For manuscript behavior evaluation, include the final `story.md`; a local filesystem path alone is not sufficient.

## Handoff Protocol

Before moving an issue to `Human Review`:

1. commit all intended changes on the issue branch
2. run final validation on that commit
3. confirm the worktree is clean
4. push the branch to `origin`
5. open or update a PR against `main`
6. update the workpad with the context receipt, tested SHA, commands, results, output paths, and PR URL

If push, Linear comment editing, or PR creation is unavailable, leave the issue in `In Progress` and record the exact blocker.

When the issue is in `Merging`:

1. read the workpad, tested SHA, and PR state
2. confirm there is no unresolved blocker or requested rework
3. refresh the branch and `main`
4. resolve merge-only conflicts and rerun affected validation
5. merge through the GitHub PR
6. confirm the merged commit is present in `origin/main`
7. update the workpad with merge SHA and final status
8. move the Linear issue to `Done`

If authentication, branch protection, CI, or review state blocks merging, keep the issue in `Merging` and record the exact blocker.
