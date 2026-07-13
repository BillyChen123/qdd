# PRD: QDD Conclude

## Product Definition

QDD Conclude is a human-guided workflow skill that turns a completed or
synthesis-ready QDD project into a coherent, evidence-rich scientific paper.
The user opens a general-purpose agent such as Codex or Claude Code and invokes
`$qdd-conclude` from inside the QDD project.

Conclude is not a TypeScript manuscript generator and is not currently an
autonomous QDD runtime phase. The general-purpose agent performs the research
synthesis, discusses the intended narrative with the user, writes a detailed
story blueprint in Markdown, revises it with the user, and only then completes
the manuscript as a Nature-style TeX draft.

The central product problem is not collecting more files. A mature QDD project
already contains questions, study memories, evidence, reports, figures, tables,
and provenance. Conclude must transform those materials from an evidence
inventory into a project-level scientific understanding, and then into one
logically coherent, contribution-centered paper.

## Current Product Stage

This PRD defines **human mode only**.

- The production surface is the `$qdd-conclude` workflow skill loaded by Codex,
  Claude Code, or another supported general-purpose agent.
- `qdd init` installs the workflow skill into the project alongside
  `qdd-start`, `qdd-propose`, `qdd-explore`, `qdd-apply`, and `qdd-close`.
- The QDD CLI may provide read, validation, provenance, and rendering helpers,
  but it does not own scientific synthesis or manuscript writing.
- An Agent SDK may run the same skill in tests to simulate multi-turn user
  interaction and evaluate behavior. The SDK is not the human-mode product
  entry point.
- Auto-mode integration is future work. It must not be implemented until the
  human workflow and its evaluation cases are mature.

Tool-specific invocation syntax may differ, but the installed workflow identity
is `qdd-conclude`. For Codex, the expected explicit invocation is
`$qdd-conclude`.

## Bootstrap And Skill Ownership

Conclude is a project-level QDD workflow skill, not an ordinary task executor or
domain skill. It must be projected by `qdd init` into the same project-local
workflow surfaces as the existing core loop, including:

```text
.codex/skills/qdd/qdd-conclude/SKILL.md
.claude/skills/qdd-conclude/SKILL.md
.claude/commands/qdd-conclude.md
```

Claude command and Codex prompt projections may also be installed where the
existing bootstrap architecture requires them. Refreshing bootstrap assets with
`qdd init . --refresh-bootstrap` must refresh conclude as well.

The installed skill contains the actual production instructions followed by the
general-purpose agent. It must not be reduced to a thin prompt that delegates
semantic work to a deterministic service. `qdd-conclude` must never be written
into an ordinary task's `skills:` field.

## Agent-Native Responsibility

The general-purpose research agent owns all semantic and editorial work:

- reconstructing the project question and its evolution
- synthesizing knowledge across studies
- locating and inspecting the underlying study outputs and promoted artifacts
- deciding the central contribution and story logic with the user
- selecting, viewing, and integrating figures and tables
- deciding what to emphasize, de-emphasize, or omit
- writing and revising `research_synthesis.md` and `story.md`
- finding and verifying the external literature needed by the paper
- keeping claims proportionate to the evidence while telling the strongest
  coherent positive story
- completing a source-grounded manuscript draft after the user accepts
  `story.md`, including prose expansion, literature verification, citations,
  TeX structure, and figure and table placement

Deterministic code may support mechanical operations such as QDD-state reading,
path validation, provenance checks, bibliography validation, TeX conversion,
and PDF rendering. It must not replace agent reasoning with regexes, keyword
scores, ranking heuristics, fixed biological templates, deterministic claim
selection, or assembled narrative fragments.

## QDD Source Model

The agent uses different QDD sources for different purposes.

### Memory

`context/memory/*.md` is the primary semantic index of what each closed study
established, how it was interpreted, what was reused, and what remained open.
Memory helps the agent understand the project without reconstructing every study
from task logs.

Memory is interpretation and navigation, not sufficient evidence for a
manuscript claim. Important claims must be verified against the underlying
study output or artifact.

### Evolution

`evolution.yaml` explains how the research question was confirmed, refined,
pivoted, or dissolved across studies. It helps the agent reconstruct why one
scientific question led to another.

