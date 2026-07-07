# PRD: QDD Conclude Skill

## Summary

`conclude` is a QDD-native writing skill for turning accumulated QDD research evidence into an auditable, submission-oriented manuscript draft. It can be invoked mid-project for audit or at the end of a project for final synthesis.

The skill vendors and modifies PaperSpine, keeping its contribution-first, results-validation, reviewer-audit, citation, and LaTeX/PDF discipline, but replacing generic material intake with QDD-aware evidence reading and biological story selection.

The core product idea is not to force every result into a rigid evidence schema. QDD already keeps a strong research trace through studies, memories, artifacts, and evolution. `conclude` should use that trace with scientific taste: gather related evidence, compare possible stories, downgrade weak claims, surface negative evidence, and only then write.

## Goals

- Generate 2-3 candidate biological or research storylines from existing QDD evidence.
- Score storylines by biological coherence, evidence strength, novelty, reviewer risk, claim safety, and usefulness of negative evidence.
- Stop for user story selection before drafting.
- Produce a submission-style TeX manuscript after selection.
- Use both internal QDD evidence and external literature citations.
- Preserve an audit trail explaining what evidence was used, downgraded, ignored, or treated as negative.
- Produce PDF and Word outputs when the local environment supports them.

## Non-Goals

- Do not introduce a heavy new QDD evidence schema in v1.
- Do not require every study to pre-label evidence as positive, negative, or neutral.
- Do not automatically run from `qdd-close` or auto mode in v1.
- Do not claim PDF or Word completion when local TeX or pandoc dependencies are missing.
- Do not silently convert weak biological signals into strong mechanism claims.
- Do not make `conclude` responsible for generating new biological analyses; it writes from existing evidence.

## Entry Point

The canonical product entry point is the CLI command `qdd conclude`.

The durable skill assets under `domain-skills/thesis/conclude/` remain important, but they are guidance and provenance for the CLI surface rather than a second standalone product entry.

It supports both use cases through the same workflow:

- Mid-project: produce story candidates, evidence packets, audits, and stop at the selection gate.
- Final project: produce story candidates, a selected manuscript story packet, manuscript-planning artifacts, and a submission-oriented manuscript package.

Current CLI shape:

```bash
qdd conclude --json
qdd conclude --output-dir conclusions/<run-id> --json
qdd conclude --output-dir conclusions/<run-id> --selected-story-id story-1 --json
qdd conclude --output-dir conclusions/<run-id> --selected-story-path conclusions/<run-id>/selected_story.md --json
```

## Core Workflow

### 1. QDD Preflight

Read the project state before writing:

- `contract.yaml`
- `evolution.yaml`
- `context/resources.md`
- recent `context/memory/*`
- `artifacts/index.yaml`
- study files under `studies/*`
- promoted figures, tables, reports, data summaries, and code provenance

Also detect local rendering tools:

- `latexmk`
- `xelatex`
- `pdflatex`
- `pandoc`

The skill must report whether final PDF and Word rendering can be completed in the current environment.

### 2. Evidence Harvest

Gather QDD artifacts, study memories, figures, tables, reports, code provenance, and reusable context.

Study outputs and artifacts are authoritative for project claims. External literature can support background, field context, related work, and discussion, but it must not invent results that QDD did not produce.

Negative, dissolved, blocked, or downgraded studies should be treated as useful boundary evidence. A good final paper may be a story about hypothesis refinement, candidate downgrade, failed mechanism search, or evidence-bounded frontier convergence, not only a strong discovery story.

The raw QDD records are not themselves the manuscript narrative boundary. `conclude` should compress them into manuscript-oriented evidence packets that preserve provenance while removing raw execution leakage from central claims and story prose.

Evidence packets should distinguish at least:

- supporting evidence
- boundary evidence
- negative validation evidence
- project or resource context that should stay outside central Results claims

### 3. Story Candidate Generation

Produce 2-3 candidate storylines before drafting.

Each candidate should include:

- central claim
- biological or methodological story
- narrative arc
- claim bundle
- supporting evidence packet references
- boundary evidence packet references
- likely reviewer objections
- claims allowed
- claim safety limits
- claims to soften or avoid
- suitability score
- recommended title style
- whether the story is best framed as discovery, method/protocol, case study, benchmark, audit report, or bounded biological hypothesis

The candidates must be substantively different in central claim and narrative arc, not merely the same evidence relabeled with different framing names.

### 4. User Selection Gate

Stop after story candidates.

The user chooses one storyline or asks for revision. V1 must not auto-select the top-scoring story, because biological taste and claim strength require human confirmation before a submission-style draft.

### 5. Drafting

After user selection, generate manuscript-planning artifacts before writing the final TeX:

