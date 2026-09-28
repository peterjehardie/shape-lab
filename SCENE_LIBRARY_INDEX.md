# Shape Lab Scene Library Index

*This is a non-binding reference list of things a complete scene library could include. It is not a plan, a to-do list or a set of rules.*

**How to read it.** Each entry has a short name and one line saying what it is. Entries marked **(in app)** already exist in Shape Lab in some form (checked against `src/structures.js`, `src/scene.js`, `src/render.js`, `src/graph.js`, `src/library.js` and the canvas tools). The marking is cautious: when something is only roughly there, it is left unmarked or the line says "partly". Everything else is a possible addition.

**A few terms used throughout:**
- **Value**: how light or dark something is, ignoring its colour.
- **Band**: one of the depth slices the scene is built in, from sky at the back to very close foreground at the front.
- **Structure**: the procedural scaffold of a layer (a ridge, a tree, a cluster) that marks the places where shapes go.
- **Vocabulary**: the set of basic shapes (circle, blob, leaf, shard...) used to fill a structure's places.
- **Silhouette**: the outer outline of a thing seen as one flat shape.

---

## 1. Scene frame and depth bands

- **Sky band (in app)**: The backmost band, holding the sky gradient and cloud layers.
- **Distant hills and mountains band (in app)**: The far land, strongly hazed, usually ridges.
- **Middle distance band (in app)**: Hills, tree lines and fields between far and near.
- **Middle foreground band (in app)**: Bushes, rocks and the nearer ground.
- **Close foreground band (in app)**: Full-size trees, big rocks, the main objects.
- **Very close foreground band (in app)**: Grass, flowers and overhanging branches right at the viewer.
- **Several layers per band (in app)**: Any number of layers can share a band, ordered back to front.
- **Depth value per layer (in app)**: Each layer gets a 0 (far) to 1 (near) depth from its band and position.
- **Horizon height (in app)**: Where the horizon sits in the frame.
- **Frame shapes (in app)**: 16:9, 2:1 panorama, 4:3, square and 3:4 portrait.
- **Extra frame shapes**: Tall scroll format, very wide panorama, 5:4, golden rectangle, circular or oval vignette frame.
- **Water layer (in app)**: A layer with a water line that mirrors what is above it, with ripple, wind streaks and glints.
- **Underlay band**: A layer behind everything for paper tone or a coloured ground.
- **Overlay band**: A layer in front of everything for rain, snow, grain or a frame border.
- **Custom band depth ranges**: Letting the user stretch or squeeze how much depth each band covers.
- **Tilted horizon**: A slightly rotated horizon for dynamic or hand-held feeling pictures.
- **Low / high eye level**: Worm's-eye or bird's-eye placement of the horizon, changing how much ground shows.
- **Aerial view band set**: A band arrangement for looking down on land, where depth runs up the page more gently.

## 2. Sky

### 2.1 Sky gradients and sky colour

- **Two-colour sky gradient (in app)**: Top colour blending to a horizon colour.
- **Top darkening (in app)**: The sky gets a little darker toward the top of the frame.
- **Sun glow (in app)**: A soft brighter patch around the sun's position, with adjustable size.
- **Three-stop gradient**: Top, middle and horizon colours for richer skies such as dusk.
- **Horizon glow band**: A thin bright strip just above the horizon line.
- **Earth-shadow band**: The dark blue-grey band just above the horizon opposite a setting sun.
- **Belt of Venus**: The pink band above the earth shadow at twilight.
- **Radial sky**: A gradient centred on the sun rather than running top to bottom.
- **Banded sky**: Flat horizontal stripes of colour, like a screen print.
- **Stepped sky**: The gradient cut into a few flat value steps.
- **Textured sky**: A sky with visible brush or grain texture instead of a smooth blend.
- **Clear blue sky**: Saturated at the top, pale near the horizon.
- **Hazy white sky**: Low contrast, nearly white, typical of humid summer days.
- **Storm sky tint**: Dark slate top with an odd yellow-green horizon.
- **Overcast sky**: Even, flat grey with almost no gradient.
- **Smoky / wildfire sky**: Orange-brown tint with a dim red sun.

### 2.2 Sun, moon and sky bodies

- **Sun direction (in app)**: The on-screen angle light comes from, used for all shading.
- **Sun ahead or behind the viewer (in app)**: Front light (flat) versus backlight (silhouettes and rims).
- **Sun hue and warmth (in app)**: The colour of sunlight and how strongly it tints lit sides.
- **Visible sun disc (in app)**: A drawn sun shape at the light's position.
- **Sun half-set**: The sun partly hidden behind a ridge or the sea.
- **Sun behind cloud**: The sun hidden, with bright cloud edges.
- **Sun flattened near horizon**: A squashed, redder sun low down.
- **Full moon**: A pale disc with optional faint surface marks.
- **Crescent moon**: A thin curved moon shape.
- **Half and gibbous moons**: The in-between phases.
- **Daytime moon**: A faint pale moon in a blue sky.
- **Moon halo**: A soft ring of light around the moon.
- **Moonlight path**: A broken strip of bright reflections on water under the moon.
- **Planets / evening star**: One or two bright points near the horizon at dusk.

### 2.3 Clouds

- **Puffy cloud structure (in app)**: Clouds built from puffs with flat bottoms, shrinking toward the horizon.
- **Far and near cloud layers (in app)**: Separate small far clouds and large near clouds.
- **Cumulus (in app, as a cloud type)**: Fair-weather puffy clouds with flat bases and rounded tops.
- **Towering cumulus**: Tall, bulging cumulus growing upward in summer afternoons.
- **Cumulonimbus**: The huge storm cloud with an anvil-shaped flat top.
- **Anvil top**: The flat spreading top of a storm cloud, drawn on its own.
- **Stratus (in app, as a cloud type)**: A flat, even grey sheet covering the sky.
- **Stratocumulus**: Rows or patches of soft lumpy cloud, often in rolls.
- **Altocumulus**: Many small cloudlets in a mid-level layer, like a flock of sheep.
- **Mackerel sky**: Regular ripples of tiny cloudlets, like fish scales.
- **Altostratus**: A thin grey sheet the sun shows through as a blurred disc.
- **Cirrus (in app, as a cloud type)**: High, thin, wispy streaks, often hooked at the end ("mares' tails").
- **Cirrostratus**: A thin high veil that makes a halo around the sun.
- **Cirrocumulus**: Very small, high, grainy cloudlets.
- **Nimbostratus**: A thick, dark rain-bearing layer with a ragged base.
- **Lenticular cloud**: Smooth lens- or saucer-shaped cloud over mountains.
- **Mammatus**: Pouch-like bulges hanging under a storm cloud.
- **Shelf cloud**: A low wedge-shaped cloud at the front edge of a storm.
- **Cap cloud on a peak**: A cloud sitting on a mountain summit like a hat.
- **Banner cloud**: A cloud streaming sideways off a peak.
- **Cloud streets**: Long parallel lines of cumulus running toward the horizon.
- **Scattered fair-weather cloudlets**: A few small cloud puffs spread across the sky.
- **Wind-torn clouds (scud)**: Ragged low fragments moving fast under a main layer.
- **Virga**: Streaks of rain hanging below a cloud that evaporate before reaching the ground.
- **Contrails**: Straight thin lines left by aircraft.
- **Cloud bank on the horizon**: A low wall of cloud along the far edge.
- **Cloud gaps with blue sky**: Holes in an overcast layer.
- **Silver lining**: Bright rim where the sun is just behind a cloud edge.
- **Cloud shadow side**: Cool dark undersides of clouds away from the sun.
- **Sunset-lit cloud undersides**: Cloud bottoms lit warm orange or pink from below.
- **Stylised spiral clouds**: Decorative curled clouds as in East Asian painting.
- **Flat cartoon clouds**: Simple scalloped outline clouds.

### 2.4 Weather and precipitation

- **Rain streaks**: Thin slanted lines in front of the scene.
- **Distant rain curtain**: A soft grey sheet of rain falling from a far cloud.
- **Drizzle haze**: Rain so fine it just softens and greys the picture.
- **Snowfall**: Scattered white dots or flakes, larger near the viewer.
- **Blizzard**: Dense, wind-driven snow that hides the distance.
- **Hail**: Bouncing white pellets, mostly a foreground effect.
- **Lightning bolt**: A jagged bright branching line.
- **Sheet lightning**: A flash lighting a cloud from inside.
- **Wind**: Bent grass, leaning trees and blown leaves (partly possible now with the node graph and grass lean).
- **Blowing leaves**: Loose leaves carried through the air.
- **Dust storm / sandstorm**: A warm brown haze swallowing the distance.
- **Heat shimmer**: Wavy distortion just above hot ground.
- **Tornado / funnel cloud**: A narrow rotating column under a storm cloud.
- **Waterspout**: A funnel over water.
- **After-rain clearing**: Wet shiny ground, bright gaps and lingering cloud.
- **Frost**: White edges on grass and leaves on a cold morning.
- **Dew sparkle**: Tiny bright points on grass in low sun.

### 2.5 Time of day

- **Dawn / blue hour**: Cool blue light before sunrise, soft and even.
- **Sunrise**: Warm low light from one side, long shadows, mist in hollows.
- **Morning**: Clear, fresh side light a few hours after sunrise.
- **Midday**: High sun, short shadows, strong top light, bleached colours.
- **Afternoon**: Warmer, lower side light.
- **Golden hour (in app, in the default Golden valley scene)**: Very warm, low light that makes everything glow.
- **Sunset**: Sun near the horizon, backlit shapes, coloured sky.
- **Dusk / twilight**: Sun gone, sky still bright, land dark and cool.
- **Night**: Dark land, starry or moonlit sky.
- **Moonlit night**: Cool, low-contrast light from the moon with soft shadows.

### 2.6 Night sky

- **Star field**: Scattered small points, denser and fainter higher up.
- **Bright stars**: A few larger points with short cross-shaped rays.
- **Milky Way band**: A soft, speckled glowing strip across the sky.
- **Constellation hint**: Recognisable star patterns as an easter egg.
- **Shooting star**: A short bright streak.
- **Aurora**: Waving curtains of green and violet light.
- **Light-pollution glow**: A warm dome of light over a distant town.
- **Night clouds lit by moon**: Silver-edged dark clouds.

### 2.7 Sky optical effects

- **Rainbow**: A coloured arc opposite the sun.
- **Double rainbow**: A second, fainter arc with colours reversed.
- **Sun halo**: A thin ring around the sun from high ice cloud.
- **Sun dogs**: Bright spots either side of the sun.
- **Crepuscular rays**: Beams of light fanning from a sun hidden behind clouds.
- **Anticrepuscular rays**: Faint rays converging on the point opposite the sun.
- **Glory / Brocken spectre**: A coloured ring around a shadow cast on mist, seen from a peak.
- **Alpenglow**: Pink-orange light on snowy peaks after sunset.
- **Iridescent cloud edges**: Pastel colours along thin cloud edges near the sun.

### 2.8 Things in the sky

- **Bird flock (V-formation)**: Migrating birds in a V.
- **Loose bird flock (murmuration)**: A swirling cloud of small birds.
- **Single soaring bird**: A hawk or gull silhouette high up.
- **Kites**: Diamond kites on strings.
- **Hot-air balloons**: Round balloons floating over the land.
- **Distant aircraft**: A tiny plane shape with a contrail.
- **Smoke column**: A rising, spreading plume from a chimney or fire.
- **Chimney smoke wisps**: Thin smoke drifting from houses.
- **Blowing seeds / petals**: Dandelion seeds or blossom petals in the air.
- **Insects in light**: Tiny bright specks in a backlit sunbeam.

## 3. Terrain by distance

### 3.1 Mountains and ranges

- **Mountain ridge structure (in app)**: A noise-built ridge line with adjustable height, peaks across, and roughness.
- **Sharp versus soft crests (in app)**: Blend between rounded and knife-edged peaks.
- **Lit and shadow planes (in app)**: The ridge split into faces at each peak and valley so the sun lights one side.
- **Spur lean (in app)**: The lines running down from each peak lean left or right.
- **Surface scatter on ridges (in app)**: Small shapes sprinkled along the ridge for trees or rocks.
- **Stacked ridge layers (in app, via presets)**: Several ridges stepping back in value.
- **Alpine peaks**: Tall, jagged, snow-capped mountains.
- **Single dominant peak**: One large mountain as a focal point, like a volcano or Matterhorn shape.
- **Volcanic cone**: A symmetrical cone with a flat or notched top.
- **Smoking volcano**: A cone with a plume rising from it.
- **Caldera**: A broad, collapsed volcanic ring.
- **Worn old mountains**: Low, rounded, tree-covered ranges.
- **Fold ridges**: Long parallel ridges running across the picture.
- **Saw-tooth range**: A row of evenly spaced sharp peaks.
- **Twin peaks**: Two similar peaks side by side.
- **Karst towers**: Tall, steep, rounded limestone pillars, as in Guilin.
- **Mountain pass / saddle**: A low dip between two peaks.
- **Snow caps (in app)**: White upper parts of peaks with a ragged snow line.
- **Snow gullies**: White streaks running down the dark faces.
- **Rock bands**: Horizontal layered stripes on a mountain face.
- **Forested lower slopes**: Mountains green below and bare above a tree line.
- **Hanging valley**: A high side valley ending in a cliff, often with a waterfall.
- **Glacier-carved U-valley**: A broad valley with steep sides and a flat floor.
- **V-shaped river valley**: Slopes meeting in a sharp V at a stream.
- **Mountain seen through haze**: A pale, flat silhouette with almost no detail.
- **Ridges receding in overlapping wings**: Alternating left and right spurs stepping into the distance.

### 3.2 Hills and rolling ground

- **Rolling hills structure (in app)**: Rounded bumps sitting on a ground plane, with size variety and lumpiness.
- **Hill scatter with clumps (in app)**: Small shape clusters sprinkled over hills for bushes or trees.
- **Downs / chalk hills**: Smooth, grassy, rounded open hills.
- **Drumlins**: Egg-shaped low hills in groups.
- **Knolls**: Single small rounded hills.
- **Hummocky ground**: Many small bumps close together.
- **Steep conical hills**: Isolated steep hills, as in Chinese painting.
- **Terraced hillside**: A hill cut into stepped levels.
- **Hill with a lone tree on top**: A classic focal motif.
- **Patchwork hills**: Hills divided into coloured fields.
- **Moorland**: Broad, bare, gently rolling high ground with heather.
- **Foothills**: Lower hills in front of a mountain range.

### 3.3 Plateaus, cliffs and canyons

- **Mesa (in app, via flat tops on ridges)**: A flat-topped hill with steep sides.
- **Butte**: A smaller, narrower flat-topped hill.
- **Plateau edge**: A long, level top ending in a cliff line.
- **Escarpment**: A long steep slope or cliff running across the view.
- **Sea cliff**: A vertical face dropping into water.
- **Cliff face with ledges**: A vertical wall broken by horizontal ledges.
- **Columnar basalt**: Cliffs made of vertical six-sided columns.
- **Overhang**: A cliff that leans out at the top.
- **Canyon**: A deep, narrow valley with steep layered walls.
- **Slot canyon**: A very narrow, curving gap with light from above.
- **Gorge**: A steep-sided river valley.
- **Layered strata**: Coloured horizontal rock bands on cliffs and canyon walls.
- **Talus apron**: A fan of broken rock at the foot of a cliff.
- **Rock arch**: A natural stone bridge.
- **Hoodoos**: Tall thin rock spires with caps.
- **Stacks and pinnacles**: Isolated rock columns standing alone.

### 3.4 Desert and arid landforms

- **Sand dunes**: Smooth curving ridges with a sharp crest and one steep side.
- **Crescent dunes**: Dunes shaped like a crescent with horns pointing downwind.
- **Star dunes**: Dunes with several arms meeting at a peak.
- **Dune ripples**: Small parallel wave marks on sand.
- **Salt flat**: A perfectly level white plain.
- **Dry lake bed**: Flat ground with cracked mud polygons.
- **Rocky desert (reg)**: Flat ground covered in stones.
- **Badlands**: Eroded, gullied, striped bare hills.
- **Wadi / dry riverbed**: A sandy channel that only floods occasionally.
- **Oasis**: A small pool with palms in the desert.

### 3.5 Ice and snow landforms

- **Glacier tongue**: A river of ice flowing down a valley.
- **Crevasses**: Dark cracks across a glacier's surface.
- **Ice fall**: A jumbled, broken steep part of a glacier.
- **Moraine**: Ridges of rock and gravel left by a glacier.
- **Snowfield**: A smooth white slope.
- **Cornice**: An overhanging lip of snow on a ridge.
- **Snow drifts**: Smooth curved heaps of wind-blown snow.
- **Ice cliff**: A vertical wall of blue-white ice.
- **Icebergs**: Floating blocks of ice, mostly under water.
- **Pack ice**: Broken plates of ice covering the sea.
- **Tundra**: Flat, treeless, low-growing cold plain.

### 3.6 Coastal landforms

- **Beach**: A strip of sand meeting the sea.
- **Pebble beach**: A shore covered in rounded stones.
- **Rocky shore**: Broken rock platforms at the water's edge.
- **Headland**: A high point of land sticking out into the sea.
- **Bay / cove**: A curved inlet of water.
- **Sea stack**: A rock column standing in the sea off a cliff.
- **Spit / sandbar**: A thin tongue of sand reaching into water.
- **Tidal flats**: Wide, wet, shiny mud or sand exposed at low tide.
- **Salt marsh**: Low grassy land cut by winding channels.
- **Fjord**: A long, narrow sea inlet between steep mountains.
- **Island**: A piece of land surrounded by water, near or far.
- **Archipelago**: Many small islands receding into the distance.
- **Coral atoll**: A ring-shaped low island around a lagoon.
- **Sand dunes behind a beach**: Grassy dunes backing the shore.

### 3.7 Ground planes and flat land

- **Ground plane (in app)**: A gently waving flat ground under a band, facing the sky.
- **Ground marks (in app)**: Small shapes sprinkled over a ground plane for texture.
- **Plain / prairie**: A wide flat open land to the horizon.
- **Meadow**: A flat grassy area with flowers.
- **Steppe**: Dry, short-grass open land.
- **Savanna**: Grassland dotted with scattered flat-topped trees.
- **Floodplain**: Flat land along a river with pools and meanders.
- **Valley floor**: The flat bottom between hills.
- **Clearing**: An open patch inside a forest.
- **Gentle slope**: Ground tilting up or down across the frame.
- **Dip / hollow**: A low place in the ground, where mist collects.
- **Embankment / bank**: A short steep rise at the edge of a path or river.

### 3.8 Shaped and farmed land

- **Rice terraces**: Curving stepped paddies following the hill contour, often water-filled.
- **Vineyard rows**: Parallel lines of vines running over hills.
- **Ploughed field**: Brown ground with parallel furrow lines converging toward the horizon.
- **Crop fields patchwork (in app, as field strips)**: Bands of different crop tones that widen toward the viewer.
- **Hay field with bales**: Mown ground with round or square bales.
- **Orchard grid**: Evenly spaced fruit trees in rows.
- **Tea plantation**: Rounded hedge rows following contours.
- **Lavender rows**: Purple parallel stripes.
- **Tulip / flower fields**: Bright bands of colour.
- **Pasture**: Grazed grass with animals and fences.
- **Polder**: Flat, drained land crossed by straight ditches.

## 4. Water

### 4.1 Still water

- **Lake**: A flat body of water filling the valley floor.
- **Mountain tarn**: A small lake high among peaks.
- **Pond**: A small pool, often with reeds.
- **Mirror lake (in app, via the water layer)**: Perfectly still water reflecting everything above.
- **Puddles**: Small reflecting patches on a path or road.
- **Marsh pools**: Scattered shallow water among grass.
- **Reservoir with dam**: A lake held back by a wall.
- **Water line (horizon on water)**: The flat far edge where water meets land or sky.

