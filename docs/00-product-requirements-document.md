# QDD Product Requirements Document (PRD)

**Version:** 1.0  
**Date:** 2026-05-26  
**Status:** Historical draft

> Historical note: this document preserves early product thinking and contains retired schema examples such as `question_delta` and `evolution_trail`. For current managed-file schemas, use `.qdd/schema-reference.md`, `.qdd/examples/*`, and `src/file-contracts/*`.

---

## Executive Summary

QDD (Question-Driven Discovery) is a spec-driven research framework that makes scientific inquiry auditable by treating question evolution as a first-class object. Unlike existing AI scientist systems that treat research as optimization (fixed goal, find best answer), QDD recognizes that in real research, the question itself evolves.

**Target Users:** Computational biologists, bioinformaticians, and research scientists working with AI coding assistants (Claude, Codex, etc.)

**Core Value Proposition:** A lightweight filesystem protocol + CLI that guides AI agents through research workflows, ensuring questions are tracked, hypotheses are bounded, evidence is structured, and intermediate artifacts are reusable.

---

## Product Vision

### What QDD Is
- A filesystem protocol for AI-assisted research (inspired by OpenSpec)
- A CLI that manages research state without calling AI models
- A set of markdown instructions that guide AI agents
- A framework that makes question evolution auditable

### What QDD Is Not
- Not a black-box AI Scientist
- Not a general-purpose chatbot wrapper
- Not a notebook generator
- Not a fully-automated pipeline engine

### Core Philosophy
**"Spec-driven research, not prompt-driven chaos"**

Just as OpenSpec brings structure to software development with AI, QDD brings structure to scientific research with AI. Every research project follows a clear protocol: contract → study → tasks → artifacts → closure → question_delta.

---

## Problem Statement

### Current Pain Points

1. **AI agents lose track of research goals**
   - Start with question A, end up answering question B
   - No audit trail of how/why the question changed

2. **Intermediate work is not reusable**
   - Every analysis is a one-off script
   - Preprocessed data, marker genes, code are not indexed
   - Next study starts from scratch

3. **No clear stopping criteria**
   - When is a study "done"?
   - When should we pivot vs. refine?
   - When should we close the project?

4. **Environment and data setup is repeated**
   - Every study re-explores what data is available
   - Every task re-checks what packages are installed
   - No project-level resource management

### Why Existing Solutions Don't Work

- **AI Scientist systems** optimize for automation, not auditability
- **Notebook-based workflows** lack structure and reusability
- **Prompt engineering** doesn't scale to multi-week research projects
- **Traditional lab notebooks** don't integrate with AI agents

---

## User Personas

### Primary Persona: Computational Biologist (Dr. Chen)
- **Background:** PhD in bioinformatics, works with scRNA-seq data
- **Tools:** Uses Claude/Codex for analysis, Scanpy/Seurat for preprocessing
- **Pain Points:**
  - Spends hours explaining context to AI in every new chat
  - Loses track of what questions were already explored
  - Can't reuse preprocessing code across projects
  - Doesn't know when to stop exploring and write up results

### Secondary Persona: Research Scientist (Alex)
- **Background:** Wet-lab biologist learning computational methods
- **Tools:** Uses AI heavily for coding, less familiar with best practices
- **Pain Points:**
  - AI generates one-off scripts that can't be reused
  - Doesn't know how to structure a computational project
  - Struggles to reproduce results from 2 months ago
  - Needs guidance on what artifacts to save

---

## Product Goals

### V0 Goals (Minimum Viable Product)
1. **Enable human-mode workflow**: User + AI can complete one research loop (contract → study → tasks → closure) with clear audit trail
2. **Artifact reusability**: Preprocessed data, code, figures are indexed and reusable across studies
3. **Question evolution tracking**: Every study closure produces a question_delta
4. **Project-level resource management**: Data and environment exploration happens once at init

