## 1. Onboarding Protocol

- [x] 1.1 Extend the filesystem contract with `data/` and `.agents/skills/`
- [x] 1.2 Add a project-level instructions target for onboarding work without introducing a separate project-manager command family
- [x] 1.3 Define the durable write boundary for `contract.yaml`, `context/resources.md`, optional sidecars, and dataset links

## 2. Bootstrap Surfaces And Skill Boundary

- [x] 2.1 Add `qdd-start` as a generated workflow surface alongside `qdd-propose`, `qdd-explore`, `qdd-apply`, and `qdd-close`
- [x] 2.2 Make `qdd init` install `.agents/skills/` as the repo-local skill truth and keep `.claude/` and `.codex/` as projections
- [x] 2.3 Restrict QDD-generated skill references to IDs that exist in the local skill registry

## 3. Resource Intake

- [x] 3.1 Extend the default scaffold and onboarding template so project theme, biological background, runtime environment, and datasets can be captured directly
- [x] 3.2 Add a minimal symlink-based dataset-linking flow under `data/`
- [x] 3.3 Record linked datasets and onboarding decisions in readable project context

## 4. Validation And Verification

- [x] 4.1 Validate placeholder onboarding state, broken dataset links, and missing local skills
- [x] 4.2 Refresh bootstrap tests for the new `qdd-start` surface and `.agents/skills/` installation
- [x] 4.3 Update docs or prototype mapping so the onboarding layer is understandable from the current repository
