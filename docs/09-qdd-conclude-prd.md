# PRD: QDD Conclude

## Product Definition

`qdd conclude` turns accumulated QDD evidence into an auditable manuscript draft. Its job is not to summarize every study. Its job is to identify the strongest defensible contribution, organize supporting and limiting evidence into a scientific story, and write that story as a TeX manuscript.

The canonical executable surface is the CLI command `qdd conclude`. `domain-skills/thesis/conclude/` supplies durable guidance and provenance; it is not a second product.

Conclude may be used mid-project to audit evidence and review a proposed story spine, or near project completion to produce a draft package. It does not run new biological analyses.

## Source Boundaries

Conclude reads the QDD project state, including contracts, evolution, memories, studies, tasks, artifact indexes, reports, figures, tables, and code provenance.

For scientific writing, source priority is:

1. promoted figure, table, dataset summary, and report content
2. reproducible analysis outputs and their provenance
3. study-level interpretation and stable project memory
4. task records and workflow status, used only to locate or audit evidence

Artifact descriptions, study summaries, and task text are not manuscript prose. They may guide retrieval, but scientific claims must be reconstructed from the underlying result content.

QDD question evolution is a planning source, not a manuscript chronology. Evolution events may explain why one result motivated, narrowed, ruled out, validated, or closed the next scientific question. Conclude selects only the evolution path needed for the paper's central contribution; operational detours and full execution history remain in provenance.

External literature supports background, related work, methods, and discussion. It must never supply results that the QDD project did not produce.

## Workflow Contract

### 1. Preflight

Validate that the project has readable QDD state and report available TeX and Word rendering tools. Missing render dependencies produce `BLOCKED`, not success.

### 2. Evidence Dossier

Build manuscript-oriented evidence packets from source artifacts. Each packet should capture:

- the scientific observation or comparison
- quantitative support and uncertainty when available
- reusable figure or table anchors
- scope and claim limits
- provenance back to QDD sources
- its role as supporting, boundary, negative-validation, or context evidence

The dossier is an internal reasoning boundary. Raw task, study, status, and artifact-description language must not flow directly into the story or manuscript.

### 3. Story Design

Consume the versioned scientific evidence dossier and the scientific transitions recorded by QDD question evolution. Do not read raw study or task prose as story content.

Produce one canonical manuscript story spine. It contains:

- one evidence-bounded central contribution
- an ordered sequence of question-answer Results beats
- a manuscript claim graph connecting lead, bridge, validation, boundary, and contradictory claims
- figure/table sequence, claim safety, missing validation, and reviewer risk
- an omission ledger for context-only, supplementary, redundant, failed, off-axis, and execution-only evidence
- multidimensional viability diagnostics for narrative closure, evidence coverage, figure readiness, claim safety, novelty risk, and missing validation

Each Results beat records the reader-facing scientific question, the evidence-backed answer, its claim and asset references, the bounded interpretation, and one transition type: `motivates`, `narrows`, `rules-out`, `validates`, or `closes`. A beat need not expose the question as literal prose, but the reasoning must be recoverable and auditable. Multiple QDD studies or tasks may compress into one beat, and one study may contribute nothing to the main story.

Evidence roles are editorial decisions:

- `core`: necessary to support the central contribution
- `bridge`: explains why the next scientific question or data modality follows
- `validation`: independently strengthens a claim
- `boundary`: changes the strongest allowed interpretation
- `context` or `supplementary`: useful but not part of the main Results spine
- `excluded`: redundant, off-axis, execution-only, erroneous, or scientifically nonessential

Negative evidence enters the main story only when it materially narrows a claim, rules out an alternative, or explains a scientifically necessary pivot. Failed searches, wrong paths, and operational errors remain in the omission ledger and provenance unless the paper's contribution specifically depends on them.

Optional emphasis profiles may change supporting evidence, figure priority, section weight, or Discussion emphasis. They must share the same central contribution, core claim set, and Results beat order. They are not separate story candidates.

