## Filesystem Contract

This slice does not change the core QDD project layout. It changes how installed workflow surfaces interpret that layout across modes.

```text
project-root/
├── contract.yaml
├── evolution.yaml
├── context/
├── studies/
├── artifacts/
├── .qdd/
│   ├── instructions.md
│   └── bootstrap.yaml
├── .claude/
│   ├── commands/qdd-*.md
│   └── skills/qdd-*/SKILL.md
└── .codex/
    └── skills/qdd-*/SKILL.md
```

Tool-specific prompt projections remain bootstrap outputs. They do not become a second truth source.

This slice may add repo-local Markdown prompt source files used by the bootstrap generator. Those files are generator inputs, not project truth sources, and they must not become a second research-state model.

The only authority signal added to this slice is the existing `contract.yaml.mode` value. No new planner file, approval ledger, or workflow-state file is introduced.

## Identifiers And Metadata

The following identifiers remain unchanged:

- modes: `human`, `assist`, `auto`
- workflow surfaces: `qdd-propose`, `qdd-explore`, `qdd-apply`, `qdd-close`
- study IDs: `STUDY-XXX`
- task IDs: `TASK-XXX`
- artifact IDs: `ART-XXX`
- question delta types: `refinement`, `confirmation`, `pivot`, `dissolution`

Protocol rule for this slice:

- `contract.yaml.mode` is the single machine-readable authority signal for installed workflow behavior.
- The confirmation gate for `human` and `assist` mode is behavioral, not a new persisted object.
- `qdd-propose` is allowed to create or refresh one first-pass `study.md` and corresponding initial `TASK-XXX.md` directly.
- `qdd-explore` may analyze read/write bounds from `qdd instructions`, but those write bounds do not authorize immediate writes in `human` or `assist` mode before the user confirms.
- Only `study.md` and `task.md` are template-constrained artifacts in this slice. The workflow prompts for `propose`, `explore`, `apply`, and `close` are behavior guides, not rigid output schemas.
- The default task checklist is a weak scaffold that must be rewritten to fit the task. It is not authoritative task logic.

## Status JSON

`qdd status --json` remains unchanged in structure. This slice tightens its meaning:

- `project.mode` is authoritative for workflow stance.
- installed prompts and skills must read `project.mode` before deciding whether `explore` may mutate state or whether `auto` may continue directly into execution.

No new status fields are required in this slice.

## Instructions JSON

`qdd instructions <id> --json` remains unchanged in structure.

This slice clarifies how the result is used:

- `read` paths remain mandatory context for an existing study or task.
- `write` paths remain capability bounds, not an obligation to write immediately.
- `qdd-propose` may use the returned study write bounds to create or refresh the first-pass `study/task` set directly.
- in `human` and `assist` mode, `qdd-explore` uses instructions JSON to inspect scope and prepare concrete recommendations, then waits for confirmation before writing.
- in `qdd-apply`, the instructions output should be treated as the approved execution surface for the current `study/task` set; if that plan is no longer sufficient, the workflow should return to `qdd-explore` in `human` or `assist` mode rather than silently reshaping the plan.
- in `auto` mode, `qdd-explore` may be merged into `qdd-apply` behavior when the study is already actionable.

No new instructions target is introduced.

## Agent Usage Rules

Shared rules:

- Use QDD command names, not `opsx` aliases.
- Read `.qdd/instructions.md` and `qdd status --json` before high-level workflow decisions.
- Call `qdd instructions STUDY-XXX --json` before editing an existing study.
- Treat `contract.yaml.mode` as the authority boundary for the current run.
- Distinguish between template-constrained artifacts (`study.md`, `task.md`) and workflow guidance text (`qdd-propose`, `qdd-explore`, `qdd-apply`, `qdd-close`).
- Keep installed workflow prompts and skills long-form, example-rich, and OpenSpec-like in structure rather than terse help text.
- Do not introduce a second planner model or a new command family in this slice.

Mode rules:

- `human`: `qdd-explore` is a planning conversation. Ask questions, surface assumptions, and present a recommended plan. Do not edit `study.md` or create tasks until the user confirms.
- `assist`: same confirmation gate as `human`, but the agent may draft more concrete edits, task shapes, and execution suggestions for the user to approve.
- `auto`: when project and study context are sufficient, the agent may skip a separate confirmation stop and continue into study execution while still respecting QDD truth sources and write bounds.

Workflow rules:

- `qdd-propose` frames one study from the user's direction and directly writes a complete first-pass `study.md` plus initial `task` record(s) using the QDD templates.
- `qdd-explore` tests worth, feasibility, blockers, evidence plan, and execution shape for an existing `study/task` set. In `human` and `assist` mode, it is discussion-first and only modifies those artifacts after confirmation.
- `qdd-apply` is the study execution unit for the current approved `study/task` set. It should report progress, blockers, and evidence state; if the task plan itself needs restructuring, that should return to `qdd-explore` in `human` or `assist` mode.
- `qdd-close` validates the study result, writes explicit `question_delta` state, updates stable reusable context, and remains human-approved in `human` and `assist` mode.