Question evolution is a reasoning source, not a required manuscript chronology.
The paper should select the logical path needed by its central contribution
rather than replay the order in which the project was executed.

### Studies And Study Outputs

Study records provide local question, method, execution, and interpretation
context. The agent must be allowed to inspect all relevant finalized study
outputs, including:

```text
studies/STUDY-XXX/output/reports/
studies/STUDY-XXX/output/figures/
studies/STUDY-XXX/output/tables/
studies/STUDY-XXX/output/data/
studies/STUDY-XXX/output/code/
```

Promoted artifacts are not an access boundary. A relevant finalized study
output may support the paper even if it was not promoted earlier. Temporary,
scratch-only, or unverifiable output must not support a central claim.

### Artifacts

Promoted artifacts are high-value, reusable evidence anchors and should be
inspected early. They provide canonical paths and provenance for important
reports, figures, tables, data, and code.

Artifact existence alone is not evidence. The agent must read the report or
table content and verify the relevant values. A vision-capable agent should also
inspect the rendered image when a figure affects interpretation or appears in
the paper. When the configured model cannot inspect image pixels, it may select,
place, caption, and cite figures from source-backed captions, reports, study
outputs, and provenance, must not claim unsupported visual observations, and
must defer pixel-level verification to the human. Lack of model vision is not a
workflow failure.

## Core Workflow

### 1. Preflight And Orientation

The agent confirms that it is inside a readable QDD project, reads project
instructions, checks QDD state, and identifies relevant project context. It
reads memory and evolution first to form a project map, then uses that map to
locate the studies, outputs, artifacts, reports, figures, and tables that require
deep inspection.

The default language for `research_synthesis.md`, `story.md`, and the final
manuscript is English. The default manuscript format is the tracked QDD Nature
template. The agent may ask for a different language, paper type, target venue,
length, or template when that preference materially affects the work.

### 2. Project Research Synthesis

The agent writes `research_synthesis.md` before proposing a manuscript story.
This document answers:

> What did the QDD project establish when its studies and evidence are considered
> together?

It must integrate across studies rather than enumerate them. It should make
legible:

- the project question and the important changes in that question
- the major findings that remained stable across the project
- how results support, complement, contradict, refine, or redirect one another
- which study outputs, reports, figures, tables, and values are decisive
- what project-level scientific model or understanding emerged
- which possible contribution appears strong enough to organize a paper
- the exact sample, method, statistical, and dataset facts needed for drafting
- a source trail from every decisive claim and value to the relevant study
  output, report, table, artifact, or project record
- candidate figures and tables, their source paths, supported captions, and
  intended argumentative roles
- available literature identifiers and precise literature questions that still
  require external verification

`research_synthesis.md` should preserve relevant complexity, including negative
or contradictory evidence when it materially changes the project-level
understanding. It is the complete source-grounded scientific substrate for later
story design and manuscript drafting. It should optimize for completeness,
traceability, and downstream usefulness rather than polished narrative prose.
It is not an evidence packet collection, claim graph, omission ledger, or
manuscript outline, and later stages must still verify decisive claims against
the underlying sources rather than treating the synthesis as evidence by itself.

### 3. Gate 1: Narrative Intent Alignment

After the research synthesis exists, the agent enters a multi-turn discussion
with the user before creating `story.md`. This interaction should resemble
`qdd-explore`: the agent proposes its current understanding, the user corrects
or redirects it, and both sides converge on one intended paper narrative.

The discussion aligns:

- the paper's central contribution
- what the paper should emphasize
- what should be de-emphasized or left outside the main story
- where the story begins
- how the Results logic progresses
- what unified understanding the story should reach
- what the reader should remember after reading the paper

This is not a candidate-selection engine. The agent may present alternatives
when genuinely different scientific framings exist, but it must not manufacture
a fixed number of candidates, scores, claim bundles, or structured story packets.

The user controls editorial emphasis among scientifically honest framings. If a
requested omission would make the central narrative materially false or
misleading, the agent must surface that conflict during alignment.

Gate 1 passes only when the user clearly indicates that the central narrative
and story logic are aligned. Before that point, the agent may keep temporary
notes, but it must not treat a provisional `story.md` as confirmed manuscript
content.

