## 1. Managed File Contracts

- [x] 1.1 Tighten the `evolution.yaml` contract to keep only `studies[].id/question/kind/resolves/opens/candidates/ts` plus lightweight `boundaries[]`
- [x] 1.2 Remove `question_before` and `question_after` from the structured evolution contract, examples, and generated references
- [x] 1.3 Tighten the `context/memory/STUDY-XXX.md` contract so it captures promoted artifacts, reused resources/artifacts, used skills, ad hoc scripts, resolved/open boundaries, and 1-3 next candidates
- [x] 1.4 Make `context/memory/STUDY-XXX.md` the only default study narrative report contract

## 2. Runtime And Close-Time Semantics

- [x] 2.1 Update close-time runtime writes so `qdd-close` maintains the simplified `evolution.yaml`
- [x] 2.2 Update close-time runtime writes so `qdd-close` writes the new memory structure into `context/memory/STUDY-XXX.md`
- [x] 2.3 Remove default report duplication from close-time outputs and related runtime assumptions
- [x] 2.4 Update `qdd status --json` and `qdd instructions --json` to reflect the new evolution-memory model

## 3. Research Map Rendering

- [x] 3.1 Rework `research-map.html` generation so it renders only from the new `evolution.yaml`
- [x] 3.2 Ensure the rendered map reflects study nodes, boundary nodes, and current open/resolved state without relying on removed fields

## 4. Prompts, Validation, And Docs

- [x] 4.1 Update prompts and instructions that still mention old evolution/report semantics
- [x] 4.2 Update validation and smoke coverage for the simplified evolution-memory-report model
- [x] 4.3 Regenerate examples or schema-reference outputs so agents can see the new managed-file shapes clearly
- [x] 4.4 Update prototype-map or related docs if they still describe the removed report/evolution semantics
