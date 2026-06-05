## Theme

Keep QDD project-state semantics sparse, readable, and research-native so agents and humans can both understand what changed across studies without reading a second governance system.

## Initial Question

How should QDD simplify `evolution.yaml`, `context/memory/`, and `research-map.html` so project history stays clear, study narratives stay useful, and close-time outputs stop feeling fragmented?

## Mode

`assist`

Human authority remains highest on research direction and semantic judgment. The system may structure project history and derived views, but it must not invent a second planning authority beyond the user's study proposal and the evidence produced by closed studies.

## Scope

### In Scope

- Simplify project-level evolution state into one sparse structured file
- Remove `question_before` / `question_after` from the evolution truth source
- Keep only the new compact study event fields:
  - `studies[].id`
  - `studies[].question`
  - `studies[].kind`
  - `studies[].resolves`
  - `studies[].opens`
  - `studies[].candidates`
  - `studies[].ts`
- Keep one lightweight `boundaries[]` collection inside `evolution.yaml`
- Make `context/memory/STUDY-XXX.md` the only default study narrative report surface
- Improve memory structure so it captures promoted artifacts, reused materials, used skills, ad hoc scripts, and next-study candidates
- Render `research-map.html` only from the new `evolution.yaml`
- Update CLI/runtime/prompt surfaces that still assume the older evolution-memory-report model

### Out Of Scope

- Redesigning the whole QDD project layout
- Reintroducing a separate `boundaries.yaml` or scoring-centered planning system
- Solving project-level auto-stop logic
- Adding a new hidden database or router for project memory
- Expanding study/task domain-skill logic beyond what this state-model cleanup requires

## Evidence Standard

This change is successful when:

- the structured project state is smaller and more stable than before,
- humans can inspect one memory file per closed study and understand what happened,
- `research-map.html` correctly reflects the new evolution structure,
- and the runtime no longer depends on the removed fields or stale report assumptions.

## Shared Context

- Recent benchmark runs showed semantic friction around `evolution.yaml`, outdated HTML output, and poor memory organization
- Earlier boundary-governance work proved too heavy for the user's intended QDD workflow
- The managed-file contract layer already exists under `src/file-contracts/` and should be reused rather than bypassed
- The user wants QDD to stay markdown-friendly, lightweight, and readable first
