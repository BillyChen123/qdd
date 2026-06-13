## 1. Safety And Portability

- [x] 1.1 Add a shared redaction helper or local redaction functions for public-data scripts that remove `api_key`, `email`, `token`, `secret`, `password`, and `auth` values from persisted outputs.
- [x] 1.2 Update `geo-candidate-capture` so saved `ncbi_esearch_url`, JSON, and reports never include API keys or contact emails.
- [x] 1.3 Update `pubmed-evidence-capture` so saved `ncbi_esearch_url`, JSON, and reports never include API keys or contact emails.
- [x] 1.4 Add tests or smoke checks proving GEO/PubMed result payloads redact sensitive parameters.
- [x] 1.5 Scrub active public-facing docs and change artifacts for machine-local paths such as `<local-absolute-path>` and project-private names such as `<private-project>`.

## 2. Environment Guidance

- [x] 2.1 Update the default `context/resources.md` template so compute guidance says CPU is sufficient for planning/baseline skills, while GPU may be used by task-specific deep-learning backends when available.
- [x] 2.2 Remove any public prompt or doc language that implies a personal Python/R environment is required.
- [x] 2.3 Reframe `qdd-skill-core` as a shipped example environment rather than the protocol-required environment.
- [x] 2.4 Update skill examples where appropriate to prefer the project-configured Python environment instead of hard-coding `conda run -n qdd-skill-core` as the only route.

## 3. Deep-Learning Dependency Contract

- [x] 3.1 Document the optional deep-learning backend contract in domain-skill docs: selected algorithm must not silently downgrade to another algorithm.
- [x] 3.2 Define `--install-missing` / `--no-install-missing` semantics for future PyTorch-backed executor skills.
- [x] 3.3 Make dependency auto-install opt-in at task level: if authorized, attempt installation into the active Python environment; if not authorized or installation fails, emit a clear actionable error.
- [x] 3.4 Record dependency status, install attempt, and package version in deep-learning skill `result.json` / report output.

## 4. GPU Device Contract

- [x] 4.1 Define `--device auto|cpu|cuda|mps` semantics for PyTorch-backed executor skills.
- [x] 4.2 Make `auto` prefer CUDA when available, then MPS when supported, otherwise CPU.
- [x] 4.3 Allow GPU-to-CPU fallback for the same selected deep-learning method when the accelerator is unavailable.
- [x] 4.4 Record requested device, actual device, and fallback reason in deep-learning skill outputs.
- [x] 4.5 Do not add device arguments to CPU-native skills unless they actually call a deep-learning backend.

## 5. Validation

- [x] 5.1 Run a repository scan for personal paths and personal environment names in active source/docs, excluding generated package output and historical archived artifacts only if intentionally exempted.
- [x] 5.2 Run `npm run build`.
- [x] 5.3 Run `npm test`.
- [x] 5.4 Run `git diff --check`.
- [x] 5.5 Verify existing CPU-native skill tests or smoke behavior do not require PyTorch/scVI packages.