### V1 Goals (Enhanced Experience)
1. **Assist mode**: AI proposes next studies based on question_delta
2. **Domain plugins**: Genomics-specific artifact contracts and validation
3. **Visualization**: TUI showing evolution trail and study progress

### V2 Goals (Full Automation)
1. **Auto mode**: SDK runtime that autonomously executes studies within contract scope
2. **Multi-project management**: Track multiple research projects
3. **Collaboration**: Multi-user support with role-based access

---

## Core Concepts

### Object Model

```
project
  = research theme + evolution trail
  = "What is the overarching question we're investigating?"

study
  = bounded hypothesis + tasks
  = "One specific question we want to answer"
  = Maps to OpenSpec's "proposal"

task
  = executable work unit + checklist
  = "One piece of evidence or artifact to produce"
  = Maps to OpenSpec's "spec"

artifact
  = reusable output (data, code, figure, report)
  = Indexed with provenance and reusability metadata

closure
  = study conclusion + question_delta
  = "How did the question change after this study?"

context
  = project-level shared resources
  = Datasets, environment, accumulated knowledge
```

### Question Delta

The core innovation. Every study closure produces:

```yaml
question_delta:
  question_before: "What are the marker genes for cell type X?"
  question_after: "What are the marker genes for cell type X in lung tissue?"
  change_type: refinement  # refinement | confirmation | pivot | dissolution
  change_driver: "Sample scope imbalance limits generalization"
  open_boundaries:
    - "Cross-tissue validation"
    - "Independent cohort replication"
```

**Four change types:**
- **refinement**: Question survives, boundaries narrowed, direction unchanged
- **confirmation**: Question sufficiently answered (support or refute)
- **pivot**: Question abandoned because "wrong question", better alternative exists
- **dissolution**: Question undecidable within current resource constraints

---

## User Stories

### Epic 1: Project Initialization

**US-1.1: Initialize research project**
- **As a** researcher
- **I want to** initialize a QDD project with my research theme
- **So that** I have a structured workspace for AI-assisted research

**Acceptance Criteria:**
- Run `qdd init --interactive`
- AI asks about research theme, initial question, scope
- AI captures project resources in a readable project-level context document
- AI records runtime environment, biological background, and data availability
- Creates `contract.yaml` and `context/resources.md`
- All project-level resources are documented upfront

**US-1.2: View project status**
- **As a** researcher
- **I want to** see current project state
- **So that** I know what studies are active, what's completed, what resources are available

**Acceptance Criteria:**
- Run `qdd status`
- Shows: contract summary, evolution trail, active studies, and available project resources
- Shows: artifact count, study completion rate

### Epic 2: Study Workflow

**US-2.1: Create a study**
- **As a** researcher
- **I want to** propose a new study (hypothesis)
- **So that** I can investigate a specific question within my research theme

**Acceptance Criteria:**
- Run `qdd add-study --interactive`
- AI reads `context/` to know available resources
- AI asks: What question? What hypothesis? What data will you use? What's the expected output?
- Creates `studies/STUDY-XXX/study.md` with question, hypothesis, blockers, tasks checklist
- AI auto-generates tasks based on hypothesis
- Blockers are separated from tasks

**US-2.2: Execute study tasks**
- **As a** researcher
- **I want to** get execution instructions for a study
- **So that** AI can execute tasks following project protocols

**Acceptance Criteria:**
- Run `qdd instructions STUDY-001`
- Returns JSON with: files to read (including context), required skills, optional skills, output path
- AI reads all context (datasets, environment, artifacts, study.md, task.md)
- AI executes tasks in order, checking off completed items
- Outputs are written to `studies/STUDY-001/output/`
- Artifacts are registered to `artifacts/index.yaml` with reusability metadata

**US-2.3: Close a study**
- **As a** researcher
- **I want to** close a completed study
- **So that** I can document how the question evolved

**Acceptance Criteria:**
- Run `qdd close-study STUDY-001`
- AI reviews all task outputs and study results
- AI generates `question_delta` (question_before, question_after, change_type, change_driver, open_boundaries)
- Appends to `evolution.yaml`
- Study status marked as completed

