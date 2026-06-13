## Task Goal

Make QDD auto mode continue from a closed `dissolution` study when the thesis-manager has left executable next candidates or open boundaries, while preserving terminal behavior for genuinely exhausted frontiers.

## Study Link

Supports `study.md`: the bounded question is whether `dissolution` should mean local hypothesis rejection rather than automatic project termination when continuation signals exist.

## Method

Implement the smallest code and prompt changes:

1. Update runtime termination logic in `src/runtime/orchestrator.ts`.
   - Remove the rule that treats `dissolution + continuation signals` as terminal by default.
   - Keep `dissolution + no next candidate + no open boundary` terminal.
   - Preserve operational stops: invalid state, phase incomplete, missing auth, agent failure, max iterations.
   - Keep lifecycle routing before terminal checks.

2. Update `domain-skills/thesis/frontier-planning/SKILL.md`.
   - Clarify that `dissolution` may mean the current study question collapsed, not the whole project.
   - Require any continuation after dissolution to move away from the dissolved premise.
   - Prefer `validation`, `robustness`, or `pivot` after data inadequacy or negative results.
   - State that `needs-human` is not required for ordinary negative results with clear next candidates.

3. Update `src/runtime/bootstrap-prompts/qdd-close.md`.
   - Teach close to distinguish local-hypothesis dissolution from project-frontier termination.
   - If the project should stop, leave no executable candidates.
   - If the project should continue after dissolution, preserve only candidates that validate, robustify, pivot, or search for better data.

4. Update `src/runtime/bootstrap-prompts/qdd-propose.md`.
   - When previous `last_kind` is `dissolution`, do not repeat the rejected premise.
   - Prefer existing recorded datasets and artifacts before broad new public-data search.
   - If a candidate names a validation dataset, first plan metadata/label fit verification before full downstream analysis.

5. Add or update tests in `src/test/smoke.test.ts`.
   - `dissolution + next_candidates` routes to propose.
   - `dissolution + open_boundary_ids` routes to propose.
   - `dissolution + no continuation` remains terminal.
   - Existing confirmation/refinement continuation tests remain valid.
   - Update any previous test that expected contradictory dissolution continuation to safe-stop.

6. Rebuild generated `dist/` if this repository tracks it.

## Expected Outputs

- Runtime behavior change in `src/runtime/orchestrator.ts`.
- Prompt/skill updates:
  - `domain-skills/thesis/frontier-planning/SKILL.md`
  - `src/runtime/bootstrap-prompts/qdd-close.md`
  - `src/runtime/bootstrap-prompts/qdd-propose.md`
- Tests in `src/test/smoke.test.ts`.
- Rebuilt `dist/**` if required by the repo workflow.
- No new managed project file schema.
- No new CLI command.

## Run Contract

Implementation must record:

- The exact continuation rule before and after.
- Which tests were added or updated.
- Whether generated `dist/` was rebuilt.
- Verification commands:

```bash
npm run build
npm test
git diff --check
```

UC dry-run verification should be run when possible:

```bash
cd /data/chenyz/project/panrank_tmp/project/case/uc_anti_tnf_mucosal_healing
node /data/chenyz/project/qdd/dist/cli/index.js auto --dry-run --max-iterations 1 --json
```

Expected dry-run outcome:

- first phase is `propose`
- target is `STUDY-005`
- command is `qdd-propose`

## Failure / Blocker Conditions

- Auto still stops solely because `last_kind=dissolution` despite non-empty next candidates.
- Auto continues when no next candidate and no open boundary remain.
- Prompt changes imply agents should continue digging into a rejected premise.
- Runtime starts parsing rich scientific strategy text as a heavy schema.
- The change introduces a new managed YAML decision file.
- Tests pass only by weakening invalid-state or phase-completion gates.
