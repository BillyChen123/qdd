## Task Goal

Define and implement the first write-oriented QDD lifecycle commands in the root TypeScript CLI.

## Study Link

This task supports the study of moving QDD from a read-only bootstrap prototype to a usable human-mode research loop.

## Method

- Extend `src/cli/index.ts` with the new command surface.
- Add focused command handlers under `src/commands/`.
- Reuse the current runtime/store utilities instead of introducing a second persistence layer.
- Keep study and task truth sources in Markdown frontmatter, and keep project/artifact/evolution truth sources in YAML.
- Add only the minimum metadata needed to close studies cleanly.
- Treat task progression during execution as direct agent edits to the generated Markdown protocol rather than as a separate CLI close command.

## Expected Outputs

- `qdd add-study`
- `qdd add-task STUDY-XXX`
- `qdd register-artifact <path>`
- `qdd close-study STUDY-XXX`
- study/task Markdown templates aligned with `docs/01-development-prototype.md`
- updated default `.qdd/instructions.md` structure aligned with the single-file prototype guidance
- updated status/instructions aggregation where required
- smoke tests for the new lifecycle flow
- light documentation updates reflecting the new implemented surface

## Run Contract

Each implementation attempt should:

- create a temporary QDD project with `qdd init`
- exercise the new commands against real generated files
- verify generated IDs, frontmatter fields, and artifact provenance
- verify that study/task bodies match the headings defined in `docs/01-development-prototype.md`
- verify that task progression can be represented by direct Markdown edits without a dedicated `close-task` command
- confirm that open-ended `context/` scanning still works unchanged
- avoid adding mandatory root directories beyond the current simplified layout

## Failure / Blocker Conditions

- If study closure requires a separate runtime `closure.md` file to remain coherent, stop and decide that before implementation.
- If the command surface starts depending on interactive AI prompting, the slice has drifted beyond its intended scope.
