## 1. Runtime

- [x] 1.1 `closeStudy()` applies `boundary-updates.yaml` automatically
- [x] 1.2 `closeStudy()` derives `question_before` from project current-question state
- [x] 1.3 invalid boundary updates block closure before `evolution.yaml` changes

## 2. Bootstrap Surfaces

- [x] 2.1 `qdd-propose` explicitly requires score output
- [x] 2.2 `qdd-explore` explicitly requires score output
- [x] 2.3 `qdd-close` explains reasoning order vs persistence order
- [x] 2.4 generated `.qdd/instructions.md` reflects the corrected semantics

## 3. Verification

- [x] 3.1 smoke tests cover automatic boundary application on close
- [x] 3.2 smoke tests cover current-question derivation for `question_before`
- [x] 3.3 smoke tests cover the updated prompt wording
