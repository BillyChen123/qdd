## Why This Slice

Recent QDD benchmark runs exposed a protocol problem, not a directory-layout problem.

The current project tree is already close to the desired `panrank`-style shape, but the control surface became too heavy:

1. `evolution.yaml` is carrying both question history and too much closure narrative.
2. `boundaries.yaml` became a separate governance truth source, which made planning prompts circular and brittle.
3. humans and agents both need a readable per-study memory surface, but the current protocol has no first-class place to put it.

The user wants to keep QDD lightweight and readable:

- structured state should stay sparse,
- narrative study memory should be explicit,
- and the research map should be something people actually want to inspect.

## Scope

This slice should:

- simplify `evolution.yaml` into a thin project history plus boundary map
- introduce `context/memory/STUDY-XXX.md` as the per-study narrative memory surface
- generate one derived visualization from `evolution.yaml` with both study nodes and boundary nodes
- make `qdd-close` the place that writes both structured evolution state and study memory
- retune prompts, instructions, validation, and status surfaces around the lighter model

This slice should not:

- redesign the whole project layout
- migrate `contract.yaml` to Markdown yet
- solve the project-level auto-stop gate yet
- keep the current boundary score system alive just for continuity
- add a hidden planner database or a heavier runtime controller

## Expected Outcome

After this slice:

- `contract.yaml` remains the stable top-level contract,
- `evolution.yaml` becomes the sparse structured map of study events and current boundaries,
- `context/memory/STUDY-XXX.md` becomes the human/agent-readable memory for each closed study,
- `research-map.html` becomes the main derived visualization of project evolution,
- and QDD planning can read project history without being forced through a separate boundary-governance subsystem.
