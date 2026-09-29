> Non-binding reference list. It records ideas only; it sets no rules or plans for the project.

# Shape Work Concepts

## How to read it

- **What this is** — the material from `SCENE_LIBRARY_INDEX.md` that still matters for abstract shape work, plus ideas the scene list lacked, sorted six different ways.
- **Six frames** — each frame cuts the same space along a different line: what a shape is made of, what can be done to it, what the eye should get from it, what kind of data moves through a node graph, at what size and reach something happens, and which real medium it imitates.
- **Deliberate overlap** — the same idea often appears in several frames; each frame shows it from a different side, and no frame is meant to be the "right" one.
- **Entry format** — a short name, then one line of plain description.

**A few words used throughout:**

- **Shape** — a closed outline with an inside, possibly with holes.
- **Path** — an open line with a start and an end; it can become a shape once given a width.
- **Field** — a value (or an arrow) defined at every spot on the canvas, like a weather map; noise is the most common example.
- **Mask** — a field used as "how much": full effect where it is white, none where it is black, partial in between.
- **Attribute** — a named value stuck to an item (a point, a shape, a group), such as its size, its random number or its position in a row.
- **Node graph** — a set of boxes (nodes) that each do one job, wired together so that one box's output feeds the next box's input.
- **Swatch** — a saved, reusable result or recipe (for example a noise plus a distortion that reads like a paint stroke) that can be applied to other shapes.

---

## Frame 1. Anatomy: what one shape is made of

*This frame looks at a single shape as an object with parts, the way a figure drawer thinks about skeleton, skin and posture.*

### 1.1 Silhouette (the outer outline read as one flat shape)

- **Proportion** — how long the shape is compared with how wide.
- **Mass distribution** — where the bulk sits: bottom-heavy, top-heavy, centred or pushed to one side.
- **Convexity** — how much the outline only bulges outward versus bending inward; a fully convex shape has no dents at all.
- **Lobes and arms** — bumps and projections that stick out from the main body.
- **Bays and bites** — inward cuts into the outline.
- **Necks and pinch points** — narrow places where the shape nearly splits in two.
- **Corner set** — how many corners there are, how sharp they are and how evenly they are spaced.
- **Symmetry** — mirror symmetry, rotational symmetry, near-symmetry or none.
- **Gesture** — the single line of movement the whole silhouette implies (a lean, a curl, a thrust).
- **Outline busyness** — how long the outline is compared with the area it holds; a simple number for how complicated the edge is.
- **Holes** — openings fully enclosed by the shape.
- **Thumbnail read** — whether the silhouette still says what it is when shrunk to a tiny size.
- **Open versus closed** — a closed shape with an inside versus an open stroke with two ends.

### 1.2 Skeleton and axes

- **Medial axis (skeleton)** — the centre line running down the middle of every part of the shape, equally far from both sides; it gives thickness, branching and a path to bend along.
- **Spine** — the one guiding curve that a stroke-like shape follows from start to end.
- **Width profile** — how the thickness changes along the spine: taper, swell, pinch, blunt end.
- **Joints and forks** — where parts of the skeleton branch or meet.
- **Centroid** — the balance point of the shape's area.
- **Main axis** — the direction of the shape's longest stretch, which sets its apparent orientation.
- **Bounding box** — the smallest upright rectangle that holds the shape.
- **Tangent and normal** — at any point on the outline, the direction the edge runs (tangent) and the direction pointing straight out of it (normal).
- **Curvature** — how sharply the outline bends at each point, positive on bulges and negative in bays.

### 1.3 Edge (the boundary as an object in its own right)

- **Profile across the edge** — how the boundary passes from inside to outside: hard step, soft ramp, feather, halo, raised rim.
- **Character along the edge** — the pattern met when travelling along it: smooth, wobbly, serrated, scalloped, faceted, torn, deckled, fibrous.
- **Edge frequency** — the size of the bumps compared with the shape: a slow wobble versus a fine tooth.
- **Edge amplitude** — how far the bumps push in and out.
- **Variation along the length** — the edge changes character from place to place, hard at one end and soft at the other.
- **Lost and found** — the edge dissolves where inside and outside are close in value, and sharpens where they contrast.
- **Broken edge** — gaps where the fill fails to reach the boundary, as in dry brush.
- **Edge pooling** — a darker (or lighter) line hugging the inside of the boundary, as when watercolour dries.
- **Outline stroke** — a separate line drawn along the edge, with its own width, taper, colour, gaps and wobble.
- **Fringe** — small satellite marks riding the boundary to break it up.
- **Stragglers** — a few loose bits that have broken off the edge and drifted away.
- **Corner treatment** — rounded (fillet), cut straight (chamfer), sharp, notched, or overshooting like a quick sketch.
- **Facing dependence** — edges that differ by which way they point, such as hard on one side and soft on the other.
- **Inward or outward** — an edge effect that eats into the shape, grows out of it, or straddles the line.

### 1.4 Interior (fill and inner structure)

- **Flat fill** — one colour, no variation.
- **Gradient fill** — colour changing across the shape: straight across, from a centre outward, around a centre, or along the spine.
- **Depth-from-edge fill** — colour set by how far a point is from the nearest edge, so bands follow the outline inward.
- **Pseudo-volume** — shading that suggests roundness, for example from a measured roundness or a light direction.
- **Core and rim** — a centre that differs from the band just inside the edge.
- **Inner divisions** — cells, veins, cracks, stripes or sub-shapes inside the outline.
- **Inner lines** — hatching, contour lines following the form, or a few detail lines.
- **Cut-outs** — smaller shapes punched out of the inside.
- **Built from marks** — an inside made of many small marks (dots, dashes, dabs) instead of a solid fill.
- **Uneven opacity** — a fill that is more see-through in places.
- **Colour jitter** — small random shifts of hue and value inside the fill so it does not look printed.

