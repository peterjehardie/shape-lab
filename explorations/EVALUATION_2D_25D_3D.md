> Non-binding evaluation note. It records an assessment for discussion; it sets no rules or plans for the project.

# Scene building: 2D, 2.5D or 3D, and one lab or two

Written 2026-09-29, after gen1 was parked. Two questions are open:

1. When shapes are arranged into a scene, should that scene be **flat (2D)**, **flat pieces placed in 3D space (2.5D)**,
   or **fully 3D**?
2. Should scene work live in a separate **Scene Lab** next to the **Shape Lab**, or should both be **two views of one
   shared document**?

A third concern runs through both: the project may later move from the browser to a native (installed, desktop)
app, so the choices below are also judged by how cheaply they would survive that move.

---

## 1. What gen1 actually did about depth

Gen1 was a 2D picture with depth faked by numbers. Reading `src/scene.js`, `src/render.js` and `src/motion.js`:

- **Depth was a single number per layer**, from 0 (far) to 1 (near). It came from the layer's depth band (sky,
  distant, middle, middle foreground, close, very close) and its order inside that band (`layerDepth`). Nothing had a
  real distance from a camera.
- **Parallax** (near things sliding further than far things when the viewpoint moves) was a sideways shift: each
  layer moved by camera offset × its depth number × a per-layer "Camera parallax" amount (`layerOffset`). Nothing got
  bigger or smaller as the camera moved, and nothing changed its overlap.
- **Haze** (far things fading toward an air colour) was `haze × (1 − depth)^falloff`, applied to the layer's colour.
- **Depth blur** (things away from the focus distance going soft) was `blur strength × |depth − focus|`, done with a
  canvas blur filter, or for small amounts by shrinking the layer and stretching it back.
- **Perspective** existed only as a distortion node (pulling points toward a vanishing point) and a "rows widen toward
  you" setting for fields.
- One lesson from the log: land layers had to run 30% past each side of the frame because parallax exposed their ends.
  Any camera, fake or real, needs pieces sized for how far the camera may travel.

So gen1 already had the *vocabulary* of 2.5D (depth, parallax, haze, depth blur, camera) without the *geometry*. That
matters below: moving to 2.5D mostly replaces invented numbers with measured ones.

---

## 2. The three options in plain language

### 2D: flat layers with fake depth

The picture is a stack of flat sheets, like cut paper glued in order. "Depth" is a label the artist or the program
assigns, and effects read that label: far sheets are hazier, softer, and slide less when the view pans. This is what
gen1 was.

- **Gives the artist:** full, direct control. What is drawn is exactly what appears. Any effect can be pushed past
  what physics would allow (a far hill sharper than a near bush, a haze colour that only hits one sheet). It suits
  poster-like, illustrative, cut-paper work.
- **Costs:** the least effort and the simplest tools. Rendering (turning the document into pixels) can be done with
  a plain 2D drawing API. The weak spot is that every depth effect is a separate hand-tuned rule, and they drift
  apart: parallax, haze and blur each have their own idea of distance, and camera motion never feels quite solid.
- **Hand-made shapes:** survive exactly. Nothing is reprojected.

### 2.5D: flat cards placed in 3D space, seen by a real camera

Each shape (or group of shapes) is painted onto a flat card, like theatre scenery flats or a multiplane animation
stand. Cards are placed at real positions in a 3D space, and a virtual camera with a lens looks at them. Because
distance is now real, effects can be computed from it: parallax, change of size with distance, overlap that shifts
as the camera moves, haze by distance, depth blur by distance from the focus plane, and light direction relative to
each card.

- **Gives the artist:** camera moves that feel solid for free (dolly in, pan, slight orbit); one consistent notion of
  distance for haze, blur and scale; the ability to rearrange depth by dragging a card nearer or farther instead of
  re-tuning several sliders. The pictures still look hand-made, because the cards are still flat artwork.
