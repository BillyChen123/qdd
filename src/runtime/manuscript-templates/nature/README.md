# QDD Conclude Nature Template

This is the default manuscript package for QDD Conclude. It is based on the
Springer Nature LaTeX authoring template, version 3.1 (December 2024), supplied
in `.ref/Nature_Template.zip`.

Upstream receipt:

- archive SHA-256: `ae54c13df5520804227e6032277e03c4bca7cd9bdcfd44ea8ad4e5dc58f49fcc`
- supplied class: `sn-jnl.cls`
- supplied bibliography style: `bst/sn-nature.bst`, identified internally as
  version 1.1 dated 2024-07-19
- upstream repository and commit: not stated in the supplied archive

The QDD-specific `main.tex` intentionally removes the sample article, author
and affiliation block, declarations, appendices, algorithms, theorem examples,
and other optional sections. Its manuscript body is limited to:

- Abstract
- Introduction
- Results
- Discussion
- Methods

The bibliography follows Methods. All figure and table environments follow the
bibliography without introducing additional manuscript sections, while their
callouts remain in the manuscript body. The document uses the `sn-nature` class
option and the matching `bst/sn-nature.bst` style.

The template is a drafting scaffold, not valid final content. A completed
conclude run must fill the title, abstract, keywords, all body sections,
bibliography, figure captions, and table captions; remove all unresolved
citation or drafting placeholders; and omit the author block when no verified
author metadata was supplied.

`sn-jnl.cls` and `bst/sn-nature.bst` retain their upstream notices and LPPL
redistribution terms. The original upstream archive is retained unchanged for
provenance.

QDD modifications are limited to the new `main.tex`, `references.bib`,
`latexmkrc`, and this README. The extracted class and bibliography style are
byte-for-byte copies from the supplied archive.
