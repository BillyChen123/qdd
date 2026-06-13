## Task Goal

Implement the smallest safety and GPU-readiness slice that makes QDD's public skill system clean, portable, and ready for optional deep-learning backends.

## Study Link

Supports the study question in `study.md`: make domain-skill execution portable, credential-safe, and GPU-aware without adding a heavy runtime scheduler.

## Method

1. Audit and scrub public-facing local information.
2. Harden public-data scripts against credential persistence.
3. Make environment guidance portable.
4. Define and document optional deep-learning dependency/device behavior.
5. Add tests for redaction and template hygiene.

Implementation should prefer small direct edits over new framework layers.

## Expected Outputs

- Updated public-data capture scripts:
  - saved E-utilities URLs must omit `api_key` and `email`
  - result JSON and reports must not contain API keys, emails, tokens, or secrets
- Updated docs / generated templates:
  - no machine-local absolute paths in active public-facing docs
  - no personal environment names such as `<private-project>` or `<personal-python-env>`
  - compute guidance allows task-specific GPU use
- Updated domain-skill guidance:
  - `qdd-skill-core` is framed as an example packaged environment, not a protocol requirement
  - skill docs prefer the project-configured Python environment
- A small documented contract for deep-learning skills:
  - `--device auto|cpu|cuda|mps`
  - explicit `--install-missing` behavior
  - backend/device/dependency provenance in outputs
- Tests or smoke checks:
  - redaction helper removes sensitive NCBI params
  - default resource template does not say GPU is globally unavailable or unnecessary
  - repository scan catches personal path/environment regressions in active docs and source

## Run Contract

Each implementation run must record:

- files changed
- whether any generated `dist/` files were rebuilt
- test commands run
- whether any dependency installation was attempted
- whether any sensitive-token scan was run

If adding a deep-learning executor method, its result JSON must record:

- backend name
- backend package import/install status
- install command attempted, if any, without credentials
- requested device
- actual device used
- fallback reason when actual device differs from requested device

## Failure / Blocker Conditions

- A public-data skill still writes `api_key`, auth token, email, or credential-bearing URL to persistent output.
- An implementation silently changes `method=scvi` or another requested deep-learning method into a CPU-native unrelated method.
- Auto-install mutates the environment without explicit task/user authorization.
- A public-facing source or doc file still contains private local paths or personal environment names.
- Existing CPU-native skills require PyTorch/scVI packages after this change.
