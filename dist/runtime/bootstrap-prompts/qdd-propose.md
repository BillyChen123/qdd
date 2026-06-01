Enter QDD propose mode.

Turn a human-supplied research direction into one complete first-pass `study.md` plus a small first-pass set of `TASK-XXX.md` records.

**IMPORTANT: Propose writes.** This is the workflow step that creates the first usable study/task set. Do not leave the project with only a vague intention if there is already enough information to write a conservative first pass.

**This is artifact creation, not long-form debate.** If the user wants to question assumptions, compare options, or revise an existing study after seeing the first pass, that belongs in `qdd-explore`.

---

## Input

The argument after `qdd-propose` is an abstract question, hypothesis, or study direction.

Examples:

- `qdd-propose Why is ALOX12B low in a subset of keratinocytes?`
- `qdd-propose Re-check whether our current skin scRNA dataset can support a barrier-state question`
- `qdd-propose Use the existing AD dataset to frame one bounded first-pass study`

---

## What Propose Owns

- create or refresh one bounded `study.md`
- create a small complete first-pass task graph for that study
- make conservative decisions when the direction is broad but still actionable
- use the existing QDD templates rather than inventing new artifact shapes
- leave the project ready for `qdd-explore` or `qdd-apply`

## What Propose Does Not Own

- extended discussion of whether the study should be reframed after the first pass exists
- implementation of analysis code or execution of the task
- closing the study or deciding `question_delta`
- building a large task tree up front

---

## Preflight

1. If the current directory is not a QDD project, run `qdd init` first.
2. Read `.qdd/instructions.md`.
3. Run `qdd status --json`.
4. If project context is still placeholder-level, complete `qdd-start` first.
5. If project context or reuse matters, inspect `qdd context --json` and `qdd artifacts:list --json`.
6. If the user is refining an existing study instead of creating a new one, read `qdd instructions STUDY-XXX --command qdd-propose --json` and the existing `study/task` files before writing.
7. If task-level executor skill choice matters, inspect study-brain guidance under `domain-skills/brain/` and use `qdd skills suggest --domain <domain> --stage <stage> --tag <tag> --json`.
8. Do not leave task `skills:` empty when the study already implies a clear executor problem class such as preprocess, integration, clustering, or annotation.
9. If the study may need external public data, decide that here instead of leaving it for apply to improvise later.

---

## Procedure

### 1. Crystallize one bounded question

Convert the user's direction into one study-sized question.

Good propose questions are:

- narrow enough to judge in one study
- connected to available data or realistic blockers
- concrete enough to imply a small first-pass task set

Bad propose questions are:

- entire programs of work
- vague aspirations with no evidence path
- mixtures of multiple unrelated hypotheses

### 2. Create the study scaffold

Use `qdd add-study` to create the next `STUDY-XXX` record.

Then edit `studies/STUDY-XXX/study.md` directly so it records a complete first pass, not placeholders.

At minimum, fill in:

- the bounded question
- the working hypothesis or expectation
- why this study matters now
- resource fit
- evidence plan
- blockers

### 3. Create the initial tasks immediately

Use `qdd add-task STUDY-XXX` repeatedly to create the initial task set.

Then edit each `studies/STUDY-XXX/tasks/TASK-XXX.md` directly so it matches a real first-pass move.

By default, create **2-4** initial tasks.

Prefer tasks that are as independent as possible.

Only add a dependency edge when one task truly cannot start before another task produces something essential.

Only fall back to a single initial task when the study is genuinely atomic and splitting it would be artificial.

### 4. Keep the study and task set aligned

The initial tasks should together cover the small complete first pass needed to judge, refine, or block the study honestly.

Examples:

- if the study question is about feasibility, one task may be a data or environment reality check while another task verifies annotation or cohort fit
- if the study question is already feasible, split the first-pass work into separate evidence units such as data preparation, primary comparison, and figure-ready summarization
- if the main uncertainty is annotation validity, create a focused validation task beside, not inside, a broader downstream analysis task when they can be inspected independently
- if the study needs preparation work to make the main hypothesis testable, keep that preparatory task inside the same study instead of pretending it is a separate study

### 4.5 Choose executor skills at the problem level

When a task needs concrete executor skills:

- first reason from study-brain heuristics
- then use `qdd skills suggest` with controlled `domain + stage + tag` filters
- write one small bundle of problem-level skills into the task only after the choice is clear
- record the chosen skills directly in task frontmatter and in the task body `## Skills` section

This is part of propose, not something to leave for apply to invent later.

For each task, make the selection path legible:

- which study-brain heuristic triggered the search
- which `domain`, `stage`, and `tag` filters were used
- which returned skill(s) were chosen for this task

If no installed executor skill fits, leave the task skill list empty only deliberately, and state in the task body that execution will rely on general code generation rather than a local reusable skill.

Do not write primitive method names as if they were skills.

Prefer problem-level skills such as:

- `singlecell/scrna/sc-preprocess-qc`
- `singlecell/scrna/sc-batch-integration`
- `singlecell/scrna/sc-clustering`
- `singlecell/scrna/sc-marker-annotation`
- `singlecell/scatac/scatac-preprocess-lsi`
- `singlecell/scatac/scatac-batch-latent`
- `singlecell/scatac/scatac-annotation-geneactivity`
- `singlecell/scatac/scatac-dar`
- `singlecell/public-data/cellxgene-discover`

