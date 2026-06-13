## Question Before

Should QDD add GPU support by letting domain-skill scripts use accelerators, and should the repository remove personal environment/path leakage before being presented as a clean public agent framework?

## Question After

QDD should first harden portability and credential safety, then add GPU-aware behavior only at executor backends that actually use deep-learning packages. Dependency installation should be explicit and auditable, while device fallback from GPU to CPU should be automatic for the selected deep-learning method.

## Change Type

refinement

## Change Driver

The code audit showed no current hard-coded CPU device for deep-learning methods, but it did reveal two concrete risks:

- public-data skills can persist credential-bearing NCBI URLs
- active docs/templates still include local-path or environment assumptions

GPU support is therefore a readiness and extension problem, not a current bug in shipped PyTorch code.

## Open Boundaries

- Which first deep-learning backend should be added: scVI/scANVI integration, label transfer, or doublet detection?
- Whether the repository should ship a separate optional GPU environment file, such as a PyTorch/scVI extra, instead of expanding the default skill environment.
- Whether auto mode may authorize `--install-missing` by default for trusted packages, or whether it should always require task-local explicit authorization.
- How much of dependency installation should be handled inside executor scripts versus by generated task instructions.

## Evidence Summary

The proposed implementation path is:

- redact sensitive public-data output immediately
- scrub active public-facing local paths and personal environment names
- make default resource guidance GPU-capable without requiring GPU
- document skill-local dependency/device semantics
- avoid introducing a heavyweight runtime scheduler
- keep CPU-native skills independent of deep-learning packages

## Recommended Next Step

Proceed to implementation for the safety and portability pieces first. Add the dependency/device contract at the same time, but only wire it into an actual deep-learning skill when that backend is introduced or extended.