### 1.5 Surface (fine texture laid over the fill)

- **Grain** — fine random speckle.
- **Directional streak** — texture that runs one way, like brush drag or wood grain.
- **Tooth** — paper texture that the colour catches on or skips over.
- **Granulation** — speckle gathering in the hollows of the surface.
- **Mottle and bloom** — broad, blotchy variation in strength.
- **Regular overlay** — weave, halftone dots, screen or scanlines.
- **Relief suggestion** — small highlights and darks along ridges, suggesting thick paint.
- **Sheen** — streaky bright reflections.
- **Texture anchoring** — whether the texture sticks to the shape (moves and scales with it) or to the page (stays put while the shape moves).
- **Texture direction source** — texture that follows the shape's main axis, a flow field, the outline, or one fixed angle.

### 1.6 Relation to neighbours

- **Stacking order** — which shape is in front.
- **Contact** — overlapping, just touching, a near miss, or clearly apart.
- **Gap shape** — the size and form of the empty space between shapes, treated as a shape in its own right.
- **Nesting** — one shape sitting fully inside another.
- **Fusing** — neighbours melting together where they come close.
- **Echo** — one shape repeating another's form at a different size or angle.
- **Alignment** — shapes sharing an edge line, a centre line or an axis.
- **Border contrast** — how different the two sides of a shared border are in value, colour and texture.
- **Cast effects** — a shape's shadow, halo or glow landing on its neighbour.
- **Contact darkening** — extra dark where shapes overlap or touch.
- **Knockout** — one shape clearing a gap around itself in the shape behind.
- **Membership** — belonging to a cluster, a row, a pattern or a layer.

### 1.7 Identity and carried data (attributes)

- **Id and index** — a unique name and a place in its sequence.
- **Personal random number** — a value fixed to this item so its variations stay stable across edits.
- **Measured values** — area, outline length, roundness, stretch, orientation, centroid.
- **Assigned values** — a role, a weight, a tag, a position on a colour ramp.
- **Inherited values** — values passed down from what made it, such as row and column in a grid or distance along a path.
- **Neighbour values** — how many neighbours it has and how close the nearest one is.
- **Recipe memory** — the list of steps that made it, kept so it can be re-edited later.

---

## Frame 2. Operations: what can be done

*This frame sorts the space by verbs. Every entry is something done to shapes, points or fields.*

### 2.1 Generate (make something new)

- **Basic geometry** — circle, ellipse, rectangle, polygon, star, capsule, arc, ring, crescent, cross, chevron, spiral.
- **Formula shapes** — superellipse (between circle and square), superformula, rose curve, Lissajous loop, Fourier blob (a circle whose radius is nudged by a few waves).
- **Freehand drawing** — an outline drawn with the pointer, then smoothed.
- **Bezier path** — a curve set by points and handles that pull the curve toward them.
- **Stroke from path** — a path given a width profile to become a filled shape.
- **Blob through points** — a smooth closed curve passing through a few chosen or random points.
- **Hull** — the rubber-band outline around a group of points (convex hull), or a closer-fitting version that follows inward bends (concave hull).
- **Contour from a field** — the outline where a field crosses a chosen level, like one line on a height map.
- **Cells from points** — space split into the area nearest each point (Voronoi cells), like cracked mud.
- **Triangles from points** — scattered points joined into a mesh of triangles (Delaunay triangulation).
- **Packing** — circles or boxes filling an area without overlapping.
- **Growth** — branching, rule-based rewriting (L-systems), branches growing toward targets (space colonisation), or particles wandering and sticking (aggregation).
- **Subdivision rules** — a rectangle split, then its parts split again, as in a Mondrian-like layout.
- **Fractals** — shapes that repeat their own pattern at smaller and smaller sizes (Koch edge, Sierpinski holes, branching trees).
- **Simulations** — spots and stripes grown by a chemistry-like process (reaction-diffusion) or grid cells switching on and off by neighbour rules (cellular automata).
- **Mark library** — ready glyph-like marks: tick, dash, comma, squiggle, loop, wedge, asterisk.
- **Trace from image** — outlines pulled out of a picture along its light and dark boundaries.
- **Letter outlines** — text turned into shapes that can be edited like any other.

### 2.2 Reshape one outline

- **Offset and inset** — grow or shrink the shape evenly all round.
- **Contour repeat** — several offset copies nested like map contours.
- **Round and chamfer** — soften corners into curves or cut them off straight.
- **Smooth** — rounding the outline a little more with each pass.
- **Simplify** — remove points while keeping the overall form.
- **Resample** — respace the outline's points evenly, often needed before a warp so straight edges can bend.
- **Roughen** — push the outline in and out with noise, along the direction straight out of the edge.
- **Quantise angles** — snap every edge to a few directions for a crystal or low-poly look.
- **Erode and dilate** — eat into the shape or grow it; doing one then the other removes small bumps or fills small gaps.
- **Taper, bend, twist, skew, bulge** — whole-shape deformations measured from the shape's own axis.
- **Expand stroke** — turn a line into a filled outline of the same width.
- **Fringe** — add small marks along the outline.
- **Mirror** — flip, or reflect half the shape to make it symmetrical.

### 2.3 Combine (several shapes into new ones)

- **Boolean union, subtract, intersect, exclude** — join, cut away, keep only the overlap, or keep everything but the overlap ("boolean" means simple yes/no logic applied to areas).
- **Smooth union and smooth subtract** — the same joins with a soft curved fillet where the shapes meet.
- **Metaball merge** — soft blobs that melt together as they approach, like drops of mercury.
- **Proximity merge** — shapes closer than a set distance fuse into one.
- **Group outline** — only the outer contour of a whole group is kept.
- **Clip** — keep only the parts of shapes that fall inside a container shape.
- **Punch holes** — cut smaller shapes out of a larger one.
- **Slice** — cut shapes along a line or a path.
- **Fracture** — break a shape into shards, for example along cell boundaries.
- **Morph** — in-between shapes blending from one form to another.