### Epic 3: Artifact Management

**US-3.1: Register artifacts**
- **As a** researcher
- **I want** task outputs to be automatically indexed
- **So that** future studies can reuse them

**Acceptance Criteria:**
- After task execution, AI calls `qdd register-artifact <path>`
- Artifact added to `artifacts/index.yaml` with:
  - Type (data, code, figure, report)
  - Format (.h5ad, .py, .png, .csv)
  - Provenance (which study/task produced it)
  - Reusability (true/false, scope: project/study)
  - Description and metadata

**US-3.2: Discover reusable artifacts**
- **As a** researcher
- **I want** AI to automatically find reusable artifacts
- **So that** I don't repeat preprocessing or analysis

**Acceptance Criteria:**
- When executing a new study, AI reads `artifacts/index.yaml`
- AI identifies artifacts with `reusable: true` and relevant type/tags
- AI suggests using existing artifacts instead of regenerating
- Example: "Found preprocessed.h5ad from STUDY-001, reusing instead of reprocessing"

### Epic 4: Context Management

**US-4.1: Explore datasets at init**
- **As a** researcher
- **I want to** document all datasets during project init
- **So that** every study knows what data is available

**Acceptance Criteria:**
- During `qdd init`, AI asks what core data resources exist
- The default record is human-readable and may summarize path, status, and constraints
- Writes to `context/resources.md`
- Future studies read this context, no re-exploration needed

**US-4.2: Explore environment at init**
- **As a** researcher
- **I want to** document runtime environment during project init
- **So that** every study knows what tools are available

**Acceptance Criteria:**
- During `qdd init`, AI asks about environment
- Documents: Python/R environment, key packages, compute resources, and relevant external tools
- Writes to `context/resources.md`
- Future studies read this context, know what's available

**US-4.3: Accumulate project knowledge**
- **As a** researcher
- **I want** to accumulate reusable knowledge (markers, cell types)
- **So that** later studies can build on earlier findings

**Acceptance Criteria:**
- Optional context files: extra `context/*.md` or `context/*.yaml` sidecars
- AI can optionally update these as studies produce validated findings
- Example: STUDY-001 identifies stable marker knowledge → added to a project context sidecar
- STUDY-002 reads context, knows these markers without re-deriving

---

## Functional Requirements

### FR-1: CLI Commands

#### FR-1.1: qdd init
```bash
qdd init [--interactive]
```
- Creates project structure
- Interactive mode: AI asks about theme, scope, and project resources
- Outputs: `contract.yaml`, `context/resources.md`

#### FR-1.2: qdd add-study
```bash
qdd add-study [--interactive]
```
- Creates new study
- Interactive mode: AI asks about question, hypothesis, data, expected output
- Reads context to know available resources
- Outputs: `studies/STUDY-XXX/study.md` with tasks checklist

#### FR-1.3: qdd add-task
```bash
qdd add-task STUDY-001 [--interactive]
```
- Adds a new task to existing study
- Creates `studies/STUDY-001/tasks/TASK-XXX.md`

#### FR-1.4: qdd instructions
```bash
qdd instructions STUDY-001 [--json]
```
- Returns execution instructions for AI
- JSON output includes: files to read, skills to load, output path
- AI uses this to execute the study

#### FR-1.5: qdd register-artifact
```bash
qdd register-artifact <path> --type <type> --reusable <bool> --description <desc>
```
- Registers an artifact to index
- Updates `artifacts/index.yaml`

#### FR-1.6: qdd close-study
```bash
qdd close-study STUDY-001
```
- Generates question_delta
- Appends to `evolution.yaml`
- Marks study as completed

#### FR-1.7: qdd status
```bash
qdd status [--json]
```
- Shows project overview
- Lists studies, artifacts, context resources

#### FR-1.8: qdd context
```bash
qdd context
```
- Shows project context
- Returns the current contents of `context/` resources

