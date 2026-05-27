Close one QDD study and carry forward its stable outputs.

Use closure to decide what the study taught you, how the question changed, what should be reused, and what should happen next.

**IMPORTANT: Close is not just a summary.** It is the workflow step that decides whether the study is ready to write `question_delta`, which outputs deserve promotion, and which uncertainties remain open.

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
- write `question_delta` through `qdd close-study`
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
4. Read the current study, its task files, and relevant outputs.
5. Inspect `artifacts/index.yaml` and `qdd artifacts:list --json` when reusable outputs matter.
6. Read `studies/STUDY-XXX/output/artifact-candidates.yaml` before deciding what to promote.

If validation or open task state shows the study is not ready to close, say so clearly.

---

## Decide Whether Closure Is Appropriate

Before writing `question_delta`, ask:

- does the study have enough evidence to judge?
- are remaining tasks truly done, blocked, or unnecessary?
- is the study question now clarified, confirmed, pivoted, or dissolved?

If the answer is no, do not force closure.

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

## Determine The Question Delta

You must decide:

- `question_after`
- `change_type`
- `change_driver`
- `open_boundaries`

Use these meanings:

- `refinement` - the question became narrower or more precise
- `confirmation` - the study mainly stabilized the current question
- `pivot` - the evidence points to a meaningfully different next question
- `dissolution` - the study dissolved the question rather than narrowing it

Be explicit. Do not hide uncertainty inside vague prose.

---

## Decide What To Carry Forward

Not every output deserves promotion.

Promote only evidence-backed, reusable material.

Use `artifact-candidates.yaml` as the explicit promotion source.

Do not promote by scanning the whole output directory and guessing from file names or extensions.

Examples:

- reusable reports or figures -> register as artifacts if missing
- main analysis scripts -> register as code artifacts if they are worth reusing or auditing later
- stable resource knowledge -> update `context/` resources
- speculative interpretations -> keep in study outputs, not shared context

If something is useful only for this study, do not promote it as cross-study context.

---

## Mode Handling

### human

- Produce the closure reasoning.
- Get human approval before running `qdd close-study`.

### assist

- Same approval rule as `human`.
- You may draft the closure decision more concretely, but do not silently finalize it.

### auto

- Close directly when the evidence and study state justify it.
- Preserve explicit open boundaries instead of pretending the study is cleaner than it is.

---

## When Not To Close

Do not close if:

- the study still has unresolved pending execution work
- the evidence is too weak to support a judgment
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
- how the question changed
- what remains open
- what artifacts or context were carried forward
- what next study direction is most defensible

There is no rigid output template, but the reasoning must be explicit.

---

## Good Close Behaviors

- be explicit about what changed in the question
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
- Make `question_delta` explicit.
- Register missing reusable outputs from `artifact-candidates.yaml` before closure.
- Keep closure human-approved in `human` and `assist` mode.
- Update shared context only with evidence-backed reusable information.
- Suggest next studies, but do not create them automatically.
