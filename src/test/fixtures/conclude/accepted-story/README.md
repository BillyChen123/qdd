# Accepted Story Rendering Fixture

This fixture represents a complete `story.md` that has already passed Gate 2.
It exists only for deterministic downstream rendering tests; it must not be fed
back through synthesis, story writing, Gate 1, Gate 2, or semantic review.

The story deliberately covers figures, a GFM table, cross-references, verified
citation anchors, TeX special characters, inline math, scientific symbols, and
inline code. Its P3 PPM figure points to the existing versioned conclude fixture
and is converted losslessly to PNG for TeX compatibility.
