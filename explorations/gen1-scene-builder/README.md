# Shape Lab

A playground for building landscape pictures from **ordered structure first, random shapes second**.

Open `index.html` through any static server (the code is plain ES modules, no build step):

```
npx http-server -c-1 .     # or: python3 -m http.server
```

## What is in it

Shape Lab now includes its ancestor, **Chroma Mat**: a palette-first, abstract-shape tool. The two meet in
**palette mode** (the default): every colour comes from six palette roles and their ramps, and each layer takes
a role and a ramp step. **Free colour** mode keeps per-layer hues with value groups.

- **Depth bands, back to front:** sky, distant hills & mountains, middle distance, middle foreground,
  close foreground, very close foreground. Each band holds any number of layers.
- **Structures** that lay down scaffolding and slots: clouds (cumulus, stratus, cirrus), mountain ridges
  (lit/shadow planes, snow caps, mesa tops), rolling hills, trees (broadleaf, conifer, poplar, willow, palm,
  shrub, bare, rule-grown L-system), clusters (bushes, rocks), grass tufts, fields with hedges and fences,
  rivers and roads, water with reflections, a framing branch, and hand-drawn shapes.
- **Shape vocabulary** that fills the slots, with per-shape, per-cluster or per-object colour variety.
- **Value groups** with overlap warnings, plus values, 2-value and 3-value views.
- **Shape groups** (shape, cluster, object, layer) that drive outlines, volume lighting, shadows and variety.
- **Lighting:** outdoor sun, measured roundness, group volume lighting, shading steps, rim light, backlit glow.
- **Fake 2D light:** offset or cast shadow clones, contact shadows, separation halo, dappled patches, light shafts.
- **Lines:** union outlines, weight following the light, breaks on the lit side, lost-and-found edges,
  wobble and sketch passes, hatching in shadow.
- **Scene graph** (bottom drawer): moves outlines, and can also drive value, size and density; presets
  include wind, vortex, terraces, patchy light, clearings.
- **Atmosphere and finish:** haze colour, near tint, depth blur, paper grain, vignette, saturation, contrast, warmth.
- **Direct editing:** Select (drag objects, scroll to resize, Delete hides, R reseeds one), Move layer, Add,
  Draw, Erase (keys V M A D E); a seed gallery; seed locks; dice per settings section; copy/paste a look.
- **Library** tab: scene presets, layer presets, saved scenes, JSON export/import, the ideas catalogue, notes.
- **From Chroma Mat:** palette roles, ramps, 87-palette library, generator, checks, palette from an image, exports
  (JSON, CSS, Blender, three.js); flat, form-light and cut-paper rendering; abstract shape families with torn edges
  and an abstract scatter layer; abstract depth presets; per-layer soft/torn/dissolving edges, grain and fades with
  look presets; perspective and lens warp nodes; mat and extra formats; a Measure tab; Motion (keyframes, camera
  parallax, drift, light orbit, hue drift, graph time); paper, mid and dark interface skins.
- `SCENE_LIBRARY_INDEX.md`: a long reference list of everything a complete scene library could contain.

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
| `src/palette.js`, `src/palette-ui.js` | palette model and library (from Chroma Mat), Palette tab |
| `src/measure.js`, `src/motion.js` | Measure and Motion tabs |
| `src/ui.js`, `src/library.js`, `src/main.js` | panels, library, app wiring |
