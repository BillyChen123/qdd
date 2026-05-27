# QDD Development Prototype

**Version:** 1.0  
**Date:** 2026-05-26

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         User / AI Agent                          │
│                    (Claude, Codex, etc.)                         │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ CLI Commands
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                         QDD CLI Layer                            │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────────┐  │
│  │   init   │add-study │instructions│ close   │   status     │  │
│  └──────────┴──────────┴──────────┴──────────┴──────────────┘  │
│                                                                   │
│  • Pure filesystem operations (no AI calls)                      │
│  • Schema validation                                             │
│  • JSON output for AI consumption                                │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ Read/Write
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Filesystem State                              │
│                                                                   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   contract.yaml │  │ evolution.yaml  │  │   context/      │ │
│  │                 │  │                 │  │  - resources.md │ │
│  │  • theme        │  │  • question     │  │  - notes.md     │ │
│  │  • scope        │  │    deltas       │  │  - sidecars.yaml│ │
│  │  • mode         │  │  • study trail  │  │  - optional     │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│                                                                   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   studies/      │  │   artifacts/    │  │    skills/      │ │
│  │                 │  │                 │  │                 │ │
│  │  STUDY-001/     │  │  • index.yaml   │  │  genomics/      │ │
│  │   - study.md    │  │  • data/        │  │   - validator   │ │
│  │   - tasks/      │  │  • code/        │  │   - recipes     │ │
│  │   - output/     │  │  • figures/     │  │  plotting/      │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                        QDD System                                 │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                     CLI Module                              │  │
│  │                                                             │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │  │
│  │  │ CommandParser│  │ SchemaValidator│ │ FileManager  │    │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘    │  │
│  │         │                  │                  │            │  │
│  │         └──────────────────┴──────────────────┘            │  │
│  │                            │                                │  │
│  └────────────────────────────┼────────────────────────────────┘  │
│                               │                                    │
│  ┌────────────────────────────┼────────────────────────────────┐  │
│  │                     Core Engine                             │  │
│  │                            │                                │  │
│  │  ┌──────────────┐  ┌──────▼───────┐  ┌──────────────┐    │  │
│  │  │ProjectManager│  │ StudyManager │  │ArtifactManager│   │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘    │  │
│  │         │                  │                  │            │  │
│  │  ┌──────▼───────┐  ┌──────▼───────┐  ┌──────▼───────┐   │  │
│  │  │ContextManager│  │ DeltaGenerator│ │ SkillLoader  │   │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘    │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                   Plugin System                             │  │
│  │                                                             │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │  │
│  │  │   Genomics   │  │   Plotting   │  │  Code Reuse  │    │  │
│  │  │    Plugin    │  │    Plugin    │  │    Plugin    │    │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘    │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagram

### Flow 1: Project Initialization

```
User                CLI                 FileSystem           AI Agent
 │                   │                      │                  │
 │  qdd init         │                      │                  │
 │──────────────────>│                      │                  │
 │                   │                      │                  │
 │                   │  Create structure    │                  │
 │                   │─────────────────────>│                  │
 │                   │                      │                  │
 │                   │  Return instructions │                  │
 │                   │<─────────────────────│                  │
 │                   │                      │                  │
 │  Instructions     │                      │                  │
 │<──────────────────│                      │                  │
 │                   │                      │                  │
 │  [User provides instructions to AI]      │                  │
 │───────────────────────────────────────────────────────────>│
 │                   │                      │                  │
 │                   │                      │  AI asks:        │
 │                   │                      │  - Theme?        │
 │                   │                      │  - Resources?    │
 │<────────────────────────────────────────────────────────────│
 │                   │                      │                  │
 │  [User answers]   │                      │                  │
 │───────────────────────────────────────────────────────────>│
 │                   │                      │                  │
 │                   │                      │  AI writes:      │
 │                   │  Write contract.yaml │  - contract.yaml │
 │                   │<─────────────────────┼──────────────────│
 │                   │  Write context/      │  - resources.md  │
 │                   │<─────────────────────┼──────────────────│
 │                   │                      │  - optional sidecars
 │                   │<─────────────────────┼──────────────────│
 │                   │                      │                  │
 │  Project ready    │                      │                  │
 │<──────────────────│                      │                  │
```

### Flow 2: Study Execution

