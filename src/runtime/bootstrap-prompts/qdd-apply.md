Implement the current approved QDD study/task set.

Work through the active study until it reaches a decision point, a meaningful blocker, or a true study-level replanning need.

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
- package final data, code, figures, tables, and reports so the study stays reviewable
- review promotion-worthiness before a completed task is left behind
- maintain `artifact-candidates.yaml` for promotion-worthy reusable outputs
- register reusable artifacts
- report progress, blockers, and judgment status
- continue across the planned task graph instead of stopping after the first completed task

## What Apply Does Not Own

- free-form study redesign as the default path
- closure judgment before the evidence exists
- replacing `qdd-explore` in `human` or `assist` mode when the task plan itself is under question

## Execution Stance

- Treat `brain/*` guidance and local domain skills as execution guidance, not as rigid pipelines that override the benchmark or task contract.
- If a standard stage such as integration / batch correction is absent from the approved task graph, do not silently invent it as a new main path inside apply.
- If that omitted stage could materially change the benchmark or study answer, either consume the already planned sensitivity path or report the gap explicitly instead of pretending the omission does not matter.

---

## Preflight

1. Read `.qdd/instructions.md`.
2. Run `qdd status --json`.
3. Run `qdd instructions STUDY-XXX --command qdd-apply --json`.
4. Run `qdd instructions TASK-XXX --command qdd-apply --json` for the active task when execution begins.
5. Read the listed study and task files.
6. Use `qdd context --json` and `qdd artifacts:list --json` when inputs or reuse matter.

Treat the returned `read` and `write` paths as authoritative bounds.
Treat missing local skills reported by `qdd instructions` as real blockers.
If task-local executor skills are listed in the task instructions, read those skill files before deciding how to run the task.

---

## Determine The Current Execution Surface

Before executing, answer these questions:

- which task is the current first move?
- which expected output makes the study more judgeable?
- are there blockers already recorded that must be resolved first?
- do the declared domain skills actually exist under the QDD root `domain-skills/` library?

If the study has multiple tasks, make the execution order explicit and keep moving while the next planned step is still clear.

If the study has only one task, start there.

If a task declares missing domain skills, stop immediately. In this case `qdd-apply` is hard-blocked until the missing skill exists under the QDD root `domain-skills/` library or the task is rewritten through `qdd-explore`.

Do not reopen broad skill selection here.

If a task depends on external public datasets, `qdd-apply` still must not reopen broad dataset search.
It may only consume the already selected dataset targets recorded in `studies/STUDY-XXX/output/public_data_request.yaml`.

`qdd-apply` consumes the task's declared executor problem-level skills only.

If a task already declares executor skills, do not skip them and jump straight to unconstrained ad hoc coding.

When the study is multi-sample or multi-donor, explicitly notice whether integration / batch correction was planned as main-path, sensitivity-only, or skip.
If that judgment is not legible from the current study/task set and could change the answer, pause and route the issue back to `qdd-explore` rather than silently assuming one side.

---

## Normalize The Active Task Before Running

Do not blindly trust a weak scaffold.

Before or during execution:

- rewrite the task checklist into task-specific executable steps
- make sure the expected outputs are concrete
- make sure inputs and dependencies are still accurate
- make sure you have actually read the task's declared local skills before choosing methods or writing code
- make sure any omitted standard stage that could change the answer is either explicitly out of scope for this task or already covered by a planned sensitivity task

If the task file is too vague to execute responsibly, say so.

In `human` or `assist` mode, bring that problem back to `qdd-explore` if it requires real plan reshaping.

Do not add new task skills here. `qdd-apply` consumes the declared task-local problem-level skill list; it does not invent one or reopen catalog search.

If the declared skill bundle is present and adequate, execution should follow that bundle.

Only fall back to general code generation when:

- the task intentionally has no local executor skill
- or the installed skill is clearly insufficient for the exact task and you explain that gap explicitly

Even in fallback mode, keep the task aligned with the declared problem class and study boundary.

Do not use fallback coding as an excuse to smuggle in an unplanned correction or to drop a planned sensitivity branch.

If the task checklist includes plain if-then reaction bullets, execute them as local task guidance:

- run the default path first
- evaluate the stated diagnostic before trying the correction
- apply only the stated small correction, such as rerunning a PCA handoff with scaling
- keep mutually exclusive method choices serial unless the task explicitly says otherwise
- do not expand one reaction bullet into a broad candidate search
- if the stated reaction is exhausted and the task is still not judgeable, report that blocker instead of inventing new branches

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

When a task has declared local executor skills:

1. name the skill(s) you are relying on
2. read the local skill instructions
3. execute the task in a way that is consistent with those skill instructions
4. keep the produced script, figure, table, or report aligned with the selected skill's problem framing

Treat local skills as execution guidance, not optional decoration.

If one of the declared skills is `public-data/cellxgene-discover`:

1. read `studies/STUDY-XXX/output/public_data_request.yaml`
2. confirm that the selected target set is explicit
3. download only those selected datasets
4. if the selected set is empty, treat that as a planning/blocker issue rather than re-running broad search here

