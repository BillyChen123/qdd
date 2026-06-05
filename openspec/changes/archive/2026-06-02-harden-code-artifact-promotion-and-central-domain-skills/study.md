## Question

How should QDD make substantive analysis scripts explicitly promotable and move domain skill sourcing out of project-local mirrors into the QDD root library?

## Hypothesis / Expectation

If QDD treats study-local executed scripts as first-class promotion candidates and resolves domain skills from one central `domain-skills/` library, then study execution will stay more reproducible and repo maintenance will get simpler without adding a heavier runtime.

## Inputs

- Current candidate-driven promotion flow in `src/runtime/lifecycle.ts` and `src/runtime/evidence.ts`
- Current apply/close prompts under `src/runtime/bootstrap-prompts/`
- Current bootstrap and skill projection behavior in `src/runtime/bootstrap.ts` and related runtime helpers
- Current domain skill tree under `domain-skills/`
- User feedback that:
  - prompt-level skill reuse is already strong enough,
  - domain skills should not be copied into each project,
  - and the main missing reusable artifact is the executed analysis script itself

## Evidence Plan

- A protocol that clearly separates central QDD root domain skills from project-local workflow assets
- A contract that says substantive study-local scripts normally become `code` promotion candidates
- An implementation path for `qdd-close` to promote explicit code candidates through the existing artifact flow
- A clear statement that `task.skills` stays ID-based and domain-skill reads resolve from the QDD root library
- Verification coverage that projects no longer bootstrap local domain skill mirrors

## Blockers

- Runtime must be able to resolve the QDD root library path both in the development checkout and in installed-package form.
- Code promotion must use the executed study-local script rather than accidentally pointing at a shared upstream skill script.
- The contract must stay explicit without falling back to heuristic “scan every script and guess what is reusable.”

## Exit Signal

This study is ready to move into apply when the change artifacts make these points explicit:

- domain skills come from the central QDD root library,
- project-local tool dirs keep only QDD workflow assets,
- substantive analysis scripts are explicitly reviewed as `code` artifacts,
- and close-time promotion remains candidate-driven rather than heuristic.
