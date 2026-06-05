## Question Before

How should QDD stop closure from looking unstable when apply-time execution leaves reusable outputs unreviewed, output trees unpackaged, and long-running analysis work treated too impatiently?

## Question After

How should QDD treat apply as the owner of candidate review, final study-output packaging, and first-pass long-task patience, so closure can remain explicit, lightweight, and candidate-driven?

## Change Type

refinement

## Change Driver

Recent HGSOC benchmark execution made three distinct gaps visible:

- reusable outputs were produced, but apply never converted them into explicit candidate state
- task and skill outputs remained spread across local folders instead of one final study-level packaging surface
- heavy analysis work such as clustering and UMAP was treated too quickly as suspicious rather than as normal long-running execution

These are not three separate products; they are one apply-time contract gap.

## Open Boundaries

- The exact task-level field name and whether it belongs in frontmatter or runtime-derived state still needs implementation choice.
- The first patience fix should stay prompt-first, but future cases may still justify a helper command or logging utility later.
- Downstream domain skills are still out of scope here, so the packaging contract must be generic enough to survive future executor growth.

## Evidence Summary

- Candidate-driven promotion already exists in runtime, but apply does not yet force candidate review strongly enough.
- Canonical study output directories already exist, but there is no requirement that final materials be packaged back into them before task completion or closure.
- Apply prompts currently encourage continuity, but they do not define a clear waiting protocol for slow-but-normal analysis steps.

## Recommended Next Step

Apply this slice by:

- adding minimal task promotion-review state,
- defining canonical study output packaging plus scratch space,
- and strengthening apply/close prompt rules around promotion review, packaging, and long-task patience.