```
User                CLI                 FileSystem           AI Agent
 │                   │                      │                  │
 │  qdd add-study    │                      │                  │
 │──────────────────>│                      │                  │
 │                   │                      │                  │
 │                   │  Create study dir    │                  │
 │                   │─────────────────────>│                  │
 │                   │                      │                  │
 │  [AI creates study.md with tasks]        │                  │
 │                   │  Write study.md      │                  │
 │                   │<─────────────────────┼──────────────────│
 │                   │                      │                  │
 │  qdd instructions │                      │                  │
 │  STUDY-001        │                      │                  │
 │──────────────────>│                      │                  │
 │                   │                      │                  │
 │                   │  Read context/       │                  │
 │                   │  Read study.md       │                  │
 │                   │  Read artifacts/     │                  │
 │                   │─────────────────────>│                  │
 │                   │                      │                  │
 │                   │  Return JSON         │                  │
 │                   │<─────────────────────│                  │
 │                   │                      │                  │
 │  JSON instructions│                      │                  │
 │<──────────────────│                      │                  │
 │                   │                      │                  │
 │  [Pass to AI]     │                      │                  │
 │───────────────────────────────────────────────────────────>│
 │                   │                      │                  │
 │                   │                      │  AI executes:    │
 │                   │                      │  - Read context  │
 │                   │  Read files          │  - Load skills   │
 │                   │<─────────────────────┼──────────────────│
 │                   │                      │  - Run tasks     │
 │                   │  Write outputs       │  - Check off     │
 │                   │<─────────────────────┼──────────────────│
 │                   │                      │                  │
 │  qdd close-study  │                      │                  │
 │──────────────────>│                      │                  │
 │                   │                      │                  │
 │                   │  Trigger delta gen   │                  │
 │                   │──────────────────────────────────────────>│
 │                   │                      │                  │
 │                   │  Write evolution.yaml│                  │
 │                   │<─────────────────────┼──────────────────│
 │                   │                      │                  │
 │  Study closed     │                      │                  │
 │<──────────────────│                      │                  │
```

---

## State Machine Diagram

### Project State Machine

```
                    ┌──────────┐
                    │   init   │
                    └─────┬────┘
                          │
                          ▼
                    ┌──────────┐
              ┌────>│  active  │<────┐
              │     └─────┬────┘     │
              │           │          │
              │           │ add-study│
              │           ▼          │
              │     ┌──────────┐    │
              │     │ running  │────┘
              │     │ studies  │
              │     └─────┬────┘
              │           │
              │           │ all studies closed
              │           ▼
              │     ┌──────────┐
              └─────│completed │
                    └──────────┘
```

### Study State Machine

```
                    ┌──────────┐
                    │  created │
                    └─────┬────┘
                          │
                          │ blockers resolved
                          ▼
                    ┌──────────┐
              ┌────>│confirmed │
              │     └─────┬────┘
              │           │
              │           │ start execution
              │           ▼
              │     ┌──────────┐
              │     │ running  │
              │     └─────┬────┘
              │           │
              │           │ blocker found
              │           ▼
              │     ┌──────────┐
              └─────│ blocked  │
                    └─────┬────┘
                          │
                          │ all tasks done
                          ▼
                    ┌──────────┐
                    │completed │
                    └─────┬────┘
                          │
                          │ close-study
                          ▼
                    ┌──────────┐
                    │  closed  │
                    └──────────┘
```

---

## File Structure Diagram