### 4. Detailed Story Blueprint

After Gate 1, the agent writes `story.md`. This is the human-readable narrative
contract that the user reviews. It is more detailed than an outline but is not
required to contain every sentence of the submission-ready manuscript.

Depending on paper type, `story.md` normally contains:

- a working title and abstract-level summary
- the Introduction argument and motivation
- a complete Results sequence with the claim and evidence carried by each part
- selected figures and tables embedded or linked in the appropriate positions
- figure and table captions
- the Discussion interpretation and intended conclusion
- the Methods scope and decisive methodological facts
- precise external citation-needed anchors where literature support remains to
  be found, including what proposition each citation must support

The agent decides which figures, tables, evidence, section structure, and claim
wording best execute the aligned narrative. The user does not need to approve
those decisions separately before seeing the resulting story.

The paper should tell one strong, positive, contribution-centered story.
Negative evidence belongs in the main narrative only when it rules out an
important alternative, explains a necessary pivot, supports specificity, or
otherwise strengthens the story's logic. Conclude does not require a visible
boundary section, exhaustive limitation list, claim-safety audit, or ledger of
unused evidence.

### 5. Gate 2: Story Review And Revision

The user reviews the actual `story.md`, including its narrative logic, evidence,
figures, tables, emphasis, and planned section content. The user may accept it,
request local edits, change emphasis, restructure sections, replace or remove
material, or request a substantial rewrite.

The agent revises `story.md` directly and repeats this review loop until the user
clearly accepts it. If feedback changes the central narrative, the agent may
reopen narrative alignment within the same discussion before rewriting the
story. `story.md` always represents the current accepted narrative contract, not
an immutable one-time selection.

Gate 2 is the final semantic and editorial checkpoint. Conclude must not render
the final TeX package before the user accepts `story.md`.

### 6. Nature Manuscript Drafting And Completion

After Gate 2, the agent uses the accepted `story.md`, the more detailed
`research_synthesis.md`, and the underlying project sources to write a complete
first-draft manuscript as a TeX package. This is a constrained manuscript-writing
stage, not a mechanical Markdown renderer. The agent must:

- expand the accepted narrative into polished scientific prose
- fill source-supported Introduction, Results, Discussion, and Methods details
  that the blueprint intentionally leaves compressed
- resolve every citation-needed anchor through verified literature research and
  produce matching `\cite{}` commands and BibTeX entries
- place the accepted figures and tables with labels, cross-references, and
  source-supported captions
- eliminate all drafting placeholders, including `TODO`, `TBD`, `citation
  needed`, `待补`, and empty required sections
- apply the tracked QDD Nature manuscript template
- run mechanical TeX, bibliography, path, and asset checks
- compile PDF when the local environment supports it

If a nonessential citation-needed proposition cannot be verified, the agent
must remove or conservatively rewrite that proposition rather than leave a
placeholder or invent a source. If an essential claim cannot be supported, it
reports the concrete blocker once and must not declare the manuscript complete
or spend paid retries against an unchanged provider failure.

The default package uses `\documentclass[pdflatex,sn-nature]{sn-jnl}`. It omits
the author and affiliation block. It retains title, keywords, and bibliography;
the manuscript body contains only Abstract, Introduction, Results, Discussion,
and Methods. The bibliography follows Methods, and all figure and table
environments are placed after the bibliography while remaining normally cited
from the body.

PDF compilation is a best-effort capability, not a completion gate. The agent
may probe once for an existing compiler, but must not install, download, or
configure a TeX distribution as part of conclude. When no compiler is
available, it records PDF status as `unavailable`, completes all compiler-free
package checks, and continues to normal handoff. Missing local TeX tooling does
not invalidate the accepted story or validated TeX package.

The manuscript-drafting stage must preserve the accepted story's central
contribution, Results logic, evidence selection, figure and table plan, claim
strength, and intended conclusion. It may substantially improve wording,
translate blueprint statements into full prose, add verified background
literature, and restore source-supported quantitative or methodological detail.
It must not use completion as permission to introduce a new central claim,
change the scientific argument, replace accepted evidence for editorial reasons,
or invent missing project facts. There is no third approval gate; the resulting
TeX is a strong first draft that the user may edit after conclude ends.

