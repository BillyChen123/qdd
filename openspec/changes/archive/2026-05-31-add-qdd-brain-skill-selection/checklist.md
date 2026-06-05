## 1. Skill Surfaces

- [x] 1.1 Define the protocol distinction between study-brain skills and executor problem-level skills.
- [x] 1.2 Decide which local skill directories or categories are indexed into the problem-skill catalog and which are planning-only.
- [x] 1.3 Define the rule that indexed executor skills are problem-level skills that may aggregate multiple internal methods.

## 2. Tool Metadata

- [x] 2.1 Define the minimal problem-skill metadata contract: `id`, `domain`, `stage`, `tags`.
- [x] 2.2 Define the first controlled vocabularies for `domain`, `stage`, and allowed tag families.
- [x] 2.3 Add validation so malformed or uncontrolled problem-skill metadata is rejected early.

## 3. Catalog And Suggestion CLI

- [x] 3.1 Generate or refresh `.qdd/skills-catalog.json` from local problem-level skills.
- [x] 3.2 Add `qdd skills suggest` with bounded filters such as `--domain`, `--stage`, and repeated `--tag`.
- [x] 3.3 Implement deterministic candidate ranking based on hard filtering, tag overlap, and stable tie-breaks.
- [x] 3.4 Return top candidates plus simple reasons and explicit low-confidence behavior at the problem-skill level rather than at the primitive method level.

## 4. Planning And Execution Flow

- [x] 4.1 Update study-planning prompts and instructions so propose/explore read study-brain skills and call the bounded suggestion surface.
- [x] 4.2 Allow one task to persist a small set of chosen problem-level skills.
- [x] 4.3 Update apply-time instructions so executor consumes only the task-local problem-skill bundle and does not reopen broad skill search.

## 5. Verification

- [x] 5.1 Add tests or fixtures that lock skill-suggestion behavior for representative queries.
- [x] 5.2 Add documentation showing how this lightweight QDD flow differs from heavy full-platform routing.
- [x] 5.3 Verify the artifact set remains research-native and consistent with the QDD study/task contract.