```
project-root/
│
├── contract.yaml                    # Project-level contract
│   ├── theme: string
│   ├── initial_question: string
│   ├── mode: human|assist|auto
│   ├── scope: {in_scope, out_of_scope}
│   └── termination_type: best_effort
│
├── evolution.yaml                   # Question evolution history
│   └── evolution_trail: [
│         {study_id, question_delta, timestamp}
│       ]
│
├── context/                         # Project-level shared resources
│   ├── resources.md
│   │   ├── ## Runtime Environments
│   │   ├── ## Biological Background
│   │   └── ## Data
│   │
│   ├── notes.md (optional)
│   └── domain-sidecar.yaml (optional)
│
├── studies/
│   ├── STUDY-001/
│   │   ├── study.md                 # Study description
│   │   │   ├── ## Question
│   │   │   ├── ## Hypothesis
│   │   │   ├── ## Blockers
│   │   │   ├── ## Tasks
│   │   │   └── ## Expected Artifacts
│   │   │
│   │   ├── tasks/
│   │   │   ├── TASK-001.md
│   │   │   │   ├── ## Depends On
│   │   │   │   ├── ## Input
│   │   │   │   ├── ## Expected Output
│   │   │   │   ├── ## Checklist
│   │   │   │   └── ## Skills
│   │   │   │
│   │   │   └── TASK-002.md
│   │   │
│   │   └── output/                  # Task outputs
│   │       ├── preprocessed.h5ad
│   │       ├── markers.csv
│   │       └── figure.png
│   │
│   └── STUDY-002/
│       └── ...
│
├── artifacts/
│   ├── index.yaml                   # Artifact registry
│   │   └── artifacts: [
│   │         {id, type, format, path, produced_by,
│   │          reusable, scope, description, schema}
│   │       ]
│   │
│   ├── data/
│   │   ├── preprocessed_study001.h5ad
│   │   └── markers_study001.csv
│   │
│   ├── code/
│   │   └── marker_identification.py
│   │
│   ├── figures/
│   │   └── marker_heatmap.png
│   │
│   └── reports/
│       └── study001_summary.md
│
├── .qdd/
│   └── instructions.md              # Core protocol for AI
│       ├── ## How to read study.md
│       ├── ## How to execute tasks
│       ├── ## How to register artifacts
│       └── ## How to generate question_delta
│
└── skills/
    ├── genomics/
    │   ├── h5ad-validator.py
    │   ├── scanpy-recipes.py
    │   └── marker-enrichment.py
    │
    └── plotting/
        ├── seaborn-themes.py
        └── figure-contract.py
```

---

## Sequence Diagram: Complete Workflow

```
User          CLI           FileSystem      AI Agent        Skills
 │             │                │              │              │
 │ 1. qdd init │                │              │              │
 │────────────>│                │              │              │
 │             │ create dirs    │              │              │
 │             │───────────────>│              │              │
 │             │                │              │              │
 │             │ return prompt  │              │              │
 │<────────────│                │              │              │
 │             │                │              │              │
 │ 2. [AI explores data & env]  │              │              │
 │──────────────────────────────────────────────>│            │
 │             │                │              │              │
 │             │                │ write context│              │
 │             │                │<─────────────│              │
 │             │                │              │              │
 │ 3. qdd add-study             │              │              │
 │────────────>│                │              │              │
 │             │ create study   │              │              │
 │             │───────────────>│              │              │
 │             │                │              │              │
 │             │ return prompt  │              │              │
 │<────────────│                │              │              │
 │             │                │              │              │
 │ 4. [AI creates study.md]     │              │              │
 │──────────────────────────────────────────────>│            │
 │             │                │              │              │
 │             │                │ write study  │              │
 │             │                │<─────────────│              │
 │             │                │              │              │
 │ 5. qdd instructions STUDY-001│              │              │
 │────────────>│                │              │              │
 │             │ read context   │              │              │
 │             │───────────────>│              │              │
 │             │ read study     │              │              │
 │             │───────────────>│              │              │
 │             │ read artifacts │              │              │
 │             │───────────────>│              │              │
 │             │                │              │              │
 │             │ infer skills   │              │              │
 │             │ return JSON    │              │              │
 │<────────────│                │              │              │
 │             │                │              │              │
 │ 6. [Pass JSON to AI]         │              │              │
 │──────────────────────────────────────────────>│            │
 │             │                │              │              │
 │             │                │              │ load skills  │
 │             │                │              │─────────────>│
 │             │                │              │              │
 │             │                │              │ execute tasks│
 │             │                │ write output │<─────────────│
 │             │                │<─────────────│              │
 │             │                │              │              │
 │             │                │ register art │              │
 │             │                │<─────────────│              │
 │             │                │              │              │
 │ 7. qdd close-study STUDY-001 │              │              │
 │────────────>│                │              │              │
 │             │ trigger delta  │              │              │
 │             │──────────────────────────────────>│          │
 │             │                │              │              │
 │             │                │ write delta  │              │
 │             │                │<─────────────│              │
 │             │                │              │              │
 │             │ study closed   │              │              │
 │<────────────│                │              │              │
```

