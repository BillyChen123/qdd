## Question Before

The current QDD CLI can drive one manual research loop, but project inspection is still file-oriented and there is no stable validation command guarding malformed state.

## Question After

QDD should add a thin validation and inspection layer around the current lifecycle so humans and agents can check project integrity, inspect artifacts, and inspect project context without changing the workflow itself.

## Change Type

refinement

## Change Driver

The main risk in the current prototype is not missing lifecycle commands anymore; it is operational friction and brittle manual inspection. The next slice should therefore harden and expose the existing state rather than add a new planning layer.

## Open Boundaries

- How deep validation should eventually go beyond required fields and basic state consistency
- Whether `qdd context` should eventually support richer filtering than file-based inspection
- Whether `qdd close-task` will later reduce the need for some validation checks around task state

## Evidence Summary

This change focuses the next slice on three commands that improve safety and observability without changing the research object model: `validate`, `artifacts list`, and `context`.

## Recommended Next Step

Implement the three commands as thin runtime layers, then dogfood one real study before moving on to agent bootstrap or higher-level assist-mode planning.
