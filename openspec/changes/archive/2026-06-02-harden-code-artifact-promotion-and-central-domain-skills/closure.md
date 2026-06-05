## Question Before

How should QDD avoid losing the main executed analysis script at closure time, and how should it stop duplicating domain skills into every project just to make them readable during planning and execution?

## Question After

How should QDD keep domain skills centralized at the QDD root while treating the study-local executed script as the real promotable `code` artifact surface?

## Change Type

refinement

## Change Driver

Two issues are now linked tightly enough to treat as one slice:

- the main executed script is often not promoted even though `code` artifacts are already supported in runtime,
- and domain skills are currently duplicated into projects even though the true reusable source of those skills belongs to QDD itself.

The goal is not more orchestration. The goal is a cleaner source-of-truth split:

- central domain knowledge in `qdd-root/domain-skills/`,
- executed reusable code in `studies/.../output/code/` and then `artifacts/code/`.

## Open Boundaries

- How QDD should resolve its own package root robustly across development, local install, and published-package environments
- Whether apply should always record exactly one main `code` candidate per substantive task, or allow several equally primary scripts in some studies
- Whether future packaging should expose central domain skills through a dedicated CLI helper, or whether path resolution through existing instructions is enough

## Evidence Summary

- Candidate-driven promotion already exists, so this slice does not need a new artifact system.
- `code` is already a valid artifact type, but current protocol pressure is not strong enough to ensure the executed script becomes an explicit candidate.
- The current project-local mirroring of domain skills creates maintenance cost without adding conceptual clarity.
- A thinner, clearer split is available: central domain skills at the QDD root, study-local executed code promoted through the existing candidate pipeline.

## Recommended Next Step

Apply this slice by:

- removing project-local domain skill projection while preserving local QDD workflow assets,
- resolving task skill reads against the QDD root `domain-skills/` library,
- and tightening apply/close so substantive analysis scripts are explicitly promoted as `code` artifacts.
