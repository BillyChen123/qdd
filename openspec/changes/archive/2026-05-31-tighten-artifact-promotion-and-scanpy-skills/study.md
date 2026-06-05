## Question

How should QDD represent one bounded single-cell study so that shared data entrypoints, canonical promoted outputs, layer-owned role defaults, and scanpy-grounded execution guidance all support a more professional first-pass analysis loop?

## Hypothesis / Expectation

If QDD moves shared data under `artifacts/data/`, promotes reusable outputs into canonical artifact locations, exposes workflow-role skill defaults through instructions, and seeds concrete scanpy and plotting skills, then one study can be proposed and executed with less ad hoc drift, better evidence retention, and more defensible method choices.

## Inputs

- Current path constants and init scaffold in `src/runtime/constants.ts`, `src/commands/init.ts`, and `src/runtime/defaults.ts`
- Current artifact registration and closure-time promotion flow in `src/runtime/lifecycle.ts` and `src/runtime/evidence.ts`
- Current instructions output in `src/runtime/instructions.ts`
- Current local-skill discovery and validation in `src/runtime/local-skills.ts`
- Existing domain skill tree in `domain-skills/`
- Existing workflow prompts under `src/runtime/bootstrap-prompts/`
- Official and primary single-cell references expected to inform skill content:
  - Scanpy docs and tutorials
  - AnnData docs
  - single-cell best practices
  - related scverse plotting and analysis references as needed

## Evidence Plan

- A revised filesystem contract and default docs that no longer present root `data/` as the project entrypoint surface.
- A layer-aware role-policy contract that explains how required and optional skills reach instructions and prompts.
- A canonical promotion rule that moves reusable files into `artifacts/{data,code,figures,reports}/`.
- A clear statement for how study-local auditability survives after promotion.
- A first wave of concrete single-cell domain skills with enough method detail to influence real execution choices.
- Tests or smoke coverage that prove canonical data placement, promotion behavior, workflow skill exposure, and domain skill projection.

## Blockers

- Flat `artifacts/data/` increases the chance of naming collisions, so canonical naming rules must be explicit.
- Workflow-aware skill resolution is hard to represent cleanly if prompts keep calling `qdd instructions` without a workflow hint.
- Domain skills must stay concrete enough to change behavior without becoming a full textbook embedded in prompts.
- Promotion behavior must avoid breaking human-readable study output trails after files move.

## Exit Signal

This study is ready to close when the implementation path is clear enough to:

- migrate shared data entrypoints to `artifacts/data/`,
- canonically promote reusable outputs into artifact directories,
- load required and optional skills by layer role and command context,
- and provide enough scanpy and plotting guidance that a normal scRNA task defaults to credible methods such as neighbors plus Leiden rather than arbitrary clustering shortcuts.
