---
name: plot/plotting-ggplot
description: Use for publication-oriented static plotting with ggplot2. Covers when to switch from Python plotting to R, how to export tidy plotting tables, and figure QA expectations for scientific outputs. Use when a task explicitly needs higher-quality static figures.
---

# plotting-ggplot

Use this skill only when static figure quality matters enough to justify an R plotting step.

Core rules:

1. Keep the analysis backbone in Python unless there is a clear visual-quality reason to switch.
2. Export tidy tables from Python, then plot them in R with `ggplot2`.
3. Do not move the full analysis object into R unless the task explicitly requires an R-native stack.
4. Apply figure QA before finalizing:
   - readable labels
   - no clipped text
   - clear legends
   - vector export for line/scatter/bar style figures when possible

When to use:

1. publication-oriented static figures
2. multi-panel composition requiring tighter visual control
3. group comparison plots where `ggplot2` produces clearer defaults than quick Python plots

When not to use:

1. quick exploratory plots
2. tasks with no figure deliverable
3. cases where Python-native plotting is already sufficient

Read on demand:

1. `references/figure_qa.md`
2. `scripts/publication_plot.R`
