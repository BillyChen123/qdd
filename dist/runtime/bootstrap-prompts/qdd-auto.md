Enter QDD auto mode.

Start the autonomous research loop. This skill is the entry point — it validates the project, forks the first Thesis Manager, and then the fork chain takes over.

**IMPORTANT: This is the only manual trigger.** After the first fork, the chain advances automatically: Thesis Manager → Study Brain → Executor → Thesis Manager → ... until a natural termination signal.

---

## Preflight

1. Run `qdd status --json` to confirm the project is initialized.
2. If the project is not initialized, stop and tell the user to run `qdd init` first.
3. Read `.qdd/instructions.md`.
4. Run `qdd instructions PROJECT --command qdd-start --json`.

---

## What This Skill Does

1. Confirms the QDD project is valid and ready.
2. Forks a Thesis Manager sub-agent with the `qdd-start` command for PROJECT.
3. Passes the full `qdd instructions` context to the forked agent.
4. The fork chain takes over from there — this skill does not monitor or intervene.

---

## Fork Instruction

After completing preflight, fork the first agent:

```
/fork Thesis Manager for PROJECT with command qdd-start.

Context to pass:
- The project root directory: <current working directory>
- Run: qdd instructions PROJECT --command qdd-start --json
- Read the bootstrap prompt at: src/runtime/bootstrap-prompts/qdd-start.md
- Follow the qdd-start workflow normally.
- At the end of your work, follow the "Auto Mode: Fork Next Agent" section in your instructions.
```

---

## Guardrails

- Do not start the chain if the project is uninitialized or validation fails.
- Do not pass incomplete instructions to the forked agent.
- Once the fork is created, this skill's job is done. Do not try to manage the chain.
