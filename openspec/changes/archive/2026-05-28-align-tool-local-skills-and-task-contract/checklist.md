## 1. Bootstrap Skill Surface

- [x] 1.1 Remove `.agents/skills/` from path constants, bootstrap output, and generated instructions
- [x] 1.2 Write QDD workflow skills under `.codex/skills/qdd/` and `.claude/skills/qdd/`
- [x] 1.3 Define the categorized local skill ID scheme as `<category>/<skill-name>`

## 2. Runtime Skill Discovery And Validation

- [x] 2.1 Rewrite local skill discovery to scan `.codex/skills/` recursively and return categorized IDs
- [x] 2.2 Update instructions and validation flows to treat missing `.codex/skills` task references as blockers
- [x] 2.3 Make `qdd-apply` hard-block on missing declared task skills instead of continuing
- [x] 2.4 Refresh inspection output so project skill health no longer references `.agents/skills/`

## 3. Task Skill Contract

- [x] 3.1 Normalize task skill IDs before writing task frontmatter `skills:`
- [x] 3.2 Keep task body `## Skills` generated from the exact same normalized array
- [x] 3.3 Prevent QDD-generated task docs from naming skills that do not exist under `.codex/skills/`
- [x] 3.4 Treat `skills:` as optional, but reject non-empty lists that contain missing skills
- [x] 3.5 Keep workflow skills under `qdd/*` out of task skill lists and reserve task `skills:` for domain dependencies

## 4. Domain Skill Integration And Projection

- [x] 4.1 Support categorized domain skill folders such as `plot/`, `genomics/`, and `env/`
- [x] 4.2 Keep mirrored `.claude/skills/` paths aligned with the `.codex/skills/` relative IDs during bootstrap refresh
- [x] 4.3 Update workflow prompts so propose/explore may write task skills, but apply only consumes them
- [x] 4.4 Update workflow prompts so they only suggest skill IDs present in the categorized local inventory

## 5. Verification

- [x] 5.1 Refresh smoke tests and fixtures for init/start/instructions/validate with the new categorized skill paths
- [x] 5.2 Update docs and prototype maps to show no `.agents/skills/` layer
- [x] 5.3 Verify a fresh scaffold and a sample task both use only installed categorized local skills