---

## UI/UX Mockup: CLI Output

### qdd status

```
╔══════════════════════════════════════════════════════════════════╗
║                      QDD Project Status                          ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║  Project: Lung Fibroblast Marker Identification                 ║
║  Theme: Identify marker genes for Day14 fibroblasts             ║
║  Mode: human                                                     ║
║                                                                  ║
╠══════════════════════════════════════════════════════════════════╣
║  Context Resources                                               ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║  Datasets:                                                       ║
║    ✓ GSE12345 (scRNA, downloaded, 50k cells)                    ║
║    ○ GSE67890 (scRNA, available, need download)                 ║
║                                                                  ║
║  Environment:                                                    ║
║    ✓ Python 3.10                                                 ║
║    ✓ scanpy 1.9.3, anndata 0.9.2                                ║
║    ✗ GPU not available                                           ║
║                                                                  ║
║  External Tools:                                                 ║
║    ✓ CellMarker API (accessible)                                 ║
║    ○ KEGG (needs setup)                                          ║
║                                                                  ║
╠══════════════════════════════════════════════════════════════════╣
║  Studies                                                         ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║  STUDY-001: Marker identification for Day14 fibroblasts         ║
║    Status: running                                               ║
║    Progress: 2/4 tasks completed                                 ║
║      ✓ TASK-001: Preprocess data                                 ║
║      ✓ TASK-002: Identify markers                                ║
║      ○ TASK-003: Pathway enrichment                              ║
║      ○ TASK-004: Visualization                                   ║
║                                                                  ║
║  STUDY-002: Cross-tissue validation                              ║
║    Status: blocked                                               ║
║    Blocker: GSE67890 not downloaded                              ║
║                                                                  ║
╠══════════════════════════════════════════════════════════════════╣
║  Artifacts                                                       ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║  Total: 5 artifacts (3 reusable)                                 ║
║                                                                  ║
║  Reusable:                                                       ║
║    • preprocessed.h5ad (data, from STUDY-001)                    ║
║    • markers.csv (data, from STUDY-001)                          ║
║    • marker_identification.py (code, from STUDY-001)             ║
║                                                                  ║
╠══════════════════════════════════════════════════════════════════╣
║  Evolution Trail                                                 ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║  Initial: "What are the top marker genes for Day14 fibroblasts?"║
║                                                                  ║
║  No studies closed yet.                                          ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
```

### qdd instructions STUDY-001 --json

```json
{
  "study_id": "STUDY-001",
  "study_question": "What are the marker genes for Day14 fibroblasts in lung tissue?",
  "read": [
    ".qdd/instructions.md",
    "contract.yaml",
    "context/resources.md",
    "studies/STUDY-001/study.md",
    "studies/STUDY-001/tasks/TASK-001.md",
    "studies/STUDY-001/tasks/TASK-002.md",
    "artifacts/index.yaml"
  ],
  "required_skills": [
    "genomics/h5ad-validator",
    "genomics/scanpy-recipes"
  ],
  "optional_skills": [
    "plotting/seaborn-themes"
  ],
  "write_to": "studies/STUDY-001/output/",
  "context_summary": {
    "datasets": [
      {
        "id": "GSE12345",
        "type": "scRNA",
        "status": "downloaded",
        "path": "/data/GSE12345/"
      }
    ],
    "environment": {
      "python_version": "3.10",
      "key_packages": ["scanpy", "anndata"],
      "gpu_available": false
    },
    "reusable_artifacts": []
  }
}
```

---

## Technology Stack

### Core CLI
- **Language:** Python 3.10+
- **CLI Framework:** Click or Typer
- **YAML Parser:** PyYAML
- **Schema Validation:** Pydantic or jsonschema
- **File Operations:** pathlib

### Skills System
- **Execution:** subprocess or importlib
- **Genomics:** scanpy, anndata
- **Plotting:** matplotlib, seaborn

### Future (V1+)
- **TUI:** Rich or Textual
- **SDK Runtime:** Anthropic SDK
- **Database:** SQLite (for artifact index)

---

## Development Phases

### Phase 1: Core CLI (Weeks 1-6)

