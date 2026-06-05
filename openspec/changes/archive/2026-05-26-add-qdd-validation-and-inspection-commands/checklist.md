## 1. CLI Surface

- [x] 1.1 Add `qdd validate` to check control files, study/task frontmatter, artifact index integrity, and basic state consistency.
- [x] 1.2 Add `qdd artifacts list --json` to expose registered artifacts as a stable inspection surface.
- [x] 1.3 Add `qdd context` to expose project context files without requiring callers to know specific filenames in advance.

## 2. Runtime And Output Contracts

- [x] 2.1 Add runtime helpers for project validation without introducing a second truth source.
- [x] 2.2 Add runtime helpers for artifact listing derived directly from `artifacts/index.yaml`.
- [x] 2.3 Add runtime helpers for enumerating and reading `context/*.yaml` while keeping the directory open-ended.
- [x] 2.4 Define clear command outputs, including JSON outputs where machine consumption matters.
- [x] 2.5 Ensure the new commands do not mutate project state.

## 3. Validation And Docs

- [x] 3.1 Add tests covering valid projects, malformed YAML/frontmatter, and basic illegal state combinations.
- [x] 3.2 Add tests covering artifact inspection and context inspection behavior.
- [x] 3.3 Update [docs/02-code-prototype-map.md](/data/chenyz/project/qdd/docs/02-code-prototype-map.md) to reflect the new command surface and usage guidance.
- [x] 3.4 Verify that this slice remains non-core workflow support: guard/query commands rather than new state-advancing commands.
