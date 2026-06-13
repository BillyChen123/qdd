## Filesystem Contract

This change keeps the existing QDD project layout. It only changes public-facing guidance and domain-skill execution contracts.

Affected surfaces:

- `context/resources.md`
- generated `.qdd/instructions.md`
- `docs/*`
- `domain-skills/*/SKILL.md`
- `domain-skills/*/parameters.yaml`
- `domain-skills/*/scripts/*.py`
- `envs/*`

Skill outputs that run optional deep-learning backends must continue to write the normal skill artifacts under the study output directory:

- `report.md` or `reports/*.md`
- `result.json` or `reports/*_result.json`
- task-specific tables / figures / processed `h5ad` files

When a skill supports an optional deep-learning method, its JSON output must include a small runtime provenance object:

```json
{
  "runtime": {
    "backend": "scvi",
    "dependency_status": "available|installed|missing|failed",
    "install_attempted": false,
    "device_requested": "auto",
    "device_used": "cuda|cpu|mps",
    "device_fallback_reason": "gpu_unavailable"
  }
}
```

The exact nesting may follow the existing skill result shape, but those fields must be inspectable without opening logs.

## Identifiers And Metadata

No new top-level QDD lifecycle identifiers are introduced.

Existing executor skill metadata stays controlled by:

- `domain`
- `stage`
- `tags`

This change may add optional parameter metadata to existing skills, but it must not add broad free-text metadata categories.

Deep-learning executor scripts may expose:

- `--device auto|cpu|cuda|mps`
- `--install-missing`
- `--no-install-missing`

Default behavior:

- `--device auto` is the default for deep-learning methods.
- `auto` prefers CUDA when PyTorch reports CUDA availability.
- `auto` may use MPS when the backend supports it.
- `auto` falls back to CPU when no accelerator is available.
- Missing optional packages are not silently installed by default.
- Auto-install is allowed only when a task or command explicitly requests it.
- If auto-install is requested, install into the active Python environment, then re-check imports.
- If install is not requested or installation fails, emit a clear actionable error rather than continuing with a different algorithm.

This distinction is important:

- device fallback is allowed
- algorithm fallback is not allowed

For example, `method=scvi` may fall back from CUDA to CPU, but it must not silently switch to Harmony because `scvi-tools` is missing.

## Status JSON

No change to core `qdd status --json` is required.

If future runtime status exposes environment information, it must report capabilities rather than local environment names:

```json
{
  "compute": {
    "gpu": "available|unavailable|unknown",
    "python_env": "project-configured",
    "r_env": "project-configured|not-required|unknown"
  }
}
```

It must not include:

- home directories
- absolute machine-local source paths
- private project names
- API keys, tokens, or emails
- personal conda environment names unless the user explicitly wrote them into the project resources

## Instructions JSON

Generated instructions should guide agents to:

- read `context/resources.md` for the active environment
- prefer portable commands such as `python <script>` unless the project explicitly records an environment wrapper
- use GPU-capable deep-learning methods only when the selected executor skill exposes that method
- request `--device auto` by default for deep-learning methods
- use `--install-missing` only when the task explicitly authorizes dependency installation
- record any package installation in the task output report
- avoid writing credential-bearing URLs into persistent artifacts

The default resource template should avoid saying GPU is not required as a global fact. It should instead say CPU is sufficient for planning and many baseline skills, while GPU can be used by task-specific deep-learning backends when available.

## Agent Usage Rules

Agents must not infer that a local developer environment name is part of the public QDD protocol.

Agents may use existing local packages, and they may install missing optional packages only when one of these is true:

- the task explicitly says dependency installation is allowed
- the user explicitly requests installation
- auto mode generated a task that includes dependency installation as part of execution

Agents must not persist secrets:

- redact `api_key`, `token`, `secret`, `password`, and `auth` parameters
- redact contact emails from machine-readable result JSON unless the user explicitly asks to record them
- remove `api_key` and `email` query parameters from saved NCBI E-utilities URLs

Agents should preserve reproducibility by writing package names and versions after installation, but not shell history, private paths, or credentials.
