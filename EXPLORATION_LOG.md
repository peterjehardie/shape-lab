Non-binding exploration log: a record of what was tried and why it was dropped. It sets no rules and is not read unless asked for.

## 2026-09-28 · first build

- **Rim light as per-edge strokes clipped to the layer union.** Dropped: every inner edge facing the light inside a
  foliage clump got a rim too, so clumps filled with scribbles. Replaced by a silhouette trick: the layer union
  minus a copy shifted away from the light leaves a crescent on the lit outline only.
- **Shadow clones over anything behind.** Dropped as the default: clones landed on the sky. Clones now keep only the
  parts over land already drawn; a per-layer switch still allows sky.
- **Shadow clone blur at full resolution over the whole frame.** Dropped for speed: now half resolution, cropped to
  the clones' bounding box.
- **Mountain planes running straight down to the frame bottom.** Read as tall vertical stripes. Planes now fade into a
  flat mass below the crests.
- **Hill bumps ending in a flat edge above the ground plane.** Showed a shelf-like seam. Bumps now fade into the ground
  colour.
- **Haze toward the warm horizon colour.** Made far mountains beige; haze now has its own (cool) colour.
- **Roundness from turning concentration alone.** Rated spiky stars as fairly round (many small corners spread
  evenly). Added a penalty for outlines that turn back and forth.
- **Full lighting on every shape.** Tiny shapes (a few pixels) now get one flat colour read from their group's volume;
  no visible difference, large speed gain.

## 2026-09-28 · second pass

- **Branches as chains of separate segments.** Each segment had its own shading and round caps, so trunks looked
  like bamboo. Replaced by one tapered ribbon per branch, shaded as a lit side and a shadow side.
- **One random stream per layer.** Adding or moving one tree changed every tree after it. Each object now has its
  own stream keyed by a fixed id, which is what makes per-object edits and added objects stable.
- **River width perpendicular to its course.** A diagonal river ballooned into a slab; width now runs straight
  across the picture, as it would for a ribbon lying on the ground.
- **Full-frame blur filter for depth of field.** Too slow when many layers were blurred; small blurs now shrink the
  layer and stretch it back, which is close enough below about 3 px.
- **Default scene v1 (saturated greens, big blobs, outlines everywhere).** Read as clip art. v2 uses a muted
  golden-hour palette, many small varied foliage shapes, no default outlines, and grain, vignette and depth blur.

## 2026-09-28 · merging Chroma Mat

- **Free per-layer colour as the only colour source.** Pictures read as many unrelated colours. Chroma Mat's
  six-role palette with ramps is now the default colour source; free colour stays as a mode.
- **Torn edges at Chroma Mat's strength times two.** Came out spiky and aggressive; now matched to the original.
- **Torn/dissolve masks on foliage layers.** They erase trees made of many small leaves; kept, with a note in the
  panel that they suit big shapes.
- **Land layers spanning only 3% past the frame.** Camera parallax exposed their ends; they now run 30% past each side.
- **Keeping the paused motion frame on screen.** Hid later edits; any edit now returns to the live scene.

## 2026-09-29 · gen1 parked as a dead end

- **Gen1 as a whole: a structured landscape scene builder.** Parked in `explorations/gen1-scene-builder/` (git tag
  `gen1-scene-builder`). It opened on a finished, pre-built scene and grew toward the program assembling pictures
  (depth bands, structures, presets) rather than a person shaping things by hand. It proved many parts, but as a
  whole it does not come together as a tool for working abstractly with shapes. Parts worth carrying as knowledge:
  the palette roles and ramps from Chroma Mat, torn edges, noise masks, grain, the warp nodes, per-object random
  streams, the node editor interaction, and the library index (moved to `library/`).
- **Open question, not settled:** whether scene work moves to 2.5D/3D (flat layers placed in 3D space) and whether
  it becomes a separate "Scene Lab" beside a "Shape Lab", or two views on one document. Gen2 steps back to Shape Lab
  only.
