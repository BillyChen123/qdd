## Question

How should the current read-only QDD prototype be extended so a user and an agent can create, progress, and close one bounded study using the existing simplified filesystem layout?

## Hypothesis / Expectation

If QDD adds a small write-oriented command set around the current `contract/evolution/context/studies/artifacts/.qdd` layout, then one human-mode research loop becomes executable without pulling agent bootstrap, plugin loading, or a second control-plane layout into the core runtime.

## Inputs

- Existing root CLI commands: `qdd init`, `qdd status --json`, `qdd instructions <id> --json`
- Current runtime modules under `src/runtime/`
- Current type contracts in `src/types.ts`
- Product guidance in `docs/00-product-requirements-document.md`
- Filesystem prototype in `docs/01-development-prototype.md`
- Live code map in `docs/02-code-prototype-map.md`
- Agreement that `docs/01-development-prototype.md` should drive study/task template design more strongly than the current prototype code does

## Evidence Plan

- Define the next stable command surface for QDD lifecycle writes: `add-study`, `add-task`, `register-artifact`, and `close-study`.
- Define the minimum metadata needed for study/task/artifact/closure state transitions without introducing `close-task`.
- Encode the `study.md` and `TASK-XXX.md` body sections from `docs/01-development-prototype.md` as the generated scaffold shape.
- Keep `status` and `instructions` aligned with the write model.
- Add smoke-test coverage for one end-to-end project -> study -> task -> artifact -> closure flow.

## Blockers

- The current codebase has no write helpers yet for Markdown frontmatter mutation.
- The repo still needs a clear rule that frontmatter stays machine-authoritative while Markdown body sections stay human-readable and prototype-aligned.
- Non-interactive flag design for closure and artifact registration still needs to stay simple enough for agent use.

## Exit Signal

This study is complete when the command set, metadata contract, and testable success path are specific enough that implementation can proceed without reopening the project layout question.