If no coherent and adequately supported spine can close the argument, stop at `insufficient-evidence` instead of generating a filler manuscript. An audit-report, method paper, or “QDD workflow is the contribution” story is allowed only when the dossier itself scientifically studies and validates that contribution.

### 4. Human Story Review

Stop before drafting. The user reviews the canonical spine and may approve it, remove or reweight evidence, change an emphasis profile, or request revision. The gate confirms one story; it does not ask the user to choose among unrelated scientific papers.

The confirmed story must be stored as versioned structured JSON or frontmatter containing the full story snapshot, Results beats, evidence roles, omission ledger, and claim limits. Drafting resumes from those structured fields and must not recover confirmation by regex or prose parsing.

### 5. Manuscript Drafting

After selection, produce planning artifacts and a TeX manuscript package. Results are organized around scientific claims and figures, not around the order of QDD studies, tasks, or artifacts.

### 6. Audit And Rendering

Audit claim safety, evidence traceability, citation integrity, figure coverage, and manuscript viability. Always write `main.tex`; render PDF or Word only when dependencies are available.

## Manuscript Quality Contract

A passing draft must satisfy all of the following:

- The title, abstract, Results, and Discussion express one coherent, evidence-bounded contribution.
- Each major Results claim is synthesized from artifact content and includes the relevant comparison, effect, statistic, or uncertainty when available.
- Each major Results claim maps to at least one usable figure, table, or verifiable value.
- Results paragraphs advance the confirmed question-answer-transition spine; they do not enumerate evidence records or replay project chronology.
- Internal provenance remains auditable outside visible prose. Manuscript text cites internal results through scientific descriptions and figure/table references, not labels such as `ART-166`, `STUDY-016`, or `TASK-043`.
- Visible prose contains no QDD execution language, status fields, audit instructions, evidence IDs, artifact descriptions, or writing placeholders.
- Negative evidence narrows claims or motivates the next question; it is not dumped as a checklist.
- External claims use verified BibTeX entries and matching TeX citations.
- Associative, proxy, or underpowered evidence is not promoted to causal or mechanistic proof.
- If the evidence cannot support a viable manuscript story, conclude stops with a diagnostic instead of generating filler.

A useful Results paragraph usually contains a claim, the decisive observation or comparison, quantitative support, a figure/table anchor, and a bounded interpretation. This is a semantic requirement, not a fixed sentence template.

## Failure Modes

The following are hard failures even when a draft has all expected sections:

- concatenated artifact or study descriptions
- sentence fragments, duplicated punctuation, or metadata-shaped prose
- a paper organized as an inventory of studies, tasks, or artifacts
- Results claims with no actual value, comparison, or figure/table support when those sources exist
- internal evidence IDs exposed as manuscript citations
- unverified or fabricated external citations
- meta-writing such as “this section frames,” “must be added later,” or “current wording is bounded”
- a generic Introduction/Discussion that does not follow from the selected evidence chain
- a positive score produced only from section counts, file existence, or provenance comments

The versioned examples and quality oracle live under `src/test/fixtures/conclude/parkinson-oracle/`.

## Example Policy

No single paper is the expected output.

- Nature-family analysis papers may calibrate contribution-first structure, paragraph flow, and figure-led Results, but they are not copied or used as literal golden text.
- Parkinson `ART-166` is a useful reference for turning evidence into a sequential biological argument, quantitative Results paragraphs, and a figure plan. It remains a project report and may contain product-facing language that should not appear in a normal scientific manuscript.
- Acceptance is defined by scientific facts, relationships, claim limits, and failure constraints rather than exact wording.

## Claim And Citation Rules

- Use “associated with,” “consistent with,” or “supports a bounded hypothesis” when evidence is associative or proxy-based.
- Use causal or mechanistic language only when the project contains corresponding perturbational or functional evidence.
- Keep source-to-claim provenance in evidence packets, audits, comments, or companion maps; do not expose workflow identifiers as readable manuscript prose.
- Use verified BibTeX-backed citations for external knowledge. An empty bibliography with “citations to be added later” is an incomplete draft, not citation success.
- Explicitly record downgraded and prohibited claims in `claim_safety_audit.md`.