**M1: Project Structure (Weeks 1-2)**
```
Deliverables:
  ✓ qdd init (creates directory structure)
  ✓ Schema definitions (contract, context, study, artifact)
  ✓ qdd validate (validates all YAML files)
  
Test:
  - Initialize empty project
  - Validate schemas catch errors
```

**M2: Study Workflow (Weeks 3-4)**
```
Deliverables:
  ✓ qdd add-study (creates study.md)
  ✓ qdd add-task (creates task.md)
  ✓ qdd instructions (returns JSON)
  ✓ Context reading (datasets, environment)
  
Test:
  - Create study with tasks
  - Get instructions JSON
  - Verify context is included
```

**M3: Artifact System (Weeks 5-6)**
```
Deliverables:
  ✓ qdd register-artifact
  ✓ artifacts/index.yaml management
  ✓ qdd close-study (generates question_delta)
  ✓ evolution.yaml tracking
  
Test:
  - Register artifacts
  - Close study with delta
  - Verify evolution trail
```

### Phase 2: Domain Plugins (Weeks 7-10)

**M4: Genomics Plugin (Weeks 7-8)**
```
Deliverables:
  ✓ h5ad-validator skill
  ✓ scanpy-recipes skill
  ✓ .h5ad artifact contract
  
Test:
  - Validate .h5ad files
  - Use Scanpy recipes
```

**M5: Plotting Plugin (Weeks 9-10)**
```
Deliverables:
  ✓ Figure artifact contract
  ✓ Seaborn themes skill
  ✓ Source data tracking
  
Test:
  - Generate figure with contract
  - Verify source data saved
```

### Phase 3: Enhanced Experience (Weeks 11-14)

**M6: Assist Mode (Weeks 11-12)**
```
Deliverables:
  ✓ Next-study proposal
  ✓ Close-project proposal
  
Test:
  - AI proposes next study
  - User approves/rejects
```

**M7: TUI (Weeks 13-14)**
```
Deliverables:
  ✓ Evolution trail visualization
  ✓ Study progress dashboard
  ✓ Context browser
  
Test:
  - Launch TUI
  - Navigate studies
```

---

## Testing Strategy

### Unit Tests
- Schema validation
- File operations
- JSON generation
- Context reading

### Integration Tests
- Full workflow: init → study → close
- Artifact registration and reuse
- Question delta generation

### End-to-End Tests
- Complete research project simulation
- Multi-study workflow
- Context accumulation

### User Acceptance Tests
- Real bioinformatics use case
- scRNA marker identification
- Cross-tissue validation

---

## Prompt Design: OpenSpec Research

### Research Findings

