# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

QDD (Question-Driven Discovery) is a research-driven framework that treats scientific inquiry as question evolution rather than optimization. The core insight: in research, the question itself evolves—QDD makes that evolution trackable, auditable, and consumable.

## Architecture

QDD follows the OpenSpec pattern: CLI as pure filesystem state manager (no AI calls), with markdown files injecting agent instructions.

**Three-layer design:**
- **CLI layer**: Manages research contract, evolution trail, study dependency graph; returns JSON state
- **Prompt layer**: Markdown templates + schema definitions for artifact dependency graph, injected into host agent
- **Orchestration layer** (optional): Thin loop driver for auto mode via SDK

**Key interfaces:**
- `qdd status --json` → returns current question state, open_boundaries, change_type sequence
- `qdd instructions <artifact-id> --json` → returns template + rules + output path
- Agent calls CLI via bash, parses JSON, generates content per markdown instructions, writes files

**Design principle:** Innovation is independent of implementation. Swap SDK, swap agent, swap model—the core remains unchanged. Human mode works at zero cost.

## Object Model

- **project** = theme contract + evolution trail. Locks research theme, tracks question evolution history
- **study** = bounded question (a deterministic proposal). Each study answers one specific question within theme
- **task** = evidence-producing verification process (spec-level execution unit). Does not redefine question, only produces verification evidence
- **run** = minimal execution attempt

**Study → Task layer** reuses software development's proposal → spec execution paradigm (faithful execution + structured delivery).

**Project layer** is research-specific, handles question evolution tracking—this is the innovation.

The interface between layers is `question_delta`: after study execution, structured report of "did the question change, how, what boundaries remain". Project layer consumes this signal for evolution judgment.

## Question Delta

Every study closure produces a `question_delta`:

```yaml
question_delta:
  question_before: string
  question_after: string
  change_type: refinement | confirmation | pivot | dissolution
  change_driver: string
  open_boundaries: []
```

**Four change types (mutually exclusive):**
- `refinement`: question survives, boundaries narrowed, direction unchanged
- `confirmation`: question sufficiently answered (support or refute)
- `pivot`: question abandoned before sufficient answer because "wrong question", better alternative within same theme
- `dissolution`: question undecidable within current resource boundaries

**Closure signal:** `change_type` sequence all refinement AND `open_boundaries` count monotonically decreasing → consider closure.

## Three Modes

Same project → study → task → run flow, different modes set different human confirmation boundaries for key decisions.

| Mode | Core Difference |
|------|-----------------|
| human | Human proposes question, agent translates to executable study |
| assist | Agent proposes, materialize/close/out-of-scope requires human confirmation |
| auto | Agent autonomously advances within research contract scope, awaiting_human only when exceeding contract or missing required human input |

**Key rules:**
- Mode can switch mid-project, only affects subsequent authority, does not rewrite history
- In auto mode, pivot/dissolution does not auto-trigger awaiting_human; ThesisManager judges based on contract scope
- In human mode, CLI + markdown instructions suffice—no SDK runtime needed

## Research Contract

Defined at init-project, locks research boundaries:

```yaml
research_contract:
  theme: string
  initial_question: string
  mode: human | assist | auto
  scope:
    in_scope: []
    out_of_scope: []
  termination_type: best_effort
  evidence_standard:
    min_studies: 1
    required_signal: support_or_refute | descriptive_boundary | engineering_delivery
    uncertainty_tolerance: string
```

## Directory Structure

```text
.
├── qdd.yaml
├── control/
│   ├── research_contract.yaml
│   └── mode.yaml
├── questions/
│   └── evolution_trail.yaml
├── studies/
│   └── STUDY-001/
│       ├── study.yaml
│       ├── study.md
│       ├── closure.yaml
│       └── tasks/
│           └── TASK-001/
│               ├── task.yaml
│               ├── task.md
│               └── runs/
│                   └── RUN-001/
│                       ├── run.yaml
│                       ├── candidate/
│                       └── artifacts/
├── artifacts/
│   ├── index.yaml
│   ├── data/
│   ├── code/
│   ├── figures/
│   └── reports/
├── prompts/
│   ├── roles/
│   └── commands/
└── plugins/
    ├── genomics/
    └── plotting/
```

## CLI Commands

### v0 Commands (Priority)
- `qdd init` - Initialize project with research contract
- `qdd status --json` - Get current project state
- `qdd add-study` - Create bounded question
- `qdd add-task` - Create evidence task
- `qdd instructions <id> --json` - Get execution instructions for agent
- `qdd close-task` - Record task result
- `qdd close-study` - Generate question_delta
- `qdd artifacts list --json` - List all artifacts
- `qdd validate` - Validate schema and state transitions