### 2.4 Deform (move the points of shapes by a rule)

- **Displacement** — every point moved by the arrow a vector field gives at that spot.
- **Noise warp** — displacement from smooth noise, for organic wobble.
- **Domain warp** — noise read at positions that have themselves been pushed by noise, giving swirly, marbled flow.
- **Swirl** — points twisted around a centre, more near the middle.
- **Ripple** — rings of push travelling out from a centre.
- **Bulge and pinch** — points swollen away from, or sucked toward, a centre.
- **Shear and lean** — everything slanted in proportion to its height.
- **Wave** — regular waves across the shape.
- **Zigzag** — a saw-tooth shift across the picture.
- **Shatter offset** — angled slices slid against one another.
- **Polar wrap** — straight bands bent into a circle, or a circle unrolled into a band.
- **Kaleidoscope and mirror** — one slice reflected around a centre or across a line.
- **Lens** — fisheye bulge or pull toward a vanishing point.
- **Lattice warp** — a coarse grid of handles that bends everything inside it.
- **Path bend** — a shape bent to follow a curve.
- **Pins** — pins placed on a shape and dragged like a puppet.
- **Flow carry** — points pushed along a flow field in many small steps, like ink carried by a current.
- **Smear** — points pulled in one direction by an amount that fades out, like paint dragged by a finger.
- **Relax** — points nudged toward even spacing, which calms a jittery outline.
- **Heat shimmer** — fine wavy movement in bands.

### 2.5 Repeat and scatter

- **Linear, grid, radial and mirror repeat** — copies along a line, in rows and columns, around a centre, or reflected.
- **Tilings** — square, hex, triangle, brick, herringbone, basketweave, fish scale, Truchet (simple tiles turned at random to make mazes), Wang (tiles with matching edges), Penrose (never-repeating).
- **Symmetry groups** — the seventeen ways a flat pattern can repeat, as a menu of repeat rules.
- **Random scatter** — copies dropped at random in an area.
- **Even random scatter** — random placement that never lets two items get too close (Poisson-disc sampling).
- **Jittered grid** — a regular grid with small random offsets.
- **Density-driven scatter** — more copies where a field is high.
- **Along a path or edge** — copies spaced along a line or around an outline.
- **Inside, on, or outside** — scatter limited to a shape's interior, its outline, or a band just beyond it.
- **Clumping** — copies gathered into groups with gaps between.
- **No-overlap push** — copies nudged apart until they stop colliding.
- **Stacking** — copies placed on top of other copies.
- **Recursive nesting** — copies inside copies inside copies.
- **Instancing** — one shape copied onto every point of a point set, each copy reading its point's size, angle and other attributes.
- **Weighted shape mix** — each copy picks its shape from a set, with chosen odds.
- **Progression** — a value that steps along the sequence, so size or colour grades from one end to the other.
- **Dropouts** — some copies skipped by rule or by chance, to break a regular beat.

### 2.6 Select and mask

- **Inside mask** — only within the shape.
- **Outside mask** — everything except the shape.
- **Edge band mask** — a strip along the boundary, on the inside, the outside, or straddling it.
- **Distance falloff** — strength fading with distance from a shape, path or point.
- **Noise mask** — a patchy random selection.
- **Gradient mask** — strength rising across the picture or the shape.
- **Range mask** — only where some value lies between two limits.
- **Painted mask** — a mask brushed by hand.
- **Facing mask** — only the parts of an outline that face a chosen direction.
- **Curvature mask** — only the bulges, or only the bays.
- **Overlap mask** — only where shapes overlap.
- **Attribute selection** — items picked by their values: large ones, every third one, a random 30 percent.
- **Mask arithmetic** — masks added, multiplied, subtracted, or combined by taking the larger or smaller value.
- **Mask shaping** — a mask made harder (threshold), softer (blur), grown, shrunk or re-curved.

### 2.7 Fill and texture

- **Flat, gradient and ramp fills** — a colour, a blend, or a set of colours read from a ramp.
- **Mark-built tone** — tone made from lines or dots: hatching, cross-hatching, stipple, halftone (dots that grow in dark areas).
- **Dither** — tone faked with a fine pattern of two colours, either as a regular grid or as scattered dots.
- **Pattern fill** — a tiling placed inside the shape.
- **Stroke fill** — the inside built from many brush-like strokes that follow a direction or a flow field.
- **Grain overlay** — fine noise over the fill.
- **Posterise and threshold** — values snapped to a few flat steps, or to pure light and dark.
- **Per-item colour jitter** — each copy nudged in hue and value.
- **Opacity and blend** — how see-through a fill is and how it mixes with what is under it (for example multiply, which darkens like a glaze, or screen, which lightens like light).

### 2.8 Measure and sample (read information out)

- **Size measures** — area, outline length, bounding box, centroid.
- **Shape measures** — roundness, stretch, convexity, main direction.
- **Distance to edge** — how deep inside (or how far outside) a point is.
- **Nearest neighbour** — distance to the closest other item.
- **Outline sampling** — curvature and edge direction at each point.
- **Field sampling** — the value of a field at a point, stored as an attribute.
- **Picture measures** — value spread, warm and cool balance, where the visual weight sits, how much of the canvas is covered.
- **Collision test** — whether two shapes overlap.

### 2.9 Convert (change what kind of thing it is)

- **Shape to points, points to shapes, fields to outlines and back** — the full list sits in Frame 4, which is organised around exactly these changes.

### 2.10 Bake and keep (swatches)