We studied [OpenSpec](https://github.com/Fission-AI/OpenSpec) to understand how successful AI collaboration frameworks organize agent instructions. Key findings:

#### 1. File Structure is Minimal

Each OpenSpec "change" (equivalent to our study) contains:
- `proposal.md` - Why and what
- `tasks.md` - Implementation checklist
- `specs/` - Requirements (optional)
- `design.md` - Technical approach (optional)
- `.openspec.yaml` - Minimal metadata (schema + created date only)

**No complex directory hierarchies** like `roles/`, `commands/`, `evolution/`.

#### 2. Single Agent Instruction File

OpenSpec uses **one** `AGENTS.md` file at project root containing:
- **Quick Reference** - Templates and format rules (copy-ready)
- **Workflow Guidance** - Step-by-step instructions
- **Embedded Templates** - Inline YAML/Markdown examples
- **Validation Checklist** - Common mistakes to avoid
- **Advanced Topics** - Progressive disclosure for complex cases

#### 3. Design Principles

From OpenSpec's [docs-agent-instructions spec](https://github.com/Fission-AI/OpenSpec/blob/main/openspec/specs/docs-agent-instructions/spec.md):

- **Lightweight by default** - Minimal ceremony, proportional rigor
- **Progressive disclosure** - Basics first, advanced topics later
- **Behavior-first** - Specs capture observable behavior, not implementation
- **Quick reference placement** - Templates and rules at the top
- **Copy-ready templates** - Direct copy-paste, no adaptation needed

#### 4. Dynamic Content Strategy

OpenSpec doesn't have "self-evolving prompts" in the sense of AI-updated rules. Instead:
- Static instruction file provides framework
- Each change's `proposal.md` and `tasks.md` capture context
- Validation is schema-based, not prompt-based
- Learning happens through accumulated artifacts, not prompt rewriting

### Application to QDD

Based on OpenSpec's success, QDD should adopt a **single-file prompt design**:

```
prompts/
└── project_manager.md    # Single instruction file
```

**Structure of `prompts/project_manager.md`:**

```markdown
# Project Manager Instructions

## Quick Reference

### Input Files
- control/research_contract.yaml - Theme and scope
- questions/evolution_trail.yaml - Question history
- artifacts/index.yaml - Available resources

### Output Template
[Copy-ready YAML template for proposal.yaml]

### Quality Targets
- artifact_reuse_ratio ≥ 0.5
- boundary_reduction ≥ 0.3
- criteria_specificity ≥ 0.8

---

## Workflow

1. Read evolution_trail → identify open_boundaries
2. Read quality_rules (below) → apply patterns
3. Read artifacts → identify reusable resources
4. Generate proposal following template
5. Self-evaluate using quality metrics

---

## Learned Quality Rules (Auto-Updated)

[This section is dynamically updated by CLI after each close-study]

Last updated: 2026-05-26 after STUDY-003

### Pattern 1: Specific Comparison > Broad Survey
Evidence: [study IDs and metrics]
Rule: [actionable guidance]
Confidence: HIGH/MEDIUM/LOW

### Pattern 2: Artifact Reuse Predicts Success
[...]

### Anti-Pattern: Scope Creep
[...]

---

## Advanced: Quality Metrics Explained

[Detailed explanation of three-layer metrics]
```

### Key Differences from Initial Design

| Initial Design (Over-engineered) | OpenSpec-Inspired (Simplified) |
|----------------------------------|--------------------------------|
| 3 directories (roles/, commands/, evolution/) | 1 file |
| 5+ markdown files | 1 markdown file |
| Complex file references | Self-contained |
| Agent reads multiple files | Agent reads 1 file |
| Separate static/dynamic files | Dynamic section within single file |

### Self-Evolution Mechanism

**How it works:**

1. **Static Framework** (top of file)
   - Quick reference, templates, workflow steps
   - Written once, rarely changes

2. **Dynamic Rules** (bottom of file)
   - "Learned Quality Rules" section
   - Updated by CLI after each `qdd close-study`
   - Agent appends new patterns or updates existing ones

3. **Update Trigger**
   ```bash
   $ qdd close-study STUDY-003
   
   Step 1: CLI calculates quality_check (3-layer metrics)
   Step 2: CLI calls Agent with:
           Input: prompts/project_manager.md + closure.yaml
           Task: Update "Learned Quality Rules" section
           - Add new patterns if discovered
           - Update confidence scores with new evidence
           - Add anti-patterns from failed studies
   Step 3: CLI writes updated file back
   ```

4. **Pattern Format**
   ```markdown
   ### Pattern N: [Title]
   Evidence:
   - STUDY-XXX (outcome): "question" → metrics
   - STUDY-YYY (outcome): "question" → metrics
   
   Rule: [Actionable guidance]
   Confidence: HIGH (N supporting, M contradicting)
   ```

### Benefits of This Approach

1. **Simplicity** - One file to read, edit, and debug
2. **Transparency** - User can see all logic in one place
3. **Maintainability** - Easy to hand-edit learned rules
4. **OpenSpec-aligned** - Follows proven successful pattern
5. **Self-contained** - No cross-file dependencies
6. **Progressive** - Basic workflow at top, advanced details at bottom

### Implementation Priority

**M2: Prompt System (after Core CLI)**
- [ ] Create `prompts/project_manager.md` template
- [ ] Implement static sections (quick ref, workflow, templates)
- [ ] Add placeholder "Learned Quality Rules" section

**M3: Self-Evolution (after Artifact System)**
- [ ] Implement quality_check calculation in `close-study`
- [ ] Create `prompts/commands/update_quality_rules.md` (instruction for Agent)
- [ ] Implement CLI logic to call Agent and update file
- [ ] Add pattern format validation

**M4: Quality Metrics (parallel with M3)**
- [ ] Implement Layer 1 (Structural) metrics
- [ ] Implement Layer 2 (Logical) metrics
- [ ] Implement Layer 3 (Convergence) metrics
- [ ] Add `qdd status --quality` visualization

---

**End of Development Prototype**