### 4.2 Moving water

- **River ribbon (in app)**: A river that narrows toward the horizon and winds across bands.
- **Meandering river (in app, via meander)**: Wide S-curves across a flat valley.
- **Braided river**: Many shallow channels splitting and rejoining over gravel.
- **Stream / brook**: A small, lively watercourse with stones.
- **Rapids**: Broken white water over rocks.
- **Waterfall (single drop)**: A vertical fall of water from a ledge.
- **Tiered cascade**: Water falling over several steps.
- **Wide curtain falls**: A broad sheet of falling water.
- **Plunge pool**: The churning pool at the foot of a waterfall.
- **Spray and mist from falls**: A soft white cloud rising from the pool.
- **Canal**: A straight, man-made channel.
- **Estuary**: Where a river widens into the sea.

### 4.3 Sea and coast

- **Calm sea**: A flat surface with faint lines.
- **Open ocean horizon**: A straight line meeting the sky.
- **Choppy sea**: Many small scattered wave shapes.
- **Rolling swell**: Long smooth waves in rows.
- **Breaking wave**: A curling crest with foam.
- **Stylised great wave**: A graphic curling wave with claw-like foam, woodblock style.
- **Surf line**: Rows of white foam lines near the shore.
- **Wave wash on sand**: Thin lacy foam edges on a beach.
- **Waves hitting rocks**: Splash and spray against cliffs.
- **Whitecaps**: Small white flecks across windy water.
- **Tide pools**: Small pools among shore rocks.

### 4.4 Water surface effects

- **Mirror reflection (in app)**: A flipped copy of what is above the water line.
- **Broken reflection (in app, via ripple)**: The flipped copy split into horizontal slivers by ripples.
- **Darker reflection**: Reflections a little darker than the thing reflected.
- **Sky reflection gradient**: Water picking up sky colours, lighter toward the far edge.
- **Glints on water (in app)**: Scattered small bright sparkles on the water surface.
- **Sun glitter path**: A column of bright sparkles under a low sun.
- **Wind streaks on water (in app)**: Lighter or darker bands where wind ruffles the surface.
- **Ripple rings**: Circles spreading from a drop or a fish.
- **Wake**: A V-shaped trail behind a boat or bird.
- **Shoreline edge light**: A thin light line where water meets land.
- **Shallow water see-through**: Stones and bed visible under clear water.
- **Foam lines**: Streaks of foam drifting on moving water.
- **Water lilies on surface**: Round pads breaking the reflection.

### 4.5 Frozen water

- **Frozen lake**: A flat white-blue surface with cracks.
- **Ice edge on a river**: Shelves of ice along the banks.
- **Icicles**: Hanging spikes from rocks and roofs.
- **Frozen waterfall**: A column of icicles and ice.
- **Snow on ice**: Patchy white over darker ice.

## 5. Vegetation

### 5.1 Tree forms (silhouettes)

- **Point-extrusion trees (in app)**: Trees grown from a root point by pushing out and splitting branches.
- **Broadleaf (in app)**: A rounded crown on a branching trunk.
- **Conifer (in app)**: A straight trunk with branch whorls tapering to a point.
- **Poplar (in app)**: A tall, narrow column crown.
- **Shrub form (in app)**: Several stems from the ground with a low crown.
- **Bare branches (in app)**: Branch structure with no foliage.
- **Round / ball crown**: A near-circular crown.
- **Oval upright crown**: Taller than wide, gently rounded.
- **Spreading / umbrella crown**: Wide and flat on top.
- **Weeping crown (in app, as willow)**: Branches hanging down to the ground.
- **Columnar crown**: Very narrow and tall, like cypress.
- **Conical crown**: A cone, wide at the base.
- **Flame-shaped crown**: A pointed, flickering vertical shape.
- **Layered / tiered crown**: Separate horizontal foliage shelves.
- **Irregular / windswept crown**: Bent to one side by prevailing wind.
- **Multi-trunk tree**: Several trunks rising from one base.
- **Leaning tree (in app, via lean)**: A trunk tilted at an angle.
- **Twisted tree**: A trunk with strong curves, like old olive or juniper.
- **Pollarded tree**: A cut-back trunk with a knob of thin shoots at the top.
- **Topiary**: Clipped geometric tree shapes.
- **Sapling**: A thin young tree with few branches.
- **Stump**: A cut-off trunk base.
- **Fallen log**: A tree lying on the ground.
- **Snag / dead tree**: A standing dead trunk with broken branches.
- **Lightning-struck tree**: A split, blackened trunk.

### 5.2 Tree species (stylised)

- **Oak**: Broad, gnarled, wide crown with clumpy foliage.
- **Beech**: Smooth trunk, dense rounded crown.
- **Maple**: Round crown, bright red or orange in autumn.
- **Birch**: Thin white trunks with dark marks and light airy foliage.
- **Aspen**: Slender pale trunks in groups with small trembling leaves.
- **Willow (weeping) (in app)**: Long hanging curtains of thin leaves, near water.
- **Elm**: Vase-shaped, branching upward then arching out.
- **Ash**: Open airy crown with long leaflets.
- **Chestnut**: Big domed crown with large leaves.
- **Plane / sycamore**: Patchy bark and big spreading crown.
- **Lime / linden**: Tall, dense, tidy dome.
- **Fruit tree**: Small, low, rounded tree, often with blossom or fruit.
- **Cherry blossom**: Spreading tree covered in pink-white flowers.
- **Olive**: Twisted grey trunk and silvery, open foliage.
- **Pine (Scots)**: Tall bare trunk with a flat-topped clumpy crown.
- **Umbrella pine (stone pine)**: A flat, wide canopy on a tall trunk, Mediterranean.
- **Spruce**: Dense, narrow, dark cone with drooping branches.
- **Fir**: Neat symmetrical cone with upswept branches.
- **Cedar**: Wide horizontal flat layers of foliage.
- **Larch**: Soft conifer that turns golden in autumn.
- **Cypress**: Tall dark narrow column, Tuscan style.
- **Juniper**: Low, twisted, shrubby conifer.
- **Redwood / sequoia**: Huge straight trunks, crown high above.
- **Japanese black pine**: Cloud-like pads of needles on twisting branches, bonsai-like.
- **Bonsai-like tree**: A small, sculpted, asymmetrical tree with pad-shaped foliage.
- **Palm (in app)**: Tall curved trunk with a burst of long fronds.
- **Fan palm**: Straight trunk with round fan-shaped leaves.
- **Date palm**: Straight trunk with a stiff crown, desert oasis.
- **Baobab**: Massive swollen trunk with short stubby branches.
- **Acacia (umbrella thorn)**: Flat-topped savanna tree.
- **Banyan / fig**: Wide tree with hanging aerial roots.
- **Mangrove**: Trees standing on arching roots over water.
- **Eucalyptus**: Pale peeling trunk, loose hanging leaves.
- **Joshua tree**: Spiky, branching desert tree.
- **Dragon tree**: Umbrella of spiky leaves on thick branches.
- **Bamboo**: Tall thin jointed stems with feathery leaf sprays.
- **Tree fern**: A trunk topped with a spray of fern fronds.

### 5.3 Tree parts and details

- **Trunk colour and value (in app)**: Separate colour and value shift for trunks and branches.
- **Foliage clumps (in app)**: Groups of shapes at branch tips.
- **Foliage on inner branches (in app)**: Some clumps placed along the tree, not only at tips.
- **Visible roots**: Root flares spreading at the trunk base.
- **Exposed roots over rocks**: Roots gripping stones on a bank.
- **Sky holes**: Gaps in a crown where sky shows through.
- **Branch peeks**: Bits of branch visible between foliage clumps.
- **Bark texture marks**: Simple lines or patches on trunks.
- **Knots and hollows**: Dark spots on old trunks.
- **Ivy on trunk**: Climbing leafy cover on the trunk.
- **Lichen patches**: Pale green-grey patches on bark.
- **Fruit and blossom dots**: Small accent-coloured shapes in the crown.
- **Cones**: Small hanging cones on conifers.
- **Snow on branches**: White caps on top of foliage clumps.
- **Autumn leaf fall**: Leaves dropping and piling under a tree.
- **Tree shadow on ground**: A flat dark shape cast by the tree.

### 5.4 Forest masses and groups

- **Tree line (in app, as a trees layer)**: A row of many small trees along a hill base.
- **Tree line on a ridge**: Trees silhouetted along a hilltop.
- **Forest edge**: A wall of trees seen from open land.
- **Forest mass (distant)**: A single textured shape for a far forest.
- **Pine forest**: Many overlapping conifer points.
- **Broadleaf woodland**: Overlapping rounded crowns.
- **Mixed forest**: Conifers and broadleaves together.
- **Birch grove**: Many white trunks close together.
- **Copse / spinney**: A small cluster of trees in a field.
- **Lone tree**: A single tree as a focal point.
- **Pair of trees**: Two trees placed with contrasting sizes.
- **Avenue of trees**: Two rows lining a road, shrinking into the distance.
- **Windbreak row**: A straight line of tall trees along a field edge.
- **Riverside trees**: Trees following a river's curve.
- **Forest interior**: Trunks in rows receding into shade with light gaps.
- **Canopy seen from inside**: Leaves overhead with sky gaps.
- **Jungle / rainforest mass**: Dense layered tropical growth.
- **Burnt forest**: Black bare trunks on grey ground.
- **Treeline at altitude**: Trees thinning out up a mountain slope.
- **Hillside dotted with trees**: Scattered trees across a slope.

### 5.5 Shrubs and hedges

- **Bush clusters (in app)**: Groups of shapes forming bushes in a band.
- **Round bush**: A simple dome.
- **Spreading shrub**: Low and wide.
- **Hedge (clipped)**: A long, flat-topped, straight-sided band.
- **Hedgerow (in app, along field edges)**: An untidy line of shrubs and small trees between fields.
- **Bramble thicket**: A tangled mass with thorny stems.
- **Heather / gorse clumps**: Low flowering shrubs on moorland.
- **Boxwood balls**: Small clipped spheres in gardens.
- **Rhododendron / azalea**: Large flowering shrubs.
- **Rose bush**: A shrub with scattered flower accents.
- **Sagebrush / desert scrub**: Grey-green low round bushes, spaced out.
- **Tumbleweed**: A loose round ball of dry stems.
- **Mountain pine / krummholz**: Stunted, wind-shaped shrubs near the tree line.

### 5.6 Grasses and ground cover

- **Grass tufts (in app)**: Fans of curved tapering blades with wind lean and curl.
- **Grass flowers (in app)**: Accent-coloured dots on some blade tips.
- **Tall meadow grass**: Long grass with seed heads.
- **Short lawn**: Even, low green texture.
- **Dry golden grass**: Late-summer straw-coloured grass.
- **Pampas grass**: Big plumes on tall stems.
- **Wheat-like seed heads**: Grass with heavy drooping heads.
- **Grass edge along a path**: Grass leaning over a path border.
- **Grass silhouette against sky**: Backlit blades seen from ground level.
- **Tussock grass**: Rounded mounds of coarse grass.
- **Clover / low ground cover**: Small rounded leaves close to the ground.
- **Leaf litter**: Scattered fallen leaves on the ground.
- **Pine needle carpet**: Reddish-brown flat ground under conifers.
- **Fallen twigs and branches**: Small sticks on the forest floor.
- **Seedlings / sprouts**: Tiny new plants.

### 5.7 Wetland and water plants

- **Reeds**: Tall straight stems at water's edge.
- **Bulrushes / cattails**: Reeds with brown sausage-shaped heads.
- **Water lilies**: Round floating leaves and cup flowers.
- **Lotus**: Large raised leaves and big flowers.
- **Sedges**: Grass-like clumps in wet ground.
- **Irises**: Sword leaves with bright flowers by water.
- **Duckweed**: A green film on still water.
- **Marsh grass**: Low clumps in shallow water.

### 5.8 Flowers

- **Scattered wildflowers**: Small dots of colour through grass.
- **Poppies**: Red cups on thin stems.
- **Daisies**: White petals with yellow centres.
- **Dandelions and seed clocks**: Yellow flowers and white round seed heads.
- **Buttercups**: Small yellow scattered flowers.
- **Lupines**: Tall coloured spikes.
- **Foxgloves**: Tall spikes with hanging bells.
- **Sunflowers**: Tall stems with big yellow heads.
- **Bluebell carpet**: A blue haze of flowers under trees.
- **Alpine flowers**: Tiny bright flowers among rocks.
- **Flower meadow mass**: Drifts of colour rather than single flowers.
- **Blossom petals on ground**: Pink-white scatter under trees.
- **Climbing roses**: Flowers along a wall or fence.

### 5.9 Ferns, vines, moss and fungi

- **Ferns**: Arching fronds with many small leaflets.
- **Bracken**: A brown-green mass of ferns on hillsides.
- **Ivy**: Leaves climbing walls and trunks.
- **Hanging vines / lianas**: Ropes of plant hanging from trees.
- **Creepers on walls**: Leafy cover spreading across stone.
- **Moss cushions**: Soft rounded green patches on rocks and logs.
- **Moss on the shadow side**: Moss placed where light does not fall.
- **Lichen on rocks**: Pale crusty spots.
- **Mushrooms**: Small cap shapes at tree bases.
- **Bracket fungi**: Shelf shapes on trunks.

### 5.10 Desert and tropical plants

- **Saguaro cactus**: Tall column cactus with upturned arms.
- **Prickly pear**: Stacked flat oval pads.
- **Barrel cactus**: Short round ribbed cactus.
- **Agave**: A rosette of thick pointed leaves.
- **Yucca**: A spiky ball of leaves on a short stem.
- **Aloe**: A low cluster of fleshy spikes.
- **Banana plant**: Large torn leaves on a thick stem.
- **Monstera / big-leaf plants**: Huge split leaves in jungle foregrounds.
- **Tropical undergrowth**: Dense large-leaved plants at forest floor level.

### 5.11 Crops

- **Wheat field**: Golden, fine-textured waving mass.
- **Corn / maize rows**: Tall green stalks in rows.
- **Rice paddies (flooded)**: Reflecting water with rows of young shoots.
- **Sunflower field**: Rows of big yellow heads all facing one way.
- **Vineyard**: Rows of vines on posts.
- **Hay stooks**: Small bundles of cut grain standing in a field.
- **Haystack**: A rounded mound of hay.
- **Pumpkin patch**: Orange round shapes on a leafy ground.

### 5.12 Seasonal states of vegetation

- **Spring green**: Fresh, light, yellow-green foliage and blossom.
- **Summer green**: Deep, full, darker greens.
- **Autumn colours**: Reds, oranges and yellows, mixed with evergreens.
- **Late autumn**: Half-bare trees and fallen leaf carpets.
- **Winter bare**: Leafless trees showing branch structure.
- **Snow-laden**: Evergreens holding snow on every branch layer.
- **Drought**: Brown grass, dusty foliage.
- **Rain-wet**: Darker, shinier leaves and ground.

## 6. Rocks and ground

### 6.1 Rocks

- **Rock clusters (in app)**: Hard-edged shape groups used as rocks in the default scene.
- **Boulder**: A single large rounded rock.
- **Boulder field**: Many large rocks scattered across ground.
- **Rock outcrop**: A mass of bedrock breaking through the ground.
- **Tor**: A stack of weathered blocks on a hilltop.
- **Stacked / balanced rocks**: Rocks piled or resting on each other.
- **Flat slab rocks**: Angular rocks with flat tops.
- **Layered sedimentary rock**: Rocks with horizontal stripes.
- **Granite domes**: Smooth, rounded bare rock hills.
- **Scree / talus**: Slopes of small loose broken rock below cliffs.
- **Pebbles**: Small rounded stones.
- **Gravel**: Very small stones as a texture.
- **River stones**: Smooth rounded stones in and by a stream.
- **Stepping stones**: A line of flat stones across water.
- **Split rock**: A boulder with a crack through it.
- **Rock with moss / snow cap**: A rock with a soft cover on its top.
- **Half-buried rocks**: Rocks sitting in grass with only tops showing.
- **Glacial erratic**: A lone big boulder on open ground.

### 6.2 Ground surfaces

- **Grass ground (in app, via ground plane colour)**: A plain coloured ground under the band.
- **Bare soil**: Brown ground with small clods.
- **Mud**: Dark, wet, shiny ground with ruts.
- **Sand**: Pale, smooth ground with ripple marks.
- **Cracked earth**: Dry ground split into polygons.
- **Rocky ground**: Earth mixed with stones.
- **Forest floor**: Dark ground with leaves, twigs and moss.
- **Snow ground**: White, smooth, softly shaded ground.
- **Patchy snow**: Snow melting into grass or soil patches.
- **Ash ground**: Grey volcanic or burnt ground.
- **Stone paving**: Flat laid stones.
- **Cobbles**: Rounded stones set in a road.

### 6.3 Paths and tracks

- **Footpath (in app, as the road / path ribbon)**: A thin winding path that narrows into the distance.
- **Dirt track with ruts**: Two parallel wheel lines with grass between.
- **Stone steps**: Steps up a slope.
- **Boardwalk**: A wooden path over wet ground.
- **Stepping-stone path**: Flat stones through grass or water.
- **Animal trail**: A faint line through grass.
- **Switchback trail**: A zig-zag path up a steep slope.
- **Footprints in snow or sand**: A line of small marks.

### 6.4 Snow and ice on the ground

- **Snow blanket**: Smooth white cover rounding off shapes.
- **Snow shadows**: Blue-violet shadows on snow.
- **Snow sparkle**: Tiny highlights on snow in sun.
- **Snow on rocks and fence tops**: White caps on the upper edges of objects.
- **Wind-carved snow**: Ripples and sharp ridges in snow.
- **Melt patches**: Dark wet ground around trunks and rocks.

## 7. Human-made elements (stylised)

### 7.1 Boundaries

- **Wooden fence (in app, as the fence on a fields layer and the Fence line layer preset)**: Posts with horizontal rails, shrinking with distance.
- **Picket fence**: Rows of pointed upright slats.
- **Wire fence**: Thin posts with faint lines.
- **Broken / leaning fence**: Posts at odd angles, some missing.
- **Dry stone wall**: A low wall of stacked irregular stones.
- **Stone wall across hills**: Walls following the land, dividing fields.
- **Brick wall**: A regular wall with brick pattern.
- **Gate**: A swinging gate in a fence or wall.
- **Stile**: Steps over a fence.
- **Hedge boundaries**: Fields divided by hedges.

### 7.2 Roads, bridges and crossings

- **Country road (in app, as the road ribbon)**: A road narrowing toward the horizon.
- **Winding mountain road**: A road curving along a slope.
- **Railway line**: Two converging rails with sleepers.
- **Telegraph line along a road**: Poles with drooping wires in rhythm.
- **Stone arch bridge**: A curved stone bridge with its reflection forming a circle.
- **Wooden footbridge**: A simple plank bridge over a stream.
- **Rope / suspension bridge**: A sagging bridge across a gorge.
- **Viaduct**: A long row of arches crossing a valley.
- **Japanese arched bridge**: A steep, red, curved bridge.
- **Ford**: A shallow place where a path crosses water.

### 7.3 Buildings

- **Cottage**: A small house with a pitched roof and chimney.
- **Farmhouse**: A larger house with outbuildings.
- **Barn**: A big shed with a large door, often red.
- **Log cabin**: A wooden house in the woods.
- **Alpine chalet**: A wide-roofed wooden house with balconies.
- **Village cluster**: A group of small houses around a church spire.
- **Church / chapel**: A building with a tower or spire.
- **Castle on a hill**: Towers and walls as a distant focal point.
- **Lighthouse**: A tall striped tower on a headland.
- **Temple / pagoda**: Stacked roofs with curved eaves.
- **Torii gate**: A red gate of two posts and two crossbeams.
- **Mountain hut**: A small shelter high on a slope.
- **Distant town skyline**: Small blocks and towers along the horizon.
- **Windows lit at night**: Warm dots in dark buildings.
- **Houses on stilts**: Buildings raised over water.
- **Tent / campsite**: A tent with a small fire.

