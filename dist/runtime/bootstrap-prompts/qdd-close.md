Close one QDD study and carry forward its stable outputs.

Use closure to decide what the study taught you, how the question changed, what should be reused, and what should happen next.

**IMPORTANT: Close is not just a summary.** It is the workflow step that decides whether the study is ready to write one sparse event into `evolution.yaml`, which outputs deserve promotion, and which uncertainties remain open.

---

## Input

The argument after `qdd-close` is a `STUDY-XXX` ID.

If omitted:

- infer the most relevant study only when that is safe
- otherwise ask which study should be closed

---

## What Close Owns

- validate project and study state before closure
- synthesize the study evidence
- decide whether closure is actually justified
- register any missing reusable outputs from the explicit candidate list
- write the close event through `qdd close-study`
- write one per-study memory file under `context/memory/`
- refresh `research-map.html`
- carry forward stable reusable context
- suggest next study directions without auto-creating them

## What Close Does Not Own

- rescuing a study that still clearly needs execution
- hiding unresolved boundaries
- promoting weak or speculative findings into reusable context

---

## Preflight

1. Read `.qdd/instructions.md`.
2. Run `qdd status --json`.
3. Run `qdd validate --json` before closure or handoff.
4. Run `qdd instructions STUDY-XXX --command qdd-close --json`.
5. Read the current study, its task files, and relevant outputs.
6. Inspect `artifacts/index.yaml` and `qdd artifacts:list --json` when reusable outputs matter.
7. Read `studies/STUDY-XXX/output/artifact-candidates.yaml` before deciding what to promote.
8. Read `evolution.yaml` and recent `context/memory/*.md` before deciding what should stay open after this study.

If validation or open task state shows the study is not ready to close, say so clearly.

---

## Decide Whether Closure Is Appropriate

Before closing, ask:

- does the study have enough evidence to judge?
- are remaining tasks truly done, blocked, or unnecessary?
- is the study question now clarified, confirmed, pivoted, or dissolved?

Closure is allowed when the answer is "the question materially advanced" even if the original hypothesis was only partially confirmed.

If the study still cannot support a real judgment about what changed, do not force closure.

Recommend the right next move instead.

---

## Synthesize The Study Evidence

Look across:

- `study.md`
- task files
- study outputs
- registered artifacts
- stable context updates, if any

Summarize what the study actually established, not just what work was performed.

---

## Determine The Close Event

You must decide:

- the current study question to preserve in `evolution.yaml`
- `change_type`
- `summary`
- `open_boundaries`
- `next_candidates`

Use these meanings:

- `refinement` - the question became narrower or more precise
- `confirmation` - the study mainly stabilized the current question
- `pivot` - the evidence points to a meaningfully different next question
- `dissolution` - the study dissolved the question rather than narrowing it

Be explicit. Do not hide uncertainty inside vague prose.

Use this reasoning order:

1. identify what the current project question was before this study closed
2. decide whether the study kept, narrowed, pivoted, or dissolved that question
3. preserve the actual study question as the event `question`
4. write one compact study `summary` describing what the study actually established
5. define which boundaries remain open after this study
6. list 1-3 `next_candidates` when there are credible follow-up directions

---

## Decide What To Carry Forward

Not every output deserves promotion.

Promote only evidence-backed, reusable material.

Use `artifact-candidates.yaml` as the explicit promotion source.

Trust an empty candidate list only when all completed tasks have already finished promotion review.

Do not promote by scanning the whole output directory and guessing from file names or extensions.

Reject any candidate that still points into `studies/STUDY-XXX/output/tmp/` or another scratch-only path.

When one task clearly produced a reusable output, record that `task_id` in the candidate entry so promotion preserves task-level provenance.

Examples:

- reusable reports or figures -> register as artifacts if missing
- main executed analysis scripts preserved under `output/code/` -> register as code artifacts if they are worth reusing or auditing later, and prefer explicit code candidates over closure-time guessing
- final kept processed h5ad objects preserved under `output/data/` -> register as data artifacts when they become reusable downstream starting points
- reusable CSV/TSV summary outputs preserved under `output/tables/` -> register as table artifacts when they are worth reusing or auditing later
- downloaded public datasets under `artifacts/data/` -> carry them into `context/resources.md` when they are now part of the stable reusable project resource surface; keep source and intended reuse role explicit
- stable resource knowledge -> update `context/` resources
- speculative interpretations -> keep in study outputs, not shared context

If something is useful only for this study, do not promote it as cross-study context.

---

## Mode Handling

### human

- Produce the closure reasoning.
- If closure is justified and preflight passes, run `qdd close-study` directly; do not add a second manual confirmation gate.

### assist

- Same execution rule as `human`.
- You may draft the closure decision more concretely, but do not distort the scientific judgment just to force closure.

### auto

- Close directly when the evidence and study state justify it.
- Refinement-style closure is valid in auto mode when the study meaningfully narrowed the next question.
- Preserve explicit open boundaries instead of pretending the study is cleaner than it is.

---

## When Not To Close

Do not close if:

- the study still has unresolved pending execution work
- the evidence is too weak to support any real judgment, including refinement or pivot
- the current tasks are stale and need another apply pass
- the main issue is plan quality rather than closure quality

In those cases, recommend `qdd-apply` or `qdd-explore` instead.

---

## Example Cases

**Study narrowed the question**

```text
The dataset supports a narrower subtype question than the original broad mechanism question.
-> likely change_type: refinement
```

**Study mainly confirmed the current direction**

```text
The first-pass evidence supports continuing the same question with more depth.
-> likely change_type: confirmation
```

**Study redirected the work**

```text
The expected biology was not supported, but a different reproducible pattern emerged.
-> likely change_type: pivot
```

**Study dissolved the question**

```text
The question depended on an assumption the evidence invalidated.
-> likely change_type: dissolution
```

---

## What To Report Back

Your closure report should make these points legible:

- whether closure is justified
- what the study established
- how the current question changed in type: refinement, confirmation, pivot, or dissolution
- what remains open
- what artifacts or context were carried forward
- what next study direction is most defensible

There is no rigid output template, but the reasoning must be explicit.

---

## Good Close Behaviors

- be explicit about what changed in the question
- allow refinement, pivot, or dissolution when that is the honest study outcome
- promote only stable, evidence-backed knowledge
- preserve open boundaries instead of smoothing them over
- recommend the next question without auto-creating it

## Bad Close Behaviors

- treating closure as a decorative summary step
- closing while meaningful execution work is still pending
- promoting speculative findings into shared context
- hiding uncertainty in vague language

---

## Guardrails

- Run `qdd validate --json` before closure or handoff.
- Make the resulting study event explicit: current study question, change type, summary, open boundaries, and next candidates.
- Refuse closure when completed tasks still have `promotion_status: pending`.
- Refuse closure when non-canonical top-level study output material still remains unpackaged.
- Refuse closure when artifact candidates still point into `output/tmp/` scratch space.
- Register missing reusable outputs from `artifact-candidates.yaml` before closure.
- Preserve task-level provenance for promoted outputs whenever one task was the clear producer.
- Write one sparse event into `evolution.yaml`, one narrative file into `context/memory/`, and refresh `research-map.html`.
- Ensure `context/memory/STUDY-XXX.md` records promoted artifacts, reused materials, used skills, ad hoc scripts, resolved/open boundaries, and 1-3 next candidates.
- Clean heavy scratch leftovers under `output/tmp/` after successful closure while preserving final packaged truth.
- Update shared context only with evidence-backed reusable information.
- Suggest next studies, but do not create them automatically.