After producing the TeX package and reporting the conditional PDF status,
the `$qdd-conclude` workflow ends. Later user-directed editing of TeX or the
published manuscript is ordinary writing work outside this conclude lifecycle.
There is no third TeX approval gate.

## Deliverable Contract

Default output directory:

```text
conclusions/<run-id>/
```

Core outputs:

```text
research_synthesis.md
story.md
final_paper/
  main.tex
  references.bib
  sn-jnl.cls
  latexmkrc
  bst/
    sn-nature.bst
  figures/
```

Conditional rendered output:

```text
final_paper/paper.pdf
```

`research_synthesis.md` is the complete project-level scientific substrate and
source trail. `story.md` is the accepted narrative contract presented for human
review. `main.tex` is the source-grounded manuscript draft produced from both
documents and the underlying project evidence.

The agent may use temporary notes while reasoning, but no evidence dossier,
claim graph, Results-beat schema, evidence-role map, omission ledger, viability
score, or writing-rationale matrix is a required product contract.

## Story Quality Contract

An acceptable `story.md` must:

- express one clear and worthwhile central contribution
- remain faithful to inspected study outputs and artifacts
- integrate evidence across studies rather than summarize studies in order
- organize Results as a logical question-to-answer progression
- identify the quantitative, visual, and methodological support required by its
  main claims, with enough detail to guide final drafting
- use figures and tables as parts of the argument rather than decoration
- keep claims proportionate to the evidence without turning the paper into a
  defensive list of boundaries
- keep QDD workflow IDs, task status, artifact metadata, and provenance syntax
  out of visible prose
- use verified literature when already available and otherwise state precise,
  proposition-level citation needs that the manuscript stage must resolve
- read as a coherent paper blueprint rather than a project log, audit report,
  evidence inventory, empty outline, or collection of disconnected findings

If the project supports a coherent research synthesis but not a defensible
paper, the agent must say so during narrative alignment rather than generate
filler. The user may still choose to produce a bounded research report, but the
skill must not mislabel it as a supported scientific manuscript.

## Hard Failure Modes

The following fail the product even when expected files exist:

- treating a CLI command, TypeScript service, or SDK runner as the human-mode
  production author
- creating `story.md` before narrative intent has been aligned with the user
- rendering TeX before the user has accepted `story.md`
- generating a fixed set of scored story candidates when no real framing
  ambiguity exists
- restricting evidence access to promoted artifacts and ignoring relevant
  finalized study outputs
- relying on memory, captions, filenames, or metadata without verifying decisive
  underlying evidence
- treating unavailable model vision as a hard gate, or claiming pixel-level
  observations when only captions, reports, and provenance were inspected
- concatenating study summaries or artifact descriptions into manuscript prose
- organizing the paper around QDD execution chronology
- treating final manuscript drafting as mechanical string conversion
- changing the accepted central contribution, Results logic, evidence selection,
  or conclusion during final manuscript drafting
- leaving unresolved drafting or citation placeholders in `main.tex`
- generating a non-Nature default package or placing figure and table
  environments inside the manuscript body
- fabricating or mismatching citations, metrics, values, datasets, or results
- declaring conclude complete while either human gate is unresolved

## Evaluation Contract

Deterministic tests should verify bootstrap projection, tracked template assets,
required file paths, mechanical validation, citation integrity, section order,
placeholder removal, and faithful asset handling.

Agent SDK evaluations may load the same production skill and simulate the two
multi-turn human gates. New conclude behavior work must not add fabricated
scientific fixtures or use fake evidence as manuscript-quality acceptance. The
current live acceptance project is the real local Parkinson QDD project resolved
from:

```text
QDD_CONCLUDE_LIVE_PROJECT
```

This local project is evaluation input, not content to copy into the QDD
repository and not a permanent exact-text oracle. The exact machine-local path
may instead be supplied by the current implementation issue. SDK evaluation
must cover at least:

1. the agent reads memory/evolution and then verifies relevant study outputs and
   artifacts
2. `research_synthesis.md` integrates findings across studies
3. user feedback during Gate 1 changes the eventual central narrative and story
   logic
