## Filesystem Contract

This slice does not change the core QDD runtime layout. Instead, it adds installed bootstrap projections that point to the existing filesystem contract:

```text
project-root/
├── contract.yaml
├── evolution.yaml
├── context/
├── studies/
├── artifacts/
└── .qdd/
    ├── instructions.md
    └── bootstrap.yaml
```

The bootstrap output should reference those paths rather than invent a second research-state model.

Bootstrap assets themselves may live in tool-compatible locations, but they must describe the current QDD truth sources rather than duplicate them.

`qdd init` should be the installation entrypoint for this layer. It should create the stable QDD scaffold, install selected tool-compatible prompts or commands, and record bootstrap metadata needed for future refresh.

## Identifiers And Metadata

Bootstrapped instructions should recognize and preserve current QDD identifiers and commands:

- Study IDs: `STUDY-XXX`
- Task IDs: `TASK-XXX`
- Artifact IDs: `ART-XXX`
- Change types: `refinement`, `confirmation`, `pivot`, `dissolution`

The bootstrap layer should explicitly teach agents which installed `qdd-*` surfaces exist and which underlying CLI commands they rely on:

- installed workflow surfaces: `qdd-propose`, `qdd-explore`, `qdd-apply`, `qdd-close`
- state-advancing CLI: `add-study`, `add-task`, `register-artifact`, `close-study`
- guard/query CLI: `status --json`, `instructions <id> --json`, `validate`, `artifacts:list --json`, `context --json`

The first bootstrap slice should not introduce a separate `qdd-project` wrapper. Project-level inspection during first entry should be handled inside `qdd-propose`, and project carry-forward should be handled inside `qdd-close`.

## Status JSON

Bootstrap instructions should treat `qdd status --json` as the high-level project dashboard API.

Expected uses:

- determine the current question state
- see active/blocked/completed/closed studies
- inspect task state summary
- inspect artifact counts and open boundaries

Bootstrap instructions should tell agents to prefer this command over manually inferring project state from scattered files when a high-level summary is enough.

`qdd-propose` should use `qdd status --json` at the start of an existing project. If the project is not initialized yet, `qdd-propose` should direct the workflow through `qdd init` first.

## Instructions JSON

`qdd instructions <id> --json` remains the primary execution-guidance API.

Bootstrap instructions should teach agents to:

- call `qdd instructions STUDY-XXX --json` before executing a study
- call `qdd instructions TASK-XXX --json` before executing or updating a task
- treat the returned `read` and `write` lists as authoritative bounds

This slice should not change the JSON contract. It should package and explain it for agent use.

`qdd-apply` should use `qdd instructions STUDY-XXX --json` as the study-level entrypoint, and then use task-level instructions as needed while the agent generates or updates tasks within that study.

## Installed Bootstrap Surface

The first bootstrap slice should install a single shared protocol source plus four workflow-specific prompt or command projections.

- Shared protocol source: `.qdd/instructions.md`
- Installed workflow surfaces: `qdd-propose`, `qdd-explore`, `qdd-apply`, `qdd-close`

The installed surfaces should follow OpenSpec-style command structure where helpful, but their content should remain QDD-native.

## Workflow Semantics

The four installed workflow surfaces should encode the following research loop:

- `qdd-propose`: start a study proposal from a human-supplied abstract question or hypothesis; first-run project bootstrap should branch through `qdd init`
- `qdd-explore`: perform structured, study-anchored exploration of worth, feasibility, blockers, evidence plan, and starter tasks
- `qdd-apply`: execute within the active study until the study reaches a decision point, not merely until one task is complete
- `qdd-close`: validate, synthesize evidence, register reusable outputs, update `evolution.yaml`, update stable `context/*.yaml` entries, and suggest the next study

The bootstrap layer should teach that humans plan at the study level while agents may generate and revise tasks during exploration and execution.

`qdd-explore` should allow some divergence in discussion, but it must remain anchored to the active study question and converge to a resource-supported plan before exiting.

## Agent Usage Rules

Bootstrap assets for the selected tool targets should enforce the following:

- Use QDD command names, not `opsx` aliases.
- Prefer `qdd status --json`, `qdd instructions <id> --json`, `qdd validate`, `qdd artifacts:list --json`, and `qdd context --json` over ad hoc scraping when possible.
- Treat `contract.yaml`, `evolution.yaml`, `context/*.yaml`, study/task Markdown files, and `artifacts/index.yaml` as the only truth sources.
- Use `.qdd/instructions.md` as the base protocol reference, not as a replacement for the CLI.
- Treat `qdd init` as the installer for scaffold plus bootstrap assets, not as an agent conversation.
- Let agents create or revise tasks during `qdd-explore` and `qdd-apply`; do not require humans to pre-plan tasks one by one.
- Treat a study as the execution unit for `qdd-apply`; do not stop merely because one task was completed if the study has not yet reached a decision point.
- During `qdd-close`, agents may write stable project context directly, but only for evidence-backed information that is reusable across studies.
- Do not generate a second internal workflow layer that redefines studies, tasks, or closures in software-delivery language.

The bootstrap layer should be thin: it should teach an agent how to operate the current QDD CLI, not create a new research runtime.
