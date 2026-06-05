## Filesystem Contract

This slice keeps the current QDD layout and clarifies two existing surfaces rather than adding a new one.

```text
project-root/
├── contract.yaml
├── evolution.yaml
├── context/
│   └── resources.md
├── studies/
├── artifacts/
├── .qdd/
├── .codex/
│   └── skills/
│       ├── qdd/
│       ├── brain/
│       └── <domain>/
└── .claude/
    ├── commands/
    └── skills/
```

Rules for this slice:

- `context/resources.md` remains the single default readable project-context file.
- `brain/*` skills remain optional planning-time sidecars under the local skill tree, not project truth sources.
- `brain/*` skills supplement workflow prompts with domain priors and tool-usage guidance; they do not replace `qdd-propose` or `qdd-explore`.
- No new `memory/` directory, task-level memory log, or separate preference database is introduced here.
- Stable user preferences should be recorded inside `context/resources.md` in explicit sections rather than through a second memory system.

## Identifiers And Metadata

Identifiers remain unchanged in this slice:

- workflow surfaces: `qdd-start`, `qdd-propose`, `qdd-explore`, `qdd-apply`, `qdd-close`
- study IDs: `STUDY-XXX`
- task IDs: `TASK-XXX`
- artifact IDs: `ART-XXX`

Readable-context rules tightened here:

- `context/resources.md` should keep project facts and durable analyst preferences in clearly separated sections.
- Project facts include research theme, biology, runtime, datasets, constraints, and reusable evidence pointers.
- Durable analyst preferences include stable methodological preferences, evidence preferences, and long-lived cautions that should bias future planning.
- Dynamic workflow state such as current blockers, current task progress, or ephemeral troubleshooting notes should not be treated as durable preference memory.

Brain-skill content rules tightened here:

- A brain skill may describe domain checks, method selection heuristics, common failure modes, and controlled skill-selection hints.
- A brain skill must not redefine QDD workflow ownership, command authority, or generic study/task template semantics already owned by the QDD prompts.
- A brain skill must not present itself as a second project truth source.

## Status JSON

`qdd status --json` does not need a new schema in this slice.

However, later agents should be able to rely on the existing status plus `context/resources.md` to understand:

- whether shared project context has been meaningfully filled,
- whether local domain skills exist,
- and whether planning can proceed without inventing missing context.

No separate memory-state object is introduced.

## Instructions JSON

`qdd instructions ... --json` remains the machine-facing boundary.

This slice clarifies how the two updated surfaces should be used:

- `qdd-start` should continue to read and write `context/resources.md` as the default context entrypoint.
- `qdd-propose` and `qdd-explore` may read relevant `brain/*` skills for domain priors before shaping study/task content.
- `qdd-apply` should continue to rely on task-declared executor skills; it should not treat `brain/*` as executor-time task skills.
- `qdd-close` may update reusable project context in `context/resources.md`, but should only carry forward durable conclusions rather than transient run details.

No new instructions target is required.

## Agent Usage Rules

- Read `context/resources.md` first for project facts and stable preferences.
- Read relevant `brain/*` skills second when domain-specific planning or skill-selection judgment is needed.
- Keep workflow reasoning anchored in the QDD command prompt being executed.
- Treat `brain/*` as advisory domain prior, not as an alternate workflow controller.
- When a stable analyst preference belongs in reusable context, write it into `context/resources.md` instead of inventing a new memory subsystem.
- When information is dynamic, task-local, or likely to go stale quickly, keep it in study/task/run artifacts rather than promoting it into durable project context.