### 7.4 Farm and rural structures

- **Windmill (traditional)**: A tower with four large sails.
- **Wind pump**: A metal tower with a many-bladed wheel.
- **Water wheel**: A wheel beside a mill on a stream.
- **Silo**: A tall round storage tower.
- **Grain elevator**: A tall blocky structure on flat land.
- **Hay barn**: An open-sided roofed shed with hay.
- **Scarecrow**: A cross-shaped figure in a field.
- **Beehives**: Small boxes in a row.
- **Well**: A round wall with a small roof.
- **Greenhouse**: A glassy, lit-through structure.
- **Water trough**: A low container for animals.

### 7.5 Utility and infrastructure

- **Power / telegraph poles**: Upright poles with sagging lines between them.
- **Pylons**: Steel lattice towers carrying cables across hills.
- **Wind turbines**: Tall white towers with three blades.
- **Dam wall**: A curved concrete wall holding back a lake.
- **Tunnel mouth**: A dark arch into a hillside.
- **Signpost**: A post with pointing boards.
- **Mile marker / cairn**: A stone pillar or pile marking a path.
- **Street lamp**: A post with a light, useful at night.

### 7.6 Boats and water structures

- **Rowing boat**: A small wooden boat, beached or on water.
- **Sailboat**: A boat with a triangular sail.
- **Fishing boat**: A small working boat with a cabin.
- **Junk / sampan**: Asian-style boats with ribbed sails or canopies.
- **Canoe**: A long narrow boat.
- **Jetty / pier**: A wooden walkway into water on posts.
- **Dock posts**: A row of posts standing in water.
- **Moored boats**: Several boats with reflections at rest.
- **Buoy**: A small floating marker.
- **Harbour wall**: A stone wall protecting boats.

### 7.7 Small props

- **Bench**: A seat facing a view.
- **Mailbox**: A small box on a post by a road.
- **Cart / wagon**: A wooden cart in a field.
- **Wheelbarrow**: A small garden cart.
- **Stack of logs**: Cut wood piled by a house.
- **Campfire**: Small flames with rising smoke.
- **Lantern**: A small glowing light.
- **Flag / banner**: Cloth on a pole showing wind direction.
- **Washing line**: Clothes on a line blowing in wind.
- **Stone lantern**: A carved garden lantern.

### 7.8 Ruins and monuments

- **Ruined wall**: Broken stone walls with plants growing over them.
- **Ruined tower**: A broken tower on a hill.
- **Standing stones**: Upright stones in a circle or row.
- **Stone arch ruin**: A single standing arch.
- **Aqueduct ruin**: A broken row of high arches.
- **Wayside shrine / cross**: A small religious marker by a path.
- **Stupa / chorten**: A domed shrine on a mountain pass.
- **Prayer flags**: Strings of small coloured flags between poles.

## 8. Fauna silhouettes

### 8.1 Birds

- **Flying gulls**: Simple M-shaped silhouettes.
- **Crows / rooks**: Dark birds in trees or fields.
- **Swallows**: Fast forked-tail shapes low over fields.
- **Geese in flight**: Long necks in a V.
- **Herons / egrets**: Tall wading birds in shallows.
- **Ducks and swans**: Floating birds with reflections.
- **Eagle / hawk soaring**: Broad wings with spread tips.
- **Owl on a branch**: A round silhouette at night.
- **Songbirds on a wire**: Small dots along a line.
- **Cranes**: Tall birds, a classic East Asian motif.
- **Flamingos**: Pink wading birds in groups.

### 8.2 Mammals

- **Deer**: Grazing or alert, at a forest edge.
- **Stag**: A deer with large antlers on a ridge.
- **Grazing cows**: Blocky shapes in pasture.
- **Sheep**: Round light dots scattered on a hillside.
- **Horses**: Standing or running silhouettes.
- **Goats on rocks**: Sure-footed shapes on cliffs.
- **Mountain ibex / bighorn**: Curved-horn animals on ledges.
- **Bears**: Heavy shapes near rivers.
- **Wolves / foxes**: Low slim shapes at the edge of trees.
- **Rabbits / hares**: Small shapes in grass.
- **Camels**: Humped shapes crossing dunes.
- **Elephants / giraffes**: Savanna silhouettes.
- **Moose / elk**: Big-shouldered animals in wetlands.
- **Dog**: A companion shape on a path.

### 8.3 Water and small creatures

- **Jumping fish**: A splash and a curved shape.
- **Whale tail / spout**: A far-off sea marker.
- **Dolphins**: Arcing backs in waves.
- **Seals on rocks**: Rounded shapes on shore stones.
- **Frogs**: On lily pads.
- **Butterflies**: Small colourful accents over flowers.
- **Dragonflies**: Thin shapes over water.
- **Fireflies**: Tiny glowing dots at dusk.

### 8.4 People (tiny figures)

- **Staffage figures**: Very small people added to show scale (a traditional landscape device).
- **Walker with stick**: A lone figure on a path.
- **Figure on a summit**: A tiny person on a peak for scale.
- **Fisher in a boat**: A seated figure with a rod.
- **Farm workers**: Bent figures in a field.
- **Figure with umbrella**: A rain-scene figure.
- **Rider on horseback**: A figure on a road.
- **Couple on a bench**: Two figures looking at the view.
- **Children playing**: Small active figures in a meadow.

## 9. Atmosphere and light

### 9.1 Atmospheric depth

- **Atmospheric haze (in app)**: Far layers lose their colour toward a haze colour.
- **Haze colour (in app)**: The colour that distant things fade toward.
- **Haze falloff (in app)**: How quickly haze builds up with distance.
- **Per-layer haze amount (in app)**: Each layer can take more or less haze.
- **Value steps with distance (in app, via value groups)**: Far things lighter, near things darker.
- **Colour temperature shift with distance (in app, via near colour tint and haze)**: Near warm, far cool.
- **Contrast fading with distance**: Lights and darks come closer together far away.
- **Detail fading with distance**: Fewer, smaller shapes and softer edges far away.
- **Edge softening with distance (in app, via depth blur)**: Outlines get softer the farther away they are.
- **Reverse haze (dark distance)**: Stormy scenes where the far land is darker than near.

### 9.2 Fog and mist

- **Fog bank**: A dense wall of fog hiding part of the scene.
- **Ground fog**: A thin layer of fog lying flat along the ground.
- **Valley mist**: Mist filling low places between hills while tops stay clear.
- **Mist between ridges (in app, partly via Misty ridges preset)**: Each ridge fading at its base into the next.
- **Fog layers per band**: Separate fog amounts for each depth band.
- **Rising mist off water**: Wisps lifting from a lake at dawn.
- **Low cloud through trees**: Cloud drifting among tree trunks on a slope.
- **Sea fret**: Coastal fog rolling in from the sea.
- **Base fade of masses (in app)**: Ridge and hill bases fade softly into what is below.

### 9.3 Sunlight setups

- **Side light (in app)**: Light from the left or right showing form clearly.
- **Backlight (in app)**: Sun ahead of the viewer, shapes go dark with bright rims.
- **Front light (in app)**: Sun behind the viewer, flat and bright.
- **Top light**: Midday sun from overhead.
- **Rim / contre-jour**: Strong backlight where edges glow (contre-jour means "against the day").
- **Spotlit scene**: One area in sun while the rest is in cloud shadow.
- **Overcast / diffuse light**: No direction, very soft shadows, even values.
- **Storm light**: Bright sunlit foreground against a dark sky.
- **Low raking light**: Very low sun catching every bump.
- **Twilight light**: Light only from the sky, no direct sun.
- **Moonlight**: Weak, cool, low-contrast directional light.
- **Firelight / lamplight**: Small warm local light sources at night.

### 9.4 Light effects

- **Light shafts / god rays (in app)**: Visible beams of light through gaps in cloud or trees.
- **Dappled light (in app, as light/shadow patches)**: Patches of light and shade from a noise field.
- **Cloud shadows on hills (in app, via dappled patches)**: Big dark patches drifting over the land.
- **Sunlit patch focal point**: One bright area of land in a mostly shaded scene.
- **Leaf translucency (in app, as backlit glow)**: Backlit leaves glowing warm instead of going dark.
- **Glow around bright shapes**: A soft halo bleeding over nearby dark edges.
- **Lens flare**: A camera-style streak or ring of spots (use sparingly).
- **Specular glints (partly: water glints only)**: Tiny sharp highlights on water, wet rocks, snow.
- **Bounce light**: Light reflected from bright ground lifting shadow undersides.
- **Sky light on top planes**: Upward-facing surfaces picking up sky colour.
- **Warm light / cool shadow (in app)**: Light and shadow tinted with separate hues.
- **Light strength (in app)**: How far lit and shadow sides differ.

### 9.5 Shadows

- **Shadow clones (in app)**: A dark copy of a shape nudged away from the light as a fake cast shadow.
- **Cast shadows on ground (in app, as cast clone mode)**: Shadows squashed flat along the ground in the sun direction.
- **Long evening shadows**: Very stretched shadows across fields.
- **Contact shadows (in app)**: Dark lines where objects meet the ground.
- **Cloud shadow bands**: Stripes of shadow across a plain.
- **Mountain shadow on mountain**: One peak shading the next.
- **Tree shadow pools**: Round dark pools under trees at midday.
- **Shadow colour (in app)**: Hue and strength of the tint in shadows.

### 9.6 Seasons

- **Spring**: Fresh greens, blossom, light haze, puddles.
- **Early summer**: Full greens, flower meadows, cumulus.
- **High summer**: Bleached light, heat haze, dry grass.
- **Early autumn**: First colour turning, mist mornings.
- **Peak autumn**: Full reds and golds.
- **Late autumn**: Bare branches, leaf litter, grey skies.
- **Early winter**: Frost, first snow on peaks.
- **Deep winter**: Snow cover, blue shadows, low sun.
- **Thaw**: Patchy snow, running water, brown grass.
- **Wet season / monsoon**: Heavy cloud, deep green, flooded fields.
- **Dry season**: Dust, yellow grass, pale sky.

### 9.7 Moods

- **Calm / serene**: Horizontal lines, soft values, still water.
- **Dramatic**: Strong contrast, diagonal lines, storm light.
- **Mysterious**: Fog, hidden forms, low contrast.
- **Lonely**: One small subject in a large empty space.
- **Cosy**: Warm lights, small house, snow outside.
- **Epic**: Huge mountains, tiny figures, wide format.
- **Melancholy**: Grey, muted, bare trees, rain.
- **Cheerful**: Saturated colours, cumulus, bright flowers.
- **Eerie**: Odd colours, dead trees, still mist.
- **Dreamy**: Soft edges, pastel palette, glow.

## 10. Value and colour

### 10.1 Value structures

- **Value groups (in app)**: A handful of lightness bands that every layer belongs to.
- **Value nudge per layer (in app)**: Small push lighter or darker inside a group.
- **Default four-group layout (in app)**: Sky, far, middle, near.
- **Three-value layout (in app, via Graphic poster preset)**: Light, mid, dark.
- **Five-value ridge study (in app, via Misty ridges preset)**: Many close steps for atmospheric depth.
- **Light sky, dark ground**: The most common outdoor value order.
- **Dark sky, light ground**: Storm light or snow scenes.
- **Light foreground, dark middle**: Sunlit meadow against a shaded forest.
- **Dark frame, light centre**: Dark near elements around a bright view (see framing).
- **High key**: Mostly light values, e.g. snow or fog.
- **Low key**: Mostly dark values, e.g. night or deep forest.
- **Full range**: From near-white to near-black with a clear focal contrast.
- **Middle key**: Mostly mid values with small accents at both ends.
- **Suggested grouping (partly: the app warns when groups overlap and can space them evenly)**: The app measures layers and proposes value groups.

### 10.2 Colour schemes

- **Colour sets hue only (in app)**: Layer colour picks the hue; value groups set lightness.
- **Colour strength (in app)**: Per-layer saturation ("chroma", meaning how intense a colour is).
- **Accent colour (in app, for grass flowers)**: A separate small-dose colour.
- **Value and hue variety (in app)**: Small random value and hue shifts per shape, cluster or object so repeats do not look stamped.
- **Analogous**: Neighbouring hues only, e.g. greens, blues and teals.
- **Complementary**: Two opposite hues, e.g. orange light and blue shadow.
- **Split complementary**: One hue plus the two neighbours of its opposite.
- **Triad**: Three evenly spaced hues, one dominant.
- **Monochrome**: One hue in many values.
- **Limited palette**: Three or four paints' worth of colours only.
- **Warm near, cool far (in app, via near tint and haze)**: Temperature used to push depth.
- **Colour groups (partly, via near tint and haze)**: Like value groups but for hue families.
- **Grey world with one colour accent**: Muted scene with a single saturated spot.
- **Duotone**: Two inks only, like a print.
- **Sepia / old photo**: Brown monochrome.
- **Night blue scheme**: Everything shifted to blue with warm lit windows.

### 10.3 Palettes by time and season

- **Dawn pastel**: Pink, lavender, pale gold.
- **Clear morning**: Fresh blue, yellow-green, cream.
- **Midday bleach**: Pale sky, strong greens, black shadows.
- **Golden hour**: Amber, orange, warm greens, violet shadows.
- **Sunset fire**: Red, orange, magenta, deep purple land.
- **Dusk**: Deep blue, teal, one warm band at the horizon.
- **Moonlight**: Blue-grey, silver, black.
- **Spring**: Yellow-green, pink, sky blue.
- **Summer**: Deep green, blue, white clouds.
- **Autumn**: Ochre, rust, crimson, olive.
- **Winter**: White, blue-violet, grey-brown, dark green.
- **Desert**: Sand, terracotta, pale turquoise sky.
- **Tropical**: Turquoise, emerald, white sand.
- **Storm**: Slate, sickly yellow-green, dark olive.
- **Misty**: Grey-blues and grey-greens close in value.

### 10.4 Colour wheels and harmony schemes

*A colour harmony is a rule for picking hues that sit well together, usually described by their positions on a colour wheel.*

- **Painter's wheel (RYB)**: The traditional red, yellow, blue wheel that matches how paints behave roughly.
- **Light wheel (RGB / CMY)**: The screen and printing wheel, where complements are different (blue opposite yellow, not orange).
- **Perceptual wheel**: A wheel built in a perceptual space so equal steps look equally different.
- **Tetrad (rectangle)**: Two pairs of complements, e.g. yellow-orange, blue-violet, red-violet, yellow-green.
- **Square tetrad**: Four hues evenly spaced around the wheel; needs one clear leader.
- **Near-complementary**: A hue with a neighbour of its opposite, softer than a true complement.
- **Double split complementary**: Two neighbours on each side of a complementary pair.
- **Analogous plus complementary accent**: A run of neighbouring hues with one small opposite spot.
- **Dominant hue with minor hues**: One hue family covers most of the picture; others appear in small doses.
- **Achromatic with accent**: Greys everywhere and one coloured focal spot.
- **Discord / clash**: Deliberately uneasy pairs (e.g. a light hue made darker than its partner) for tension.
- **Natural order of value**: Keeping yellows light and violets dark, as they are in pure pigments.
- **Reversed order of value**: Dark yellows and light violets for strange or moody scenes.
- **Hue shifting ramps**: Moving hue as well as value along a shading ramp (e.g. warmer in light, cooler in shadow), common in pixel art.
- **Hue rotation by depth**: Hues rotate gradually from near to far bands.
- **Colour proportion 60/30/10**: One colour covers most area, a second supports, a third accents.

### 10.5 Gamut masking and limited ranges

*A gamut is the full range of colours available; a gamut mask is a shape drawn on the colour wheel, and only colours inside it are used.*

- **Gamut mask**: Draw a shape on the wheel and restrict the palette to colours inside it.
- **Triangle mask**: Three corners give a primary-like set, with mixes between them.
- **Offset triangle mask**: A triangle placed off-centre, dominated by one hue.
- **Narrow wedge mask**: A slim slice around one hue family, for near-monochrome scenes.
- **Two-lobe mask**: Two separate islands for a complementary palette.
- **Low-chroma circle mask**: A small circle near the centre, for muted, grey-rich palettes.
- **Mask rotation**: Turning the same mask to a new hue for a different mood.
- **Gamut from pigments**: The colours that a chosen set of paints can actually mix.
- **Gamut clipping**: Colours outside what a screen can show are cut to the nearest showable colour.
- **Gamut compression**: Out-of-range colours are squeezed in smoothly instead of clipped.

### 10.6 Value and chroma structure

*Chroma means how far a colour is from grey at a given lightness.*

- **Value scale (nine or ten steps)**: A fixed ladder from white to black used to plan values.
- **Chroma scale**: A ladder from grey to the most intense version of a hue at one value.
- **Maximum chroma by hue**: Each hue reaches its peak intensity at a different value (yellow light, blue dark).
- **Value-first palette**: Choose values per group first, then pick hues that fit.
- **High chroma at mid values**: Colours look most intense in the middle tones, not in the lightest lights.
- **Chroma drops in light and shadow**: Very light and very dark areas lose intensity.
- **Saturation peak at the terminator**: The band where light turns to shadow is often the most intense.
- **Equal-value colour changes**: Hue changes that keep value fixed, so the value plan stays intact.
- **Greyed backgrounds, clean focal colour**: Chroma saved for the centre of interest.

### 10.7 Perceptual colour spaces

- **sRGB**: The standard screen colour space; simple but not perceptually even.
- **Linear RGB**: RGB without the display curve, correct for light maths such as blending light.
- **HSL / HSV**: Hue-saturation-lightness models; easy to use but lightness is not what the eye sees.
- **CIELAB (L\*a\*b\*)**: A space with a lightness axis and two colour axes, designed to be roughly even to the eye.
- **CIELCh**: CIELAB in polar form: lightness, chroma, hue angle.
- **OKLab**: A modern space that predicts lightness and hue more evenly than CIELAB.
- **OKLCH**: OKLab in polar form; good for building palettes by lightness, chroma and hue.
- **HSLuv**: An HSL-like picker built on a perceptual space, so equal lightness looks equal.
- **Munsell system**: A painter's colour atlas using hue, value and chroma steps chosen by eye.
- **Colour appearance models (CAM16)**: Models that also account for surroundings and lighting.
- **Colour difference (Delta E)**: A number for how different two colours look.
- **Wide gamuts (Display P3)**: Screens that can show more saturated colours than sRGB.

### 10.8 Light colour, shadow colour and local colour

*Local colour is an object's own colour under neutral white light.*

- **Local colour**: The object's own colour, before light and air change it.
- **Light colour**: The colour of the light source tinting everything it hits.
- **Lit colour = local times light**: Lit areas combine the object's colour with the light's colour.
- **Shadow colour = local times sky**: Shadows are lit by the sky, so outdoors they lean blue.
- **Warm light, cool shadow (in app, via light and shadow hue)**: Sunlit outdoor scenes.
- **Cool light, warm shadow**: Overcast or north-light scenes where shadows feel warmer by contrast.
- **Bounce colour in shadows**: Shadows picking up colour from nearby lit ground (green under trees, orange in canyons).
- **Sunlight to skylight ratio**: How much brighter direct sun is than the sky, which sets shadow depth.
- **Colour temperature in Kelvin**: Light colour described as a temperature (low = orange, high = blue).
- **Blackbody colours**: The run of light colours from candle to noon sun to blue sky.
- **Moonlight blue shift**: Night scenes look bluer because the eye's colour sense changes in dim light (the Purkinje effect).
- **Colour constancy**: The eye still reads a white house as white in orange light; painting the true tint looks convincing.
- **Mother colour**: A single colour mixed into every colour to unify the picture.
- **Colour key / tinted glaze**: One transparent colour laid over everything.
- **Snow and water take the sky's colour**: Reflective and white surfaces show the colour of their light.

