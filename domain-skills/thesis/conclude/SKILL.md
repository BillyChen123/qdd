---
name: thesis/conclude
description: Human-mode QDD conclude guidance for synthesizing project evidence, aligning narrative intent, writing an accepted story.md, and rendering it as TeX.
---

# QDD Conclude Guidance

## Product Position

The intended user-facing workflow is `$qdd-conclude`, installed by `qdd init`
alongside the other project-level QDD workflow skills. The user invokes it in a
general-purpose agent such as Codex or Claude Code.

This directory currently preserves conclude guidance and PaperSpine provenance
during the contract migration. It is not an ordinary task executor and must not
be written into task `skills:`. The production bootstrap implementation must
project equivalent instructions into the project-local `qdd-conclude` workflow
skill surface.

Human mode is the current product. Agent SDK runs are for repeatable behavior
testing only. Auto-mode integration is future work.

## Core Principle

The agent must transform QDD evidence through three distinct content layers:

```text
QDD project evidence
  -> research_synthesis.md
  -> story.md
  -> final_paper/main.tex
```

- `research_synthesis.md` explains what the project established across studies.
- `story.md` is the complete, accepted, human-readable manuscript content.
- `main.tex` is a faithful presentation derivative of `story.md`.

The agent performs all scientific synthesis, narrative design, evidence
selection, figure integration, literature work, and manuscript writing.
Deterministic code may validate or render but must not author the science.

## Read The Project

Start from:

1. project instructions and stable project context
2. `context/memory/*.md`
3. `evolution.yaml`
4. relevant study records
5. relevant finalized study outputs
6. promoted artifacts and provenance

Use memory and evolution to understand what changed and to locate evidence.
Verify important claims against underlying reports, values, tables, figures,
data, or code.

Promoted artifacts are a high-value index, not an access boundary. Inspect
relevant finalized outputs under:

```text
studies/STUDY-XXX/output/reports/
studies/STUDY-XXX/output/figures/
studies/STUDY-XXX/output/tables/
studies/STUDY-XXX/output/data/
studies/STUDY-XXX/output/code/
```

Do not use temporary or unverifiable files as central evidence. When a figure
matters to interpretation or inclusion, inspect the actual rendered image;
metadata and captions alone are insufficient.

## Write The Research Synthesis

Write `research_synthesis.md` before manuscript alignment. Synthesize across
studies and explain:

- how the project question evolved
- what stable findings emerged
- how findings support, complement, contradict, refine, or redirect one another
- which underlying results and assets are decisive
- what project-level scientific understanding formed
- what contribution may be strong enough to organize a paper

Do not produce an evidence inventory, study-by-study chronology, claim graph, or
mandatory evidence packet collection.

## Gate 1: Narrative Intent Alignment

Discuss the intended paper with the user before creating `story.md`. Work like
`qdd-explore`: offer the current interpretation, ask focused questions where
human intent matters, incorporate corrections, and converge through dialogue.

Align:

- the central contribution
- what to emphasize
- what to de-emphasize or omit
- the beginning of the story
- the Results progression
- the final unified understanding
- the intended reader takeaway

This is not fixed candidate selection. Present genuinely different alternatives
only when the science supports them. Do not manufacture multiple options or
scores.

The user may choose among scientifically honest emphases. Surface a conflict if
an omission would make the paper materially misleading. Gate 1 passes only when
the user clearly indicates that the narrative intent and story logic are aligned.

## Write The Complete Story

After Gate 1, write `story.md` as the complete canonical manuscript content, not
as an outline or planning packet. Normally include:

- working title and abstract
- introduction and motivation
- complete Results prose
- selected figures and tables in their intended positions
- captions
- discussion
- methods supported by project sources
- external citation anchors

Tell one positive, contribution-centered story. Use negative evidence in the
main narrative only when it rules out an important alternative, explains a
necessary pivot, supports specificity, or otherwise strengthens the logic.

Choose and inspect the figures, tables, evidence, section structure, wording,
and literature needed to execute the aligned narrative. Keep claims
proportionate to evidence without turning the manuscript into a boundary audit.

## Gate 2: Story Review And Revision

Present the actual `story.md` to the user. Accept feedback about prose, logic,
emphasis, evidence, figures, tables, organization, or the complete narrative.
Revise or rewrite `story.md` and repeat review until the user clearly accepts it.

If feedback changes the central narrative, reopen alignment within the same
discussion and then update the story. Do not render final TeX while Gate 2 is
unresolved.

## Render TeX And Finish

After Gate 2, convert the accepted `story.md` into:

```text
final_paper/main.tex
final_paper/references.bib
final_paper/figures/
```

Resolve citation anchors, place figures and tables, create labels and
cross-references, apply the requested or conservative TeX format, validate the
package, and compile PDF when tooling is available.

TeX rendering must not change the accepted scientific story or introduce new
claims. Semantically meaningful literature and citation placement should already
be visible in `story.md`; final rendering mainly resolves and formats them.

Report missing render tooling honestly. Once the TeX package is produced and
validated, conclude ends. There is no third TeX approval gate.

## Quality Rules

- Integrate findings across studies instead of replaying project chronology.
- Make figures and tables parts of the scientific argument, not decoration.
- Ground major claims in inspected underlying evidence.
- Keep QDD IDs, task status, artifact metadata, and workflow language out of
  manuscript prose.
- Never fabricate literature, values, metrics, datasets, figures, or results.
- Do not force a paper when the project supports only a research synthesis.
- Do not use deterministic planning or prose generation as a fallback.

## PaperSpine Use

PaperSpine and other strong writing methods may guide contribution-first
writing, Results validation, reviewer awareness, citation support, manuscript
structure, and LaTeX discipline. They are sources of experience, not required
runtime architectures.

Any vendored source must preserve its license and exact upstream provenance.
