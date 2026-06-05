## 1. Runtime Semantics

- [x] 1.1 Make close-time current-question derivation use project current-question state instead of the study-local bounded question
- [x] 1.2 Make `closeStudy()` automatically apply study-local boundary updates before writing `question_delta`
- [x] 1.3 Keep close-time failure atomic enough that invalid boundary updates stop closure before evolution is appended

## 2. Prompt And Instruction Tightening

- [x] 2.1 Tighten propose prompt around `current question -> current frontier -> score -> current study`
- [x] 2.2 Tighten explore prompt around the same model and require explicit score reporting
- [x] 2.3 Tighten close prompt so reasoning order and persistence order are both explicit
- [x] 2.4 Update generated instructions / defaults so the same semantics survive bootstrap

## 3. Verification

- [x] 3.1 Add smoke coverage for close-time automatic boundary application
- [x] 3.2 Add smoke coverage for `question_before` using project current-question state
- [x] 3.3 Update smoke expectations for score visibility and boundary/evolution wording
