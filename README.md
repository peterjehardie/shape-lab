# Shape Lab

A playground for building landscape pictures from **ordered structure first, random shapes second**.

Open `index.html` through any static server (the code is plain ES modules, no build step):

```
npx http-server -c-1 .     # or: python3 -m http.server
```

## What is in it

- **Depth bands, back to front:** sky, distant hills & mountains, middle distance, middle foreground,
  close foreground, very close foreground. Each band holds any number of layers.
- **Structures** that lay down scaffolding and slots: clouds, mountain ridges (split into lit/shadow planes),
  rolling hills, point-extrusion trees (broadleaf, conifer, poplar, shrub, bare), clusters (bushes, rocks),
  grass tufts, and a framing branch.
- **Shape vocabulary** that fills the slots: circles, ellipses, blobs, leaves, squares, triangles, shards, stars.
- **Value groups:** every layer takes its lightness from one group; light and shadow only move inside it.
  Values, 2-value and 3-value views check the pattern.
- **Shape groups** at four levels (shape, cluster, object, layer) that drive outlines, volume lighting and shadow clones.
- **Lighting:** outdoor sun (angle plus front/back), measured roundness (round shapes get smooth shading,
  squarish ones get flat planes), group volume lighting, shading steps, rim light.
- **Fake 2D light:** shadow clones for close shapes, dappled light/shadow patches for distant ones.
- **Lines:** union outlines, weight following the light, breaks on the lit side, wobble and sketch passes.
- **Distortion node graph** (bottom drawer), scaled per layer, plus per-layer and per-shape noise.
- **Library** tab: presets, saved scenes, JSON export/import, a catalogue of built and not-yet-built ideas, notes.

## Code map

| File | Role |
| --- | --- |
| `src/scene.js` | bands, layer and scene settings, defaults |
| `src/structures.js` | the structure generators |
| `src/geom.js` | polygons, shape vocabulary, roundness measure |
| `src/pipeline.js` | generation, shape fill, distortion; caching; grouping |
| `src/render.js` | lighting, outlines, clones, patches, value views |
| `src/color.js` | OKLab colour (perceived lightness = value) |
| `src/graph.js`, `src/graph-editor.js` | distortion graph model and editor |
| `src/ui.js`, `src/library.js`, `src/main.js` | panels, library, app wiring |
