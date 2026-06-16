## Filesystem Contract

This change reuses the existing QDD filesystem layout:

- `evolution.yaml` remains the sparse project evolution ledger.
- `context/memory/STUDY-XXX.md` remains the narrative memory for richer reasoning.
- `domain-skills/thesis/frontier-planning/SKILL.md` remains the thesis-manager project-frontier guidance.
- `src/runtime/bootstrap-prompts/qdd-close.md` remains the close-time system prompt.
- `src/runtime/orchestrator.ts` remains the auto-mode phase selector and operational gate.

No new required project-level file is introduced.

Open boundaries remain valid project memory. They can represent unresolved science, limitations, future directions, or deferred modality requirements. They should not by themselves force auto mode to continue.

## Identifiers And Metadata

Keep existing identifiers:

- `STUDY-XXX`
- `TASK-XXX`
- `BXXX`
- `ART-XXX`

Keep existing study close event shape in `evolution.yaml`:

- `id`
- `question`
- `kind`
- `resolves`
- `opens`
- `candidates`
- `ts`

The intended semantic adjustment is:

- `candidates` means executable next studies for auto-mode continuation.
- `opens` means unresolved boundaries to carry forward, not necessarily executable next studies.
- A project may terminate or become synthesis-ready with open boundaries if the thesis-manager chooses not to emit executable candidates.

## Status JSON

`qdd status --json` can keep the current `question_state` structure:

- `last_kind`
- `next_candidates`
- `open_boundary_ids`

The runtime interpretation should change:

- `next_candidates.length > 0` means auto mode has a thesis-manager-approved executable continuation.
- `open_boundary_ids.length > 0` alone does not mean auto mode should continue.

This keeps the interface stable while fixing the current over-continuation behavior.

## Instructions JSON

Instructions should continue to expose role-specific guidance through the existing commands:

- `qdd instructions PROJECT --command qdd-start --json`
- `qdd instructions STUDY-XXX --command qdd-close --json`

The thesis-manager instructions should teach the model to reason about a lightweight project lifecycle:

- exploration: find data anchors and stable signals.
- main evidence: a central result exists but needs validation or boundary clarification.
- story enrichment: the central model is locked; next studies should enrich the story through validation, robustness, mechanism triage, functional consequence, or negative controls.
- synthesis-ready: additional candidates are unlikely to substantially change or enrich the central model within available data/resources.
- closed: no more auto studies should be proposed.

This lifecycle is prompt-only guidance. It is not a new machine status field.

## Agent Usage Rules

The thesis-manager should decide whether to emit executable `next_candidates`.

Rules for close-time thesis judgment:

- Do not stop immediately after the first central result appears.
- After a central result appears, prefer at least one story-enrichment pass when available data/resources can support it.
- Once the central model is supported, enriched, and bounded by negative evidence, allow remaining unresolved boundaries to become limitations or future directions instead of auto studies.
- Only write `next_candidates` for studies that can substantially validate, enrich, stress-test, or redirect the central model.
- Do not write `next_candidates` merely because a question is scientifically interesting.
- If a remaining question requires a new modality, unavailable dataset, or experiment outside current resources, usually preserve it in memory as a future direction rather than forcing auto continuation.

Runtime should keep enforcing operational safety:

- invalid managed state stops auto mode.
- active studies with pending or running tasks continue to apply.
- completed or blocked studies go to close.
- missing auth, agent failure, explicit iteration caps, and phase incompletion still stop.

Runtime should not override thesis-manager scientific judgment by treating open boundaries alone as continuation.
