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