### 10.9 Atmospheric colour models

- **Atmospheric perspective (in app, as haze)**: Distant things fade toward the air colour.
- **Blend toward sky colour**: Distant colour = mix of object colour and horizon colour by distance.
- **Exponential fog**: Haze grows with distance following an exponential curve (a Beer–Lambert style falloff).
- **Height fog**: Haze thicker low down, thinner higher up.
- **Rayleigh scattering**: Small air molecules scatter blue light, giving blue sky and blue distance.
- **Mie scattering**: Larger particles (haze, dust, water) scatter all colours, giving white glare and pale distance.
- **Brighter haze toward the sun**: Haze is lighter and warmer in the sun's direction.
- **Sunset reddening**: Light crossing more air loses blue, so low sun turns orange and red.
- **Darks lighten faster than lights darken**: With distance, shadows lift toward the haze value sooner than lights drop.
- **Distance desaturation**: Colours lose chroma with distance.
- **Distance hue shift**: Greens turn blue-grey, browns turn violet-grey with distance.
- **Dust haze**: Warm, brown-yellow distance in dry places.
- **Smoke haze**: Orange-brown distance with a dim red sun.

### 10.10 Saturation hierarchies

- **Saturation by depth**: Most intense in front, greyest far away.
- **Saturation by focus**: Most intense at the centre of interest.
- **Saturation by area**: The bigger the area, the less saturated it should be.
- **Grey majority**: Most of the picture is muted so a few colours can sing.
- **One pure note**: Only one area uses near-full chroma.
- **Stepped chroma groups**: Like value groups, a few chroma levels shared by layers.
- **Scene saturation (in app)**: A global saturation control in Finish.

### 10.11 Palette generators

- **From a key colour**: Build the whole palette by rotating and shading one chosen colour.
- **From a harmony rule**: Pick a scheme (triad, split, and so on) and generate hues, values and chromas.
- **From an image**: Pull the main colours out of a photo or painting (colour clustering such as k-means).
- **From a gamut mask**: Sample colours only inside a drawn mask.
- **From time of day**: Sun height sets light colour, sky colour and shadow colour.
- **From season**: Ready hue families for spring, summer, autumn and winter.
- **From weather**: Clear, hazy, stormy, foggy and snowy colour sets.
- **From a mood word**: Calm, dramatic, eerie and so on mapped to colour sets.
- **From a pigment set**: Only colours a chosen set of real paints could mix.
- **Cosine palette**: A smooth run of colours made from a simple repeating wave per channel.
- **Ramp interpolation in OKLCH**: Even gradients between two colours with no muddy middle.
- **Value-locked generator**: Generates hues while keeping each value group's lightness.
- **Palette lock and reroll**: Keep some colours fixed and reroll the rest.
- **Palette scoring**: Rate a palette for contrast, harmony and value spread.
- **Palette swap**: Apply a new palette to the same scene, matching by value.
- **Colour-blind check**: Preview the palette as seen with common colour-vision differences.

## 11. Composition structures

### 11.1 Framing devices

- **Framing branch (in app)**: A branch entering from a frame edge, drooping with leaves.
- **Overhanging foliage top edge**: Leaves along the top of the frame.
- **Side trees (coulisse)**: Tall dark trees at left and right like theatre side-wings (coulisse means stage wing).
- **Dark foreground mass (repoussoir)**: A dark near object on one side that pushes the eye into the picture (repoussoir means "pusher").
- **Arch frame**: A rock arch, bridge or tree arch around the view.
- **Window / cave mouth frame**: Looking out from a dark opening.
- **Foreground grass frame (in app, as grass tufts)**: Grass along the bottom edge.
- **Vignette (in app)**: Darkening toward the corners to hold the eye inside.
- **Tunnel of trees**: Trees on both sides meeting overhead.

### 11.2 Placement grids

- **Rule of thirds**: Key lines and focal points placed on a 3-by-3 grid.
- **Golden section**: A similar grid based on the golden ratio (about 0.618).
- **Centred symmetry**: A calm, formal layout around the middle.
- **Diagonal split**: The picture divided along a diagonal.
- **Low horizon**: Mostly sky, for cloud-focused scenes.
- **High horizon**: Mostly land, for fields and paths.
- **Focal point placement**: Choosing where the most contrast and detail go.
- **Secondary focal points**: Smaller points of interest that support the main one.
- **Empty space (breathing room)**: Deliberately quiet areas to rest the eye.

### 11.3 Lines through the picture

- **Leading lines**: Paths, rivers or fences that pull the eye to the focal point.
- **S-curve**: A winding path or river forming an S from front to back.
- **Zig-zag recession**: Overlapping spurs alternating left and right into the distance.
- **Converging lines**: Rows, rails or roads meeting at the horizon.
- **Horizontal calm**: Long flat lines for quiet scenes.
- **Vertical rhythm**: Tall trunks or columns for strength.
- **Diagonal energy**: Slopes and leaning shapes for movement.
- **Radiating lines**: Rays or paths spreading from a point.
- **Circular path (eye loop)**: Elements arranged so the eye circles back.
- **L-shape / Z-shape layouts**: Simple layout skeletons for landscapes.

### 11.4 Depth cues

- **Overlap (in app, via back-to-front bands)**: Near things covering far things.
- **Size diminishing with distance (in app, for clouds, clusters, trees)**: Things shrink toward the horizon.
- **Vertical position**: Farther things sit higher up the ground plane.
- **Value and colour fade (in app, via haze and value groups)**: Distance shown by lightening and cooling.
- **Detail gradient**: Crisp detail near, simple masses far.
- **Texture gradient**: Pattern elements packing closer with distance.
- **Scale cues**: A figure, house or animal to show how big the land is.
- **Converging perspective**: Rows and roads narrowing into depth.
- **Cast shadows linking objects to ground**: Placing things on the land convincingly.

### 11.5 Rhythm, variety and grouping

- **Rhythm / repetition**: Repeated shapes (fence posts, trees) with varied spacing.
- **Spacing that shrinks with distance**: Rows getting tighter toward the horizon.
- **Odd numbers**: Groups of three or five look more natural than pairs.
- **Uneven intervals**: Avoiding equal gaps between similar objects.
- **Big / medium / small**: One large, a few medium, many small shapes in a group.
- **Tangents avoidance**: Avoiding edges that just touch and create awkward lines.
- **Grouped masses**: Joining small items into a few big readable shapes.
- **Counterweight**: A small strong element balancing a large weak one.
- **Contrast of shape character**: Round against angular, soft against hard, to make a focus.

### 11.6 Value-pattern templates (notan layouts)

*Notan is a Japanese term for the pattern of light and dark shapes in a picture, seen in just two or three flat values.*

- **2-value view (in app)**: Shows the picture as pure light and dark to check the pattern.
- **3-value view (in app)**: Shows the picture in light, mid and dark.
- **Values view (in app)**: Removes colour so only lightness shows.
- **Adjustable value-check thresholds (in app)**: Where the cuts between values fall.
- **Dark frame, light middle**: Dark edges surrounding a light centre.
- **Light frame, dark middle**: A dark subject in a light surround.
- **Dark bottom, light top**: Silhouette land against a bright sky.
- **Light bottom, dark top**: Bright snow or water under a storm sky.
- **Diagonal dark mass**: A dark wedge running corner to corner.
- **Dark L**: A dark mass along one side and the bottom.
- **Steelyard**: A large mass on one side balanced by a small far one on the other.
- **Pattern of three values stepping back**: Near dark, middle mid, far light.
- **Spotlight**: A small light shape in a large dark field.
- **Silhouette strip**: A dark band across the middle with light above and below (e.g. a shoreline).
- **Checkerboard interlock**: Light and dark shapes fitting into each other.

### 11.7 Formats and crops

- **Wide panorama (in app)**: 2:1 wide format.
- **Portrait (in app)**: 3:4 tall format.
- **Square (in app)**: 1:1.
- **Hanging scroll**: Very tall and narrow, East Asian format.
- **Hand scroll**: Very long and low, read side to side.
- **Close crop**: Cutting in tight on one element.
- **Postcard / stamp**: Small formats with a border.

### 11.8 Armatures and proportion systems

*An armature is a hidden set of lines across the frame that the main shapes and edges can be hung on.*

- **Golden spiral**: A spiral that grows by the golden ratio, leading the eye into one point.
- **Fibonacci spiral**: A close cousin of the golden spiral built from squares of Fibonacci sizes (1, 1, 2, 3, 5, 8...).
- **Phi grid**: A grid like the rule of thirds but with the lines at golden-ratio positions, nearer the centre.
- **Fibonacci grid**: Nested squares and rectangles from the Fibonacci sequence.
- **Dynamic symmetry**: A system of diagonals and their perpendiculars across the frame, used to place edges and gestures.
- **Baroque diagonal**: The diagonal from lower left to upper right, felt as rising.
- **Sinister diagonal**: The diagonal from upper left to lower right, felt as falling.
- **Reciprocal diagonals**: Lines at right angles to the main diagonals, meeting them at "eyes" of the frame.
- **Root rectangles**: Frames whose proportions are square roots (root 2, root 3, root 5), each with its own grid.
- **Rabatment**: Folding the short side onto the long side to mark a square inside the frame; its edge is a strong line.
- **Harmonic armature**: A set of 14 lines (diagonals, reciprocals and centre lines) that works in any rectangle.
- **Diagonal method**: Place key points on 45-degree lines running in from the corners.
- **Centre cross**: The vertical and horizontal centre lines, for formal or calm designs.
- **Rule of quarters / fifths**: Finer grids than thirds for placing horizons and verticals.
- **Musical ratios**: Divisions such as 1:2, 2:3 and 3:4 used to place lines.
- **Golden triangles**: A diagonal plus perpendiculars from the other corners, making three similar triangles.
- **Modular grid**: An even grid of cells used to line up masses and gaps.
- **Armature overlay**: Showing any of these as lines over the picture while editing.
- **Snap to armature**: Letting horizons, peaks and trees snap to armature lines.

### 11.9 Composition shapes

- **L composition**: A strong vertical on one side and a horizontal along the bottom.
- **O / circular composition**: Elements arranged in a ring that keeps the eye inside.
- **S composition**: The main path or shape curves like an S from front to back.
- **Z composition**: The eye zig-zags from one side to the other and back into depth.
- **Triangle / pyramid**: Masses arranged in a stable triangle with a peak.
- **Inverted triangle**: A wide top and narrow base, tense and unstable.
- **Cross / cruciform**: A strong vertical crossed by a strong horizontal.
- **Tunnel composition**: Dark masses on all sides with a light opening in the middle.
- **C composition**: A curved mass wrapping around the focal point.
- **U / valley composition**: High sides and a low middle, like a valley.
- **V composition**: Two slopes meeting low in the frame.
- **X composition**: Two diagonals crossing near the focus.
- **T composition**: A horizontal across the top held by a central vertical.
- **H composition**: Two verticals joined by a horizontal (two trees and a horizon).
- **Radial / starburst**: Lines spreading from one point.
- **Balance scale**: Two masses balanced either side of the centre.
- **Steelyard composition**: A big near mass balanced by a small far one, like a steelyard balance.
- **Three-spot**: Three main shapes making a triangle of interest.
- **Group mass**: All important shapes gathered into one big mass with open space around it.
- **Horizontal bands**: The picture stacked in flat strips (sky, hills, fields, water).
- **Vertical bands**: Repeated tall shapes across the frame (trunks, cliffs).
- **All-over pattern**: No single focus; the surface is an even field of marks.
- **Frame within a frame**: An inner frame (arch, window, trees) around the view.
- **Cantilever**: A mass reaching in from one edge over empty space.
- **Compound curve**: Several linked curves carrying the eye through the picture.
- **Overlap cascade**: Shapes overlapping in a chain that steps into depth.

### 11.10 Horizon placements

- **Horizon on the lower quarter**: Big sky; for cloud and light scenes.
- **Horizon on the lower third**: Sky leads, land supports.
- **Horizon on the centre line**: Calm and formal, good for mirror reflections.
- **Horizon on the upper third**: Land leads, for fields, paths and water.
- **Horizon on the upper quarter**: Almost all ground, for aerial or intimate scenes.
- **Horizon out of frame (above)**: Looking down; no sky at all.
- **Horizon out of frame (below)**: Looking up; only sky, branches and peaks.
- **Hidden horizon**: The true horizon covered by trees or hills.
- **Two horizons**: A far land line and a nearer water line.
- **Horizon matched to mood**: Low for open and airy, high for enclosed and grounded.

### 11.11 Shape-size hierarchy

- **Dominant shape**: One shape clearly bigger or stronger than the rest.
- **Subdominant shapes**: A few mid-sized shapes that support the dominant one.
- **Subordinate shapes**: Many small shapes that add texture and scale.
- **Size contrast ratio**: How much bigger the biggest shape is than the smallest.
- **One giant, many tiny**: Exaggerated contrast for epic scale.
- **Avoid equal halves**: No two main areas of the same size.
- **Mass areas vs detail areas**: Large quiet shapes next to small busy ones.
- **Hierarchy of edges**: Few hard edges, more soft edges, many lost edges.
- **Hierarchy of contrast**: The strongest contrast in one place only.
- **Hierarchy of detail**: The most detail at the focus, simplifying outward.
- **Nesting**: Small shapes grouped inside medium shapes grouped inside big shapes.

### 11.12 Rhythm types

- **Regular rhythm**: The same element at the same spacing (fence posts).
- **Alternating rhythm**: Two elements taking turns (tree, gap, bush, gap).
- **Progressive rhythm**: Elements that grow or shrink step by step.
- **Flowing rhythm**: Curving repeats like waves or rolling hills.
- **Random rhythm**: Loose repeats with irregular spacing.
- **Syncopation**: A deliberate break or skip in a regular pattern.
- **Echo shapes**: The same shape repeated at a different size elsewhere (a cloud echoing a hill).
- **Counterpoint**: Two different rhythms running together (tall trunks against low bushes).
- **Beat and rest**: Busy passages broken by quiet spaces.
- **Gradation**: Smooth change in size, value, colour or spacing across the picture.
- **Staccato and legato edges**: Choppy broken edges versus long flowing ones.

### 11.13 Tangents and trouble spots to avoid

*A tangent is where two edges just touch, creating an awkward line that pulls the eye.*

- **Kissing edges**: Two shapes that just touch; overlap them or separate them clearly.
- **Horizon tangent**: A tree top or roof line sitting exactly on the horizon.
- **Frame tangent**: A shape that just touches the frame edge.
- **Corner exits**: Lines running straight into a corner, pulling the eye out.
- **Pointing out**: Branches or paths that aim out of the picture.
- **Equal spacing**: Objects evenly spread, looking mechanical.
- **Everything centred**: The main subject dead centre with nothing to balance it.
- **Bisected picture**: A horizon or tree cutting the picture into two equal halves.
- **Parallel contours**: Many edges running parallel like train tracks.
- **Same-size shapes**: Repeats with no size variety.
- **Competing focal points**: Two areas fighting for attention.
- **Busy edges of the frame**: High contrast or detail near the border.
- **Trapped negative space**: Small, awkward gaps boxed in by shapes.
- **Vertical stacking**: Objects lined up one exactly above another.
- **Repeated angles**: Every slope at the same angle.
- **Bullseye**: Rings of shapes around a dead-centre subject.
- **Lollipop trees**: A round crown on a straight stick trunk.
- **Accidental mergers**: Two dark (or light) shapes at different depths merging into one blob.
- **Head-on symmetry**: Mountains or trees drawn perfectly symmetrical by accident.
- **Tangent checker**: A tool that highlights edges that nearly touch.

### 11.14 Eye paths

- **Entry point**: Where the eye first enters, often at a lower corner.
- **Z reading path**: The eye moves left to right, then back and across again.
- **Zig-zag into depth**: Alternating left-right steps going back.
- **Spiral into focus**: The eye circles inward to the main point.
- **Looping path**: The eye loops around the picture and returns.
- **Stepping stones of light**: A trail of light spots leading to the focus.
- **Stepping stones of colour**: Repeated accents that lead the eye.
- **Implied lines**: Lines the eye completes between separate objects.
- **Gaze direction**: Figures or animals looking toward the focus.
- **Value gradient lead**: A gradual lightening toward the focus.
- **Exit stoppers**: A tree or dark mass at the edge that turns the eye back in.
- **Rest areas**: Quiet spaces where the eye pauses.
- **Visual weight balance**: Big, dark, saturated or detailed things weigh more; balance them across the frame.

### 11.15 Focal point tricks

- **Strongest value contrast**: The lightest light meets the darkest dark at the focus.
- **Sharpest edges**: Hard edges only at the focus.
- **Highest chroma**: The most saturated colour at the focus.
- **Most detail**: Fine detail only where you want the eye.
- **Isolation**: The subject set apart in open space.
- **Lines converging on the focus**: Paths, ridges and edges all pointing to it.
- **Spotlit focus**: The focus in a patch of light, the rest in shade.
- **Complementary accent**: A small spot of the opposite colour.
- **Unique shape**: One different shape among repeats (one red tree in a green wood).
- **Human element**: A tiny figure or house pulls the eye strongly.
- **Break in rhythm**: The focus is where a pattern changes.
- **Texture contrast**: A smooth area against rough, or the reverse.
- **Temperature contrast**: A warm spot in a cool scene or the reverse.
- **Focus by depth blur (in app)**: Depth blur with a chosen sharpest depth.
- **Vignette pull (in app)**: Darkened corners that push the eye toward the centre.
- **Halo around the focus (in app, via separation halo)**: A light glow behind the focal shape.

### 11.16 More framing devices

- **Doorway frame**: Looking out through a door or gateway.
- **Bridge-underside frame**: The arch of a bridge framing the view.
- **Cliff overhang frame**: A dark rock lip across the top.
- **Tree pair frame**: Two trunks either side, branches meeting overhead.
- **Cloud frame**: Dark clouds across the top corners.
- **Shadow foreground frame**: A band of cast shadow across the bottom.
- **Reflection frame**: Water reflections framing the bottom edge.
- **One-sided frame**: A dark mass on one side only.
- **Soft frame**: Fog or blur around the edges.
- **Foreground grasses as a veil**: Tall grass partly covering the view.

### 11.17 More depth cues

- **Alternating value planes**: Light band, dark band, light band going back, so each separates from the next.
- **Stacked silhouettes**: Several flat hill shapes, each paler than the one in front.
- **Fog gaps between planes**: A light mist line at the base of each plane.
- **Consistent light direction**: The same sun side lit on every plane ties the space together.
- **Diminishing cast shadows**: Shadows getting shorter and thinner with distance.
- **Diminishing contrast in texture**: Grass and leaf marks fading to flat colour.
- **Reflections deepen water**: Reflections showing depth in a flat surface.
- **Depth blur (in app)**: Softening layers away from a focus depth.
- **Motion parallax**: Near things moving faster than far things (see motion effects).

### 11.18 Negative space

*Negative space is the empty area around and between the main shapes.*

- **Designed sky shape**: Treating the sky as a shape with its own interesting outline.
- **Gaps between trees**: Varied, readable holes between trunks and crowns.
- **Negative silhouette**: The subject shown by the space around it.
- **Ma (meaningful emptiness)**: A Japanese idea of deliberate empty space that gives the picture calm.
- **Figure-ground reversal**: Shapes that can be read as either object or background.
- **Varied negative shapes**: Empty areas of different sizes and shapes.
- **Emptiness as the subject**: A tiny subject in a vast, quiet field.
- **Sky holes in foliage**: Gaps in tree crowns that let light through.

### 11.19 Cropping

