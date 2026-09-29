> Non-binding handover. It records where the work was heading when the session stopped; it sets no rules.

# Handover · 2026-09-29

## State

- Gen 1 (scene builder) is parked in `explorations/gen1-scene-builder/`, recorded in the exploration log
  as a dead end as a whole, with useful parts.
- Gen 2 (this Shape Lab) is at the repository root: browser-free core in `src/core`, Canvas renderer,
  interface with tools, inspector, layers, graph dock, swatches, throw-in starters. It opens empty.
- Two reference notes were written by background agents and not yet discussed with the user:
  `explorations/EVALUATION_2D_25D_3D.md` (current leaning: scenes as flat cards in 3D space, one
  document with shapes as assets, Shape Lab stays 2D) and `library/SHAPE_WORK_CONCEPTS.md`
  (six different ways to organise shape work).

## Where it was heading

- Hearing the user's reaction to gen 2's interface and feel before adding much more.
- Candidates that had come up: per-item paint (not only colour) from generators; a mask per group that
  can be a generator; effect parameters driven by fields (e.g. torn-edge strength from a noise field);
  a swatch used as a brush along a path; saving graph fragments as reusable nodes; a side-by-side
  variations view (same recipe, different seeds).
- Performance: effect-heavy layers redraw at about 50 ms a frame at 2× pixel density while dragging.
  Moving pixel effects to WebGL or workers is the obvious next step if it matters.
- The Scene Lab question (2.5D cards in a 3D space) waits on the user's evaluation.