#### FR-1.9: qdd validate
```bash
qdd validate
```
- Validates all YAML files against schemas
- Checks for missing required fields, invalid state transitions

### FR-2: File Structure

```
project/
  ├── contract.yaml              # Research theme, scope, termination criteria
  ├── evolution.yaml             # Question delta history
  ├── context/                   # Project-level shared resources
  │   ├── resources.md           # Default project resources
  │   ├── notes.md               # Optional free-form context
  │   └── sidecar.yaml           # Optional structured context
  ├── studies/
  │   └── STUDY-001/
  │       ├── study.md           # Question, hypothesis, tasks checklist
  │       ├── tasks/
  │       │   ├── TASK-001.md    # Task description, checklist, dependencies
  │       │   └── TASK-002.md
  │       └── output/            # Task outputs
  ├── artifacts/
  │   ├── index.yaml             # Artifact registry
  │   ├── data/
  │   ├── code/
  │   ├── figures/
  │   └── reports/
  ├── .qdd/
  │   └── instructions.md        # Core protocol instructions for AI
  └── skills/
      └── genomics/              # Domain-specific skills
          ├── h5ad-validator.py
          └── scanpy-recipes.py
```

### FR-3: Schemas

#### contract.yaml
```yaml
theme: string
initial_question: string
mode: human | assist | auto
scope:
  in_scope: [string]
  out_of_scope: [string]
termination_type: best_effort
evidence_standard:
  min_studies: integer
  required_signal: support_or_refute | descriptive_boundary | engineering_delivery
  uncertainty_tolerance: string
```

#### context/resources.md
```md
# Project Resources

## Runtime Environments
- Python: path/version/key packages
- R: path/version/key packages

## Biological Background
- Research object
- Stable boundaries
- Prior knowledge worth reusing

## Data
- Primary datasets
- Supporting datasets
- Existing evidence assets
```

Optional context sidecars may also live in `context/*.md` or `context/*.yaml` when a project needs extra structure.

#### artifacts/index.yaml
```yaml
artifacts:
  - id: string
    type: data | code | figure | report
    format: string (.h5ad, .py, .png, .csv, ...)
    path: string
    produced_by: STUDY-XXX/TASK-YYY
    reusable: boolean
    scope: project | study | task
    description: string
    schema: object (optional, for data artifacts)
    tags: [string] (optional)
```

#### evolution.yaml
```yaml
evolution_trail:
  - study_id: STUDY-001
    question_delta:
      question_before: string
      question_after: string
      change_type: refinement | confirmation | pivot | dissolution
      change_driver: string
      open_boundaries: [string]
    timestamp: datetime
```

### FR-4: Skills System

Skills are executable code that AI can invoke for domain-specific tasks.

**Skill structure:**
```
skills/
  └── genomics/
      ├── h5ad-validator.py      # Validates .h5ad artifact contract
      ├── scanpy-recipes.py      # Common Scanpy preprocessing templates
      └── marker-enrichment.py   # Pathway enrichment for markers
```

**Skill invocation:**
- Declared in `task.md`: `Skills: required: [genomics/h5ad-validator]`
- CLI auto-infers from keywords in study.md (e.g., "scRNA" → load genomics skills)
- AI calls skills as needed during task execution

### FR-5: AI Instructions

`.qdd/instructions.md` contains core protocol rules for AI:
- How to read study.md and task.md
- How to execute tasks (checklist-driven)
- How to register artifacts
- How to generate question_delta
- Artifact reusability guidelines
- Code quality standards (no one-off scripts, write reusable functions)

---

## Non-Functional Requirements

### NFR-1: Performance
- CLI commands respond in < 1 second
- File operations are local, no network calls
- Artifact index supports 1000+ artifacts without performance degradation

### NFR-2: Usability
- Interactive mode guides users through complex workflows
- JSON output for programmatic consumption
- Human-readable markdown for manual editing

### NFR-3: Maintainability
- Core CLI is model-agnostic (no AI calls)
- Domain logic in plugins, not core
- Schema validation prevents invalid states