- **Bleed off the edge**: Letting big shapes run out of the frame to suggest scale.
- **Tight crop**: Cutting in close for intimacy.
- **Loose crop**: Plenty of space around the subject.
- **Cut through objects deliberately**: Clear, intentional cuts rather than near misses.
- **Off-centre crop**: Moving the subject off-centre for tension.
- **Crop out competitors**: Removing distracting elements at the edges.
- **Viewfinder tool**: A movable crop box to test framings.
- **Multiple crop preview**: Several crops of the same scene side by side.
- **Strip crop**: A thin band from a larger scene.
- **Inset detail**: A small enlarged crop placed beside the full view.

### 11.20 Formats and aspect choices

- **16:9 and 4:3 (in app)**: Screen formats.
- **3:2**: The 35mm photo format.
- **5:4**: A near-square, calm format.
- **21:9 cinematic**: A wide film format.
- **3:1 panorama**: A very long strip for wide valleys.
- **9:16 phone vertical**: Tall format for phone screens.
- **Root-2 paper (A-series)**: Paper sizes that halve without changing shape.
- **Golden rectangle**: A frame whose sides follow the golden ratio.
- **Tondo**: A circular picture.
- **Arched top**: A frame with a rounded top.
- **Fan shape**: A curved, folding-fan format.
- **Diptych / triptych**: One view split across two or three panels.
- **Format fits subject**: Tall for trees and waterfalls, wide for ranges and shorelines.

### 11.21 More value-pattern (notan) templates

- **Big light, big dark, small accents**: Two large value shapes with a few small opposite spots.
- **Dominant value**: Most of the picture in one value, with the rest as contrast.
- **Value proportions 60/30/10**: Mostly one value, some of a second, a little of a third.
- **Value zig-zag**: Light and dark bands alternating into depth.
- **Light path through dark**: A light river or road winding through dark land.
- **Dark path through light**: A dark hedge or stream across a bright field.
- **Radial light**: Light spreading from one bright point into darkness.
- **Island shape**: One shape of one value floating in the other value.
- **Frame and hole**: A dark frame with a light opening (or the reverse).
- **Stripes**: Horizontal value bands of different widths.
- **Diagonal bands**: Value bands running on a slant.
- **Three dark shapes**: Three dark masses of different sizes on a light ground.
- **Interlocking fingers**: Light and dark shapes reaching into each other along one edge.
- **Mid-value dominant with light and dark accents**: A grey picture with small extremes.
- **Value thumbnail set**: A page of small value layouts to choose from before building a scene.

## 12. Shape-language vocabularies

### 12.1 Base shapes

- **Circle (in app)**: A plain round shape.
- **Ellipse (in app)**: A stretched circle.
- **Blob (in app)**: An irregular round shape.
- **Leaf (in app)**: A pointed oval.
- **Rounded square (in app)**: A square with soft corners.
- **Square (in app)**: A hard four-cornered shape.
- **Triangle (in app)**: A three-cornered shape.
- **Shard (in app)**: A sharp, broken-looking angular shape.
- **Spiky star (in app)**: A star-like shape with points.
- **Teardrop**: A round shape with one point.
- **Crescent**: A curved moon shape.
- **Scallop**: A shape with a bumpy, cloud-like edge.
- **Heart / double lobe**: Two round lobes, useful for leaves.
- **Needle**: A very thin long shape for pine needles and grass.
- **Fan**: A wedge that spreads out, for palm leaves and ferns.
- **Hexagon / polygon**: Many-sided flat shapes for rock and basalt.
- **Capsule**: A long rounded shape for stones and cloud puffs.
- **Brush dab**: A shape like a single brush mark.
- **Wedge**: A tapering slice for grass and shards.
- **Ring**: A hollow circle for ripples.

### 12.2 Mixes

- **Mix: soft (in app)**: Circles, ellipses, blobs and leaves.
- **Mix: foliage (in app)**: Mostly blobs, with circles, leaves and ellipses.
- **Mix: hard (in app)**: Squares, triangles and shards.
- **Mix: everything (in app)**: All base shapes.
- **Weighted mixes**: Choosing how often each shape appears.
- **Custom saved mixes**: User-made shape sets with names.

### 12.3 Shape families per material

- **Broadleaf foliage family**: Rounded, clumpy, scalloped edges.
- **Conifer foliage family**: Spiky, layered, triangular.
- **Palm foliage family**: Long arching fans and strips.
- **Grass family**: Thin, tapering, curved blades.
- **Flower family**: Small round or star shapes in accent colours.
- **Hard rock family**: Angular, flat-faced, cracked.
- **Soft rock family**: Rounded, water-worn, smooth.
- **Cloud family**: Puffy tops, flat bottoms, soft edges.
- **Wispy cloud family**: Long thin curved streaks.
- **Water family**: Horizontal slivers, ellipses and thin lines.
- **Wave family**: Curls, crests and scallops.
- **Snow family**: Smooth, rounded, simple masses.
- **Ice family**: Sharp shards and flat planes.
- **Sand family**: Long smooth curves with one sharp edge.
- **Man-made family**: Straight edges, right angles, repeats.
- **Animal family**: Simple compact silhouettes with a few long parts (legs, necks).

### 12.4 Edge types

- **Edge noise per shape (in app)**: Roughens each shape's outline, sized to the shape.
- **Hard edge**: A crisp boundary, for near and sunlit things.
- **Soft edge**: A blurred boundary, for far or misty things.
- **Lost edge (in app, for outlines)**: An edge that disappears where two areas match in value.
- **Found edge**: An edge kept sharp where values contrast.
- **Broken edge**: An edge with gaps, like dry brush.
- **Serrated edge**: Saw-tooth edges for pine and grass.
- **Scalloped edge**: Bumpy edges for foliage and cloud.
- **Faceted edge**: Straight segments with corners, for rock and ice.
- **Feathered edge**: Many small strokes fraying out, for grass tops and fur.

### 12.5 Size distribution and grouping

- **Size variety (in app)**: How much shape sizes vary within a layer.
- **Rotation variety (in app)**: How much shapes are randomly turned.
- **Shape size (in app)**: The overall size of shapes in a layer.
- **Four grouping levels (in app)**: Shape, cluster, object and whole layer.
- **Big / medium / small ratio**: A set proportion of large, middle and small shapes.
- **Size by depth**: Shapes shrink with distance automatically.
- **Size by position in the group**: Bigger shapes in the middle, smaller at the edges.
- **Clumping**: Shapes gather into groups with gaps between.
- **Even scatter**: Shapes spaced evenly, for texture.
- **Stragglers**: A few small shapes breaking off the edge of a mass.

## 13. 2D lighting tricks

- **Measured roundness (in app)**: Each shape is measured; round shapes shade like balls, square ones like bevelled blocks.
- **Manual roundness (in app)**: Setting roundness by hand instead of measuring.
- **Group volume lighting (in app)**: A clump, tree or cloud is lit as one big form.
- **Light group level (in app)**: Choose whether each shape, cluster, object or layer is lit as one volume.
- **Light / shadow range (in app)**: How far a layer's shading spreads.
- **Light bias (in app)**: Shifting a layer toward lit or shadowed.
- **Shading steps (in app)**: Smooth shading or 2, 3 or 4 flat steps.
- **Rim light (in app)**: A light edge inside the outline on the side facing the light.
- **Shadow clone (in app)**: Offset dark copy as a cast shadow, with offset, softness and share of objects cloned.
- **Clone may fall on sky (in app)**: Option to let fake shadows land on the sky.
- **Dappled patches (in app)**: Noise-based light and shadow patches, with scale, stretch and coverage.
- **Faceted mountain planes (in app)**: Ridge faces lit by the way they point.
- **Separation halo (in app)**: A lighter band in the layer behind a dark shape, to pull them apart.
- **Contact darkening (partly, as contact shadow at feet)**: Darken where shapes overlap or touch the ground.
- **Core shadow line**: A darker band where a form turns from light to shadow.
- **Reflected light**: A lighter strip on the shadow side from bounced light.
- **Highlight spot**: A small bright spot on the most lit point.
- **Cast shadow projection (in app)**: Shadows laid along the ground by sun direction.
- **Ambient occlusion (fake)**: Darkening in creases and deep inside clumps.
- **Top-light gradient on masses**: Upper parts of masses lighter than lower parts.
- **Translucent glow (in app)**: Thin things glow when backlit.
- **Wet sheen**: Streaky bright reflections on wet surfaces.
- **Snow-top lighting**: Upper surfaces turned white or light regardless of form.

## 14. Line quality

- **Outline around shape, cluster, object or layer (in app)**: Choose which group gets one outline.
- **Outline width (in app)**: Thickness of lines.
- **Outline tone (in app)**: Darker than fill, ink, lighter than fill, or a custom colour.
- **Scene ink colour (in app)**: One colour used for all ink lines.
- **Heavier lines on the shadow side (in app)**: Line weight follows light direction.
- **Line breaks on the light side (in app)**: Lines fade or break where light hits.
- **Wobble (in app)**: Lines move with noise for a hand-drawn feel.
- **Sketch passes (in app)**: Several loose passes of the same line.
- **Group outline union (in app)**: Only the outer contour of a group gets a line.
- **Lose edges where values match (in app)**: Outlines fade where the two sides are close in value.
- **Tapered lines**: Lines thick in the middle, thin at the ends, like a brush.
- **Line thinning with distance**: Far layers get finer lines automatically.
- **Coloured lines by region**: Warm lines in light, cool in shadow.
- **Interior detail lines**: A few lines inside shapes, like bark or rock cracks.
- **Contour hatching**: Lines following a form's curve.
- **Overshoot lines**: Lines that run slightly past corners, like quick sketches.
- **Dotted / dashed lines**: Broken lines for far or delicate things.
- **Double lines**: Offset second line for a printed look.
- **No-line style (in app, default for most layers)**: Shapes read by value only.

## 15. Rendering and stylisation

### 15.1 Shading styles

- **Smooth shading (in app)**: Continuous light-to-shadow blend.
- **Stepped / cel shading (in app)**: Hard flat bands of light and shadow, like cartoons.
- **Posterisation**: The whole picture cut into a few flat colour levels.
- **Flat colour**: No shading, value groups only.
- **Gradient fills per mass**: Each mass shaded top to bottom.
- **Dither shading**: Light and shadow made from dot patterns.
- **Halftone**: Dots of varying size, like printed newspapers.
- **Stipple**: Many small dots building up darks.
- **Glow shading**: Soft light bleeding over edges.

### 15.2 Line and hatching styles

- **Clean ink**: Even, crisp outlines.
- **Loose sketch (in app, via wobble and passes)**: Wobbly overlapping lines.
- **Hatching in shadow (in app)**: Parallel strokes clipped to shadow areas.
- **Cross-hatching**: Crossing strokes for darker shadows.
- **Scribble shading**: Loose continuous scribbles for tone.
- **Pen and wash**: Ink lines over soft colour.
- **Woodcut lines**: Bold carved-looking lines with sharp ends.
- **Engraving**: Fine parallel lines that swell and thin with tone.

### 15.3 Textures

- **Paper texture (in app, as paper grain)**: Fine grain showing through the whole picture.
- **Watercolour paper**: Rough texture with colour pooling at edges.
- **Canvas weave**: A woven pattern overlay.
- **Film grain / noise**: Fine random speckle.
- **Brush texture in fills**: Streaks inside shapes following a direction.
- **Dry brush edges**: Broken, scratchy shape edges.
- **Sponge texture**: Blotchy texture for foliage.
- **Splatter**: Random droplets of colour.
- **Wash bleeding**: Soft colour spreading past edges.
- **Granulation**: Speckles where pigment settles in hollows.
- **Print misregistration**: Colour layers slightly out of line, like a cheap print.
- **Riso / screen-print grain**: Rough flat colour with speckle.

### 15.4 Colour treatment and finishing

- **Colour strength per layer (in app)**: Saturation control per layer.
- **Global colour grade (in app, partly: saturation and contrast)**: Adjust hue, saturation and contrast of the whole image.
- **Temperature shift (in app)**: Warm or cool the whole picture.
- **Gradient map**: Remap values to a chosen range of colours.
- **Depth of field (in app, as depth blur)**: Blur far (or near) layers to focus on one band.
- **Bloom**: Bright areas glow softly.
- **Vignette (in app)**: Darkened corners.
- **Extra blur per layer (in app)**: Soften one layer on its own.
- **Chromatic fringe**: Slight colour split at edges, for a retro camera look.
- **Border / mat**: A frame or margin around the image.
- **Signature / seal stamp**: A small red square seal, East Asian style (as decoration only).

### 15.5 Style families

- **Graphic poster (in app, as a preset)**: Stepped shading, ink outlines, three values.
- **Travel poster**: Flat bold shapes, limited palette, big clean sky.
- **Japanese woodblock**: Flat colours, bold outlines, gradient skies, stylised waves.
- **Chinese ink landscape**: Tall mountains in mist, monochrome, loose brush.
- **Gouache illustration**: Opaque flat colour with soft edges.
- **Watercolour**: Transparent washes, soft blending, white paper showing.
- **Oil sketch (plein air)**: Chunky brush marks, bold colour notes.
- **Storybook**: Soft round shapes, warm palette.
- **Pixel art**: Low-resolution blocky pixels with limited colours.
- **Low-poly**: Flat-shaded triangle facets.
- **Paper cut / layered paper**: Flat layers with soft drop shadows between them.
- **Stained glass**: Flat colour cells with thick dark leading lines.
- **Mosaic**: Small tile pieces making up the image.
- **Silhouette art**: Everything dark against a coloured sky.
- **Minimal line**: A few lines and flat colour areas.
- **Retro 70s**: Warm oranges and browns, banded sun.
- **Vaporwave**: Pink and teal, glowing sun with stripes.
- **Game backdrop**: Clear layers suitable for parallax scrolling.

## 16. Procedural building blocks

### 16.1 Structures (generators)

- **Sky gradient (in app)**: Fills the back of the scene.
- **Clouds (in app)**: Places puffy cloud groups in a sky band.
- **Mountain ridge (in app)**: A noise ridge line with planes and scatter.
- **Rolling hills (in app)**: Rounded bumps on a ground plane with scatter.
- **Trees by point extrusion (in app)**: Branching trees with foliage clumps.
- **Clusters (in app)**: Groups of shapes for bushes and rocks.
- **Grass tufts (in app)**: Fans of blades with optional flowers.
- **Framing branch (in app)**: A branch entering from an edge.
- **Ribbon: river or road (in app)**: A strip that winds and narrows with distance.
- **Water plane (in app)**: A surface that mirrors layers above it.
- **Rows / rhythm structure (partly, via fields, hedges and fences)**: Repeated elements in lines (fences, vines, poles).
- **Drawn shapes (in app)**: A hand-drawn outline filled with a mass, shapes, or both, with shapes along its edge.
- **Terraces**: Stacked contour steps across a slope.
- **Fields, hedges and fences (in app)**: Field strips in perspective with hedges and an optional fence.
- **Field grid**: A patchwork of fields in perspective.
- **Dunes**: Curved ridges with a sharp crest.
- **Cliff wall**: A vertical face with ledges and cracks.
- **Waterfall**: A falling ribbon with spray at the base.
- **Waves**: Rows of wave shapes that shrink with distance.
- **Shoreline**: An edge between land and water with foam.
- **Building block**: Simple house shapes from boxes and roofs.
- **Fence / wall run**: Posts and rails following the ground.
- **Power line**: Poles with sagging curves between them.
- **Figure / animal stamp**: Place a silhouette from a small library.
- **Falling particles**: Rain, snow or leaves as a layer.
- **Light shafts**: Beams from a point through gaps.
- **Fog layer**: A soft horizontal band at a chosen height.
- **Star field**: Scattered points in the sky.
- **Vine / creeper**: Growth that follows an edge or surface.

### 16.2 Scatter and placement methods

- **Random scatter in a band (in app)**: Shapes placed randomly between a top and bottom line.
- **Surface scatter (in app)**: Shapes placed just below a ridge or hill top.
- **Clumped scatter (in app)**: Several shapes per spot (scatter per clump on hills).
- **Poisson-disc scatter**: Random placement that never lets items get too close (even but natural).
- **Grid with jitter**: A regular grid with small random offsets.
- **Rows in perspective**: Lines of items getting closer together with distance.
- **Along a path**: Items placed along a line or ribbon edge.
- **Density map scatter (in app, via graph density)**: More items where a mask or noise is high.
- **Slope-aware scatter**: Rocks on steep parts, grass on flat parts.
- **Edge scatter**: Items gathered along the rim of a mass.
- **Avoid-overlap scatter**: Items pushed apart so they do not collide.
- **Stacking**: Items placed on top of others (snow on rocks, flowers on grass).
- **Hand-placed points (in app, Add tool)**: The user clicks to place items.

### 16.3 Growth models

- **Point extrusion (in app)**: Grow a segment from a point, split, repeat.
- **Whorl growth (in app, for conifers)**: Rings of branches up a straight trunk.
- **Multi-stem growth (in app, for shrubs)**: Several stems from one base.
- **L-systems (in app, with plant, bush, sparse tree, weed and custom rules)**: Rewrite rules like "a branch becomes a branch plus two twigs" for consistent species.
- **Space colonisation**: Branches grow toward scattered target points, filling a crown shape naturally.
- **Crown-shape envelope**: Growth limited to a chosen outline (round, cone, column).
- **Phototropism**: Branches bend toward the light.
- **Gravity droop (in app, for the framing branch)**: Branches sag with length.
- **Wind bias**: Growth leans away from the wind.
- **Pruning**: Remove branches outside a shape or in a gap.
- **Leaf arrangement patterns**: Alternate, opposite or spiral placement along twigs.
- **Root growth**: Downward branching for exposed roots.
- **Vine following**: Growth that clings to a nearby edge.

### 16.4 Noise types

- **Smooth noise, fbm (in app)**: Layered smooth noise ("fbm" means several octaves of noise added together).
- **Ridged noise (in app)**: Noise with sharp creases, good for mountain crests.
- **Wave (in app)**: A regular up-and-down pattern.
- **Cellular (Worley) noise (in app, as the Cells node)**: Cell-like patterns, good for cracked earth and stones.
- **Voronoi regions (in app, via the Cells node)**: Splitting space into irregular cells, good for fields and rocks.
- **Domain-warped noise**: Noise bent by another noise, for swirly flowing shapes.
- **Billow noise**: Puffy rounded noise, good for clouds.
- **Terraced noise**: Noise cut into flat steps, good for terraces and strata.
- **Blue noise**: Evenly spread random points.
- **Directional / stretched noise**: Noise stretched one way, for wind streaks and grain.

### 16.5 Distortion patterns (node graph)

- **Scene-wide node graph (in app)**: One graph decides how far every outline point moves.
- **Graph amount per layer (in app)**: Each layer takes more, less, none or reversed bending.
- **Layer noise (in app)**: One smooth field moving a whole layer.
- **Position input (in app)**: The point's x and y.
- **Layer depth input (in app)**: 0 far to 1 near.
- **Number input (in app)**: A constant value.
- **Noise node (in app)**: Smooth noise.
- **Ridged noise node (in app)**: Sharp-creased noise.
- **Wave node (in app)**: A regular wave.
- **Swirl node (in app)**: Twists points around a centre.
- **Ripple node (in app)**: Rings pushing points outward.
- **Maths nodes (in app)**: Add, subtract, multiply, mix, absolute and remap.
- **Band mask node (in app)**: Limits an effect to a range, e.g. only the top of the picture.
- **Displacement output (in app)**: How far points move sideways and up/down.
- **Wind node (partly, as a wind graph preset)**: Bends things from their roots, more at the tips.
- **Bulge / pinch**: Swell or squeeze around a point.
- **Shear / lean**: Slant everything by height.
- **Twist per object**: Rotate each object's top relative to its base.
- **Steps node (in app)**: Snaps values into terraces.
- **Clamp, smooth step and power nodes (in app)**: Limit and shape a value's curve.
- **Linear gradient node (in app)**: A value that rises along a chosen direction.
- **Cells node (in app)**: Cell edges and centres for cracked or tiled patterns.
- **Random per object**: A different value for each object.
- **Curve / falloff node (partly, via smooth step and power)**: Shape how a value rises and falls.
- **Graph drives value, size and density (in app)**: The same graph also lightens, grows or thins shapes, set per layer.
- **Graph drives colour**: The same graph shifting hue.
- **Graph presets (in app)**: Gentle wobble, nothing, wind sway, sky vortex, terraced edges, patchy light, forest clearings, bigger shapes up close.
- **Graph per band and saved graphs**: Separate graphs per band and user-saved graphs.

