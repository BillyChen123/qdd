## 1. Project State Model

- [x] 1.1 Redefine QDD evolution types/defaults/validation around a thin `studies + boundaries` `evolution.yaml`
- [x] 1.2 Remove `boundaries.yaml` and study-local `boundary-updates.yaml` from the required governance path
- [x] 1.3 Define the derived `research-map.html` surface from `evolution.yaml` alone

## 2. Close-Time Memory Loop

- [x] 2.1 Add `context/memory/STUDY-XXX.md` writing to `qdd-close`
- [x] 2.2 Make `qdd-close` update simplified evolution state, project memory, and derived visualization in one coherent write path
- [x] 2.3 Keep `context/resources.md` as stable shared context rather than turning it into a running log

## 3. Prompt And Instruction Simplification

- [x] 3.1 Rewrite propose/explore/close prompts to read `contract.yaml`, `context/resources.md`, `evolution.yaml`, and recent `context/memory/*.md`
- [x] 3.2 Remove score-driven boundary-planning requirements from generated instructions and defaults
- [x] 3.3 Keep human propose as the highest semantic authority; treat study `candidates` only as suggestions

## 4. Validation

- [x] 4.1 Update smoke coverage for `qdd init`, `qdd status`, `qdd instructions`, and `qdd close-study` under the new state model
- [x] 4.2 Add smoke coverage for memory creation and `research-map.html` rendering
- [x] 4.3 Update docs and prototype-map references that still describe `boundaries.yaml` as a required truth source