- `confirmed_contribution.md`
- `results_validation.md`
- `reviewer_audit.md`
- `citation_support_bank.md`
- `section_blueprints.md`
- `writing_rationale_matrix.md`

Then generate the TeX manuscript, BibTeX file, figure/table asset map, and audit reports.

The selected story should be a stable, machine-readable manuscript story packet with at least:

- selected story id
- central claim
- narrative arc
- claim bundle
- supporting packet refs
- boundary packet refs
- reviewer objections
- claim safety limits

Backward-compatible parsing of older selected-story markdown is acceptable, but the canonical restored object should be the manuscript-native story packet.

### 6. Rendering And Audit

Always generate `main.tex`.

If TeX is available, compile PDF and check it. If pandoc is available, generate Word when requested. If rendering dependencies are missing, the manuscript package should be marked `BLOCKED` for rendering, not complete.

## Taste Rubric

The skill should reason with a qualitative multi-dimensional rubric rather than requiring new structured evidence fields.

Recommended dimensions:

- **Biological coherence:** Does the story form a plausible biological arc?
- **Evidence strength:** Are central claims supported by reproducible, non-circular evidence?
- **Negative evidence use:** Are failed hypotheses used to bound the story rather than hidden?
- **Claim safety:** Are causal or mechanistic verbs downgraded when evidence is associative?
- **Novelty and significance:** Is the story worth reading beyond a workflow demo?
- **Reviewer risk:** What would a skeptical reviewer attack first?
- **QDD contribution:** Does the story demonstrate question evolution, artifact reuse, boundary narrowing, or evidence-grounded pivoting?
- **Manuscript viability:** Can the evidence support a complete Results/Discussion arc without padding?

## Claim Safety Rules

`conclude` should be conservative with biological verbs.

Examples:

- Use "is associated with" instead of "drives" when evidence is expression correlation.
- Use "marks a candidate state" instead of "defines a mechanism" when no causal or functional evidence exists.
- Use "supports a bounded hypothesis" instead of "proves" when validation is proxy-based.
- Use negative studies to explain why stronger claims were not made.

The skill should explicitly name downgraded claims in `claim_safety_audit.md`.

## PaperSpine Vendor Strategy

Vendor PaperSpine v4.0.0 into the `conclude` skill resources and modify it for QDD.

Requirements:

- Preserve upstream MIT license.
- Record upstream repository, version, and commit hash.
- Keep a short local modification note.
- Reuse PaperSpine checks where useful:
  - contribution-first gate
  - results-as-validation gate
  - reviewer-aware audit
  - citation support bank
  - LaTeX guard
  - final artifact audit
- Replace PaperSpine generic intake/material scan with QDD evidence harvesting.
- Add QDD-specific story candidate scoring and user selection gate before manuscript drafting.

The intended direction is a practical fork/vendor, not a thin wrapper around an external installation. QDD should be able to modify the writing workflow around its own research state and taste requirements.

## Output Layout

Default output directory:

```text
conclusions/<run-id>/
```

Expected outputs:

```text
story_candidates.md
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

`paper.pdf` and `paper.docx` are present only when rendering succeeds.

## Internal And External Citations

The manuscript should use two evidence channels:

- Internal QDD evidence: figures, tables, reports, study memories, and artifact provenance.
- External literature: BibTeX-backed citations for background, prior work, related methods, discussion, and field context.

Every major Results claim should point to internal QDD evidence. Every literature statement that needs external support should use a real citation entry, not a fake bracket number.

## Acceptance Criteria

- Given a QDD project with mixed positive and negative evidence, `conclude` produces multiple distinct story candidates.
- Story candidates and selected story outputs do not leak raw execution-language fragments such as `TASK-xxx`, `status closed`, `None.`, or `expected_artifacts` in their narrative body.
- It does not force a strong mechanism story when evidence only supports association or candidate status.
- It explicitly reports downgraded claims and unused or negative evidence.
- It stops for user story selection before drafting.
- The selected story is stable enough to restore and continue drafting through packet refs rather than raw task/study text reuse.
- After selection, it produces a coherent TeX manuscript and bibliography.
- Every major Results claim points to QDD evidence.
- External literature citations have real BibTeX entries.
- Missing TeX or pandoc dependencies produce a clear `BLOCKED` rendering status.
- Vendored PaperSpine license and upstream provenance are preserved.

## Future Integration

Possible v2 additions:

- `qdd-close` suggests running `conclude` when the project is synthesis-ready.
- `qdd auto` can stop at synthesis-ready and prompt the user to run `conclude`.
- A future CLI command may wrap the skill.
- Selected final `conclude` outputs may be registerable as QDD report artifacts.
- Story candidate scores may later inform thesis-manager stop/continue decisions, but should not become a required schema in v1.