### v1 Commands (Later)
- `qdd edit-contract`
- `qdd retry-study`
- `qdd cache-data`
- `qdd register-code`
- `qdd plot-spec`
- `qdd export-report`

### Post-v1 Commands
- `qdd run-auto`
- `qdd tui`
- `qdd sdk-status`

## Development Phases

### M0: Project Bootstrap ✓
- Memory files
- Product discussion draft
- Development document draft
- PanRank migration/discard checklist

### M1: Core Filesystem Protocol (Next)
- `qdd init`
- Schema definitions
- project/study/task/run file structure
- `qdd validate`

**Acceptance:** Empty directory can initialize. Missing fields, illegal enums, illegal state transitions are blocked.

### M2: Human Mode Instructions
- `qdd instructions <study|task|closure>`
- Markdown command templates
- Status JSON

**Acceptance:** Codex can generate task result per instructions. Manual execution of one round can close study and write `question_delta`.

### M3: Artifact System
- Artifact index
- Run artifact dirs
- data/code/table/figure/report artifact contracts
- `qdd artifacts list --json`

**Acceptance:** Each task result must declare at least one artifact or blocker. Artifacts traceable to study/task/run.

### M4: Genomics + Plotting Plugins
- `.h5ad` schema summary
- Preprocessing artifact rules
- Plotting task contract
- Figure source data contract

**Acceptance:** One scRNA demo can save annotated h5ad, result table, figure, and report.

### M5: Assist Mode
- Next-study proposal
- Close-project proposal
- Retry-study proposal

**Acceptance:** Agent can propose, but project-level materialize/close requires explicit confirmation.

### M6: SDK Auto Runtime
- Auto read status
- Auto call agent
- Auto validate output
- Authority mode controls advancement

**Acceptance:** Same human-mode workflow runs in auto mode without changing core file protocol.

## Key Design Principles

- **Critical rules should be schema, not prompt prose**
- **Prompt tells agent how to act; schema prevents invalid state**
- **Core tracks inquiry, not optimize novelty**
- **Domain capability should be pluggable, not hardcoded**
- **Human mode must be first-class, not degraded auto mode**
- **Every reusable output must have provenance**
- **A failed or unresolved study is still useful if it sharpens the question boundary**

## What NOT to Do

- Do not call AI models in core CLI
- Do not do automatic literature review in core
- Do not use novelty as global gate
- Do not build complex GUI/TUI as first deliverable
- Do not hardcode scRNA/plotting/package installation rules into core prompts
- Do not promise automatic project closure or automatic scientific truth judgment

## Prompt/Instruction Design

Prompt layer does three things only:
- Tell agent the current artifact's objective
- Tell agent available inputs and boundaries not to cross
- Require agent output conforming to schema

Better distribution:
- Invariants → schema validator
- State transitions → CLI
- Domain practices → plugin instructions
- Single-task objectives → command instruction
- Agent behavior posture → short role prompt

## Domain Plugins

### Genomics Plugin
Solves execution-layer problems in scRNA/spatial/scATAC/GWAS tasks. Provides:
- Data binding checklist
- `.h5ad` artifact contract
- obs/var/layer/schema summary
- Preprocessing provenance
- Label mapping report
- Standard Scanpy/AnnData recipes
- Safe smoke tests

### Code Reuse Plugin
Prevents agent from writing every run as one-off script. Provides:
- Project-local `src/` or `analysis_lib/` code deposition rules
- Task candidate script → reusable module promotion rules
- Minimal unit/smoke test contract
- Code artifact index

### Plotting Plugin
Makes scientific plotting auditable artifact, not random final image. Provides:
- Figure spec
- Source data contract
- Style/theme contract
- Caption draft
- File outputs: `.png/.pdf/.svg` + source table + figure metadata

## Migration from PanRank

**Migrate:**
- `contracts/schemas.ts` project/study/task/run schemas
- Runtime store artifact/run logging concepts
- Prompt asset loader concepts
- TUI/sidebar state display concepts

**Defer:**
- `@openai/codex-sdk` runtime
- Semantic Scholar MCP
- Novelty gate editor
- Giant role prompts
- Full TUI

**Discard or rewrite:**
- Novelty-first project dispatch
- Project research gate
- Hardcoded plotting delivery rules in Coder
- Design that stuffs package installation, environment policy, domain skills into single role prompt

## Current Status

Project is in M0 (bootstrap) phase. Next milestone is M1: Core Filesystem Protocol.

First deliverable v0 definition: "In an empty research project, user can use QDD + generic Codex to complete one auditable question evolution loop from research contract to study closure, depositing at least one reusable artifact."