### 16.6 Masks

- **Band mask (in app)**: Select a range of height (or any value).
- **Depth mask**: Select layers by distance.
- **Light-side mask**: Select the lit or shadowed side of shapes.
- **Slope mask**: Select steep or flat parts of a surface.
- **Height mask**: Select above or below a line, like a snow line.
- **Noise mask**: A patchy random selection.
- **Edge-distance mask**: Select near the edges or deep inside masses.
- **Painted mask**: A mask drawn by hand.
- **Object mask**: Select one tree, rock or cloud.

### 16.7 Randomness controls

- **Scene seed (in app)**: One number that sets the whole scene's randomness.
- **Layer seed (in app)**: Each layer has its own random number.
- **Reseed one layer (in app)**: New random seed for a single layer.
- **Separate shape stream (in app)**: Changing shapes does not move the scaffolding.
- **Reseed all (in app)**: New random seeds for every layer.
- **Seed locks (in app)**: Keep chosen layers fixed while reseeding the rest.
- **Variation amount**: One slider for how wild the randomness is.
- **Deterministic export**: The same seed always gives the same picture.

## 17. Editing tools and workflow

### 17.1 Layers and scene management

- **Layer list by band (in app)**: Layers shown and sorted by depth band.
- **Layer visibility (in app)**: Show or hide a layer.
- **Inspector sections (in app)**: Shape fill, value and colour, light and form, fake 2D light, outline, distortion.
- **Click to select layer (in app)**: Click the picture to pick the layer under the pointer.
- **Add layer to a band (in app)**: Start a new layer in any band.
- **Delete layer (in app)**: Remove a layer.
- **Reorder within a band (in app)**: Move a layer back or forward.
- **Change a layer's structure (in app)**: Switch what kind of scaffold a layer uses.
- **Duplicate layer (in app)**: Copy a layer with its settings.
- **Move layer between bands (in app)**: Push a layer nearer or farther.
- **Rename layers (in app)**: Custom names.
- **Add, remove and spread value groups (in app)**: Edit the list of value groups or space them evenly.
- **Shift a layer (in app)**: Nudge a whole layer sideways or up and down.
- **Lock layer**: Stop accidental changes.
- **Solo layer**: Show only one layer.
- **Layer groups / folders**: Group several layers to edit together.
- **Copy and paste a look (in app)**: Move colour, variety, light, fake-light and line settings between layers.
- **Layer opacity / blend**: Make a layer see-through or blend differently.

### 17.2 Viewing and checking

- **Colour view (in app)**: The normal picture.
- **Values view (in app)**: The picture without colour.
- **2-value and 3-value views (in app)**: Flat value checks.
- **Groups view (in app)**: Shows how shapes are grouped.
- **Structure overlay (in app)**: Shows scaffold lines and slot points.
- **Squint view**: A blurred view to check big shapes.
- **Mirror view**: Flip the picture to spot balance problems.
- **Thumbnail view**: A tiny preview to judge the overall design.
- **Grid overlays**: Thirds, golden section and diagonals drawn over the picture.
- **Value histogram**: A chart of how much of each value is used.
- **Split before / after**: Compare two versions side by side.
- **Zoom and pan**: Look closely at part of the scene.

### 17.3 Direct editing

- **Per-object move, resize, hide and reseed (in app, Select tool)**: Drag an object, scroll to resize, Delete to hide, R for a new seed.
- **Move layer tool (in app)**: Drag the whole selected layer on the canvas.
- **Reset edits (in app)**: Clear object edits, added objects, drawn shapes or layer shift.
- **Drag structure handles**: Reshape a ridge line or path by dragging its control points.
- **Draw shapes by hand (in app, Draw tool)**: Drag an outline that becomes a lit mass filled with shapes.
- **Draw ridge line by hand**: Sketch a horizon and let the tool fill it.
- **Paint density**: Brush where trees or grass should be denser.
- **Place single objects (in app, Add tool, for trees, clouds, clusters and tufts)**: Click to drop a new object.
- **Delete single objects (in app, Erase tool or Delete key)**: Hide one unwanted object.
- **Sun handle on canvas**: Drag the sun to set direction.
- **Horizon handle**: Drag the horizon up and down.
- **Path drawing**: Draw rivers and roads as curves.
- **Keyboard shortcuts (in app, for undo/redo)**: Quick commands.

### 17.4 Exploring variations

- **Reseed gallery (in app, Pick from 8)**: A grid of thumbnails with different seeds for one layer.
- **Randomise one settings section (in app, dice per section)**: Random values for just one group of settings.
- **Randomise within limits**: Shuffle all settings inside safe ranges.
- **Mutate**: Small random changes to the current scene.
- **Mix two scenes**: Blend settings from two saved scenes.
- **Favourites**: Mark good results while exploring.
- **History timeline**: Jump back to any earlier state.

### 17.5 Saving, sharing and output

- **Undo and redo (in app)**: Step backward and forward through changes.
- **Autosave (in app)**: The current scene survives a reload.
- **Saved scenes (in app)**: Named scenes kept in the browser.
- **Export and import JSON (in app)**: Save scenes as files and load them back.
- **Export PNG (in app)**: Save the picture as an image.
- **Notes (in app)**: A place to jot ideas in the library.
- **Techniques catalogue with Try buttons (in app)**: Built, partial and idea entries that can be applied to the scene.
- **High-resolution export**: Save at larger sizes for print.
- **SVG export**: Save as scalable vector shapes.
- **Layered export**: Each band as a separate image, for parallax or editing elsewhere.
- **Animated export**: Short loops of drifting clouds or swaying grass.
- **Share link**: A link that opens the same scene.
- **Scene thumbnails in library**: Small previews next to saved scenes.

### 17.6 Help and learning

- **Tooltips on every setting**: One-line explanations.
- **Guided presets**: Presets that explain what each step does.
- **Before / after examples for techniques**: Pictures showing the effect.
- **Glossary**: Plain meanings of art terms used in the app.

## 18. Presets: full scene recipes

### 18.1 Presets already in the app

- **Golden valley (in app)**: The default: low warm sun, fields and a river in the middle ground, soft depth blur and grain.
- **Alpine lake (in app)**: Snowy peaks mirrored in still water, pines up close.
- **Desert mesas (in app)**: Flat-topped rock ranges, dry scrub and a high hard sun.
- **Backlit evening (in app)**: Low warm sun ahead of the viewer, silhouettes with rim light.
- **Misty ridges (in app)**: Many ridges stepping back in small even value steps.
- **Graphic poster (in app)**: Two-step shading, ink outlines, three value groups.
- **One layer per band (in app)**: A bare starting point with one default layer in each band.

### 18.2 Mountains

- **Alpine lake morning (partly, via the Alpine lake preset)**: Snow peaks reflected in a still lake with pines at the edge.
- **Alpenglow peaks**: Pink-lit summits over a darkening valley.
- **High pass with prayer flags**: A rocky saddle with flags and far peaks.
- **Volcano over plains**: A single cone rising from flat farmland.
- **Karst river**: Limestone towers along a winding river with a small boat.
- **Mountain storm**: Dark clouds rolling over a sunlit ridge.
- **Above the clouds**: Peaks poking through a sea of cloud.
- **Glacier valley**: Ice tongue, moraines and a milky lake.
- **Hut on a ridge**: A tiny shelter on a long ridge with deep drop-offs.
- **Scree slope and tarn**: Grey rock slopes around a small dark lake.

### 18.3 Forests and woodland

- **Misty pine forest**: Layers of conifers fading into fog.
- **Autumn woodland path**: A path under golden trees with leaf litter.
- **Birch grove in spring**: White trunks and fresh green.
- **Bluebell wood**: Blue flower carpet under beech trees.
- **Forest clearing with light shafts**: A glade lit by beams.
- **Redwood giants**: Huge trunks with tiny figures.
- **Rainforest river**: Dense tropical green over brown water.
- **Winter forest**: Snow-laden spruces and blue shadows.
- **Bamboo grove**: Tall stems with filtered green light.
- **Burnt forest regrowth**: Black trunks with bright new green below.

### 18.4 Lakes, rivers and waterfalls

- **Lakeside dock at dawn**: A jetty into mist-covered water.
- **River bend in summer**: An S-curve river through meadows.
- **Waterfall glen**: A tall fall into a mossy pool.
- **Canal with windmills**: Straight water, flat land and windmills.
- **Stepping stones stream**: A shallow brook with stones and ferns.
- **Lily pond**: Still water with lilies and willow reflections.
- **Frozen lake**: Snow-dusted ice with skaters as tiny figures.
- **Marsh at sunset**: Reeds, pools and flying geese.
- **Mountain river rapids**: White water between boulders.
- **Estuary at low tide**: Shiny mud flats and stranded boats.

### 18.5 Coast and sea

- **Coastal cliffs**: High cliffs, sea stacks and wheeling gulls.
- **Lighthouse headland**: A lighthouse on a grassy point in wind.
- **Tropical beach**: Palms, white sand and turquoise water.
- **Stormy sea**: Breaking waves under a dark sky.
- **Fishing harbour**: Moored boats, harbour wall, houses.
- **Pebble beach at dusk**: Smooth stones and calm grey sea.
- **Fjord**: Steep walls dropping into long water.
- **Great wave**: A woodblock-style wave with a far peak.
- **Dune coast**: Grassy dunes and a wide empty beach.
- **Island chain**: Small islands stepping into haze.

### 18.6 Desert and arid

- **Desert mesa sunset (partly, via the Desert mesas preset at midday)**: Flat-topped red rock against an orange sky.
- **Sand sea**: Endless dunes with long shadows.
- **Oasis**: Palms and a pool among dunes.
- **Canyon overlook**: Layered canyon walls from above.
- **Saguaro evening**: Cactus silhouettes against a pink sky.
- **Salt flat mirror**: A perfectly flat reflective plain.
- **Badlands**: Striped eroded hills under a hard sun.
- **Savanna acacia**: Flat-topped trees and a big sky.
- **Joshua tree plain**: Spiky trees on a boulder-strewn flat.

### 18.7 Farmland and rural

- **Rice terraces**: Stepped reflecting paddies on a hillside.
- **Rolling farmland patchwork**: Coloured fields divided by hedges.
- **Tuscan hills**: Cypress avenue, farmhouse and golden fields.
- **Lavender rows**: Purple stripes leading to a stone house.
- **Wheat field and red barn**: Golden grain, a barn and a big sky.
- **Vineyard slopes**: Rows of vines over hills at golden hour.
- **Sheep on the downs**: White dots on smooth green hills.
- **Country road with poles**: A road and power line to the horizon.
- **Orchard in blossom**: Rows of pink-white trees.
- **Hay harvest**: Bales in a stubble field at sunset.

### 18.8 Winter

- **Winter field**: Snow-covered field, fence line and bare trees.
- **Cabin in snow**: A lit cabin under snowy pines at dusk.
- **Frosty morning**: White-edged grass and low mist.
- **Snowy village**: Roofs, a church spire and chimney smoke.
- **Ice and snow peaks**: Bright white summits under deep blue sky.
- **Blizzard pass**: Figures and poles fading into blowing snow.

### 18.9 Weather and mood

- **Rainy valley**: Rain curtains, grey haze and wet greens.
- **After the storm**: Rainbow, bright sunlit field, dark departing clouds.
- **Foggy morning field**: A lone tree in ground fog.
- **Thunderstorm plain**: Lightning over a wide flat land.
- **Windy hillside**: Bending grass and leaning trees.
- **Heat of summer**: Bleached sky, heat haze, dry grass.
- **Autumn gale**: Blowing leaves and torn clouds.
- **Overcast moor**: Muted heather and grey sky.

### 18.10 Night and twilight

- **Starry mountain night**: Milky Way over dark peaks.
- **Moonlit lake**: A moon path on water between dark trees.
- **Aurora over tundra**: Green curtains over snow.
- **Village lights at dusk**: Warm windows in a blue valley.
- **Campfire in the woods**: Firelit trunks and a dark sky.
- **Firefly meadow**: Glowing dots over grass at dusk.

### 18.11 Stylised and graphic

- **Travel poster peaks**: Flat bold mountains and a big sun.
- **Woodblock river village**: Flat colours, outlines, gradient sky.
- **Ink wash mountains**: Monochrome peaks in mist, scroll format.
- **Paper-cut layers**: Flat stacked hills with drop shadows.
- **Low-poly valley**: Faceted hills and trees.
- **Pixel-art sunset**: Blocky pixels with a banded sun.
- **Silhouette sunset**: Black land shapes on a colourful sky.
- **Retro banded sun**: Stripes across the sun over flat hills.
- **Stained-glass landscape**: Flat colour cells with dark lines.

### 18.12 Studies (single-idea exercises)

- **Value steps study**: Five ridges in even value steps (close to Misty ridges).
- **Two-value study**: A scene designed to read in pure light and dark.
- **Single tree study**: One tree in a field, testing silhouette and light.
- **Cloud study**: Sky only, several cloud types.
- **Rock study**: Boulders only, testing round-versus-square shading.
- **Edge study**: Same scene with hard, soft and lost edges.
- **Colour temperature study**: Warm light and cool shadow on simple forms.
- **Backlight study**: Silhouettes and rim light only.
- **Framing study**: One view with different framing devices.
- **Rhythm study**: Fence posts and trees with varied spacing.

## 19. Single-layer recipes

*Small ready-made layers to drop into any scene. The app calls these layer presets.*

- **Pine stand (in app)**: A group of conifers in the close band.
- **Poplar row (in app)**: A line of narrow poplars in the middle distance.
- **Weeping willow (in app)**: One large willow up close.
- **Palms (in app)**: Two leaning palms.
- **Rule-grown bush (in app)**: L-system bushes in the middle foreground.
- **Rock outcrop layer (in app)**: A large hard-edged rock group.
- **Wildflower meadow (in app)**: Dense grass with many pink flower dots.
- **Hedgerow fields (in app)**: Field strips with hedges.
- **Fence line (in app)**: A single post-and-rail fence.
- **Winding river (in app)**: A meandering river ribbon.
- **Dirt road (in app)**: A narrow road ribbon with bank shapes.
- **Lake reflection (in app)**: A water layer in the middle distance.
- **Snowy peaks (in app)**: A sharp far ridge with snow caps.
- **Mesas (in app)**: A flat-topped far ridge.
- **Cirrus wisps (in app)**: High thin cloud streaks.
- **Framing branch preset (in app)**: A dark leafy branch from the right edge.
- **Your own saved layer presets (in app)**: Any layer saved for reuse.
- **Pine tree line**: A row of small conifers along a hill base.
- **Broadleaf tree line (in app, in the default scene)**: A row of small rounded trees.
- **Bush row**: A scatter of bushes in the middle foreground.
- **Rock group (in app, in the default scene)**: A few hard-edged boulders in the close band.
- **Flowering grass strip (in app, in the default scene)**: Grass tufts with flower dots.
- **Far snowy range**: A pale ridge with white tops.
- **Near dark ridge**: A dark, detailed ridge close behind the foreground.
- **Cloud bank**: Low clouds along the horizon.
- **High cirrus**: Thin streaks near the top of the sky.
- **Reed bed**: Reeds along a water line.
- **Foreground boulders with moss**: Big rocks with green tops.
- **Autumn leaf scatter**: Leaves on the ground in the close band.
- **Fog strip**: A soft horizontal fog band.
- **Bird flock**: A few birds in the sky band.

## 20. Pigment library (conventional artist paints)

*A pigment is the coloured powder in a paint. Its Colour Index code (for example PB29) names the actual chemical, so two brands with the same code behave alike. "Warm" or "cool" bias means which way a colour leans (a red leaning orange is warm; a red leaning violet is cool). Codes below are the usual modern ones; some paints are sold as mixes, marked as such.*

### 20.1 Pigment properties

- **Colour Index code**: The standard pigment name (PB = blue, PY = yellow, PR = red, PG = green, PO = orange, PV = violet, PBr = brown, PBk = black, PW = white).
- **Temperature bias**: Whether the colour leans warm or cool compared with a pure hue.
- **Masstone and undertone**: The colour in a thick layer versus a thin or tinted layer, which can differ a lot.
- **Opacity**: How well a paint covers what is under it.
- **Transparency**: How much light passes through, letting under-layers glow.
- **Tinting strength**: How strongly a pigment changes a mix; phthalos are very strong, earths are gentle.
- **Staining**: Whether the pigment soaks into paper and cannot be lifted.
- **Granulating**: Pigment particles settle into the paper grain, giving a speckled texture.
- **Flocculation**: Particles clump into soft blotches as the paint dries.
- **Lightfastness**: How well a colour resists fading in light (rated I to V, I being best).
- **Drying rate (oil)**: How fast a colour dries; umbers are fast, cadmiums slow.
- **Darkest value**: How dark the pigment can go on its own, which limits its use for shadows.
- **Maximum chroma**: The most intense colour the pigment can give.
- **Toxicity**: Some historic pigments (lead, cadmium, cobalt) need care in handling.
- **Genuine versus hue**: "Hue" on a label means a substitute mix imitating a traditional pigment.
- **Single pigment versus convenience mix**: One-pigment paints mix cleaner; ready mixes save time but can muddy.

### 20.2 Whites

- **Titanium white (PW6)**: Very opaque, bright, slightly cool; the strongest white for covering.
- **Zinc white (PW4)**: Cooler and more transparent; good for gentle tints and glazes.
- **Lead white / flake white (PW1)**: Warm, flexible and buttery in oil; toxic.
- **Buff titanium (PW6:1)**: An off-white, warm cream for soft lights.
- **Chinese white (PW4)**: The zinc white sold for watercolour and gouache.

### 20.3 Blacks and greys

- **Ivory / bone black (PBk9)**: A soft, slightly warm-brown black; the black of the Zorn palette.
- **Lamp black (PBk6)**: A dense, cool, opaque black.
- **Carbon black (PBk7)**: A very strong neutral black.
- **Mars black (PBk11)**: An opaque iron-oxide black, heavy and neutral to warm.
- **Graphite grey (PBk10)**: A shiny, soft grey made from graphite.
- **Davy's grey (usually a mix based on slate powder, PBk19)**: A light greenish grey for muting colours.
- **Payne's grey (mix, often ultramarine plus black)**: A dark blue-grey used for skies, water and shadows.
- **Neutral tint (mix)**: A cool dark grey for glazing shadows.
- **Perylene black (PBk32)**: A very dark black with a green or violet cast, transparent in thin layers.

### 20.4 Blues

- **Ultramarine blue (PB29)**: Warm, violet-leaning blue; transparent and granulating; the classic sky and shadow blue.
- **Phthalo blue, green shade (PB15:3)**: Cool, intense, staining, very strong; a little goes a long way.
- **Phthalo blue, red shade (PB15:1 or PB15:6)**: Like PB15:3 but leaning slightly violet.
- **Cobalt blue (PB28)**: A clean, fairly neutral blue; semi-transparent, weak tinting, gently granulating.
- **Cerulean blue (PB35)**: A slightly green, opaque sky blue; granulates.
- **Cerulean chromium / cobalt turquoise (PB36)**: A greener, brighter cerulean.
- **Prussian blue (PB27)**: A deep, cool, staining blue, darker than phthalo in masstone.
- **Indanthrone blue (PB60)**: A deep, slightly dull, violet-leaning blue; good for dark skies.
- **Manganese blue (PB33, now rare; hues are common)**: A bright, clear, granulating greenish blue.
- **Indigo (usually a mix today)**: A very dark, cool blue-black for night skies and deep shadows.

