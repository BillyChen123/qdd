## 1. Central Domain Skill Source

- [x] 1.1 Define QDD root `domain-skills/` as the canonical source for domain skills
- [x] 1.2 Stop projecting domain skills into project-local `.codex/skills/` and `.claude/skills/`
- [x] 1.3 Keep local tool bootstrap surfaces limited to QDD workflow assets under `qdd/`
- [x] 1.4 Resolve task domain skill IDs against the QDD root library and surface missing central skills as blockers

## 2. Code Artifact Promotion Hardening

- [x] 2.1 Tighten `qdd-apply` instructions and prompts so substantive final scripts are preserved under `studies/STUDY-XXX/output/code/`
- [x] 2.2 Default the main substantive analysis script into `artifact-candidates.yaml` as `type: code` unless it is directly registered
- [x] 2.3 Keep `code` candidate paths study-local and preserve `task_id` provenance
- [x] 2.4 Update `qdd-close` and promotion flow so explicit `code` candidates are promoted into `artifacts/code/`

## 3. Verification

- [x] 3.1 Update tests or smoke coverage so fresh projects no longer expect local domain skill mirrors
- [x] 3.2 Verify instructions and runtime resolve central domain skill paths correctly from the QDD root library
- [x] 3.3 Verify a substantive executed script can move from `output/code/` to `artifact-candidates.yaml` and then to `artifacts/code/`
- [x] 3.4 Refresh docs or prototype mapping where the skill-source or code-promotion contract changed
