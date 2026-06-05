## Theme

Clarify QDD's planning knowledge boundary so domain brain skills act as sidecar domain priors and executor-skill usage guides, while `context/resources.md` remains the single readable project context entrypoint with room for stable analyst preferences.

## Initial Question

How should QDD polish the current `brain/study-planning-core` skill so it supplements, rather than overrides, `qdd-propose` and `qdd-explore`, and how should `context/resources.md` evolve so one document can carry project facts plus durable user preferences without introducing a heavier memory subsystem?

## Mode

`human`

Humans still own workflow semantics, domain-prior content, and the final wording of reusable prompts and templates. Agents may tighten the content boundary, update scaffolds, and refine readable templates, but must not silently redefine QDD workflow authority or introduce a new memory layer as a hidden system.

## Scope

### In Scope

- Reposition `domain-skills/brain/study-planning-core/SKILL.md` as a sidecar domain-prior and executor-skill usage guide.
- Remove or rewrite wording in the brain skill that duplicates QDD workflow semantics already owned by `qdd-propose` and `qdd-explore`.
- Keep the brain skill focused on domain-specific judgment such as data-state interpretation, analysis-path heuristics, method-selection cautions, and controlled executor-skill lookup hints.
- Keep `context/resources.md` as the default readable project context file instead of creating a new `memory/` subsystem.
- Expand the `resources.md` scaffold so it clearly holds both project facts and stable analyst preferences in separate readable sections.
- Align `qdd-start` defaults, prompts, and tests with the updated `resources.md` structure.
- Keep the resulting slice lightweight and directly compatible with the current bootstrap/runtime design.

### Out Of Scope

- Introducing a new `memory/` directory, automatic self-evolving memory writer, or task-by-task memory log in this slice.
- Changing QDD workflow ownership across `qdd-start`, `qdd-propose`, `qdd-explore`, `qdd-apply`, or `qdd-close`.
- Redesigning executor skill metadata, runtime search semantics, or the current `qdd skills suggest` CLI surface.
- Defining every future domain brain skill here; this slice only tightens the first single-cell planning brain.
- Replacing `context/resources.md` with a database, YAML schema, or multilayer memory system.

## Evidence Standard

This change is successful when:

- the brain skill reads as domain prior and tool-usage guidance rather than a shadow copy of QDD workflow semantics,
- `qdd-propose` and `qdd-explore` remain the clear owners of study/task planning semantics,
- `context/resources.md` stays the single default readable context entrypoint,
- the resources scaffold cleanly separates project facts from durable analyst preferences,
- `qdd-start` can still populate the file directly without inventing a new subsystem,
- and the updated scaffold remains light enough that later domain skills can simply read `context/resources.md` rather than depending on a second memory truth source.

## Shared Context

- The repository already uses `context/resources.md` as the required human-readable project context file, and runtime prompts, inspection, and tests already depend on that path.
- The current default scaffold includes sections such as `Research Theme`, `Biological Background`, `Runtime Environments`, `Data Resources`, and `Local Skills`.
- The user wants one place to keep stable preferences and long-lived domain bias, but does not want a heavy memory architecture that duplicates project facts or workflow state.
- The current `brain/study-planning-core` draft still mixes domain heuristics with statements about task graph shaping and propose/explore behavior, which risks overlapping with QDD workflow prompts.
- The desired direction is: QDD owns workflow semantics; brain skills inject domain priors and skill-usage guidance; `resources.md` carries project facts plus compact stable preferences.
