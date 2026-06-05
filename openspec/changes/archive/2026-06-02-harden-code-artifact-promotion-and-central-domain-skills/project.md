## Theme

Keep QDD lightweight while making executed analysis code explicitly reusable and moving domain skills back to one central library owned by the QDD repo itself.

## Initial Question

How should QDD ensure that substantive analysis scripts are promoted as `code` artifacts, while resolving domain skills from the QDD root `domain-skills/` library instead of copying those skills into every project?

## Mode

`human`

Humans still own which study outputs deserve reuse and which domain skills belong in the shared library. Agents may tighten apply/close behavior and resolve skill paths, but must not invent shadow skill copies or silently skip code promotion review.

## Scope

### In Scope

- Tighten the apply/close contract so substantive analysis scripts are explicitly reviewed for promotion.
- Default the main study script into `artifact-candidates.yaml` as a `code` candidate when a task runs real analysis code.
- Ensure `qdd-close` promotes explicit `code` candidates into `artifacts/code/` just like other artifact types.
- Treat the executed study-local script under `studies/STUDY-XXX/output/code/` as the promotable code surface, not the upstream library source file.
- Make QDD root `domain-skills/` the canonical source of domain skills.
- Stop projecting domain skills into project-local `.codex/skills/` and `.claude/skills/`; keep only QDD workflow assets there.
- Keep `task.skills` as canonical skill IDs rather than filesystem paths.

### Out Of Scope

- Rewriting the whole workflow prompt system beyond the path and promotion tightening needed here.
- Adding a new skill registry, router, or catalog runtime beyond the current lightweight contract.
- Moving QDD workflow skills out of the local tool bootstrap surface.
- Redesigning artifact schemas beyond the explicit `code` promotion behavior needed here.
- Solving remote distribution or package-install discovery for external skill libraries beyond the QDD root library.

## Evidence Standard

This change is successful when:

- a task that runs substantive analysis code preserves a readable final script under `studies/STUDY-XXX/output/code/`,
- that script is normally recorded into `artifact-candidates.yaml` as a `code` candidate unless it is directly registered,
- `qdd-close` reliably promotes explicit `code` candidates into `artifacts/code/`,
- initialized projects stop receiving copied domain skills under local tool directories,
- and task/execution instructions resolve domain skill reads from the QDD root `domain-skills/` library while leaving `task.skills` as stable IDs.

## Shared Context

- The runtime already supports `code` as a real artifact type and already has candidate-driven promotion, but current behavior depends too much on prompt discipline and too little on an explicit code-promotion contract.
- Current bootstrap mirrors domain skills into project-local `.codex/skills/` and `.claude/skills/`, which duplicates maintenance and muddies the true source of shared domain knowledge.
- The user has explicitly said prompt pressure is already strong enough for skill reuse; the problem is not adding more orchestration, but clarifying where skills live and what code must be promoted.
- In the current development checkout, the intended central skill source is `/data/chenyz/project/qdd/domain-skills`. The portable product meaning should be “QDD package root `domain-skills/`”, not a hard-coded machine path.
