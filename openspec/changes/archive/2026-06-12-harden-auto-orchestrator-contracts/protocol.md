## Filesystem Contract

This slice keeps the current QDD project layout and adds no new primary truth source.

The runtime continues to communicate through existing managed files:

```text
contract.yaml
context/resources.md
context/memory/STUDY-XXX.md
evolution.yaml
studies/STUDY-XXX/study.md
studies/STUDY-XXX/tasks/TASK-XXX.md
studies/STUDY-XXX/output/**
studies/STUDY-XXX/output/artifact-candidates.yaml
artifacts/index.yaml
.qdd/schema-reference.md
.qdd/examples/*
```

The hardening adds one runtime observation surface only in `AutoResult` / logs, not a durable protocol file:

- invalid managed-file state detected after a phase
- phase drift detected after a phase
- state-derived next phase selected after a phase

No new run daemon, scheduler, or persistent job queue is introduced.

## Identifiers And Metadata

Existing identifiers remain unchanged:

- study IDs: `STUDY-XXX`
- task IDs: `TASK-XXX`
- artifact IDs: `ART-XXX`
- boundary IDs: `BXXX`
- auto phases: `start | propose | apply | close`
- auto commands: `qdd-start | qdd-propose | qdd-apply | qdd-close`

Add one new auto terminal code:

- `invalid_state` - a phase completed, but current project files could not be parsed or validated into QDD status.

Add one lightweight phase observation structure to the internal result/log stream:

```ts
interface AutoPhaseStateObservation {
  phase: OrchestratorPhase;
  target: string;
  invalidState?: {
    message: string;
    likelyPath?: string;
  };
  drift?: {
    changedPaths: string[];
    unexpectedPaths: string[];
  };
  nextPhase?: PhaseTarget | null;
}
```

This observation is diagnostic. It does not replace `qdd status --json` as the project state API.

## Status JSON

`qdd status --json` remains the canonical state summary and should not accept invalid current files silently.

`qdd auto` should call a safe wrapper around status construction:

```text
safeBuildAutoStatus(projectRoot)
  try buildStatus(projectRoot)
  catch validation/parsing error
    return invalid_state with message and likely managed file path when detectable
```

When invalid state is detected after an agent phase, auto stops with:

- terminal code: `invalid_state`
- terminal reason: concise error message
- final phase: the phase that produced or exposed the invalid state
- enough path context for a human or follow-up agent to repair the file

Do not continue to the next phase when `evolution.yaml`, `artifact-candidates.yaml`, or another managed file cannot be read into the current runtime schema.

## Instructions JSON

The existing `qdd instructions ... --json` surface remains authoritative for phase read/write expectations.

This slice tightens rules rather than changing the schema:

- `PROJECT/qdd-start` instructions should explicitly say that study/task creation and `evolution.yaml` mutation are outside the start write surface.
- `STUDY/qdd-close` instructions should explicitly say: do not hand-write `evolution.yaml`; closure writes must go through `qdd close-study`.
- Study/task instructions should keep pointing agents to `.qdd/schema-reference.md` and the relevant `.qdd/examples/*` before editing managed files by hand.
- Managed file examples should be treated as generated current references. Historical docs must not be presented as current schema authority.

The agent runner may remain project-root scoped in this slice. If deeper enforcement is added later, it should consume the same instruction `read`/`write` paths rather than inventing a second allowlist model.

## Agent Usage Rules

The runtime, not the agent transcript, decides phase progression.

After every non-dry-run phase:

1. Capture a lightweight before/after file snapshot for managed surfaces relevant to phase drift detection.
2. Reread status with safe error capture.
3. Inspect phase completion for the phase that just ran.
4. Select the next phase from persisted state, not from the previous phase label alone.

State-derived phase selection should behave like this:

```text
if status invalid:
  stop invalid_state
else if current phase failed completion checks:
  stop phase_incomplete
else:
  next = computeInitialPhase(status, taskRecords)
```

The special case is a clean `start` with no studies: it naturally recomputes to `propose(STUDY-001)`. If `start` over-completes and creates an active/completed/blocked study, recomputation should pick up the real state instead of blindly proposing the next unused study ID.

Phase drift policy should stay lightweight:

- `qdd-start` unexpected writes include `studies/**`, `evolution.yaml`, and `artifacts/index.yaml`.
- `qdd-propose` unexpected writes include direct `evolution.yaml` mutation and artifact registry promotion.
- `qdd-apply` unexpected writes include direct `evolution.yaml` mutation and closure-owned memory/report finalization.
- `qdd-close` may write `evolution.yaml`, `context/memory/**`, `research-map.html`, artifact promotion state, and the target study status.

For this slice, drift detection may initially warn and record diagnostics rather than block every run. Invalid managed-file state must block.

Historical documentation handling:

- Mark old PRD/prototype docs that contain retired schemas as historical.
- Prefer current generated `.qdd/schema-reference.md` and `.qdd/examples/*` in prompts and tests.
- Add tests that workflow prompts do not contain retired `question_delta` / `evolution_trail` guidance.