- **Costs:** moderate. It needs a GPU drawing API (WebGL or WebGPU in the browser; see section 6), a camera model, a
  way to pick and drag things in 3D, and a side view or top view so the artist can see where cards sit. Specific
  pitfalls:
  - *Soft or torn edges are partly transparent.* GPUs draw partly transparent things correctly only when they are
    drawn back to front, so cards need sorting, and two cards that cross through each other will show seams.
  - *Cards are flat, so light on them is flat.* A card turned toward the sun gets one brightness all over. Shape-level
    shading has to come from the Shape Lab (painted-in light, like gen1's volume lighting), or from a **normal map**
    (an extra image that tells the renderer which way each pixel "faces", so a flat card can be lit as if curved).
  - *Cards give themselves away at steep angles.* Once the camera swings more than roughly 20–30 degrees around a
    card, it reads as cardboard. 2.5D suits framed, mostly-frontal views, not free orbiting.
  - *Real depth blur is expensive;* blurring each card by its distance is cheap and usually good enough.
- **Hand-made shapes:** survive when the card faces the camera. At an angle they are foreshortened (squashed), which is
  correct but may not be wanted. If a card holds a baked image rather than live vector outlines, it goes soft or
  pixelated when the camera gets close (section 3).

### Full 3D: shapes become solid meshes

Everything is a **mesh**: a surface built from many small triangles, with thickness and a back side. The camera can go
anywhere; light and shadow fall from real geometry.

- **Gives the artist:** any viewpoint, real cast shadows, real occlusion, objects that can be turned around.
- **Costs:** by far the highest. Making good meshes is its own craft with its own tools (modelling, **UV unwrapping**,
  i.e. flattening a 3D surface so an image can be wrapped onto it, materials, lights, shadows). Making 3D look
  hand-made rather than computer-generated needs **non-photorealistic rendering** (outline shaders, stepped shading,
  painted textures), which is a research-sized area. Tools like Blender already do all of this far better than a
  small project could.
- **Hand-made shapes:** mostly do not survive as themselves. A 2D outline has to become a profile for a 3D form
  (pushed out, spun round, or used as a cross-section), and the character of the drawing (torn edges, wobble, grain)
  becomes a texture or a silhouette detail that changes with every viewpoint. The core idea of the Shape Lab (working
  abstractly with flat shapes) sits awkwardly here.

### Side by side

| | 2D (fake depth) | 2.5D (cards + camera) | Full 3D (meshes) |
| --- | --- | --- | --- |
| Artist control over the look | Total | High | Indirect |
| Camera motion | Sliding sheets only | Solid within a frontal range | Free |
| Depth effects | Separate hand rules | Computed from one distance, with overrides | Computed, physically |
| Effort to build | Low | Moderate | Very high |
| Tooling needed | 2D editor | 2D editor + 3D placement view | Modeller, UVs, materials, lights |
| Rendering | 2D drawing API is enough | GPU needed | GPU + shadows + style shaders |
| Hand-made shapes | Exact | Exact face-on; baked images soften up close | Must be translated; character at risk |
| Distance from the Shape Lab idea | Closest | Close | Far |

---

## 3. How Shape Lab shapes would enter each option

Four ways a shape made in the Shape Lab can become part of a scene:

- **Flat card (sprite).** A **sprite** is a flat picture placed in the scene. The shape sits on a rectangle-like card
  with a fixed orientation. Works in all three options; it is the native unit of 2D and 2.5D.
- **Billboard.** A card that always turns to face the camera. Useful for things that should never be seen edge-on
  (foliage clumps, clouds, particles, scattered rocks). Only meaningful when there is a real camera (2.5D, 3D).
- **Extruded shape.** The outline is pushed out into a thick solid, like a cookie cutter through dough, optionally
  with a rounded edge (**bevel**). Gives real thickness and side faces that catch light. Meaningful in 3D, and as a
  special kind of card in 2.5D. The flat face keeps the drawing; the sides are new and plain.
- **Texture.** The shape is turned into an image that is wrapped onto something else (a card, a mesh, the ground, the
  sky). Needed for full 3D, and it is how a baked **swatch** (an image produced by running effects on a shape) would
  travel.

Two further choices apply to any of these:

- **Live or baked.** A *live* shape keeps its recipe (outline, noise, masks, distortion settings, seed) and is redrawn
  when needed, so it stays sharp at any size and updates when edited in the Shape Lab. A *baked* shape is a finished
  image or a frozen outline: fast and predictable, but it stops following edits and has a fixed resolution. Effects
  that work on pixels (blur, grain, torn masks in gen1 worked on pixels) usually force baking at some resolution.
- **Where effects run.** Some effects belong to the shape (torn edge, grain); some belong to the scene (haze, depth
  blur, light direction). Keeping that line clear is what lets one shape be reused at different depths.

| Entry route | 2D | 2.5D | 3D |
| --- | --- | --- | --- |
| Flat card / sprite | Native | Native | Possible, reads as cardboard |
| Billboard | Not needed | Good for many small things | Common for foliage |
| Extruded shape | Can only be faked | A thick card; useful for near objects | Native |
| Texture | Not needed | Card contents; mandatory when baked | Mandatory |

---

## 4. One lab or two

### Option A: two separate apps that share a file format

Shape Lab and Scene Lab are separate programs. Both read and write the same kind of file.

- **For:** each app stays small and focused; they can be built at different times, even with different technology
  (for example the Scene Lab native and GPU-heavy while the Shape Lab stays in the browser).
- **Against:** a shared format has to be agreed and versioned before either app is mature, and two programs that
  both write it will disagree about details. Editing a shape "in place" while looking at the scene becomes a
  round trip between apps. Code for shared parts (noise, colour, palette, recipes) must be packaged as a library used
  by both, or duplicated.

### Option B: one app, two views over one document

One program, one open document. A Shape view edits shapes; a Scene view places them. Both look at the same data, so
an edit in one shows immediately in the other.

- **For:** the tightest loop (tweak a torn edge while watching it at the far end of the scene); one copy of shared
  code; one file for the artist to keep track of.
- **Against:** the easiest route back to gen1's failure. With everything in one app, scene features tend to spread into
  shape work (defaults, presets, auto-generated scenes) until the app again assembles pictures instead of helping a
  person shape things. The app also carries both the 2D tooling and the 3D placement tooling at once.

### Option C: Shape Lab exports assets that Scene Lab places

The Shape Lab produces **assets** (a reusable, named item: a shape recipe, or a baked swatch or card) into a library;
the Scene Lab only places and arranges those assets and never edits their insides.

- **For:** the clearest boundary. The Shape Lab can be finished first and used on its own. It matches how production
  tools usually divide work (asset creation vs layout).
- **Against:** a slower creative loop (edit, export, re-place) unless the reference is live. Baked exports go stale.
  The split may feel bureaucratic for a single artist.

### How they relate

These are less exclusive than they look. Option C's asset boundary can exist **inside** one document: shapes are
assets with ids, and scene entries are placements that point at those ids. Built that way, Option B (two views) and
Option A (two apps) differ only in packaging, and the choice can be postponed. What cannot be postponed cheaply is the
data model; that is the real decision.

---

## 5. What a shared document model needs

The following hold whichever option is chosen:

- **Stable ids for everything.** Shapes, recipe nodes, placements, palettes, swatches. Ids are never reused and never
  derived from position in a list. Gen1 learned this twice: per-object random streams keyed by a fixed id kept other
  objects from changing when one was added, and motion keyframes matched layers by id.
- **Recipes as the source of truth, bakes as caches.** A *recipe* is the list of steps and settings that makes a
  shape (base outline, noise, masks, distortions, seed). A *bake* is its result (a polygon set or an image). The
  document stores recipes; bakes are stored beside them, labelled with a fingerprint of the recipe, seed, resolution
  and renderer version, so a stale bake is detectable and can be rebuilt. When the artist deliberately freezes a result
  (a swatch they like), that frozen bake becomes a first-class item of its own.
- **Recipes as data, not code.** Nodes are stored as a type name plus parameters (as gen1's graph already did), never as
  functions. Then any implementation, in any language, can read them.
- **Seeds and a specified random generator.** Gen1's `rng.js` (a small integer-based generator) is portable: the same
  seed gives the same numbers in any language if the algorithm is written down. Noise functions need the same
  treatment.
- **Two levels of transform.** A **transform** is the move/rotate/scale that places something.
  - *Inside a shape:* 2D only (position, rotation, scale, possibly skew), usually stored as a 2×3 matrix or as separate
    fields.
  - *Placing a shape in a scene:* a placement record with its own transform. For 2D that is again a 2D transform plus a
    depth or order number. For 2.5D and 3D it is a 3D position, a 3D rotation (commonly a **quaternion**, a four-number
    form of rotation that avoids the gimbal lock problem of three angles), and a scale.
  - A 2D scene can be stored as a 3D placement with a fixed front-facing camera, so choosing 3D placement records costs
    little even if the first scene view is 2D. The reverse (adding 3D later to 2D records) needs a migration.
- **Units and conventions written down.** Gen1 stored geometry in picture pixels tied to canvas size (`W`, `H`); a
  portable model uses resolution-independent units (for example, shape space from −1 to 1, scene space in metres or
  abstract units). Also recorded: which way is up (y up or y down), angles in degrees or radians, left- or
  right-handed 3D axes.
- **Asset references by id, not by path or pointer.** A placement says "shape `S12`, version 4", not a file path or an
  in-memory object. External files (images, fonts) are referenced by content fingerprint so they can move.
- **Colour as palette references.** Colour stored as palette role and ramp step (the Chroma Mat model), with resolved
  values in a perceptual space (OKLab/OKLCh, as gen1 used) rather than screen hex codes, so re-rendering in another
  engine or colour space stays faithful.
- **Scene-level effects kept separate from shape-level effects.** Haze, depth blur and scene light belong to placements
  and the camera; torn edges and grain belong to shapes. A placement can carry overrides (this card: less haze).
- **A version number and migrations.** The file states its format version, and loaders upgrade older versions step by
  step.

A minimal sketch of the shape of such a document (illustrative only):

```json
{
  "format": "shapelab-doc", "version": 1,
  "units": { "shape": "unit-square", "scene": "metres", "up": "+y", "angles": "degrees" },
  "palettes": { "P1": { "roles": { "dominant": [0.62, 0.08, 140] } } },
  "shapes": {
    "S12": {
      "rev": 4, "seed": 81723,
      "recipe": [
        { "id": "n1", "type": "blob", "params": { "lobes": 5, "wobble": 0.2 } },
        { "id": "n2", "type": "tornEdge", "params": { "depth": 1.2, "reach": 0.03 } }
      ],
      "fill": { "palette": "P1", "role": "dominant", "step": 0 },
      "bakes": [{ "kind": "raster", "px": 1024, "fingerprint": "a91f…", "file": "blob:5c2e…" }]
    }
  },
  "scene": {
    "camera": { "position": [0, 1.6, 0], "rotation": [0, 0, 0, 1], "fov": 40, "focus": 12 },
    "placements": [
      { "id": "p7", "shape": "S12", "rev": 4, "as": "card",
        "transform": { "position": [3, 0, -18], "rotation": [0, 0, 0, 1], "scale": [4, 4, 1] },
        "overrides": { "haze": 0.8 } }
    ]
  }
}
```

---

## 6. Browser now, native later

### Drawing technology, in plain terms

| Job | Browser | Native equivalents |
| --- | --- | --- |
| 2D vector drawing (paths, fills, strokes, simple filters) | **Canvas 2D** (what gen1 used), or SVG | **Skia** (the engine behind Chrome's Canvas 2D, usable directly), Core Graphics (Apple), Direct2D (Windows), Cairo |
| GPU drawing, widely available | **WebGL 2** (a browser form of OpenGL ES 3) | OpenGL / OpenGL ES |
| Modern GPU drawing and computation | **WebGPU** | **wgpu** (a Rust library that implements the WebGPU interface natively) or **Dawn** (Google's C++ one), both running on Metal, Vulkan or Direct3D 12 |
| Wrapping web code as a desktop app | – | Tauri or Electron (the same web code in an installed window) |

- 2D (and the Shape Lab itself) can stay on Canvas 2D for a long time. Gen1's slow spots (full-frame blur, masks done
  pixel by pixel) are the ones a GPU would fix.
- 2.5D needs WebGL 2 or WebGPU. WebGPU has the better portability story because the same interface and shader
  language (WGSL) exist natively through wgpu or Dawn. Its browser support has grown to the major browsers but still
  has gaps on some platforms and devices, so a WebGL 2 fallback, or a library that covers both (three.js, for
  instance), is the cautious route.
- Full 3D in the browser is feasible with three.js or Babylon.js, but the tooling cost (section 2) dominates, not the
  rendering.

### What keeps a later move cheap

- **A pure core.** Geometry, noise, random numbers, recipe evaluation, colour maths and the document model live in
  code that never touches the page, the canvas or the DOM (the browser's page structure). Only a thin layer draws and
  handles input. The core can then be ported, or compiled (for example written in Rust or C++ and compiled to
  **WebAssembly**, a compact format browsers can run at near native speed, and also compiled natively).
- **A narrow renderer interface.** The core hands the renderer simple things: polygons, fills, cards, transforms,
  images. Swapping Canvas 2D for Skia, or WebGL for wgpu, then touches one layer.
- **No looks that depend on browser-only features.** Gen1 relied on `ctx.filter = blur(...)` and canvas blend modes
  such as `soft-light`. These behave slightly differently everywhere. Effects that matter should be defined by the
  project (its own blur, its own blend formula), ideally as shaders.
- **The document as plain, versioned data** (section 5), with no reliance on how JavaScript happens to order or
  serialise things.
- **Reference renders.** A handful of saved documents with expected output images (or geometry fingerprints) catch
  drift when anything is reimplemented.

---

## 7. Experiments that would settle the questions quickly

Each is small and throwaway, built next to the Shape Lab rather than into it.

1. **Card box.** Build: 4–6 flat hand-made shapes (borrowed from gen1 output or drawn quickly) on cards in a WebGL or
   WebGPU scene with a perspective camera; controls to pan, dolly and orbit a little; a toggle that switches to gen1's
   fake parallax on the same art. Shows: whether real perspective (size change, shifting overlap) feels worth the cost
   over sliding sheets, and how far the camera can move before cards read as cardboard.

2. **Live vs baked card.** Build: one torn-edged, grainy shape on a card, shown three ways: baked image at a fixed
   resolution, baked at several resolutions picked by distance, and redrawn live from its vector recipe each time the
   camera stops. Dolly the camera from far to very close. Shows: where baked images break, whether torn edges and grain
   hold up, and what live redraw costs. This decides the recipe/bake rules in section 5.

3. **Depth effects from real distance.** Build: in the card box, haze, per-card depth blur and one light direction
   computed from each card's real distance and facing, next to gen1's band-number versions; one override slider per
   card. Shows: whether measured distance gives the look an artist wants or whether overrides get used constantly
   (if they do, 2.5D's main advantage shrinks toward 2D).

4. **Extrusion probe.** Build: take one Shape Lab outline, extrude it with a bevel, light it, and view it at several
   angles beside the same shape as a flat card. Shows: whether hand-made character survives the step into 3D, which
   sizes the real gap between 2.5D and full 3D, and whether "thick cards" are a useful middle step.

5. **One document, two views, one outside reader.** Build: a tiny JSON document in the section 5 shape; a shape editor
   and a card scene both open on it, where editing the shape updates the scene live; then a separate small script
   outside the browser (Node, or Python with a Skia binding) that reads the same file and draws the shape. Shows:
   whether the two-views model stays clean or tangles, whether the recipe format is truly independent of the UI, and
   how much output drifts between two renderers.

Experiments 1–3 answer "2D or 2.5D"; 4 answers "is full 3D worth watching"; 5 answers "one lab or two" and "is the
data portable".

---

## 8. Current leaning (open, not a decision)

**Open. This is the current leaning of the evaluation, to be revised by the experiments above.**

- **Dimension:** 2.5D for scenes, when scenes return. It keeps shapes flat and hand-made (the point of the Shape Lab)
  while replacing gen1's scattered depth numbers with one real distance and a real camera. Full 3D looks like a poor
  fit for this project's purpose and a large cost; extruded "thick cards" may be worth keeping as a later option.
  Plain 2D stays the right mode for the Shape Lab itself.
- **Split:** one document model with an asset boundary inside it: shapes are assets with ids and recipes; the scene is
  a list of placements that reference them. Start as **Shape Lab only** (as gen2 already does), then add a Scene view
  over the same document, keeping the Scene view strictly a placing-and-camera tool with no generators or preset
  scenes. Whether that view ships inside the same app or as a second app can wait, because the data model makes it a
  packaging question.
- **Data:** store scene placements with 3D transforms from the start, recipes as the source of truth, bakes as
  fingerprinted caches, resolution-independent units, palette-role colours.
- **Technology:** keep a pure core with no browser dependencies and a narrow renderer interface; Canvas 2D is fine for
  the Shape Lab early on; prefer WebGPU (with a WebGL 2 fallback or a library covering both) for the scene side,
  because the same interface exists natively.

What would change the leaning: if experiment 1 shows fake parallax is nearly as good in practice, 2D wins on cost; if
experiment 3 shows every card needs overrides, the measured-distance advantage is weak; if experiment 5 shows the two
views tangling, separate apps sharing the format (Option A) become more attractive; if experiment 4 shows extruded
shapes keeping their character well, a thicker 2.5D moves closer to 3D.