### 20.5 Greens

- **Viridian (PG18)**: A cool, transparent blue-green; weaker than phthalo, granulates slightly.
- **Phthalo green, blue shade (PG7)**: Intense cool green; strong and staining.
- **Phthalo green, yellow shade (PG36)**: A warmer, brighter phthalo green.
- **Chromium oxide green (PG17)**: Opaque, dull, earthy green; good for distant foliage.
- **Terre verte / green earth (PG23)**: A weak, transparent grey-green; traditional for underpainting skin and soft landscapes.
- **Cobalt green (PG19)**: A pale, weak, opaque green.
- **Cobalt teal (PG50)**: A bright, opaque blue-green.
- **Perylene green (PBk31)**: A very dark, cool green-black for deep foliage shadows.
- **Green gold (PY129)**: A transparent yellow-green glow, lovely for sunlit leaves.
- **Sap green (mix)**: A warm, ready-mixed leaf green.
- **Hooker's green (mix)**: A deep, slightly blue leaf green.
- **Olive green (mix)**: A dull yellow-green for dry foliage.

### 20.6 Yellows

- **Yellow ochre (PY43, natural; PY42, synthetic)**: An opaque, earthy, warm yellow; the base of many landscape palettes.
- **Raw sienna (PBr7)**: A transparent golden-brown yellow for warm glows.
- **Transparent yellow oxide (PY42)**: A transparent ochre for glazing.
- **Cadmium yellow light (PY35)**: A bright, opaque, slightly cool yellow.
- **Cadmium yellow medium / deep (PY35 or PY37)**: Warmer, more orange cadmium yellows.
- **Hansa yellow light (PY3)**: A cool, lemony, transparent yellow; non-toxic.
- **Hansa yellow medium (PY74 or PY97)**: A warmer transparent yellow.
- **Lemon yellow (often PY3 or PY175)**: A cool, greenish yellow for spring greens.
- **Bismuth vanadate yellow (PY184)**: A clean, opaque yellow used in place of cadmium.
- **Nickel titanate yellow (PY53)**: A pale, soft, opaque yellow for light skies.
- **Aureolin / cobalt yellow (PY40)**: A transparent, slightly cool yellow; delicate.
- **Indian yellow (modern versions often PY153 or PY110)**: A glowing, transparent deep yellow.
- **Naples yellow (genuine PY41, usually a mix today)**: A pale, creamy, warm yellow for sunlit skies.
- **Quinacridone gold (usually a mix today)**: A transparent golden yellow for autumn light.

### 20.7 Oranges and warm earths

- **Cadmium orange (PO20)**: A bright, opaque orange.
- **Pyrrole orange (PO73)**: An intense, fairly opaque orange.
- **Benzimidazolone orange (PO62)**: A clean, fairly transparent orange.
- **Burnt sienna (PBr7)**: A warm, transparent red-brown; mixed with ultramarine it gives a wide range of greys.
- **Transparent red oxide (PR101)**: A glowing transparent rust colour.
- **Light red / English red (PR101)**: An opaque, warm brick red earth.

### 20.8 Reds

- **Cadmium red light / medium (PR108)**: A warm, opaque, strong red.
- **Pyrrole red (PR254)**: An intense, fairly opaque scarlet; a common cadmium alternative.
- **Naphthol red (PR112 or PR170)**: A bright, fairly transparent warm red.
- **Vermilion (PR106)**: A historic orange-red made from mercury; now mostly a hue.
- **Alizarin crimson (PR83)**: A cool, deep, transparent red; fades in light.
- **Permanent alizarin substitutes (often PR177, PR206 or quinacridone mixes)**: Lightfast versions of crimson.
- **Quinacridone rose (PV19)**: A cool, transparent pink-red; mixes clean violets.
- **Quinacridone magenta (PR122)**: A cool magenta; a printer-like primary.
- **Perylene maroon (PR179)**: A deep, dusky red for darks.
- **Venetian red (PR101)**: An opaque, earthy red.
- **Indian red (PR101)**: A cool, purplish earth red.
- **Potter's pink (PR233)**: A soft, granulating, greyed pink.

### 20.9 Violets

- **Dioxazine violet (PV23)**: A very strong, dark violet; can overpower mixes.
- **Quinacridone violet (PV19)**: A transparent, reddish violet.
- **Cobalt violet (PV14)**: A delicate, weak, granulating violet.
- **Manganese violet (PV16)**: A dull, fairly opaque violet.
- **Ultramarine violet (PV15)**: A soft, granulating blue-violet for shadows.
- **Mars violet / caput mortuum (PR101)**: An earthy purple-brown.

### 20.10 Browns

- **Raw umber (PBr7)**: A cool, greenish brown; dries fast in oil.
- **Burnt umber (PBr7)**: A warm, dark brown.
- **Van Dyke brown (now usually a mix)**: A deep, cool brown.
- **Sepia (usually a mix today)**: A dark, warm grey-brown, historically from cuttlefish ink.
- **Transparent brown oxide (PR101)**: A warm glazing brown.

### 20.11 Classic limited palettes