If one of the declared skills is `public-data/cellmarker-fetch`, `public-data/lrdb-fetch`, `public-data/geo-candidate-capture`, or `public-data/pubmed-evidence-capture`:

1. read the task text itself as the bounded search intent
2. use only the named source and query terms already captured there
3. materialize the chosen local CSV/TSV output under the study output directory
4. do not invent a new managed YAML handoff for lightweight public-data capture tasks

### 2.5 Be patient with heavy analysis

Slow clustering, UMAP, integration, large h5ad I/O, and similar steps are normal.

Do not abandon a method just because it has been running for a few minutes.

Keep waiting and inspect progress first when:

- the process is still alive
- logs or partial outputs still change
- the workload is naturally heavy for the dataset size

Treat these as stronger failure signals:

- explicit non-zero exit
- repeated hard runtime errors
- sustained non-progress after extended inspection
- clear resource exhaustion or corrupted inputs

Absence of immediate output is not enough to justify a fallback.

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
studies/STUDY-XXX/output/data/
studies/STUDY-XXX/output/code/
studies/STUDY-XXX/output/figures/
studies/STUDY-XXX/output/tables/
studies/STUDY-XXX/output/reports/
studies/STUDY-XXX/output/tmp/
```

Rules:

- `output/tmp/` is scratch space only; do not leave final study truth there
- package final reusable outputs back into `output/data|code|figures|tables|reports` before marking the task complete
- if the task produces the final kept processed h5ad or equivalent reusable data object, preserve it in `output/data/`
- if you ran substantive analysis code, preserve a readable script in `output/code/`
- if one script is the main executed analysis surface for this task, normally record it in `artifact-candidates.yaml` as `type: code` unless you directly register it
- if the study claim depends on visual inspection, save at least one key figure in `output/figures/`
- keep reusable summary CSV/TSV tables in `output/tables/` and normally promote them as `type: table` when they matter beyond this study
- keep tables and reports in the matching subdirectories when practical
- keep purely local intermediate files under `output/tmp/` when they are not part of the final study surface

### 5. Register reusable outputs

When an output is genuinely reusable, either:

- call `qdd register-artifact` immediately, or
- add it to `studies/STUDY-XXX/output/artifact-candidates.yaml` so `qdd-close` can promote it later

When one task clearly produced the output, include that `task_id` in the candidate entry so provenance survives promotion.

Before you leave a task in `completed`, set its `promotion_status` explicitly:

- `none` when you reviewed the outputs and nothing should be promoted
- `candidate-recorded` when you reviewed the outputs and wrote one or more entries into `artifact-candidates.yaml`
- `registered` when you directly registered the reusable output during apply

Do not leave a completed task with implicit or unknown promotion review state.

Do not treat every output file as an artifact.

### 6. Reassess the study

After each meaningful step, ask:

- is the study now judgeable?
- is it clearly blocked?
- is the next planned task still the right within-study move?
- did the study boundary change so much that the study itself needs replanning?

If the study is not yet judgeable and the next planned task is still clear, keep going inside `qdd-apply`.

If the study became judgeable, blocked, or truly needs study-level replanning, stop execution and move to the right next workflow.

### 6.5 Final Output Alignment

Before finalizing a benchmark-facing or otherwise structured answer, distinguish:

- what the analysis most strongly suggests
- what the current task explicitly asks you to return

Do not suppress valid exploratory findings just to fit a rigid return surface.

But when the task is a structured benchmark or fixed-answer evaluation, make sure the final returned answer is aligned with the required output format, quantity, or interpretation target.

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
- Do not invent extra tasks casually; if the declared task graph is no longer enough, treat that as a study-level issue and make it explicit.

---

## When To Pause

Pause and report if:

- the current task is too ambiguous to execute responsibly
- an environment or data blocker prevents progress
- execution reveals that the study question or task structure needs reconsideration
- execution reveals that the declared task graph is missing a genuinely necessary study-level step
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
- read and use the task's declared local skills before choosing analysis methods
- leave behind readable scripts for substantive analyses
- leave behind key figures when visual evidence matters
- keep promotion candidates explicit instead of assuming everything should be registered
- keep reusable outputs registered with provenance
- set promotion review explicitly before a completed task is considered done
- package final outputs back out of scratch space into the canonical study output surface

## Bad Apply Behaviors

- treating one completed task as automatic proof that the whole study is done
- treating one completed task as automatic proof that apply should stop
- ignoring declared task-local executor skills and improvising a different execution path without explanation
- silently redesigning the plan in `human` or `assist` mode
- leaving task files stale while work progresses
- keeping a generic checklist when the real task has become specific
- finishing a study without the script that produced the main analysis result
- marking a task completed while `promotion_status` is still effectively pending
- leaving task-local top-level folders in `output/` instead of packaging back into canonical directories
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
- Set `promotion_status` explicitly before leaving a task completed.
- Use `output/tmp/` only as scratch space and package final outputs back into canonical study directories.
- Register reusable outputs with provenance.
- Treat slow clustering, UMAP, integration, and large h5ad processing as normal long-running work unless there is real evidence of failure.
- In `human` and `assist` mode, return to `qdd-explore` when plan restructuring is needed.
- In `auto` mode, only append a minimal new task when it is strictly required and still inside the study boundary.
