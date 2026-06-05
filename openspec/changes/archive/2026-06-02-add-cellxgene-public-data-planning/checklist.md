## 1. Planning Contract

- [x] 1.1 Create `domain-skills/brain/singlecell/public-data-planning/SKILL.md`
- [x] 1.2 Encode hard triggers for when external public data search is required
- [x] 1.3 Encode the structured search fields and broadening ladder for CELLxGENE planning
- [x] 1.4 Encode `human` / `assist` / `auto` selection behavior without moving download into planning

## 2. Handoff And Executor

- [x] 2.1 Define `studies/STUDY-XXX/output/public_data_request.yaml` as the single persisted handoff file
- [x] 2.2 Create `singlecell/public-data/cellxgene-discover` with `SKILL.md`, `parameters.yaml`, and one runnable Python entry script
- [x] 2.3 Make the executor support bounded `search` and `download` actions from the same structured request contract
- [x] 2.4 Ensure downloaded files land on the normal reusable data surface and can be registered back into project resources

## 3. Runtime Integration

- [x] 3.1 Extend controlled skill metadata to support an acquisition stage and public-data tags
- [x] 3.2 Ensure local skill discovery and `.qdd/skills-catalog.json` include the new executor skill
- [x] 3.3 Update planning prompts and instructions so `qdd-propose` / `qdd-explore` can use the new brain skill and handoff file
- [x] 3.4 Keep `qdd-apply` bounded to consuming `selected` datasets rather than reopening broad public-data search

## 4. Validation

- [x] 4.1 Add or update tests for skill catalog discovery and `qdd skills suggest` retrieval of the new executor skill
- [x] 4.2 Validate that the handoff file stays thin, human-editable, and single-source
- [x] 4.3 Validate that `human`, `assist`, and `auto` mode semantics stay consistent across planning and apply
- [x] 4.4 Refresh prototype or contributor docs if they need to mention the new public-data branch
