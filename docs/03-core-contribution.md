# QDD Core Contribution

## The Problem

**Most AI-for-science systems assume the research question is fixed.** They model scientific inquiry as an optimization problem: search a predefined hypothesis space for the best answer. This works for well-defined problems (protein folding, molecular docking) but fails in exploratory research.

**The reality: in exploratory research, the question itself evolves.** You start asking A, discover halfway through that the real question is B, then realize B depends on resolving C first. This question evolution is not a bug—it's the essence of discovery.

Current AI systems don't track this. They treat question changes as failures (pivot = wasted effort) or ignore them entirely (just keep the final result, discard the path). **We lose the most valuable signal: how the question evolved and why.**

## The Core Insight

**Question evolution is not noise—it's structured signal.**

When a study closes, it produces more than just an answer. It produces:
- Evidence that narrows the question boundary
- Artifacts that enable follow-up questions
- A decision: refine, confirm, pivot, or dissolve

This is analogous to spec-driven development (SDD):
- In SDD: vague requirements → iterative specs → clear contract
- In QDD: vague question → iterative evidence → decidable question

**Both are convergence processes.** The difference: SDD converges to "what to build", QDD converges to "what to ask".

## What QDD Does Differently

### 1. Question Delta as First-Class Object

Every study closure produces a `question_delta`:

```yaml
question_delta:
  question_before: "What cell types are in this dataset?"
  question_after: "What are the T cell subtypes and their activation states?"
  change_type: refinement  # or confirmation, pivot, dissolution
  change_driver: "Initial clustering revealed 8 major types; immune cells show highest heterogeneity"
  open_boundaries:
    - "Activation state markers need validation"
    - "Rare subtypes (<1%) not yet characterized"
```

**This is not a summary—it's a structured contract** between the study layer (execution) and project layer (question management).

### 2. Three-Layer Quality Metrics

Question quality is quantified through three complementary lenses:

**Layer 1: Structural (objective, filesystem-based)**
- `artifact_reuse_ratio`: Do later studies reuse earlier outputs?
- `combination_novelty`: Are we recombining artifacts in new ways?
- `graph_centrality`: Which artifacts are most depended upon?

**Layer 2: Logical (agent-assisted, schema-validated)**
- `criteria_specificity`: Can success/failure be defined precisely?
- `criteria_testability`: Can we verify the answer with available resources?
- `undecidable_zone_size`: How much remains unknowable?

**Layer 3: Convergence (objective, history-based)**
- `boundary_reduction_rate`: Are open boundaries shrinking over time?
- `boundary_elimination_count`: How many boundaries have been fully resolved?
- `convergence_velocity`: Is progress accelerating or stalling?

**Key design**: Layers 1 and 3 are objective (computable from filesystem state), providing sanity checks for Layer 2 (which requires agent judgment). If an agent claims a question is high-quality but produces no reusable artifacts, the structural score exposes the disconnect.

### 3. Self-Evolving Project Manager

The project-level prompt is not static. After each study closure:

1. CLI computes three-layer metrics
2. CLI appends learned pattern to `prompts/project_manager.md`:

```markdown
## Learned Quality Rules

### Pattern: Premature cell type naming
- **Evidence**: Study-003 named 5 subtypes; Study-004 discovered 3 were doublets
- **Rule**: Require QC metrics (doublet score, ambient RNA) before naming
- **Confidence**: High (n=2 failures)

### Pattern: Reusable preprocessing
- **Evidence**: Studies 001-004 all used same normalization → artifact reuse 0.8
- **Rule**: Deposit preprocessing code to `src/` after first use
- **Confidence**: High (n=4 successes)
```

**This is not reinforcement learning.** It's structured memory: the system learns what worked and what didn't, in a form that's human-readable and editable.

## Comparison to Existing Approaches

| Approach | Question Evolution | Quality Metric | Human Role |
|----------|-------------------|----------------|------------|
| **Jupyter + LLM** (Copilot, Cursor) | Implicit, lost in history | None | Drives everything |
| **Automated research** (AI Scientist, research agents) | Ignored (one-shot generation) | Novelty score (unreliable) | Passive observer |
| **Electronic lab notebooks** (Benchling, LabArchives) | Manual notes, unstructured | None | Manual tracking |
| **QDD** | Explicit, structured, tracked | Three-layer metrics | Epistemic authority |

**Key differences:**

1. **vs Jupyter + LLM**: We make question evolution explicit and trackable, not buried in cell execution history.

2. **vs Automated research**: We don't claim AI can do science alone. Human sets research contract (theme, scope, termination criteria); AI executes within boundaries and reports when question changes.

3. **vs Lab notebooks**: We provide computational structure. Question evolution is not free-text notes—it's typed deltas with validation.

## The Core Contribution

**We formalize question evolution as a computable process.**

Specifically:

1. **Formalization**: Question convergence is defined through three measurable dimensions (structural, logical, convergence), not subjective judgment.

2. **Mechanism**: `question_delta` provides structured signal between execution layer (studies/tasks) and question management layer (project).

3. **Validation**: Convergence metrics are objective and testable. We can detect when a question is:
   - Converging (boundaries shrinking, artifacts reused)
   - Stalling (no boundary reduction, low artifact reuse)
   - Diverging (pivot without clear driver, dissolution without exhausting options)

4. **Self-improvement**: The system learns from its own evolution trail, updating project-level guidance based on what worked.

**This is not about making AI smarter.** It's about making question evolution—the core process of exploratory research—visible, trackable, and improvable.

## What This Enables

**Short-term (human mode)**:
- Researchers can see how their question evolved and why
- Reusable artifacts are tracked, not lost in scattered notebooks
- Question quality is quantified, not guessed

**Medium-term (assist mode)**:
- AI can propose follow-up questions based on convergence metrics
- System warns when question is stalling or diverging
- Self-evolution improves question quality over time

**Long-term (auto mode)**:
- Multi-agent orchestration: ThesisManager (question evolution) + StudyBrain (planning) + Executor (implementation)
- Autonomous research within explicit contract boundaries
- Human intervention only when exceeding contract scope or hitting undecidable boundaries

## Why This Matters

**Current AI-for-science systems optimize for the wrong thing.** They try to maximize novelty, automate hypothesis generation, or replace human judgment.

**QDD optimizes for question clarity.** The goal is not to answer questions faster—it's to help researchers discover the *right* questions to ask.

Because in exploratory research, **asking the right question is 80% of the work.**

---

**In one sentence**: QDD treats question evolution as a first-class, quantifiable process, making exploratory research trackable and improvable without assuming AI can replace human scientific judgment.