- **Zorn palette**: Yellow ochre, vermilion (or cadmium red), ivory black and white; a surprising range from four paints.
- **Zorn with ultramarine**: Ultramarine added for real blues in skies and water.
- **Zorn with cobalt**: Cobalt blue replacing black for gentler greys.
- **Cool Zorn**: Black swapped for Payne's grey for bluer shadows.
- **Four-colour antique palette**: White, black, red ochre and yellow ochre, as described for ancient Greek painters.
- **Traditional primary triad**: Cadmium yellow, cadmium red and ultramarine.
- **Modern primary triad**: Hansa yellow, quinacridone rose and phthalo blue; mixes clean, bright secondaries.
- **Split-primary palette**: A warm and a cool version of each primary (six paints) for clean mixing.
- **Earth triad**: Yellow ochre, light red and a dark blue-grey (indigo or Payne's grey); gentle, harmonious landscapes.
- **Old-master earth palette**: Yellow ochre, raw umber, burnt sienna, black and white.
- **Ultramarine and burnt sienna pair**: Two paints that make a full range of warm and cool greys.
- **Payne's grey monochrome**: One blue-grey plus white or paper for value studies.
- **Payne's grey plus one**: Payne's grey with one warm accent (burnt sienna or ochre).
- **Sepia monochrome**: Sepia and paper for old-style studies.
- **Plein-air (outdoor) oil set**: White, cadmium yellow light, cadmium red, alizarin or quinacridone, ultramarine, viridian or phthalo green, yellow ochre and burnt sienna.
- **Impressionist palette**: Bright pure colours, no earths and no black.
- **Tonalist palette**: Earths, muted greens and greys for quiet, misty scenes.
- **Desert earth palette**: Yellow ochre, burnt sienna, light red, cobalt and white.
- **Winter palette**: Ultramarine, burnt sienna, cerulean and white.
- **Tropical palette**: Phthalo blue, phthalo green, hansa yellow, quinacridone rose.

### 20.12 Starter sets by medium

- **Watercolour starter (6 to 12 pans)**: A warm and cool of each primary plus ochre, burnt sienna and a dark.
- **Gouache starter**: A primary triad plus white and black; gouache is opaque and matte.
- **Oil starter**: Around eight tubes: white, two yellows, two reds, two blues, one earth.
- **Acrylic starter**: Similar to oil, with fast-drying, slightly darker-when-dry colours.
- **Ink wash set**: A single black ink diluted into many greys.
- **Coloured-ink set**: A few transparent inks for bright glazes.
- **Pastel landscape set**: Many pre-mixed values of greens, blues and earths.

### 20.13 Mixing models

- **Subtractive mixing**: Paint mixes absorb more light, so they get darker and duller.
- **Kubelka–Munk model**: A physical model that describes each pigment by how it absorbs and scatters light, predicting realistic paint mixes.
- **Single-constant Kubelka–Munk**: A simpler version using one number pair per pigment.
- **Spectral mixing**: Mixing full reflectance curves instead of three RGB numbers, giving paint-like results.
- **Latent pigment mixing**: A method that turns colours into amounts of a few base pigments, mixes those, and converts back (used by published libraries such as Mixbox).
- **Digital averaging (RGB)**: Plain averaging of screen colours; blue and yellow give grey, not green.
- **Averaging in linear light**: Better for mixing light, still not like paint.
- **Averaging in OKLab**: Smooth, even-looking blends with no dark dip, but still not paint-like.
- **Glazing (multiply)**: A transparent layer over another, like multiplying colours.
- **Scumbling**: A thin opaque light layer over dark, which looks cooler and bluish.
- **Optical mixing**: Small dots of separate colours blending in the eye, as in pointillism.
- **Broken colour**: Strokes of different colours laid side by side without full blending.

### 20.14 How mixes would look

- **Mud risk**: Mixing many pigments, or too much of a complement, gives dull brown-grey.
- **Clean secondaries**: Mixing two pigments that lean toward each other (a green-leaning blue with a green-leaning yellow) gives bright results.
- **Dull secondaries**: Mixing pigments that lean away (a violet-leaning blue with an orange-leaning yellow) gives muted results.
- **Tinting with white cools and chalks**: White makes reds pinker and cooler, and can look chalky.
- **Yellow plus black makes olive**: Black added to yellow turns it greenish.
- **Complement greys**: Ultramarine and burnt sienna, or viridian and alizarin, give rich coloured greys.
- **Granulating washes**: Ultramarine, cerulean and earth washes break into speckled texture.
- **Staining underlayers**: Phthalos and quinacridones cannot be lifted once dry.
- **Watercolour dries lighter**: Wet washes look darker than the dry result.
- **Acrylic dries darker**: Colours shift a little darker as they dry.
- **Blooms / backruns**: Wet paint creeping into a drying wash makes a cauliflower edge.
- **Edge darkening**: Watercolour pigment gathers at the edge of a wash as it dries.
- **Glazed glow**: Transparent layers over white give a luminous colour.
- **Opaque flatness**: Gouache and heavy opaque mixes give matte, flat areas.
- **Overpowering strength**: A strong pigment (phthalo, dioxazine) takes over a mix quickly.
- **Mixable-gamut preview**: Showing which scene colours a chosen paint set can and cannot reach.

## 21. Abstract shape library

*Shapes that are not tied to one material. Any of them could join the shape vocabulary or act as a building block.*

### 21.1 Geometric primitives

- **Dot**: A tiny filled circle.
- **Line segment**: A straight stroke with two ends.
- **Rectangle**: A four-sided shape with right angles, any proportion.
- **Rhombus / diamond**: A tilted square with equal sides.
- **Parallelogram**: A slanted rectangle.
- **Trapezoid**: Four sides with one parallel pair, like a cut-off triangle.
- **Right triangle**: A triangle with one square corner.
- **Isosceles triangle**: A tall triangle with two equal sides, like a fir tree.
- **Pentagon, hexagon, octagon**: Regular shapes with five, six or eight sides.
- **Regular n-gon**: A regular shape with any number of sides.
- **Star polygon**: A star with any number of points and inner radius.
- **Semicircle**: Half a circle, like a sunrise.
- **Arc**: A curved stroke from part of a circle.
- **Annulus sector**: A curved band cut from a ring, like a rainbow piece.
- **Stadium / capsule**: A rectangle with round ends.
- **Cross / plus**: Two bars crossing.
- **Chevron**: A V-shaped bar, like a bird mark.
- **Arrowhead**: A pointed triangle with a notch.
- **Archimedean spiral**: A spiral with evenly spaced turns.
- **Logarithmic spiral**: A spiral that widens as it turns, like a shell.

### 21.2 Superellipses and formula shapes

- **Superellipse (squircle)**: A shape between a circle and a square, set by one roundness number.
- **Lamé curve**: The formula behind superellipses, allowing star-like to box-like shapes.
- **Superformula**: A single formula that makes flowers, stars, shells and leaves by changing a few numbers.
- **Rounded polygon**: Any polygon with softened corners.
- **Rose curve**: A petal pattern from a simple wave around a circle.
- **Lissajous figure**: Looping curves from two waves at right angles.
- **Fourier shape**: A circle whose radius is changed by a few waves, giving lumpy organic outlines.
- **Cardioid**: A heart-like curve.
- **Teardrop curve**: A smooth drop shape from a formula.
- **Lemniscate**: A figure-eight curve.

### 21.3 Organic and biomorphic shapes

*Biomorphic means shaped like living things without copying a particular one.*

- **Amoeba**: A soft blob with a few lobes.
- **Pebble**: A slightly flattened rounded shape.
- **Bean / kidney**: An oval with one side pushed in.
- **Lobe cluster**: Several bulges joined into one shape.
- **Petal**: A soft pointed oval, wider near the tip.
- **Seed / grain**: A small pointed oval.
- **Cell**: A rounded polygon, as in plant tissue.
- **Droplet**: A drop with a rounded bottom and a point.
- **Splash**: A central blob with spiky sprays.
- **Puddle shape**: A flat irregular pool outline.
- **Coral branch**: A soft branching form.
- **Root tangle**: Wandering, forking thin shapes.
- **Noise blob**: A circle whose edge is pushed in and out by noise.
- **Bezier blob**: A smooth closed curve through a few random points.
- **Closed spline**: A smooth loop passing through chosen points.

### 21.4 Field-based and computed shapes

- **Metaballs**: Soft balls that melt together when close, like drops of mercury.
- **Smooth union shapes**: Two shapes blended with a soft fillet where they meet.
- **Signed-distance shapes**: Shapes defined by distance to their edge, easy to round, grow or blend.
- **Voronoi cells**: Space split into cells around scattered points, like cracked mud or giraffe patches.
- **Delaunay triangles**: A mesh of triangles joining scattered points.
- **Convex hull**: The tight rubber-band outline around a group of points.
- **Concave hull**: A closer-fitting outline that follows inward bends.
- **Contour shapes**: Outlines traced at one level of a noise field, like map contours.
- **Reaction-diffusion patterns**: Spots and stripes grown by a chemistry-like simulation, as on animal skins.
- **Circle packing**: Circles of different sizes filling an area without overlapping.
- **Rectangle packing**: Boxes fitted tightly into an area.
- **Weighted Voronoi stippling**: Dots placed so their density follows a tone.

### 21.5 Fractals

*A fractal is a shape that repeats its own pattern at smaller and smaller scales.*

- **Koch snowflake**: A triangle whose edges gain smaller triangles again and again.
- **Sierpinski triangle**: A triangle with ever smaller triangular holes.
- **Dragon curve**: A folded, space-filling zig-zag line.
- **Hilbert curve**: A single line that winds to fill a square.
- **Mandelbrot and Julia outlines**: Famous endlessly detailed shapes from simple sums.
- **Fractal coastline**: A line broken by midpoint displacement into a rugged edge.
- **Barnsley fern**: A fern shape made by repeating a few transforms.
- **Pythagoras tree**: Squares branching into smaller squares like a tree.
- **Cantor dust**: A line or area broken into gaps at every scale.
- **Iterated function systems**: A general method for fractals using repeated shrink-and-place rules.
- **Diffusion-limited aggregation**: Particles wandering and sticking, growing coral or frost shapes.
- **Fractal branching**: Branches that split into smaller copies of themselves.

### 21.6 Glyph-like marks

- **Tick**: A short check-mark stroke.
- **Dash**: A short straight stroke.
- **Comma**: A dot with a tail.
- **C-curve**: A short curved stroke, good for foliage.
- **Squiggle**: A wavy short line.
- **Loop**: A small curl.
- **Zig-zag mark**: A short saw-tooth stroke for grass or rock.
- **Tilde / wave mark**: A small wave for water.
- **V-mark**: A tiny V for distant birds.
- **X-mark**: A crossed pair of strokes.
- **Asterisk**: A small starburst of strokes.
- **Spiral glyph**: A small curling mark.
- **Wedge mark**: A small triangular stamp, like cuneiform.
- **Calligraphic stroke**: A stroke that swells and thins with direction.
- **Seal-script square**: A dense square mark of lines, like a carved seal.

### 21.7 Brush-mark families

- **Dab**: A short, round press of the brush.
- **Flat stroke**: A broad, square-ended stroke.
- **Round stroke**: A stroke with a pointed start and end.
- **Dry-brush stroke**: A broken, scratchy stroke with gaps.
- **Fan-brush flick**: A spray of fine lines for grass or foliage.
- **Rigger line**: A long, thin, wandering line for branches and masts.
- **Sponge dab**: A blotchy textured patch.
- **Stipple dab**: A cluster of small dots from an upright brush.
- **Splatter flick**: Random droplets flicked from a brush.
- **Palette-knife slab**: A flat, sharp-edged patch of thick paint.
- **Scumble**: A loose, scrubbed patch of broken colour.
- **Wash**: A broad, smooth, transparent area.
- **Blot**: An ink blot with soft spreading edges.
- **Ink brush (sumi) stroke**: A bold stroke that changes from wet to dry along its length.
- **Rake / comb stroke**: Several parallel lines from a split brush.
- **Stamp**: A repeated printed shape, like a potato print.

### 21.8 Tiling and pattern units

- **Square grid**: Cells in rows and columns.
- **Hex grid**: Six-sided cells like a honeycomb.
- **Triangle grid**: Cells of alternating triangles.
- **Brick offset**: Rows shifted by half a cell.
- **Herringbone**: Rectangles in a zig-zag V pattern.
- **Basketweave**: Pairs of bars alternating direction.
- **Fish scale**: Overlapping round-bottomed scales.
- **Seigaiha**: The Japanese pattern of overlapping wave arcs.
- **Asanoha**: The Japanese hemp-leaf star pattern.
- **Shippo**: Overlapping circles forming petal shapes.
- **Truchet tiles**: Simple tiles (arcs or diagonals) placed at random rotations to make maze-like patterns.
- **Wang tiles**: Tiles with matching edges for endless non-repeating fills.
- **Penrose tiling**: A pattern that never repeats, made from two shapes.
- **Aperiodic monotile**: A single tile shape that fills the plane without ever repeating.
- **Islamic star pattern**: Interlaced stars and polygons from compass-and-ruler rules.
- **Wallpaper symmetry groups**: The 17 ways a pattern can repeat on a flat surface.
- **Rosette**: A pattern repeated around a centre point.
- **Greek key / meander**: A continuous right-angled line pattern.
- **Checkerboard**: Alternating light and dark squares.
- **Stripes and bands**: Parallel strips of varying width.
- **Polka dots**: Evenly spaced circles.
- **Ogee**: An onion-shaped repeating curve.
- **Quatrefoil**: A four-lobed shape repeated.
- **Paisley**: A curved teardrop motif.

### 21.9 Shape grammars and rule systems

*A shape grammar is a set of rules that replaces or splits shapes step by step to build a design.*

- **Split grammar**: Divide a shape into parts, then divide those parts, as for building facades.
- **Recursive subdivision**: Keep cutting rectangles into smaller ones, as in Mondrian-like layouts.
- **Repeat rule**: Copy a shape along a line or grid.
- **Radial repeat rule**: Copy a shape around a centre.
- **Mirror rule**: Reflect a shape to make symmetry.
- **Stacking rule**: Place shapes on top of others (a hat on a rock, snow on a branch).
- **L-system (in app, for trees)**: Rewrite rules for branching forms.
- **Cellular automata**: Grid cells that turn on or off by neighbour rules, growing patterns.
- **Wave function collapse**: Fills a grid with tiles that fit their neighbours, giving varied but consistent layouts.
- **Grammar weights**: Rules chosen with set chances for controlled variety.

### 21.10 Shape modifiers

- **Boolean union**: Join two shapes into one.
- **Boolean subtract**: Cut one shape out of another.
- **Boolean intersect**: Keep only the overlap.
- **Boolean exclude**: Keep everything except the overlap.
- **Offset outward**: Grow a shape evenly all round.
- **Inset**: Shrink a shape evenly all round.
- **Contour repeat**: Several offset copies, like map contours.
- **Round corners (fillet)**: Soften sharp corners into curves.
- **Chamfer**: Cut corners off straight.
- **Corner-cutting smoothing (in app, for drawn shapes)**: Rounds an outline a little more with each pass.
- **Simplify**: Remove points while keeping the overall shape.
- **Subdivide**: Add points so the outline can bend more smoothly.
- **Roughen edge (in app, as edge noise)**: Push the outline in and out with noise.
- **Fracture / shatter**: Break a shape into shards, e.g. with Voronoi cells.
- **Slice**: Cut a shape along a line into two.
- **Mirror**: Flip a shape.
- **Radial array**: Copies arranged in a circle.
- **Skew**: Slant a shape sideways.
- **Taper**: Narrow one end.
- **Bend**: Curve a shape along an arc.
- **Twist**: Rotate a shape more at one end than the other.
- **Bulge / pinch shape**: Swell or squeeze the middle of a shape.
- **Wave along**: Make an edge ripple along its length.
- **Quantise angles**: Snap edges to a few directions for a low-poly or crystal look.
- **Erode and dilate**: Eat into or grow a shape, removing or filling small details.
- **Outline to shape**: Turn a stroke into a filled shape.
- **Cut holes**: Punch smaller shapes out of a larger one.
- **Morph**: Blend smoothly from one shape to another.
- **Fringe along the edge (in app, for drawn shapes)**: Small shapes riding the outline to break it up.

## 22. Abstract effects

*Whole-picture or per-layer treatments that change how the image looks rather than what is in it. Section 15 lists the basic stylisation options; these are further variants.*

### 22.1 Tone quantising

- **Threshold (two-tone)**: Every pixel becomes pure light or pure dark.
- **Posterise in perceptual space**: Cutting values into steps in OKLab so steps look even.
- **Posterise per channel**: Cutting each colour channel separately for poster-like colour shifts.
- **Value-group snap**: Forcing every colour to the nearest value group level.
- **Palette snap**: Replacing every colour with the nearest colour from a fixed palette.

### 22.2 Dot and line screens

- **Ordered (Bayer) dither**: A regular grid pattern of dots that mixes two colours into tones.
- **Error-diffusion dither**: Spreading rounding errors to neighbours (as in Floyd–Steinberg), giving a grainy, organic look.
- **Blue-noise dither**: Evenly spread random dots with no visible pattern.
- **Amplitude halftone**: Dots of changing size on a fixed grid.
- **Frequency halftone**: Dots of fixed size with changing spacing.
- **Line halftone**: Parallel lines that thicken in dark areas.
- **Circular halftone**: Concentric rings that thicken with tone.
- **CMYK halftone rosette**: Four coloured dot screens at different angles, like printed magazines.
- **Stipple by tone**: Dots placed more densely in dark areas.
- **Hatching family: parallel**: Strokes all in one direction.
- **Hatching family: cross**: Two or more directions layered for darker tones.
- **Hatching family: contour**: Strokes following the form's curve.
- **Hatching family: scribble**: Loose looping strokes building tone.
- **Hatching family: tonal art map**: Hatch sets that add strokes smoothly as tone darkens.
- **ASCII art**: Tone shown by text characters.

### 22.3 Glitch and digital effects

- **Pixel sorting**: Runs of pixels sorted by brightness into streaks.
- **Channel shift**: Red, green and blue layers offset from each other.
- **Block displacement**: Rectangular chunks shifted sideways.
- **Scanlines**: Thin dark horizontal lines, like an old screen.
- **CRT curve and glow**: Bulging, glowing old-monitor look.
- **VHS wobble**: Jittery lines and colour bleeding, like videotape.
- **Datamosh smear**: Blocks of one image dragged over another.
- **Pixelate**: Big square pixels.
- **Mosaic tiles**: Small tiles with grout lines between them.
- **Crystallize**: The picture broken into Voronoi cells of flat colour.

### 22.4 Warps and distortions

- **Displacement map**: One image pushes the pixels of another around.
- **Kaleidoscope**: A slice of the picture mirrored around a centre.
- **Mirror halves**: One half reflected onto the other.
- **Polar warp**: The picture wrapped into a circle (a "tiny planet").
- **Swirl (in app, as a graph node)**: A twist around a point.
- **Ripple warp (in app, as a graph node)**: Circular waves pushing outward.
- **Wave warp**: Regular waves across the picture.
- **Fisheye / barrel**: Bulging lens distortion.
- **Heat haze warp**: Small wavy distortion in bands.
- **Liquify**: Pushing parts of the picture by hand.

### 22.5 Simulated media

- **Kuwahara filter**: A smoothing filter that keeps edges and gives an oil-paint look.
- **Watercolour simulation**: Wet edges, pooling, granulation and paper bleed.
- **Pencil sketch**: Grey graphite strokes and paper tooth.
- **Charcoal smudge**: Soft, dark, dusty marks.
- **Crayon wax**: Broken colour catching on paper texture.
- **Soft pastel**: Chalky strokes that break over the grain.
- **Oil impasto**: Thick paint ridges catching light.
- **Linocut**: Bold cut shapes with gouge marks.
- **Chalk on blackboard**: Light dusty marks on dark.
- **Blueprint**: White lines on blue.
- **Cyanotype**: Prussian-blue print tones.
- **Etching**: Fine lines with plate tone around them.

### 22.6 Light and lens effects

- **Anamorphic streak**: Horizontal light streaks from bright spots.
- **Radial chromatic aberration**: Colour fringes that grow toward the corners.
- **Starburst**: Spikes from bright light points.
- **Light leak**: Warm coloured glows bleeding in from an edge, like old film.
- **Lens dirt**: Soft spots that show when the sun is in frame.
- **Tilt-shift**: Blur above and below a sharp band, making the scene look like a model.
- **Lens blur (bokeh)**: Soft discs from out-of-focus lights.
- **Motion blur**: Streaks along a direction of movement.
- **Radial blur**: Streaks outward from a point, like a zoom.
- **Inner glow**: A soft light around the inside edge of shapes.
- **Outer glow**: A soft light around the outside edge of shapes.
- **Long shadow**: A flat, extended shadow from every shape at one angle, a graphic-design style.
- **Drop shadow**: A soft offset shadow under each layer, like stacked paper.

### 22.7 Texture overlays

- **Coloured noise**: Grain with colour variation.
- **Dust and scratches**: Specks and lines like an old print.
- **Fold and crease texture**: Light and dark lines like folded paper.
- **Torn paper edge**: A ragged fibrous border.
- **Deckled edge**: The wavy rough edge of handmade paper.
- **Stain and foxing**: Brown spots of age on paper.
- **Fabric weave**: Linen or canvas threads.
- **Wood grain**: Grain lines as in a woodblock print.
- **Concrete / plaster**: Rough mottled wall texture, for fresco looks.
- **Noise overlay per band**: Different grain amounts for near and far.

### 22.8 Colour effects

- **Solarise**: Tones partly inverted, giving strange halos.
- **Invert**: Light becomes dark and colours flip.
- **Channel mixer**: Rebuilding colour from blended channels.
- **Split toning**: One tint in the lights and another in the shadows.
- **Tritone**: Three inks for dark, middle and light tones.
- **Colour cycling**: Palette colours shifting over time for animated water or fire.
- **Hue shift by depth**: Hue rotates across depth bands.

## 23. Motion effects

*None of these exist in the app yet. They list what animating the scenes could involve.*

### 23.1 Depth and camera

- **Parallax by depth band**: Near bands move faster than far bands when the view shifts, giving strong depth.
- **Parallax scroll loop**: Endless sideways scrolling with each band wrapping, as in side-scrolling games.
- **Pan**: The view slides sideways across the scene.
- **Tilt**: The view slides up or down, e.g. from sky down to foreground.
- **Push-in**: A slow move toward the scene.
- **Pull-out**: A slow move away to reveal more.
- **Truck**: The camera slides sideways, so parallax shows depth.
- **Pedestal / crane rise**: The camera rises, revealing the land over a foreground edge.
- **Dolly-zoom**: Moving in while zooming out (or the reverse) so the subject stays the same size while the background grows or shrinks.
- **Ken Burns move**: A slow combined pan and zoom over a still picture.
- **Rack focus**: Depth blur shifts from one band to another.
- **Orbit (fake)**: Bands slide in opposite directions around a centre depth.
- **Camera shake**: Small quick jitter for storms or drama.
- **Handheld drift**: Slow, gentle wandering movement.
- **Reveal from behind**: The view moves past a foreground tree or rock to reveal the scene.

### 23.2 Wind and plants

- **Wind sway**: Trees, grass and branches bend and return.
- **Gust wave**: A band of stronger wind travelling across a field of grass.
- **Grass ripple**: Rolling waves through tall grass.
- **Leaf flutter**: Small fast jitter in individual leaves.
- **Branch bounce**: A framing branch bobbing after a gust.
- **Tree bend in a gust**: The whole crown leaning then settling.
- **Willow strands swinging**: Hanging strands swinging like pendulums.
- **Crops waving**: Wheat or rice moving in long waves.
- **Flowers nodding**: Flower heads bobbing on stems.

### 23.3 Sky and weather

- **Cloud drift**: Clouds sliding across the sky, faster when nearer.
- **Cloud growth**: Cumulus puffing up and changing shape.
- **Cloud shadow drift**: Dark patches moving over the hills.
- **Fog rolling**: Fog banks moving and thinning.
- **Mist rising**: Wisps lifting off water.
- **Rain particles**: Falling streaks, with splashes on the ground and water.
- **Snow particles**: Drifting flakes with wind wobble.
- **Hail bounce**: Pellets bouncing on the ground.
- **Lightning flash**: A bolt with the whole scene lighting up for a moment.
- **Rainbow fade**: A rainbow appearing and fading as light changes.
- **Stars twinkling**: Stars flickering gently.
- **Shooting star streak**: A quick streak across the night sky.
- **Aurora waving**: Curtains of light rippling.
- **Moving heat shimmer**: Wavy distortion moving above hot ground.
- **Dust devils**: Small spinning dust columns crossing a desert.

### 23.4 Water

- **Water shimmer**: Reflections breaking and rejoining in ripples.
- **Glint twinkle**: Sparkles on water appearing and vanishing.
- **River flow**: Surface streaks moving downstream.
- **Waves rolling in**: Rows of waves moving toward the shore and breaking.
- **Foam wash**: Lacy foam sliding up and back on sand.
- **Waterfall fall**: Streaks moving down with spray at the base.
- **Rain-drop rings**: Rings spreading from rain drops or fish.
- **Boat bobbing**: Boats rocking gently on the water.
- **Ice creaking**: Slow cracks appearing on a frozen lake.

### 23.5 Light and time

- **Light flicker**: Firelight or lanterns wavering.
- **Dappled light shifting**: Leaf-shadow patches moving as branches sway.
- **Light shafts shifting**: Beams moving and changing as clouds pass.
- **Sun movement**: The sun and shadows moving across a time-lapse.
- **Day-night cycle**: Sky, light colour, shadows and lights changing through a full day.
- **Sunset colour shift**: The sky and land warming then cooling as the sun sets.
- **Lights switching on**: Windows lighting up one by one at dusk.
- **Season change**: Foliage colour and snow cover changing over a year.
- **Weather change**: Clear sky clouding over into rain and clearing again.

### 23.6 Creatures, people and objects

- **Birds flying**: Birds crossing with a wing-flap cycle.
- **Flocking**: Many birds moving together with simple rules (as in "boids": keep apart, align, stay together).
- **Butterfly flutter**: Erratic fluttering paths over flowers.
- **Firefly blinking**: Dots drifting and blinking at dusk.
- **Fish jumping**: A splash and ripple on a lake.
- **Grazing animals**: Slow head-down, head-up loops.
- **Walking figure**: A tiny person walking along a path.
- **Smoke rising**: Chimney or campfire smoke curling upward.
- **Windmill turning**: Sails rotating steadily.
- **Flags flapping**: Cloth waving in the wind.
- **Washing on a line**: Clothes swinging.
- **Falling leaves**: Leaves tumbling and drifting down.
- **Blossom petals**: Petals floating on the air.
- **Dust motes**: Specks floating in a sunbeam.

### 23.7 Stylised motion

- **Boil**: Each frame redrawn with small random differences, so lines shimmer like hand-drawn animation.
- **Line wiggle**: Outlines gently wobbling over time.
- **Animating on twos**: Holding each drawing for two frames for a hand-animated feel.
- **Stepped motion**: Movement in visible jumps instead of smoothly.
- **Build-up reveal**: The scene drawing itself band by band, back to front.
- **Line-drawing reveal**: Outlines drawing on before fills appear.
- **Shape morphing**: One shape changing smoothly into another.
- **Growth animation**: Trees growing branch by branch from a seed point.
- **Colour grade transition**: A slow change from one palette to another.
- **Seed shuffle**: Stepping through random seeds as a flickering animation.

### 23.8 Easing curves

*Easing is how a movement speeds up and slows down between two points.*

- **Linear**: Constant speed; mechanical.
- **Ease in**: Starts slow, ends fast.
- **Ease out**: Starts fast, ends slow.
- **Ease in-out**: Slow at both ends, fastest in the middle.
- **Sine easing**: A gentle, natural curve.
- **Cubic and quintic easing**: Stronger versions with a sharper speed change.
- **Exponential easing**: Very slow then very fast (or the reverse).
- **Back / overshoot**: Goes slightly past the target then returns.
- **Elastic**: Springs back and forth before settling.
- **Bounce**: Bounces like a dropped ball.
- **Step / hold**: Jumps from value to value with no in-between.
- **Custom curve**: A hand-shaped curve with handles.
- **Spring easing**: Motion driven by a spring with stiffness and damping.
- **Anticipation and follow-through**: A small move the other way before the action, and a settle after it.

### 23.9 Looping

- **Seamless loop**: The last frame flows into the first with no jump.
- **Loop by periodic noise**: Noise sampled around a circle so it returns to where it started.
- **Ping-pong loop**: Playing forward then backward.
- **Cross-fade loop**: Blending the end into the start.
- **Layered loop lengths**: Different layers looping at different lengths for a less repetitive feel.
- **Loop length finder**: Choosing a length that all loops fit into evenly.
- **Phase offsets**: Each object starting its loop at a different point, so they do not move in step.

## 24. Motion rigging and animation tools

*Rigging means giving a drawing a control structure (bones, springs, handles) so it can be moved convincingly.*

### 24.1 Skeletons and bones

- **Bones from branch structure**: Using a generated tree's own branches as its skeleton.
- **Bones for grass blades**: A short chain per blade so it bends from the root.
- **Bones for framing branches**: A chain from the frame edge to the twig tips.
- **Bones for animals and figures**: Simple skeletons for walking and flying cycles.
- **Skinning**: Attaching shapes to bones so they move with them.
- **Weight falloff**: How strongly each bone moves nearby shapes.
- **Forward kinematics**: Rotating a parent bone moves all its children.
- **Inverse kinematics**: Moving a tip and letting the chain work out the bends.
- **Root pinning**: Keeping trunk bases and grass roots fixed in place.

### 24.2 Dynamics

- **Spring dynamics**: Parts pulled back to rest by a spring, with stiffness and damping.
- **Pendulum motion**: Hanging parts swinging under gravity.
- **Verlet chains**: A chain of points that behaves like a rope or vine.
- **Secondary motion (jiggle)**: Small parts lagging and overshooting after the main move.
- **Wind field**: A moving map of wind direction and strength across the scene.
- **Turbulence**: Swirling noise added to the wind.
- **Gust events**: Short bursts of stronger wind at chosen times.
- **Drag**: Movement slowing down in air or water.
- **Stiffness by thickness**: Thick trunks barely move; thin twigs move a lot.
- **Collision with ground**: Falling particles stopping or bouncing at the ground line.

### 24.3 Procedural motion

- **Noise-driven sway**: Each object sways by smooth noise, with its phase set by its position.
- **Time input in the node graph**: A time value in the existing distortion graph, so any displacement can move.
- **Wind graph over time**: The existing wind preset animated by moving its noise.
- **LFOs (slow oscillators)**: Repeating waves that drive any setting up and down.
- **Random walks**: Values that wander smoothly over time.
- **Expressions**: Small formulas that drive a setting, such as "sway = sin(time)".
- **Drivers**: Linking one setting to another (sun angle drives sky colour).
- **Per-object phase offsets**: The same motion starting at a different moment for each object.
- **Seed stepping**: Changing the random seed every few frames for a boiling look.

### 24.4 Particles

- **Emitter**: A place where particles start (sky band for rain, a chimney for smoke).
- **Spawn rate**: How many particles appear per second.
- **Lifetime**: How long each particle lives.
- **Gravity and wind forces**: What pushes particles around.
- **Size and fade over life**: Particles shrinking and fading as they age.
- **Particle shapes from the vocabulary**: Using the app's shapes as flakes, leaves or petals.
- **Depth-aware particles**: Particles sized and hazed by the band they fall in.

### 24.5 Keyframes, curves and timeline

- **Keyframes**: Stored values at chosen times, with in-betweens filled automatically.
- **Per-layer animation channels**: Any layer setting can be animated on its own track.
- **Scene-setting channels**: Sun angle, haze, sky colours and finish settings as animatable tracks.
- **Curve editor**: A graph of each value over time with easing handles.
- **Dope sheet**: A grid of keyframes for quick timing changes.
- **Timeline and scrubbing**: A bar to drag through time and preview.
- **Playback controls**: Play, pause, loop and step frame by frame.
- **Frame rate**: Frames per second (12 for hand-drawn feel, 24 or 30 for smooth).
- **Duration and loop region**: Setting the length and the part that repeats.
- **Markers**: Named points on the timeline for events such as a lightning flash.
- **Onion skin**: Faint views of the previous and next frames to judge motion.

### 24.6 Constraints

- **Follow path**: An object moving along a drawn path (a bird along a curve).
- **Aim / look-at**: An object turning to face a target.
- **Parent**: One object carried along with another.
- **Limit rotation**: Stopping a bone bending past a set angle.
- **Stick to surface**: Keeping objects on the ground or water line.
- **Copy motion**: One object repeating another's movement with a delay.

### 24.7 Deformers

- **Bend deformer**: Curving a whole object over time.
- **Twist deformer**: Rotating the top of an object relative to its base.
- **Lattice (free-form) deformer**: A coarse grid of handles that warps everything inside it.
- **Mesh warp**: A finer grid for detailed bending.
- **Puppet pins**: Pins placed on a shape to drag it like a puppet.
- **Squash and stretch**: Changing a shape's proportions as it moves, keeping its area.
- **Path deformer**: Bending an object along a curve.
- **Wave deformer**: A travelling wave through a shape.

### 24.8 Preview and performance

- **Real-time preview**: Playing the animation live at lower quality.
- **Frame cache**: Storing rendered frames for smooth playback.
- **Layer caching**: Keeping static layers as images while only moving layers redraw.
- **Render queue**: Rendering several animations or sizes in order.
- **Deterministic frames**: The same seed and time always give the same frame.

### 24.9 Export formats

- **GIF**: Short looping animation with a limited palette, widely supported.
- **Animated WebP**: Smaller looping animation with full colour.
- **APNG**: Animated PNG with full colour and transparency.
- **MP4 (H.264)**: Standard video for sharing.
- **WebM**: Open web video format.
- **PNG sequence**: One image per frame for editing elsewhere.
- **Sprite sheet**: All frames packed into one image for games.
- **Layered parallax export**: Each band as its own image or loop for game engines.
- **Lottie**: A small vector animation file (JSON) played in apps and websites.
- **Animated SVG**: Vector shapes animated in the browser.
- **Live canvas embed**: A web page that runs the scene live.
- **Live wallpaper**: A looping scene for desktop or phone backgrounds.