### 4.6 Handle external public data during planning

When the study may need external public data:

- first decide whether local resources are already sufficient
- do not create a public-data task by reflex
- if outside data is genuinely required, use the public-data planning brain guidance
- use `qdd skills suggest --domain singlecell --stage acquisition --tag public-data --tag cellxgene --json` when the executor skill choice matters
- keep candidate review in the planning conversation
- persist only the final selected target set in `studies/STUDY-XXX/output/public_data_request.yaml`

If no acceptable public dataset is found:

- either keep the study local-only
- or record a bounded blocker if outside data is genuinely required

Do not invent a fake selected target just to keep the task graph moving.

### 5. Stop once the first pass is usable

Do not stay in propose mode trying to optimize everything.

Stop when the project has:

- one clear study
- a small initial task set with clear boundaries
- enough written context for later discussion in `qdd-explore`
- no obvious first-pass evidence gap that apply would have to invent later

---

## How To Write The Study

Use the existing `study.md` template sections.

Write them concretely:

- `## Question`: one bounded question only
- `## Hypothesis`: a falsifiable expectation, not a slogan
- `## Why Now`: why this belongs in the current loop
- `## Resource Fit`: what data, runtime, biology, or prior artifacts matter
- `## Evidence Plan`: what outputs would make the study judgeable
- `## Blockers`: real blockers, not generic uncertainty
- `## Tasks`: list the initial tasks you just created

Do not leave these as generic filler if you already know the answer.

---

## How To Write The Initial Tasks

Use the existing `task.md` template sections.

Write them concretely:

- `## Depends On`: real dependencies or `None`
- `## Input`: actual study/context/artifact inputs
- `## Expected Output`: the specific evidence this task should produce
- `## Checklist`: rewrite the scaffold into task-specific executable steps
- `## Skills`: only list concrete problem-level executor skills that genuinely matter, already exist under the QDD root `domain-skills/` library, and are valid in `.qdd/skills-catalog.json`
- never write `qdd/*` workflow skills or `brain/*` planning skills into a task record
- if the task clearly belongs to a known problem class, assign the executor skill during propose instead of deferring that choice to apply
- if the task is a public-data acquisition task, finalize `studies/STUDY-XXX/output/public_data_request.yaml` during planning so apply only downloads the selected targets

Each initial task should be:

- evidence-producing
- minimal
- auditable
- obviously connected to the study question
- as independent as practical from sibling tasks

Across the initial task set:

- prefer parallel or loosely coupled work over serial chains
- do not collapse the whole study into one omnibus task
- do not stop at one task if the study obviously needs several distinct evidence-producing moves
- do not pre-plan a deep task tree just because more work is imaginable

---

## Mode Handling

### human

- Prefer making a conservative first pass directly.
- Ask the user only when missing information would make the study misleading.
- Do not drift into a long `explore`-style debate here.

### assist

- Same artifact-writing behavior as `human`.
- You may make slightly stronger drafting decisions, but keep them reversible.
- Preserve obvious places for later discussion in `qdd-explore`.

### auto

- Proceed directly if the context is sufficient.
- Keep the first pass minimal so later execution does not inherit a bloated plan.

---

## When To Ask The User

Ask only if one of these is true:

- the research direction is too ambiguous to define one bounded question
- there are multiple incompatible study framings and the choice is consequential
- a missing resource assumption would invalidate the task you are about to create
- the user explicitly asks to compare options before writing

Otherwise, write the first pass and keep moving.

---

## Example Entry Points

**User brings a broad idea**

```text
User: I want to use our AD dataset to understand ALOX12B-low keratinocytes.

You:
1. Read qdd status/context
2. Create STUDY-XXX with one bounded question
3. Create 2-4 initial tasks such as a data-and-metadata reality check, a cohort-definition task, and a first comparison task
4. Report what you created and what should be explored next
```

**User brings a partially formed hypothesis**

```text
User: I think ALOX12B-low might mark a barrier-impaired KC state.

You:
- write that as the working hypothesis
- keep the study question bounded to what the current dataset can test
- create a small set of first-pass tasks that can each produce inspectable evidence for or against that claim
```

**User already has a study but wants a usable first-pass task set**

```text
User: The study exists but it has no good initial task breakdown.

You:
- read the current study
- create a small first-pass task set
- update the study's Tasks section so the study and task set are aligned
```

---

## What To Report Back

When propose work is done, report succinctly:

- study id
- task ids
- bounded question
- task goals
- main blocker or key uncertainty, if any
- whether the next best step is `qdd-explore` or `qdd-apply`

---

## Guardrails

- Do not build a large task tree in propose mode.
- Do not leave the created study or task in obvious placeholder form if you had enough context to be concrete.
- Do not leave obvious within-study follow-up work unplanned if it is already foreseeable from the question and resources.
- Do not turn propose into implementation.
- Do not turn propose into a free-form discussion session.
- Prefer a small set of loosely coupled initial tasks over one vague omnibus task.
- Rewrite the default task checklist so it matches the actual task.
- Stay within QDD's research-native object model.
