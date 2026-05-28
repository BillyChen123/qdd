Implement the current approved QDD study/task set.

Work through the active study until it reaches a decision point, a meaningful blocker, or a boundary change that should return to `qdd-explore`.

**IMPORTANT: Apply is execution mode.** Read the current study/task state, execute the work, update records, and keep going until the study can be judged or is explicitly blocked.

**Do not treat apply as the default place to redesign the plan.** In `human` and `assist` mode, if the current task set is no longer good enough, pause and route the discussion back to `qdd-explore`.

---

## Input

The argument after `qdd-apply` is usually a `STUDY-XXX` ID.

If omitted:

- infer the active study from context when that is safe
- or ask the user which study to execute

---

## What Apply Owns

- execute the current approved study/task set
- update study/task Markdown as the work progresses
- produce outputs in the study output directory
- package code, figures, tables, and reports so the study stays reviewable
- maintain `artifact-candidates.yaml` for promotion-worthy reusable outputs
- register reusable artifacts
- report progress, blockers, and judgment status

## What Apply Does Not Own

- free-form study redesign as the default path
- closure judgment before the evidence exists
- replacing `qdd-explore` in `human` or `assist` mode when the task plan itself is under question

---

## Preflight

1. Read `.qdd/instructions.md`.
2. Run `qdd status --json`.
3. Run `qdd instructions STUDY-XXX --json`.
4. Read the listed study and task files.
5. Use `qdd context --json` and `qdd artifacts:list --json` when inputs or reuse matter.

Treat the returned `read` and `write` paths as authoritative bounds.
Treat missing local skills reported by `qdd instructions` as real blockers.

---

## Determine The Current Execution Surface

Before executing, answer these questions:

- which task is the current first move?
- which expected output makes the study more judgeable?
- are there blockers already recorded that must be resolved first?
- do the declared domain skills actually exist under `.codex/skills/`?

If the study has multiple tasks, make the execution order explicit.

If the study has only one task, start there.

If a task declares missing local skills, stop immediately. In this case `qdd-apply` is hard-blocked until the missing skill is installed under `.codex/skills/` or the task is rewritten through `qdd-explore`.

---

## Normalize The Active Task Before Running

Do not blindly trust a weak scaffold.

Before or during execution:

- rewrite the task checklist into task-specific executable steps
- make sure the expected outputs are concrete
- make sure inputs and dependencies are still accurate

If the task file is too vague to execute responsibly, say so.

In `human` or `assist` mode, bring that problem back to `qdd-explore` if it requires real plan reshaping.

Do not add new task skills here. `qdd-apply` consumes the declared task skill list; it does not invent one.

---

## Execution Loop

### 1. Announce the current task

Say which study and task you are executing.

### 2. Execute the evidence-producing work

Examples:

- run the data reality check
- run the analysis step
- generate the figure or report
- record a blocker with enough detail to be actionable

### 3. Update records as you go

Update the task file when progress changes.

Update the study file when blockers, evidence state, or task status materially change.

### 4. Write outputs into the study output directory

Keep outputs inside:

```text
studies/STUDY-XXX/output/
```

Use these subdirectories when the corresponding evidence exists:

```text
studies/STUDY-XXX/output/code/
studies/STUDY-XXX/output/figures/
studies/STUDY-XXX/output/tables/
studies/STUDY-XXX/output/reports/
```

Rules:

- if you ran substantive analysis code, preserve a readable script in `output/code/`
- if the study claim depends on visual inspection, save at least one key figure in `output/figures/`
- keep tables and reports in the matching subdirectories when practical
- keep purely local intermediate files in study output; they do not become artifacts by default

### 5. Register reusable outputs

When an output is genuinely reusable, either:

- call `qdd register-artifact` immediately, or
- add it to `studies/STUDY-XXX/output/artifact-candidates.yaml` so `qdd-close` can promote it later

Do not treat every output file as an artifact.

### 6. Reassess the study

After each meaningful step, ask:

- is the study now judgeable?
- is it clearly blocked?
- did the study boundary change?

If yes, stop execution and move to the right next workflow.

---

## Mode Handling

### human

- Execute the current approved study/task set.
- If execution reveals that the task plan itself needs restructuring, pause and recommend `qdd-explore`.

### assist

- Same planning boundary as `human`.
- You may suggest concrete task edits, but do not silently redesign the plan as your default execution path.

### auto

- Continue within the study boundary when the next move is obvious.
- If a strictly necessary new task must be appended to keep execution coherent, keep it minimal, update the records, and stay within the existing study question.
- Do not grow the task graph casually.

---

## When To Pause

Pause and report if:

- the current task is too ambiguous to execute responsibly
- an environment or data blocker prevents progress
- execution reveals that the study question or task structure needs reconsideration
- the work produced evidence that already makes the study judgeable
- the user interrupts

In `human` and `assist` mode, plan redesign should usually return to `qdd-explore`.

---

## Progress Reporting

There is no rigid output schema, but your progress reports should be concrete.

Good progress reporting usually includes:

- current study
- current task
- what was run
- what output or blocker was produced
- whether the study is closer to judgment
- the next action

Example:

```text
## Executing STUDY-002

Current task: TASK-003
What I did: ran the metadata reality check against the raw h5ad
Result: sample-level metadata exists, but no reliable cell type annotations were present
Output: studies/STUDY-002/output/data_reality_check.md
Study status: not yet judgeable; one focused follow-up task remains
Next action: update TASK-003 and continue with the first analysis task
```

---

## Good Apply Behaviors

- keep execution aligned to the current study question
- keep task updates synchronized with real progress
- notice when the study is already judgeable and stop
- leave behind readable scripts for substantive analyses
- leave behind key figures when visual evidence matters
- keep promotion candidates explicit instead of assuming everything should be registered
- keep reusable outputs registered with provenance

## Bad Apply Behaviors

- treating one completed task as automatic proof that the whole study is done
- silently redesigning the plan in `human` or `assist` mode
- leaving task files stale while work progresses
- keeping a generic checklist when the real task has become specific
- finishing a study without the script that produced the main analysis result
- relying on visual claims without saving the figure that supports them
- registering every output file just because it exists

---

## When Apply Ends

Apply ends when one of these is true:

- the study has enough evidence to judge
- the study is blocked in a meaningful way
- the study boundary changed and should return to `qdd-explore`

At that point, say which next workflow is appropriate:

- `qdd-close`
- `qdd-explore`
- or explicit pause awaiting user input

---

## Guardrails

- Treat the study, not the single task, as the execution unit.
- Keep the current approved task set as the default execution surface.
- Rewrite the weak checklist scaffold into task-specific steps.
- Update study/task records directly as progress changes.
- Preserve readable scripts in `output/code/` for substantive analyses.
- Save key figures in `output/figures/` when visual evidence matters.
- Use `artifact-candidates.yaml` as the explicit promotion boundary for reusable outputs.
- Register reusable outputs with provenance.
- In `human` and `assist` mode, return to `qdd-explore` when plan restructuring is needed.
- In `auto` mode, only append a minimal new task when it is strictly required and still inside the study boundary.