### NFR-4: Extensibility
- Plugin system for domain-specific logic
- Skill system for executable code
- Schema can be extended without breaking existing projects

---

## Success Metrics

### V0 Success Criteria
1. **Adoption**: 10 researchers complete at least one full research loop (init → study → closure)
2. **Artifact reuse**: 50% of studies reuse at least one artifact from prior studies
3. **Question tracking**: 100% of closed studies have valid question_delta
4. **Time savings**: 30% reduction in "re-explaining context to AI" time

### V1 Success Criteria
1. **Assist mode usage**: 50% of users try assist mode for next-study proposals
2. **Domain plugin adoption**: 80% of genomics users enable genomics plugin
3. **Multi-study projects**: Average project has 3+ studies

### V2 Success Criteria
1. **Auto mode usage**: 20% of users run at least one study in auto mode
2. **Collaboration**: 10% of projects have multiple contributors
3. **Publication**: At least one paper published using QDD workflow

---

## Risks and Mitigations

### Risk 1: Too complex for users
**Mitigation:** 
- Interactive mode guides users through workflows
- Provide templates and examples
- Start with simple use cases (single study projects)

### Risk 2: AI doesn't follow protocol
**Mitigation:**
- Schema validation catches invalid outputs
- Instructions.md is clear and prescriptive
- Skills provide executable guardrails

### Risk 3: Domain plugins are too rigid
**Mitigation:**
- Plugins are optional, not required
- Users can customize or disable plugins
- Core protocol is domain-agnostic

### Risk 4: Artifact index becomes unwieldy
**Mitigation:**
- Tagging and filtering system
- Periodic cleanup of non-reusable artifacts
- Archive old projects

---

## Development Roadmap

### Phase 1: Core Protocol (M1-M3, 6 weeks)
- **M1 (2 weeks)**: CLI skeleton, schema definitions, file structure
  - `qdd init`, `qdd validate`
  - contract.yaml, context/ structure
  - Schema validation
  
- **M2 (2 weeks)**: Study workflow
  - `qdd add-study`, `qdd add-task`
  - study.md, task.md templates
  - `qdd instructions` JSON output
  
- **M3 (2 weeks)**: Artifact system
  - `qdd register-artifact`
  - artifacts/index.yaml
  - `qdd close-study` with question_delta

**Deliverable:** Human-mode workflow functional, one demo project completed

### Phase 2: Domain Plugins (M4-M5, 4 weeks)
- **M4 (2 weeks)**: Genomics plugin
  - .h5ad artifact contract
  - Scanpy recipes skill
  - h5ad-validator skill
  
- **M5 (2 weeks)**: Plotting plugin
  - Figure artifact contract
  - Source data tracking
  - Style templates

**Deliverable:** One scRNA demo project with reusable artifacts

### Phase 3: Enhanced Experience (M6-M7, 4 weeks)
- **M6 (2 weeks)**: Assist mode
  - Next-study proposal generation
  - Close-project proposal
  
- **M7 (2 weeks)**: TUI
  - Evolution trail visualization
  - Study progress dashboard
  - Context browser

**Deliverable:** Assist mode functional, TUI available

### Phase 4: Automation (M8+, 6+ weeks)
- **M8**: SDK runtime for auto mode
- **M9**: Multi-project management
- **M10**: Collaboration features

---

## Open Questions

1. **Should context/ files be auto-updated by AI?**
   - Pro: Keeps context fresh
   - Con: AI might make mistakes, pollute context
   - **Decision needed:** Manual promotion vs. auto-update

2. **How to handle study retries?**
   - If a study fails, should we create STUDY-001-retry or reuse STUDY-001?
   - **Decision needed:** Versioning strategy

3. **Should we support study branching?**
   - One study spawns multiple parallel sub-studies
   - **Decision needed:** Flat vs. hierarchical study structure

4. **How to handle external data sources that change?**
   - Dataset gets updated, invalidates prior studies
   - **Decision needed:** Versioning for datasets in context

