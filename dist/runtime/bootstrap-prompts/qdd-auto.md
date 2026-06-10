Enter QDD auto mode.

Start the autonomous research loop through the QDD runtime orchestrator. This skill is a thin launcher: it validates that the project can be inspected, then runs `qdd auto` so the runtime can coordinate Claude SDK agent sessions.

**IMPORTANT: The runtime is the orchestrator.** Do not fork agents from this skill. Do not duplicate the phase graph here.

---

## Preflight

1. Run `qdd status --json` to confirm the project is initialized.
2. If the project is not initialized, stop and tell the user to run `qdd init` first.
3. Confirm the user has configured Claude SDK credentials through `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_API_KEY`, or `~/.claude/settings.json`.

---

## What This Skill Does

1. Confirms the QDD project is valid and ready.
2. Runs `qdd auto` from the project root.
3. Lets the runtime orchestrator choose phases, launch Claude SDK sessions, reread filesystem state, and stop with a terminal or resumable reason.

---

## Runtime Command

Use the CLI runtime:

```bash
qdd auto
```

For inspection without SDK calls:

```bash
qdd auto --dry-run
```

For machine-readable output:

```bash
qdd auto --json
```

---

## Guardrails

- Do not call `/fork`.
- Do not spawn agents manually.
- Do not encode phase transitions in this skill.
- If `qdd auto` reports a resumable failure, report the stop reason and current project state instead of trying to continue from chat context.