- **Bake** — freeze the result of a live recipe into fixed shapes or a fixed image, so it stops recalculating and can be moved around freely.
- **Live swatch** — a saved recipe that recalculates on every new shape it is applied to.
- **Frozen swatch** — a saved finished result, used as-is.
- **Exposed knobs** — the few settings a swatch leaves open (amount, scale, seed, colour), with the rest hidden.
- **Edge swatch** — an edge profile and character that can be applied to any outline.
- **Fill swatch** — an interior treatment that can be poured into any shape.
- **Stroke swatch** — a mark that can be laid along any path.
- **Stamp swatch** — a single mark placed at points.
- **Pattern swatch** — a tile that repeats without visible seams.
- **Warp swatch** — a saved distortion that can be applied elsewhere.
- **Mask swatch** — a saved selection pattern, such as a spray fade.
- **Look swatch** — several of the above bundled, such as noise plus distortion plus edge that together read as a paint stroke.
- **Stretch or repeat** — how a stroke swatch covers a longer path: stretched, repeated, or with fixed ends and a middle that repeats.
- **Fresh each use** — a swatch that reseeds itself every time so no two uses match exactly.
- **Swatch from selection** — capturing the current shape and its stack of operations as a new swatch.
- **Swatch library** — named, tagged, previewed swatches with favourites.
- **Swatch exchange** — swatches saved to files and loaded into other projects.

### 2.11 Steer and explore

- **Seed** — one number that sets all the randomness of an item or a recipe.
- **Seed lock** — chosen parts kept fixed while the rest rerolls.
- **Variation amount** — one control for how wild the randomness is.
- **Variant gallery** — a grid of versions with different seeds or small changes, to pick from.
- **Mutate** — small random changes to the current state.
- **Randomise within limits** — all settings shuffled inside safe ranges.
- **Operation stack** — the steps kept as an editable list, so an early step can change without redoing the later ones.
- **Branching history** — earlier states kept and reachable, including side branches.
- **Side-by-side compare** — two versions shown together.

---

## Frame 3. Perceptual goals: what the eye should get

*This frame sorts the space by what a viewer sees and feels, not by how it is made. It draws on the composition material of the old index with the scene content removed.*

### 3.1 Reading and legibility

