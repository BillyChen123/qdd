suppressPackageStartupMessages({
  library(ggplot2)
})

theme_publication <- function(base_size = 12) {
  theme_bw(base_size = base_size) +
    theme(
      panel.grid.major = element_blank(),
      panel.grid.minor = element_blank(),
      panel.border = element_rect(color = "black", linewidth = 0.5),
      axis.text = element_text(color = "black"),
      axis.ticks = element_line(color = "black"),
      legend.key = element_blank()
    )
}

if (interactive()) {
  message("Load a tidy data.frame and add a ggplot layer stack with theme_publication().")
}