5. **Should question_delta be AI-generated or human-reviewed?**
   - AI generates, human approves?
   - Or AI generates and auto-commits?
   - **Decision needed:** Authority model for question_delta

---

## Appendix: Comparison with OpenSpec

| Aspect | OpenSpec | QDD |
|--------|----------|-----|
| **Domain** | Software development | Scientific research |
| **Core object** | Proposal → Spec → Tasks | Study → Tasks → Closure |
| **Innovation** | Spec-driven development | Question evolution tracking |
| **Artifact** | Code changes | Data, code, figures, reports |
| **Stopping criteria** | Tasks completed | Question answered or evolved |
| **Unique feature** | Delta specs (ADDED/MODIFIED/REMOVED) | Question_delta (refinement/pivot/confirmation/dissolution) |
| **Context** | Git repository | Project context (datasets, environment, knowledge) |

**Key insight:** QDD borrows OpenSpec's "filesystem protocol + AI instructions" pattern but adds research-specific concepts (question evolution, artifact reusability, project context).

---

## Appendix: Example Workflow

### Step 1: Initialize project
```bash
$ qdd init --interactive
```

AI asks:
- Research theme? → "Identify marker genes for lung fibroblasts"
- Initial question? → "What are the top marker genes for Day14 fibroblasts?"
- Available data? → "GSE12345 (downloaded at /data/GSE12345), GSE67890 (need to download)"
- Runtime environments? → "Python analysis environment available; optional R environment if a task needs it"
- Biological background? → "Lung fibroblasts, Day14 focus"

Creates:
- `contract.yaml`
- `context/resources.md`

### Step 2: Create first study
```bash
$ qdd add-study --interactive
```

AI asks:
- Question? → "What are the marker genes for Day14 fibroblasts in lung tissue?"
- Hypothesis? → "Fibroblasts express COL1A1, COL3A1, DCN based on literature"
- Which dataset? → "GSE12345 (from context)"
- Expected output? → "Marker gene list, heatmap, pathway enrichment"

Creates:
- `studies/STUDY-001/study.md` with:
  - Question, hypothesis
  - Blockers: [x] GSE12345 available, [ ] KEGG setup
  - Tasks: [ ] Preprocess, [ ] Identify markers, [ ] Enrichment, [ ] Visualize

### Step 3: Execute study
```bash
$ qdd instructions STUDY-001 --json
```

Returns:
```json
{
  "study_id": "STUDY-001",
  "read": [
    ".qdd/instructions.md",
    "contract.yaml",
    "context/resources.md",
    "studies/STUDY-001/study.md",
    "studies/STUDY-001/tasks/TASK-001.md",
    "artifacts/index.yaml"
  ],
  "required_skills": ["genomics/h5ad-validator"],
  "optional_skills": ["genomics/scanpy-recipes"],
  "write_to": "studies/STUDY-001/output/"
}
```

AI:
1. Reads all context
2. Executes tasks in order
3. Checks off completed tasks in study.md
4. Writes outputs to `studies/STUDY-001/output/`
5. Registers artifacts to `artifacts/index.yaml`

### Step 4: Close study
```bash
$ qdd close-study STUDY-001
```

AI generates question_delta:
```yaml
question_delta:
  question_before: "What are the marker genes for Day14 fibroblasts in lung tissue?"
  question_after: "What are the marker genes for Day14 fibroblasts, and how do they vary across tissue types?"
  change_type: refinement
  change_driver: "Found tissue-specific marker variation in literature"
  open_boundaries:
    - "Cross-tissue validation"
    - "Temporal dynamics (Day7 vs Day14)"
```

Appends to `evolution.yaml`

### Step 5: Next study
```bash
$ qdd add-study --interactive
```

AI reads `evolution.yaml`, sees open boundaries, proposes:
- "Study cross-tissue marker variation using GSE67890?"
- "Study temporal dynamics using Day7 samples from GSE12345?"

User chooses, new study created.

---

**End of PRD**
