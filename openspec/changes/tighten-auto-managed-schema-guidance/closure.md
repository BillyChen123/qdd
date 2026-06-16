## Question Before

Auto mode can execute scientific work successfully, but stale hand-written managed metadata can still stop the run after the evidence is produced.

## Question After

Auto mode should keep the lightweight hand-written metadata workflow, but managed-schema drift must be prevented by explicit current templates and diagnosed as schema drift when it happens.

## Change Type

refinement

## Change Driver

The Parkinson auto run wrote `artifact-candidates.yaml` with old top-level `candidates:` and wrote `status: judgeable`. Current runtime contracts reject both, but the terminal error collapsed the first failure into a misleading candidate path error.

## Open Boundaries

- Whether a future heavier structured API is needed if prompt/schema hardening does not reduce managed-file drift enough.
- Whether auto should run a cheap validate/check immediately after managed-file writes, rather than only at phase boundaries.

## Evidence Summary

Current contracts already define the desired schemas. The gap is at the interface between agent instructions and runtime diagnostics: agents are not shown the exact current candidate template at the moment of writing, and stale manifest shape is not surfaced with a precise message.

## Recommended Next Step

Implement the minimal hardening slice: current schema template in apply instructions, explicit `judgeable` prohibition for machine status, precise stale-manifest diagnostics, and regression tests.