4. the agent does not require fixed candidate selection
5. the agent writes `story.md` only after narrative alignment
6. user rejection during Gate 2 causes `story.md` to be revised or rewritten
7. TeX is produced only after story acceptance
8. the final manuscript expands the accepted blueprint without changing its
   central narrative or claim strength
9. `main.tex` uses the tracked `sn-nature` template, contains only the required
   manuscript sections, has verified citations, and has no unresolved drafting
   placeholders
10. figures are integrated from verified textual evidence and provenance; actual
    image inspection is evaluated only when the configured model supports vision

Semantic review of `research_synthesis.md` and `story.md` remains useful, but an
automated model reviewer is advisory. Missing model vision, reviewer
`cannot_assess`, or a reviewer request that depends only on unavailable image
inspection must not block human review, trigger paid retries, or cause unrelated
production-code changes. File existence, section counts, keyword scores, and TeX
validity alone are still insufficient evidence of manuscript quality.

## Acceptance Criteria

- `qdd init` installs and refreshes `qdd-conclude` alongside the five existing
  QDD workflow skills for supported general-purpose agents.
- A user can invoke `$qdd-conclude` inside a QDD project without starting an SDK
  or dedicated conclude CLI authoring pipeline.
- The agent reads memory and evolution for project understanding and may inspect
  any relevant finalized study output as well as promoted artifacts.
- The agent writes an English cross-study `research_synthesis.md` that preserves
  the complete scientific substrate, source trail, methods facts, key values,
  candidate figures and tables, and literature needs required downstream.
- Gate 1 is a multi-turn narrative-alignment conversation, not a fixed story
  selection form.
- The agent creates an English, detailed `story.md` narrative blueprint only
  after Gate 1 passes.
- Gate 2 allows repeated review and rewriting of `story.md` until the user
  accepts it.
- `story.md` contains the accepted central contribution, Results logic,
  scientific emphasis, evidence and figure/table plan, and precise citation
  needs; it may intentionally compress prose that the final stage completes.
- Final manuscript drafting begins only after Gate 2, uses the synthesis and
  underlying sources as well as the accepted story, and does not change the
  accepted narrative contract.
- The default `main.tex` uses the tracked `sn-nature` template, omits the author
  block, contains only Abstract, Introduction, Results, Discussion, and Methods,
  places references before all figure and table environments, includes verified
  citations, and contains no unresolved drafting placeholders.
- The workflow ends after producing and validating the TeX package and reporting
  conditional PDF render status; an unavailable local compiler is nonblocking
  and no third gate is required.
- SDK tests simulate both gates but do not redefine the production entry point.
- Auto-mode integration remains explicitly out of scope for this human-mode
  release.

## PaperSpine And Other Writing Methods

PaperSpine may inform contribution-first writing, Results validation, reviewer
awareness, citation support, manuscript structure, and LaTeX discipline. Other
strong scientific-writing methods may be adopted when they produce better
QDD-specific synthesis and story quality.

PaperSpine is a source of experience, not the product architecture, a required
runtime dependency, or QDD's identity. Conclude's distinctive responsibility is
the transformation from QDD memory, question evolution, studies, and evidence
into a coherent project-level synthesis, an accepted narrative `story.md`, and a
source-grounded manuscript draft.

Any vendored external source must preserve its license, upstream repository,
version, commit, and local modification notes.

## Superseded Requirements And Symphony Sequencing

This PRD supersedes earlier requirements for a `qdd conclude` production CLI
author, Agent SDK production session, evidence-dossier pipeline, deterministic
story planner, fixed story candidates, canonical claim graph, evidence-role
engine, omission ledger, viability scoring, or a large mandatory planning
artifact tree.

Mechanical TeX, citation, path, provenance, and rendering code may be reused
when it respects `story.md` as the accepted narrative contract and leaves final
scientific writing to the agent.
Deterministic scientific planning and runtime-generated manuscript prose must
not remain as production fallbacks.

For Symphony delivery, this human-mode architecture contract must merge to
`main` before implementation issues begin. Downstream issues should be split by
bounded responsibility, such as bootstrap projection, workflow-skill content,
source inspection, two-gate SDK evaluation, and constrained Nature manuscript
drafting. Each issue must use a base commit that already contains this PRD and
must not expand scope into auto mode.