## Output Contract

Default output directory:

```text
conclusions/<run-id>/
```

Core outputs:

```text
evidence_dossier.json
evidence_dossier.md
story_plan.json
story_plan.md
evidence_packets.md
selected_story.md
evidence_audit.md
claim_safety_audit.md
reviewer_risk_audit.md
render_status.md
paper_rewriting_output/
  confirmed_contribution.md
  results_validation.md
  reviewer_audit.md
  citation_support_bank.md
  section_blueprints.md
  writing_rationale_matrix.md
  final_paper/
    main.tex
    references.bib
    figures/
    paper.pdf
    paper.docx
```

`evidence_dossier.json` is the versioned machine-readable boundary between source artifacts and later story planning. Its scientific narrative fields come from bounded reads of artifact content, while QDD study, task, artifact, path, row, and line identifiers remain in dedicated provenance fields. `evidence_dossier.md` renders the same contract for human review.

`story_plan.json` is the versioned canonical story plan. It records the central contribution, question-answer Results beats, claim graph, evidence roles, figure/table sequence, omission ledger, optional emphasis profiles, viability diagnostics, and story-plan audit. Reader-visible statements reference dossier claims while QDD study/task/artifact/evolution provenance remains in sidecars. A migration release may still emit legacy `story_candidates.*`, but downstream drafting must consume the canonical story plan.

`selected_story.md` records human confirmation of the canonical story for CLI compatibility. It and the planning artifacts are intermediate contracts. `main.tex`, `references.bib`, reusable assets, and audits are the manuscript deliverable. PDF and Word files are present only after successful rendering.

## Golden Oracle

The repository oracle is a small, versioned quality standard independent of the full local Parkinson project. It contains:

- curated expected scientific facts and relationships
- explicit claim limits
- required manuscript signals
- forbidden visible patterns and hard failures
- excerpts from a known failed draft with failure explanations
- a reference story shape derived from `ART-166`, without prescribing exact prose

The full Parkinson project remains an optional end-to-end input selected through `QDD_CONCLUDE_EVAL_CASE`. It is not itself the oracle.

Evaluation must combine deterministic checks with semantic review of the generated manuscript. Section presence, TeX validity, evidence comments, and output-file existence are necessary but insufficient. Any hard failure makes the run non-passing regardless of its aggregate score.

## Acceptance Criteria

- Conclude produces one canonical, evidence-bounded story spine rather than partitioning the dossier into unrelated candidate papers.
- Each Results beat has a grounded answer and a scientifically meaningful transition to the next beat, or closes the argument.
- QDD question evolution is selectively projected into the story without replaying operational chronology.
- Core, bridge, validation, boundary, supplementary/context, and excluded evidence are explicitly distinguished; omissions remain auditable outside visible prose.
- Optional emphasis profiles preserve the central contribution, core claims, and Results order.
- The human story-review gate occurs before final drafting.
- The confirmed story can be restored without copying raw task or study prose.
- The final Results sequence follows scientific claims and figures rather than QDD object order.
- Every major Results claim is supported by artifact content and auditable provenance.
- Visible manuscript prose contains no QDD execution identifiers or meta-writing.
- Claim strength stays within the evidence and external citations are verifiable.
- Missing evidence or dependencies are reported honestly as gaps or blockers.
- The versioned oracle rejects the known Parkinson bad case and prevents false-positive quality scores.

## PaperSpine Provenance

PaperSpine patterns may be reused for contribution confirmation, results validation, reviewer audit, citation support, LaTeX checks, and final artifact audit. Any vendored source must preserve its license, upstream version, commit, and local modification notes.

PaperSpine is an implementation resource, not the product identity or quality oracle for QDD conclude.
