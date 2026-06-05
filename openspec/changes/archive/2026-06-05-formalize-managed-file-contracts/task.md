## Task Goal

Extract QDD's managed file definitions into an explicit contract layer and make those contracts visible inside every initialized project.

## Study Link

This task executes the bounded study in `study.md`: clarify the managed-file surface without broadening QDD's workflow or adding a heavy runtime subsystem.

## Method

Implement the slice in one coordinated pass:

- inventory the managed file families QDD already owns
- extract their schema/template/example logic into explicit source modules
- make `qdd start` emit project-local schema references and examples
- retarget validators, template builders, and instructions so they read from the same contract layer
- tighten Markdown skill-section parsing so human-readable descriptions are allowed without breaking machine truth

## Expected Outputs

- source modules for managed file contracts
- generated `.qdd/schema-reference.md`
- generated `.qdd/examples/*`
- updated scaffold/init behavior
- updated validation and template-building behavior
- tests covering the generated references and normalized skill-section rules

## Run Contract

Each implementation run should record:

- which managed file families were extracted into explicit contracts
- which existing runtime writers/validators were rewired to consume those contracts
- one concrete example of the generated `.qdd/schema-reference.md`
- one concrete example of at least two emitted example files
- verification that a valid example passes validation and an invalid shape fails for the documented reason

## Failure / Blocker Conditions

- File contracts remain split across multiple hidden runtime implementations after the change
- `.qdd/schema-reference.md` or `.qdd/examples/*` become stale copies rather than generated reflections of the real contracts
- The change widens into runtime orchestration refactors that belong to a later proposal
- The task `## Skills` body rules remain ambiguous after the change
