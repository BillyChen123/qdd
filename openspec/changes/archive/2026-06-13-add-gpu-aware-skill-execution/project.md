## Theme

Make QDD's shipped domain skills safe to run in clean public environments while allowing deep-learning backends to use GPU when available.

## Initial Question

How should QDD handle optional deep-learning dependencies and GPU devices without leaking local paths, personal environment names, API keys, or machine-specific assumptions?

## Mode

Assist mode for framework development. The human sets the product direction; the implementation should preserve a lightweight QDD architecture and avoid a heavy global execution manager.

## Scope

### In Scope

- Scrub personal or machine-local paths from public-facing docs and active OpenSpec artifacts.
- Prevent public-data skills from writing API keys, emails, auth tokens, or credential-bearing URLs into reports or JSON outputs.
- Replace hard-coded local environment assumptions in prompts/docs with portable environment guidance.
- Add a small, explicit dependency strategy for optional deep-learning skill backends:
  - prefer already-installed packages
  - if missing and auto-install is allowed, install into the active Python environment
  - if missing and auto-install is not allowed or fails, emit a clear actionable error
- Add GPU-first execution semantics for deep-learning methods:
  - request `auto` device by default
  - prefer CUDA when available
  - fall back to CPU when GPU is unavailable
  - record requested and used device in outputs
- Limit GPU/device controls to skills that actually use PyTorch or comparable deep-learning libraries.

### Out Of Scope

- A TypeScript-level GPU scheduler, queue, or resource allocator.
- A global package manager that mutates user environments without an explicit task-level opt-in.
- Replacing existing CPU-native Scanpy/Harmony/Scanorama workflows with deep-learning methods by default.
- Adding large new benchmark datasets or private local database references.
- Shipping personal environment names such as `<private-project>`, `<personal-python-env>`, or machine-local absolute paths.

## Evidence Standard

The change is successful when a clean checkout no longer exposes personal paths or credentials in generated guidance, public-data skills redact sensitive request fields, and any new deep-learning executor path can report:

- dependency status
- whether auto-install was attempted
- requested device
- actual device used
- CPU fallback reason when applicable

Existing non-deep-learning skills should continue to work without GPU packages installed.

## Shared Context

Current investigation found no direct hard-coded `device="cpu"` or `CUDA_VISIBLE_DEVICES=-1` in shipped domain-skill scripts. The main gaps are product hygiene and missing GPU-aware deep-learning entry points.

The current domain-skill tree contains 34 local skills. Most shipped executors are CPU-native scientific Python workflows. `scvi` / `scanvi` currently appear only as possible precomputed embedding names, not as runnable integration methods.

GEO and PubMed capture skills currently accept `--api-key` and `--email`; their output path must avoid persisting those values or URLs that include those values.
