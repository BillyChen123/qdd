## Question

Can QDD make domain-skill execution portable, credential-safe, and GPU-aware without adding a heavy runtime scheduler or forcing every user to preinstall deep-learning packages?

## Hypothesis / Expectation

A lightweight executor-local contract is enough:

- public-data skills can redact credentials at output time
- generated resources and docs can avoid personal environment/path assumptions
- optional deep-learning methods can expose `--device auto` and explicit dependency installation controls
- GPU can be preferred when available while CPU remains a valid fallback device

The expected outcome is a safer public repository and a clearer path for future scVI/scANVI-style skills, not a full compute orchestration subsystem.

## Inputs

- Existing domain-skill scripts under `domain-skills/`
- Existing default environment file under `envs/`
- Existing generated resource template in `src/file-contracts/resources.ts`
- Existing install and roadmap docs under `docs/`
- Current public-data skills:
  - `public-data/geo-candidate-capture`
  - `public-data/pubmed-evidence-capture`
- Current CPU-native single-cell / spatial skills that already use threads but do not use PyTorch.

## Evidence Plan

The implementation should produce evidence for four things:

- Sensitive-output audit:
  - GEO and PubMed capture outputs must not persist API keys, emails, or credential-bearing URLs.
- Portability audit:
  - active docs and prompts must not expose personal paths or personal environment names.
  - `qdd-skill-core` may remain as a shipped example env only if it is clearly framed as optional and not required by the protocol.
- GPU semantics:
  - deep-learning capable skills must prefer GPU through `--device auto`.
  - if GPU is unavailable, they must run on CPU when the chosen backend supports CPU.
  - the used device must be written to outputs.
- Dependency semantics:
  - missing optional packages may be installed only with explicit authorization.
  - install attempts and failures must be recorded.
  - chosen algorithms must not silently downgrade to unrelated methods.

## Blockers

- No currently shipped executor appears to run a PyTorch deep-learning backend directly.
- Adding scVI/scANVI support may require new optional dependencies and may make the default conda env heavier if not isolated.
- Automatic installation can surprise users if it mutates environments without an explicit opt-in.

## Exit Signal

The study can close when the change defines a minimal implementation path with:

- exact files to scrub or update
- a clear redaction rule for public-data outputs
- a clear device/dependency contract for future deep-learning skills
- tests or smoke checks that prove no secrets are written and existing CPU-native skills remain unaffected
