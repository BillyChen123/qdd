<div align="center">
  <img src="logo/QDD.png" alt="QDD - Question-Driven Discovery" width="430" />

  <p><strong>Question-driven orchestration for AI-assisted biomedical discovery.</strong></p>
  <p>Turn long-horizon research into an auditable loop of questions, evidence, artifacts, and next-study decisions.</p>

  <p><strong>Language</strong></p>
  <p><a href="README.zh-CN.md">简体中文</a> · <strong>English</strong></p>

  <p><strong>Quick Links</strong></p>
  <p>
    <a href="#the-five-core-flows">Core Flows</a>
    ·
    <a href="#auto-mode">Auto Mode</a>
    ·
    <a href="#domain-skill-injection">Skills</a>
  </p>
</div>

## What QDD Gives You

<table>
  <tr>
    <td><strong>Question governance</strong><br />Every study records how the research question changed: refinement, confirmation, pivot, or dissolution.</td>
    <td><strong>Agent-ready memory</strong><br />Contracts, study files, task records, artifacts, and evolution history stay readable to both humans and agents.</td>
  </tr>
  <tr>
    <td><strong>Domain skill injection</strong><br />34 local skills are routed by role and task instead of being dumped into every prompt.</td>
    <td><strong>Public-data grounding</strong><br />CELLxGENE, GEO, PubMed, CellMarker, and ligand-receptor references become auditable local artifacts.</td>
  </tr>
</table>

## Why QDD

Modern AI agents can write code, search public databases, and run analyses. The hard part is no longer only execution. The hard part is keeping a multi-step scientific project coherent after every partial result, failed hypothesis, dataset limitation, or promising signal.

QDD is built for that gap:

| Without QDD | With QDD |
|---|---|
| Scattered chats, scripts, notebooks, and folders | One readable research state shared by humans and agents |
| Agents optimize the next task only | Agents optimize the next question |
| Negative results become dead ends | Negative results become pivots, validations, or robustness studies |
| Public-data searches are hard to audit | Dataset and reference choices are recorded as reusable evidence |
| Domain knowledge must be re-explained every turn | Domain skills are injected into the right role at the right time |

## The Five Core Flows

QDD is intentionally small. The human-facing mental model is five flows plus Auto Mode.

### 1. Start

Establish the project contract: research theme, scope, data assumptions, runtime environment, durable resources, and mode. This is the stable "why are we doing this?" layer.

### 2. Propose

Turn the current frontier into one bounded study. A good study has a judgeable question, a falsifiable expectation, a small task graph, and explicit resource fit.

### 3. Explore

Stress-test a proposed study before execution. This is where the agent and user refine boundaries, decide whether public data is needed, and avoid over-broad or under-powered plans.

### 4. Apply

Execute the study tasks. QDD injects task-local domain skills, runs code inside the project, preserves scripts and outputs, and keeps final artifacts under a canonical study output surface.

### 5. Close

Synthesize evidence and update the research frontier. A close event can refine, confirm, pivot, or dissolve a question. QDD records what changed, what remains open, which artifacts are reusable, and what next candidates are worth pursuing.

## Auto Mode

Auto Mode runs the whole loop through an Anthropic-compatible SDK session:

```text
Start -> Propose -> Apply -> Close -> Propose -> ...
```

It is designed for long-running research automation, not a single prompt. The runtime decides the next phase from persisted QDD state, while the thesis-manager role decides whether the project should continue, stop, validate, pivot, or search for better data.

Minimal launch:

```bash
qdd auto --max-turns unlimited
```

Auto Mode currently speaks the Anthropic protocol. Install dependencies and configure an Anthropic-compatible model before running it. If you use DeepSeek as the default backend, route it through an Anthropic-compatible gateway or internal proxy:

```bash
export ANTHROPIC_AUTH_TOKEN="your-api-key"
export ANTHROPIC_BASE_URL="https://<your-anthropic-compatible-deepseek-gateway>"
export ANTHROPIC_MODEL="deepseek-reasoner"
qdd auto --max-turns unlimited
```

You can also pass the model explicitly:

```bash
qdd auto --model deepseek-reasoner --max-turns unlimited
```

## Domain Skill Injection

QDD ships with **34 local skills** that are routed by role and task instead of dumped into every prompt.

| Skill layer | Current coverage |
|---|---|
| Thesis planning | project-frontier planning and continue/stop/pivot decisions |
| Study brain | single-cell, spatial, and public-data planning |
| scRNA-seq | QC, integration, clustering, annotation, DE, group stats, module scoring, enrichment, communication, trajectory |
| scATAC-seq | LSI preprocessing, latent integration, gene-activity annotation, DAR |
| Spatial transcriptomics | QC, integration, clustering, annotation, group stats, DE, neighborhood, niche composition, structure quantification |
| Public data and reference | CELLxGENE, GEO, PubMed, CellMarker, ligand-receptor resources |

The point is not just more tools. The point is **role-aware injection**:

- thesis-manager gets frontier-planning skills
- study-brain gets planning skills
- executor gets only the task-local domain skills it needs
- public-data skills are separated from downstream analysis skills

This keeps prompts smaller, analysis more reproducible, and agent behavior easier to audit.

## Public Data As First-Class Research Context

QDD treats external data and references as evidence, not hidden prompt memory.

Supported public-data/reference surfaces currently include:

- CELLxGENE dataset discovery
- GEO candidate capture
- PubMed evidence capture
- CellMarker marker reference capture
- ligand-receptor database capture

Dataset acquisition and downstream analysis are deliberately decoupled:

```text
external source -> fetch/capture skill -> local artifact -> domain executor -> study output
```

That means an agent can first find or validate a dataset, then hand a normalized local artifact to a single-cell or spatial workflow without mixing search logic into analysis code.

## What QDD Is Not

- It is not a clinical decision system.
- It is not a black-box cloud notebook.
- It is not a replacement for domain judgment.
- It is not a rigid workflow engine where every branch is pre-scripted.

QDD is a protocol layer for human-agent research: local files, explicit evidence, reusable artifacts, and question evolution.

## Quick Start

Requirements:

- Node `>=20.19.0`
- An Anthropic-compatible model configuration for Auto Mode

Install locally:

```bash
npm install
npm run build
npm install -g .
```

Initialize a research project:

```bash
mkdir my-qdd-project
cd my-qdd-project
qdd init .
```

Then either run the five flows manually through your agent workflow, or start Auto Mode:

```bash
qdd auto --max-turns unlimited
```

More installation details are in [docs/04-installation-guide.md](docs/04-installation-guide.md).