- **Distance read** — the design still holds when seen small or from across a room.
- **Squint read** — the big light and dark shapes hold when details blur away.
- **Silhouette clarity** — each important shape reads by its outline alone.
- **Figure and ground** — a clear sense of which shapes are things and which are space.
- **Deliberate ambiguity** — shapes that flip between thing and space.
- **Grouping** — near or alike items read as one unit (the eye's habit of grouping, often called gestalt).
- **Closure** — the eye completes a shape from broken parts.
- **Continuation** — the eye carries a line on through gaps.

### 3.2 Weight and balance

- **Visual weight** — size, darkness, saturation, detail, isolation and position all make a shape feel heavier.
- **Symmetric balance** — equal weight either side of the centre, calm and formal.
- **Asymmetric balance** — unequal shapes that still feel balanced.
- **Steelyard** — a large mass near the centre balanced by a small one far out.
- **Counterweight** — a small strong accent holding a large weak area.
- **Grounded** — weight low in the frame, stable.
- **Floating** — shapes lifted away from the bottom, light or uneasy.
- **Weight centre** — the balance point of the whole picture.

### 3.3 Movement and direction

- **Gesture** — the main sweep a shape or group implies.
- **Implied lines** — lines the eye draws between separate shapes.
- **Horizontal calm, vertical strength, diagonal energy** — the moods that line direction carries.
- **Rising and falling diagonals** — lower-left to upper-right felt as rising, the other as falling.
- **Pointing shapes** — wedges, tapers and arrows that aim the eye.
- **Flow** — many marks lined up so the surface feels like a current.
- **Eye path** — the route the eye takes: entry, loop, spiral in, zig-zag.
- **Exit stoppers** — shapes near the edge that turn the eye back in.

### 3.4 Rhythm and interval

- **Regular beat** — the same element at the same spacing.
- **Alternation** — two elements taking turns.
- **Progression** — elements growing or shrinking step by step.
- **Flowing rhythm** — curving repeats like waves.
- **Loose rhythm** — repeats with irregular spacing.
- **Syncopation** — a deliberate skip or accent in a regular beat.
- **Counterpoint** — two different rhythms running together.
- **Beat and rest** — busy passages broken by quiet ones.
- **Gradation** — a smooth change of size, value, colour or spacing across the field.
- **Uneven intervals** — gaps of different widths, which read as natural.
- **Odd groups** — groups of three or five, which settle better than pairs.

### 3.5 Tension and rest

- **Near-touch** — two edges almost meeting, which creates a strong pull.
- **Crowding** — shapes squeezed together.
- **Instability** — a wide top on a narrow base, or a lean past balance.
- **Off-centre pull** — a main shape pushed away from the middle.
- **Open space** — deliberate emptiness that lets the picture breathe (the Japanese idea of ma).
- **Resolution** — a quiet area after a busy one.
- **Hard against soft** — contrast of edge types creating a charge.

### 3.6 Edges and focus

- **Edge hierarchy** — few hard edges, more soft ones, many lost ones.
- **Lost and found** — edges disappearing and reappearing along one boundary, which keeps the eye moving.
- **Focus by contrast** — the strongest light against dark in one place.
- **Focus by detail** — fine detail only where attention should go.
- **Focus by colour** — the most intense colour saved for one area.
- **Focus by difference** — one odd shape among many alike.
- **Focus by rhythm break** — the place where a pattern changes.
- **Focus by isolation** — a shape set apart in open space.
- **Competing focus** — two areas fighting for attention, usually a fault.

### 3.7 Shape character and contrast

- **Round** — soft, safe, friendly.
- **Angular** — sharp, active, aggressive.
- **Flowing** — graceful, organic.
- **Blocky** — solid, still, built.
- **Size hierarchy** — one dominant shape, a few supporting ones, many small ones.
- **Size contrast** — how much bigger the biggest shape is than the smallest.
- **Character pairs** — hard with soft, straight with curved, busy with quiet, rough with smooth, geometric with organic.
- **Family resemblance** — shapes that share a trait so they belong together while differing.
- **Echo** — a form repeated at another size somewhere else.

### 3.8 Surface energy

- **Active and quiet surfaces** — textured, busy areas set against smooth, calm ones.
- **Hand feel** — small imperfections that show a human or physical process.
- **Machine feel** — exact repeats, clean edges, even spacing, used on purpose.
- **Freshness** — marks that look placed once and left alone rather than worked over.
- **Texture contrast** — rough against smooth as a source of interest.

### 3.9 Space without a scene

- **Overlap depth** — in front and behind, with no landscape needed.
- **Value steps** — paler or closer-in-value shapes seem further back.
- **Softness depth** — blurred shapes recede, sharp ones advance.
- **Transparency depth** — see-through layers suggest stacked planes.
- **Shallow space** — shapes staying near the picture surface, like layered paper.
- **Flatness** — all depth cues removed on purpose, so the picture reads as pattern.

### 3.10 Trouble spots

- **Kissing edges** — two shapes that just touch.
- **Frame tangents** — a shape that just touches the frame edge.
- **Equal spacing** — mechanical, lifeless intervals.
- **Same sizes** — repeats with no size variety.
- **Parallel contours** — many edges running side by side like rails.
- **Trapped gaps** — small awkward spaces boxed in by shapes.
- **Accidental mergers** — two shapes of the same value fusing into one blob.
- **Bullseye** — rings of shapes around a dead-centre subject.
- **Halved frame** — a strong line cutting the picture into two equal parts.
- **Repeated angles** — every slope at the same tilt.
- **Busy border** — high contrast or detail right at the frame.

---

## Frame 4. Data: what flows through a node graph

*This frame sorts the space by the kind of thing passing along the wires of a node graph, and by the nodes that turn one kind into another. Many "effects" turn out to be a conversion followed by a conversion back.*

### 4.1 Data types

- **Number** — a single value, such as an amount or a size.
- **Count** — a whole number, such as how many copies.
- **Choice** — an on/off switch or a pick from a list.
- **Seed** — a number that fixes randomness.
- **Point or vector** — a position, or a direction with a length, in two dimensions (here "vector" means an arrow, not "vector graphics").
- **Transform** — a bundle of move, turn, scale and slant.
- **Curve** — a mapping from one number to another, drawn as a graph, used for falloffs and response.
- **Colour** — one colour.
- **Colour ramp** — a run of colours laid along a 0-to-1 line, so any number can be turned into a colour.
- **Path** — an open line.
- **Shape** — a closed outline, possibly with holes.
- **Shape set** — many shapes, each carrying its own attributes.
- **Point set** — many points, each carrying attributes such as size, angle and random number.
- **Scalar field** — one number for every spot on the canvas (noise, a gradient, a distance).
- **Vector field** — one arrow for every spot on the canvas (a flow, a push, a wind).
- **Mask** — a scalar field between 0 and 1 used to say how much.
- **Image** — a grid of coloured pixels (a raster).
- **Tile** — one cell of a repeating pattern, with rules for how its edges meet.
- **Stroke description** — a path plus a width profile plus a mark to lay along it.
- **Group tree** — shapes organised into groups within groups.
- **Time** — the current moment, for anything that moves.
- **Swatch** — a packaged piece of graph with a few inputs left open.

### 4.2 Attributes an item can carry

- **Position, rotation, scale** — where it is, how it is turned, how big it is.
- **Id and index** — its name and its place in the order.
- **Normalised index** — its place as a fraction from 0 (first) to 1 (last), handy for gradations.
- **Random** — a stable random number of its own.
- **Parent** — which group or source item it came from.
- **Distance along path** — how far along its guiding path it sits.
- **Distance to edge** — how deep inside its container it sits.
- **Area and size measures** — read from its own outline.
- **Neighbour count** — how many other items are close by.
- **Colour and weight** — its own colour and how strongly it counts.
- **Tag** — a label used for later selection.
- **Custom** — any user-named value.
- **Attribute from field** — a field's value read at the item's position and stored on it.
- **Attribute transfer** — values copied from the nearest items of another set.
- **Level change** — values moved between points, shapes and groups, for example averaging a shape's points to give the shape one value.

### 4.3 Conversions between types

- **Shape to points (outline)** — points spaced along the outline, each knowing its edge direction and curvature.
- **Shape to points (inside)** — points scattered inside the shape.
- **Shape to points (corners)** — the outline's own corner points, or its centroid.
- **Points to shapes (copies)** — a shape copied onto each point (instancing).
- **Points to shape (enclosure)** — a hull or a smooth blob around the points.
- **Points to shapes (cells)** — Voronoi cells or Delaunay triangles.
- **Points to shape (melt)** — soft blobs at each point merged where they meet (metaballs).
- **Points to path** — points joined in order, or by the shortest route, into a line.
- **Path to shape** — the path given width, or closed up.
- **Shape to path** — the outline taken as a line, its skeleton, or a set of offset contours.
- **Shape to scalar field** — a signed distance field: at every spot, the distance to the nearest edge, negative inside and positive outside; this one field gives offsets, soft edges, halos, bands and blends almost for free.
- **Shape to coverage** — 1 inside, 0 outside, optionally softened at the edge.
- **Scalar field to shape** — the outline where the field crosses a level (contouring), or everything above a level (threshold).
- **Scalar field to vector field (slope)** — the direction the field climbs fastest at each spot (its gradient).
- **Scalar field to vector field (swirl)** — the slope turned sideways by a quarter turn (curl), which gives smooth swirling flow with no pile-ups.
- **Vector field to deformation** — each point moved by the arrow at its spot.
- **Vector field to paths** — lines traced by following the arrows (streamlines), which make flowing strokes.
- **Scalar field to points** — points scattered more thickly where the field is high, or placed at its peaks.
- **Points to scalar field** — distance to the nearest point (the cellular look), or a soft blob stamped at each point.
- **Scalar field to colour** — each value looked up on a colour ramp.
- **Colour to scalar field** — lightness, hue or one channel taken out.
- **Image to scalar field** — the picture's lightness as a field.
- **Image to shapes** — tracing outlines from light and dark.
- **Image to points** — dots placed so their density follows the tone (stippling).
- **Shapes to image** — rasterising: shapes turned into pixels.
- **Shape set to scalar field** — how crowded or covered each spot is.
- **Field to mask** — a field remapped, clamped or thresholded into 0 to 1.
- **Number to field** — one value spread everywhere, to feed a field input.
- **Graph to swatch** — a chosen piece of graph folded into one reusable node.
- **Group to flat and back** — a group broken into its pieces, or pieces bundled into a group.

### 4.4 Field sources

- **Constant** — the same value everywhere.
- **Linear, radial and angular gradients** — values rising across the canvas, out from a centre, or around a centre.
- **Smooth noise** — gentle random hills and valleys.
- **Layered noise (fbm)** — several sizes of noise added together, large ones strong and small ones faint, for natural detail.
- **Ridged noise** — noise folded to give sharp creases.
- **Billow noise** — noise folded the other way, for puffy rounded lumps.
- **Cellular noise** — values from the distance to scattered points, giving cells, pebbles and cracks.
- **Cell edges** — only the borders between cells, as thin lines.
- **Wave and stripes** — regular up-and-down patterns.
- **Checker** — alternating squares.
- **Distance from things** — distance to a shape, a path or a point.
- **Image source** — a picture read as values.
- **Painted source** — a field brushed by hand.
- **Looping noise** — noise that joins seamlessly at the edges of a tile or at the end of a loop.
- **Directional noise** — noise stretched one way, for streaks and grain.

### 4.5 Field operators

- **Arithmetic** — add, subtract, multiply, mix, larger of, smaller of, absolute value.
- **Remap** — moving a range of values onto another range.
- **Clamp** — cutting values off at a low and a high limit.
- **Smoothstep** — a soft S-shaped switch from 0 to 1 between two values, the usual way to soften a threshold.
- **Power and bias** — bending the response toward the low or high end.
- **Steps** — snapping values into flat terraces.
- **Repeat** — wrapping values so they cycle, turning a gradient into bands.
- **Invert** — swapping high and low.
- **Blur and sharpen** — softening or crisping the field.
- **Coordinate moves** — the field shifted, scaled, turned, mirrored, repeated or wrapped around a centre before it is read.
- **Domain warp** — the field read at positions pushed by another field.

### 4.6 Vector field sources and operators

- **Uniform direction** — the same arrow everywhere, like steady wind.
- **Radial** — arrows pointing out from, or in to, a centre.
- **Vortex** — arrows circling a centre.
- **Noise arrows** — arrows from two noise fields.
- **Along-edge field** — arrows running parallel to the nearest outline.
- **Away-from-edge field** — arrows pointing straight out of the nearest outline.
- **Hand-combed field** — directions brushed in by hand.
- **Arrow operators** — arrows turned, scaled, set to one length, added together or blended.

### 4.7 Graph mechanics

- **Where values are computed** — per outline point, per item, per pixel or per group; the same node means different things in each.
- **Local or world coordinates** — a field read in canvas space or in each shape's own space.
- **Group node** — several nodes folded into one box.
- **Exposed inputs** — the settings a group node shows on its face.
- **For each item** — a piece of graph run once per item, reading that item's attributes.
- **Repeat loop** — a piece of graph run several times, each run fed the last result, as growth, relaxing and erosion need.
- **Switch** — choosing between two branches by a value.
- **Freeze** — caching a node's output so it stops recalculating.
- **Preview any wire** — showing what flows along any connection.

---

## Frame 5. Scale and reach: how big, and where

*This frame sorts the space by size and by the region an operation touches. The same noise means different things as a paper grain, as an edge wobble and as the layout of a whole picture.*

### 5.1 The scale ladder

- **Grain** — below a single mark: paper tooth, fibres, pigment speckle.
- **Mark** — one stroke, dab, glyph or stamp.
- **Shape** — one closed form with a clear outline.
- **Cluster** — a handful of shapes read as one unit.
- **Mass** — clusters merged into one big light or dark area.
- **Field** — an all-over surface of repeated marks or shapes with no single outline.
- **Layer** — one sheet of the work.
- **Whole picture** — everything inside the frame.
- **Series** — several pictures sharing swatches, palettes and rules.

### 5.2 What each scale is mostly about

- **At grain scale** — texture, tooth, speckle, the sense of a physical surface.
- **At mark scale** — pressure, taper, direction, edge character, the gesture of the hand.
- **At shape scale** — silhouette, edge hierarchy, interior structure.
- **At cluster scale** — grouping, size variety, spacing, stragglers.
- **At mass scale** — value pattern, weight, figure and ground.
- **At field scale** — density, rhythm, flow, evenness versus clumping.
- **At picture scale** — balance, eye path, focus, open space, format.
- **At series scale** — consistency, variation, a recognisable voice.

### 5.3 Moving between scales

- **Nesting** — small shapes grouped inside medium ones grouped inside big ones.
- **Treatment level** — choosing whether a light, outline or colour shift treats each shape, each cluster or the whole mass as one.
- **Relative sizing** — noise, grain and edge bumps sized to the shape they sit on, or to the canvas.
- **Self-similarity** — the same pattern repeating at several sizes (the fractal idea).
- **Detail thinning** — fine detail reduced where things are small or far from the focus.
- **Zoom behaviour** — texture that scales with zoom, or stays the same size on screen.
- **Size ratio** — the proportion of big, medium and small pieces.
- **Size gradient** — sizes shifting smoothly across the picture.

### 5.4 Reach of an operation

- **Inside one shape** — the effect stays within the outline.
- **Edge band** — the effect lives only in a strip along the boundary.
- **Halo** — the effect lives only in a zone just outside the shape.
- **Everywhere but the shape** — the effect wraps around the shape and leaves it untouched.
- **Each shape on its own** — every shape gets its own copy of the effect, read in its own coordinates, so no two match.
- **Per cluster** — one effect shared across a group.
- **Per layer** — one effect across a whole layer.
- **Across chosen layers** — one effect across several layers, which ties them together.
- **Global** — one effect over the whole picture, after everything else.
- **Masked region** — the effect limited by a mask.
- **Frame-relative** — the effect tied to the frame edges or centre, like a vignette.
- **Selected items** — the effect applied only to items chosen by attribute.

### 5.5 Coordinates and order

- **Canvas space** — positions measured on the page.
- **Layer space** — positions measured inside a layer, which may be shifted.
- **Local space** — positions measured inside each shape, from its own bounding box or centre.
- **Along-path space** — one number for distance along a path and one for distance across it, so textures can run along a stroke.
- **Polar space** — angle and distance around a centre.
- **Order matters** — warp then texture stretches the texture with the shape; texture then warp keeps the texture crisp while the outline bends.
- **Before or after merging** — an edge effect applied to each shape, or only to the merged outline of the group.

---

## Frame 6. Medium and material: what it looks made of

*This frame sorts the space by the real-world process a result imitates. Each medium is a bundle of a path, a width profile, an edge, an interior texture, a noise and a distortion, which makes each medium a natural family of swatches.*

### 6.1 Wet brush

- **Round stroke** — pointed start and end, swelling in the middle.
- **Flat stroke** — broad and square-ended, changing width as it turns.
- **Dab** — a short single press.
- **Rigger line** — a long, thin, wandering line.
- **Ink brush stroke** — a bold stroke that runs from wet to dry along its length.
- **Bristle streaks** — many thin lines inside the stroke following its direction.
- **Paint running out** — cover thinning and breaking up toward the stroke's end.
- **Pressure** — width and strength rising and falling along the path.
- **Loaded start** — a heavier blob where the brush first touches.

### 6.2 Dry brush and scumble

- **Dry-brush stroke** — broken, scratchy cover with the paper showing through.
- **Skipping on tooth** — colour catching only on the high points of a textured surface.
- **Scumble** — a loose scrubbed patch of broken colour over another colour.
- **Fan flick** — a spray of fine lines from a spread brush.
- **Rake** — several parallel lines from a split brush.

### 6.3 Palette knife

- **Slab** — a flat, sharp-edged patch of thick paint.
- **Hard leading edge** — one crisp straight side where the blade lifted.
- **Drag streaks** — fine ridges and skips in the direction of travel.
- **Scrape** — paint pulled thin so the layer beneath shows.
- **Ridge highlight** — a thin light line along a raised paint edge.

### 6.4 Stamp and print

- **Hand stamp** — a repeated shape with uneven ink and small differences each time.
- **Ink squash** — a darker rim where ink is pressed to the stamp's edge.
- **Woodcut** — bold carved shapes with grain lines in the flat areas.
- **Linocut** — bold cut shapes with gouge marks.
- **Screen print** — flat colour with slightly soft, filled-in edges.
- **Riso print** — rough flat colour with speckle and grain.
- **Misregistration** — colour layers printed slightly out of line.
- **Worn block** — gaps in the print where the surface did not take ink.

### 6.5 Cut and torn paper

- **Scissor cut** — clean edges, often with slightly straight segments.
- **Knife cut** — perfectly crisp edges with sharp corners.
- **Torn edge** — a fibrous, ragged edge with a pale core showing where the paper split.
- **Deckle** — the soft wavy edge of handmade paper.
- **Stacked paper** — layers casting small soft shadows on those below.
- **Collage** — cut pieces overlapping, each with its own texture.
- **Paper grain** — a faint surface texture in each piece.

### 6.6 Stencil and spray

- **Stencil edge** — a hard edge with a faint halo of overspray.
- **Stencil bridges** — thin gaps that hold a stencil together, left across a shape.
- **Spray falloff** — speckle that thins out away from the centre of the spray.
- **Drip** — paint running down from a heavy spot.
- **Tape edge** — a dead straight edge with a slight lip.
- **Splatter** — random droplets flicked or sprayed.

### 6.7 Ink and wash

- **Wash** — a broad, smooth, transparent area.
- **Blot** — an ink blot with soft spreading edges.
- **Bleed** — colour spreading past its edge into wet paper.
- **Bloom** — wet paint creeping into a drying area, leaving a cauliflower edge.
- **Edge darkening** — pigment gathering at the rim as a wash dries.
- **Granulation** — speckle where pigment settles in the paper's hollows.
- **Wet-in-wet** — colours melting softly into each other.
- **Glaze** — a transparent layer darkening and tinting what is beneath.

### 6.8 Dry media

- **Pencil** — grey strokes with paper tooth showing.
- **Charcoal** — soft, dark, dusty marks that smudge.
- **Pastel** — chalky strokes breaking over the grain.
- **Crayon** — waxy colour catching on the surface.
- **Smudge** — marks softened and dragged by a finger.

### 6.9 Built and crafted surfaces

- **Mosaic** — small tiles with grout lines between them.
- **Stained glass** — flat colour cells with thick dark lines between.
- **Tile** — repeated units with small gaps and slight differences.
- **Stitch** — lines made of short repeated stitches.
- **Weave** — interlaced over-and-under bands.
- **Inlay** — flat shapes fitted edge to edge, each with its own grain.

### 6.10 Machine and screen

- **Halftone** — dots that grow in dark areas, like printed pictures.
- **Dither** — fine two-colour patterns standing in for tone.
- **Pixel** — blocky square cells with limited colour.
- **Clean vector** — perfect edges and flat fills, used for their own sake.
- **Plotter line** — single even lines drawn by machine, often in dense rows.
- **Laser cut** — crisp outlines with thin burnt edges.
- **Glitch** — shifted strips, split colour channels, sorted streaks.

### 6.11 Natural processes as media

- **Erosion** — edges eaten back unevenly, with the softest parts going first.
- **Cracking** — a surface splitting along cell-like lines.
- **Staining** — soft-edged blotches with darker rims.
- **Water mark** — a pale tide line where water dried.
- **Burn** — a darkened, curled edge.
- **Fold and crease** — straight light and dark lines across a surface.
- **Melt and drip** — shapes sagging and running downward.
- **Rust and patina** — speckled, blotchy colour growing from edges and pits.

---

## Primitives that recur across frames

- **Outline** — a closed path; every silhouette, edge treatment, boolean and fill starts here.
- **Path with a width profile** — an open line plus a thickness along it; the root of every stroke, mark and medium.
- **Point set with attributes** — points that carry values; the root of every scatter, repeat, pattern and per-item variation.
- **Scalar field** — a value at every spot; the root of noise, gradients, masks and texture.
- **Vector field** — an arrow at every spot; the root of every warp, flow and directional texture.
- **Distance** — how far a spot is from an edge, path or point; the hidden workhorse behind soft edges, offsets, halos, edge bands, depth fills and smooth blends.
- **Mask** — a field used as "how much"; the root of every inside, outside, edge-band and partial effect.
- **Response curve** — a curve that reshapes a value; the root of falloffs, thresholds and pressure.
- **Colour ramp** — a run of colours addressed by a number; the bridge from any value to colour.
- **Coordinate space** — where a position is measured from (canvas, layer, shape, along a path, around a centre); it decides whether an effect sticks to the shape or to the page.
- **Seed** — the number behind all randomness, so results can be repeated or varied on purpose.
- **Order** — the sequence of operations, which changes the result as much as the operations themselves.
- **Swatch** — a named, reusable bundle of the above with a few open knobs.

### Same idea, seen through each frame

- **Soft edge** — an edge profile (Frame 1), a mask softening (Frame 2), a lost edge (Frame 3), a distance field through a smoothstep (Frame 4), a grain-to-shape decision (Frame 5), a wash or a bleed (Frame 6).
- **Paint stroke** — a spine with a width profile (Frame 1), a stroke plus a warp plus a texture baked to a swatch (Frame 2), a gesture with freshness (Frame 3), a path read in along-path space feeding noise (Frame 4), a mark (Frame 5), a wet or dry brush (Frame 6).
- **Scatter of dots** — shapes with neighbours (Frame 1), a scatter and instance (Frame 2), a rhythm or a field of texture (Frame 3), a point set built from a density field (Frame 4), a cluster or field (Frame 5), stipple or spray (Frame 6).

---

## Where the scene material went

- **Out of scope: scene frame and depth bands (old section 1)** — sky, far, middle and near bands belong to landscape building; only the plain idea of stacked layers survives.
- **Out of scope: subject matter (old sections 2 to 8)** — sky, clouds, weather, terrain, water, vegetation, rocks, buildings, props and creatures are subjects, not shape concepts.
- **Out of scope: atmosphere, sunlight setups, seasons and moods (old section 9)** — tied to depicting a place; the depth cues that work without a scene moved to Frame 3.
- **Out of scope: time-of-day, season and atmospheric colour models (old sections 10.3, 10.8, 10.9)** — scene lighting; colour ramps and harmony ideas stay as primitives but a palette reference is a separate topic.
- **Out of scope: landscape-specific composition (parts of old section 11)** — horizon placements, framing trees, figures for scale and landscape eye paths; the abstract composition ideas moved to Frame 3.
- **Reframed: material shape families (old section 12.3)** — foliage, rock, cloud and water families became shape characters in Frame 3 and media in Frame 6.
- **Reframed: 2D lighting tricks (old section 13)** — scene lighting dropped; shape-level shading, rim and halo moved to interior and neighbour relations in Frame 1.
- **Out of scope: scene structures (old section 16.1)** — ridges, hills, trees, rivers, fences and waterfalls; the general generators behind them (ribbons, rows, growth) moved to Frame 2.
- **Out of scope: plant-specific growth (parts of old section 16.3)** — phototropism, leaf arrangement and roots; branching and space colonisation stay as generators.
- **Out of scope: scene editing tools (parts of old section 17)** — bands, sun and horizon handles, painting tree density; layers, variation and history stay in Frame 2.
- **Out of scope: scene and layer presets (old sections 18 and 19)** — landscape recipes are replaced by swatches.
- **Out of scope: pigment catalogue (old section 20)** — individual paints dropped; mixing ideas such as glazing, scumbling and broken colour moved to Frame 6.
- **Out of scope: scene motion, rigging and export (old sections 23 and 24)** — wind in grass, weather, creatures and skeletons; deformers such as lattice, path bend and pins moved to Frame 2, and time as a data type sits in Frame 4.
- **Kept almost whole** — abstract shapes, modifiers, patterns and grammars (old section 21), noise, distortion nodes, masks and randomness (old sections 16.4 to 16.7), edges and line quality (old sections 12.4, 14), and textures and simulated media (old sections 15.3, 22), spread across all six frames.
