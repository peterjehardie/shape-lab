# Shape Lab (gen 2)

A browser tool for working abstractly with shapes: draw and edit vector shapes, give their edges
character, push them around with noise and distortion, texture them, combine them, grow many of them
from small node graphs, and bake results into reusable swatches. It opens on an empty artboard;
"Throw in" adds random, fully editable starting material.

This is exploration code (a proof of concept), not a committed build.

## Run

Any static file server from the repository root, for example:

```
npx http-server -p 8123 -c-1 .
```

then open http://localhost:8123. No build step; plain ES modules.

## What is in it

- **Tools**: select/transform (move, resize, rotate, snapping), point editing, rectangle, ellipse,
  polygon, star, blob, squircle, crescent, line, wave, spiral, pen, pencil, hand.
- **Edges and distortion (outline effects)**: torn edge, noise warp, wave, zigzag, jitter, facet,
  smooth, grow/shrink, twist, pinch/bloat, taper, bend.
- **Pixel effects**: noise texture, grain, halftone, value steps, colour adjust, dry edge, fade,
  pooled edge, displace, smear, blur, edge light, form shadow, cast shadow, glow, spatter.
- **Where effects act**: on a shape, on a group or layer (outline effects bend every shape inside,
  pixel effects act on the combined picture), or on the whole picture (document level).
- **Paints**: solid, linear, radial, noise (run through a colour ramp), patterns (lines, grid, dots,
  checker, cross-hatch, waves, bricks), and swatches as tiled fills. Colours are OKLCH.
- **Line quality**: even, tapered, swelling and brushy strokes (turned into outlines, so effects
  can roughen them too).
- **Combining and masking**: live union/subtract/intersect/exclude that keep their parts editable;
  any shape can mask its group (alpha, inverted, or by lightness), and a textured mask is just a
  mask with effects.
- **Generators**: a node graph of points (grid, scatter, ring, line, sunflower, along an outline,
  inside a shape), shapes, per-item values (random, read from a field, maths, colour by value),
  fields (noise, radial, linear, near shapes, field maths) and shape operations (copy to points,
  transform, outline effect, repeat, mirror, combine, merge, keep some). Any node's output can be
  previewed on the canvas. "Bake to shapes" turns a generator into separate editable paths.
- **Swatches**: bake a selection into a PNG that also stores the shapes it came from, keep it in the
  document and in a browser library, place it, use it as a fill, or put the editable recipe back.

## Layout of the code

```
src/core/     no browser code: could move to another host or a native app
  doc.js        the document format (plain JSON) and tree helpers
  store.js      every change as a small operation; undo/redo; change counters for caching
  path.js       editable paths (anchors + handles) and flattened polygons
  prims.js      primitive shapes, each described by a parameter list
  geomfx.js     outline effects
  raster.js     pixel effects on plain RGBA buffers
  effects.js    the effect registry: stage, parameters, defaults
  graph.js      the generator node graph: node types, typed links, evaluation
  geometry.js   node outlines after their own effects, cached; stroke outlines
  bool.js       boolean operations and offsetting (wraps vendor/clipper.js)
  color.js      OKLab / OKLCH colour, mixing, ramps
  rng.js        seeded randomness and noise
  math.js       2D matrices and bounds
src/render/   Canvas 2D renderer with per-node bitmap caches
src/ui/       the interface (viewport and tools, inspector, layers, graph editor, swatches)
```

The interface builds its controls from the parameter descriptions in the core (effects, primitives,
graph nodes), so a new effect or node needs no interface code.

## Elsewhere in the repository

- `explorations/gen1-scene-builder/` — the first generation, a structured landscape scene builder,
  parked. Still runs from its own folder.
- `explorations/EVALUATION_2D_25D_3D.md` — notes on 2D, 2.5D and 3D scene building and on a
  Scene Lab / Shape Lab split.
- `library/` — reference lists: the scene library index from gen 1 and a reorganisation of it
  into different ways of thinking about shape work.
