// Library: scene presets, saved scenes, a catalogue of techniques and ideas, and notes.
import { h, deepClone } from './util.js';
import { defaultScene, makeLayer, BANDS } from './scene.js';
import { KINDS } from './structures.js';

const store = {
  get(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  },
  set(key, v) {
    try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* storage unavailable */ }
  },
};

const byName = (scene, name) => scene.layers.find((l) => l.name === name);
const each = (scene, fn) => scene.layers.filter((l) => l.kind !== 'sky').forEach(fn);

export const PRESETS = [
  { id: 'valley', label: 'Golden valley', text: 'The default: low warm sun from the upper left, fields and a river in the middle ground, soft depth blur and grain.', make: () => defaultScene() },
  {
    id: 'backlit', label: 'Backlit evening', text: 'Sun ahead of the viewer, low and warm. Shapes go to silhouette with glowing edges and light shafts.',
    make: () => {
      const s = defaultScene();
      Object.assign(s.globals, { sunAngle: 98, sunFront: -0.75, sunHue: 58, sunWarm: 0.85, shadowHue: 285, skyTop: '#6776b3', skyHorizon: '#f4b07c', hazeColor: '#c7a3b0', haze: 0.85, rays: 0.55, warmth: 0.25 });
      s.globals.valueGroups = [
        { name: 'Sky', value: 0.82, spread: 0.08 },
        { name: 'Far', value: 0.6, spread: 0.05 },
        { name: 'Middle', value: 0.42, spread: 0.06 },
        { name: 'Near', value: 0.2, spread: 0.07 },
      ];
      byName(s, 'Sky').p.glow = 1;
      byName(s, 'Sky').p.sunDisc = 0.9;
      for (const n of ['Clouds near', 'Trees', 'Tree line', 'Grass', 'Rocks']) { byName(s, n).p.rim = 0.5; byName(s, n).p.glow = 0.7; }
      byName(s, 'Trees').p.cloneMode = 'cast';
      byName(s, 'Trees').p.castLen = 1.4;
      return s;
    },
  },
  {
    id: 'lake', label: 'Alpine lake', text: 'Snowy peaks mirrored in still water, pines up close.',
    make: () => {
      const s = defaultScene();
      const keep = ['Sky', 'Clouds far', 'Clouds near', 'Far range', 'Near range'];
      s.layers = s.layers.filter((l) => keep.includes(l.name));
      byName(s, 'Far range').p.snow = 0.6;
      byName(s, 'Far range').p.baseY = 0.6;
      byName(s, 'Near range').p.baseY = 0.64;
      s.layers.push(
        makeLayer('middle', 'water', 'Lake', { waterY: 0.64, color: '#6f8fae', reflect: 0.7, ripple: 5 }),
        makeLayer('midfg', 'clusters', 'Shore stones', { count: 14, yTop: 0.86, yBottom: 0.92, x0: 0.3, x1: 1, clusterSize: 24, perCluster: 4, vocab: 'mix-hard', color: '#8a8377', flat: 0.7, valueJitter: 0.06, contact: 0.5, groundDetail: 80 }),
        makeLayer('close', 'trees', 'Pines', { form: 'conifer', count: 4, x0: 0.02, x1: 0.28, baseY: 0.98, height: 0.7, trunk: 7, foliage: 30, density: 6, vocab: 'spiky', rotJitter: 0.1, color: '#2f4f3c', valueJitter: 0.04, hueJitter: 8, jitterBy: 'cluster', volume: 0.7, clone: 0.4, cloneMode: 'cast', castLen: 0.5, contact: 0.5 }),
        makeLayer('veryclose', 'grass', 'Reeds', { count: 26, x0: 0.25, x1: 1, yTop: 0.96, bladeHeight: 120, blades: 5, bladeWidth: 4, curl: 0.2, color: '#6e7a42', hueJitter: 10 }),
      );
      Object.assign(s.globals, { horizonY: 0.64 });
      return s;
    },
  },
  {
    id: 'misty', label: 'Misty ridges', text: 'Many ridge layers stepping back in small, even value steps. A study in atmosphere.',
    make: () => {
      const s = defaultScene();
      const sky = byName(s, 'Sky');
      const clouds = byName(s, 'Clouds far');
      const ridge = (band, name, baseY, height, freq, color) => makeLayer(band, 'ridge', name, { baseY, height, frequency: freq, color, sharp: 0.5, facetDetail: 0.35, dapple: 0.15 });
      s.layers = [
        sky, clouds,
        ridge('distant', 'Ridge 1', 0.5, 0.2, 2, '#8a97c0'),
        ridge('distant', 'Ridge 2', 0.56, 0.17, 3, '#7d8fb5'),
        ridge('middle', 'Ridge 3', 0.63, 0.16, 3.5, '#6c86a4'),
        ridge('middle', 'Ridge 4', 0.71, 0.15, 4.5, '#5d7e8f'),
        makeLayer('midfg', 'hills', 'Low hills', { baseY: 0.82, height: 0.08, color: '#58745c', scatter: 60, vocab: 'mix-foliage', scatterSize: 9 }),
        makeLayer('close', 'trees', 'Pines', { form: 'conifer', count: 5, x0: 0.62, x1: 0.95, baseY: 0.97, height: 0.5, trunk: 5, foliage: 26, density: 4, vocab: 'spiky', color: '#35523d', rotJitter: 0.1, valueJitter: 0.04 }),
      ];
      Object.assign(s.globals, { haze: 1, hazeCurve: 0.8, horizonY: 0.55, skyTop: '#9fb3cf', skyHorizon: '#e8e4dc', hazeColor: '#c4cedd', sunFront: 0.5, dof: 0.5, focus: 0.9 });
      s.globals.valueGroups = [
        { name: 'Sky', value: 0.92, spread: 0.03 },
        { name: 'Ridge far', value: 0.82, spread: 0.03 },
        { name: 'Ridge mid', value: 0.7, spread: 0.035 },
        { name: 'Ridge near', value: 0.56, spread: 0.04 },
        { name: 'Near', value: 0.36, spread: 0.06 },
      ];
      byName(s, 'Ridge 3').p.valueGroup = '2';
      byName(s, 'Ridge 4').p.valueGroup = '3';
      byName(s, 'Low hills').p.valueGroup = '3';
      byName(s, 'Low hills').p.valueNudge = -0.08;
      byName(s, 'Pines').p.valueGroup = '4';
      return s;
    },
  },
  {
    id: 'poster', label: 'Graphic poster', text: 'Two-step shading, ink outlines heavier on the shadow side, three value groups, hatching in the shadows.',
    make: () => {
      const s = defaultScene();
      Object.assign(s.globals, { lightSteps: '2', grain: 0.15, dof: 0, vignette: 0.1 });
      s.globals.valueGroups = [
        { name: 'Light', value: 0.88, spread: 0.07 },
        { name: 'Mid', value: 0.6, spread: 0.1 },
        { name: 'Dark', value: 0.3, spread: 0.1 },
      ];
      each(s, (l) => Object.assign(l.p, { lineMode: 'object', lineTone: 'ink', lineWidth: l.band === 'distant' || l.band === 'sky' ? 1 : 1.8, lineWeight: 0.8, lineBreak: 0.25, chroma: 1.2, dapple: 0, shapeNoise: 0.08, hatch: l.band === 'close' ? 0.6 : 0 }));
      return s;
    },
  },
  {
    id: 'desert', label: 'Desert mesas', text: 'Flat-topped rock ranges, dry scrub and a high hard sun.',
    make: () => {
      const s = defaultScene();
      s.layers = [
        byName(s, 'Sky'), byName(s, 'Clouds near'),
        makeLayer('distant', 'ridge', 'Far mesas', { baseY: 0.6, height: 0.2, mesa: 0.8, frequency: 2, sharp: 0.2, color: '#c49a7c', facetDetail: 0.6 }),
        makeLayer('middle', 'ridge', 'Near mesas', { baseY: 0.7, height: 0.2, mesa: 0.7, frequency: 3, sharp: 0.2, color: '#b8714d', facetDetail: 0.7, dapple: 0.3 }),
        makeLayer('midfg', 'hills', 'Dunes', { baseY: 0.84, height: 0.06, bumps: 6, color: '#d1a874', scatter: 60, scatterSize: 6, vocab: 'spiky', groundDetail: 150 }),
        makeLayer('close', 'trees', 'Joshua-ish', { form: 'lsystem', lsRule: 'sparse', levels: 3, count: 2, x0: 0.1, x1: 0.8, baseY: 0.95, height: 0.35, trunk: 9, foliage: 26, density: 8, vocab: 'spiky', color: '#6c7b44', clone: 0.5, cloneMode: 'cast', castLen: 0.4, contact: 0.5 }),
        makeLayer('veryclose', 'clusters', 'Scrub', { count: 10, yTop: 0.95, yBottom: 1.02, clusterSize: 40, vocab: 'spiky', color: '#7e7a4a', ground: true, groundDetail: 120 }),
      ];
      Object.assign(s.globals, { sunAngle: 110, sunFront: 0.4, sunWarm: 0.5, skyTop: '#5b8fd0', skyHorizon: '#f2dcc2', hazeColor: '#d8c3b5', haze: 0.6 });
      return s;
    },
  },
  {
    id: 'blank', label: 'One layer per band', text: 'A bare starting point: sky plus one default layer in each band.',
    make: () => {
      const s = defaultScene();
      s.layers = [makeLayer('sky', 'sky', 'Sky'), ...BANDS.map((b) => makeLayer(b.id, b.kind, b.label))];
      return s;
    },
  },
];

// Single layers that drop into the current scene.
export const LAYER_PRESETS = [
  { label: 'Pine stand', band: 'close', kind: 'trees', p: { form: 'conifer', count: 5, x0: 0.6, x1: 0.95, baseY: 0.96, height: 0.55, trunk: 6, foliage: 28, density: 6, vocab: 'spiky', rotJitter: 0.1, color: '#2f4f3c', valueJitter: 0.04, hueJitter: 8, contact: 0.4 } },
  { label: 'Poplar row', band: 'middle', kind: 'trees', p: { form: 'poplar', count: 9, x0: 0.1, x1: 0.6, baseY: 0.72, height: 0.2, trunk: 3, foliage: 12, density: 10, vocab: 'mix-foliage', color: '#5d7b45', hueJitter: 8 } },
  { label: 'Weeping willow', band: 'close', kind: 'trees', p: { form: 'willow', count: 1, x0: 0.7, x1: 0.7, baseY: 0.93, height: 0.5, trunk: 14, levels: 3, foliage: 22, density: 9, vocab: 'leaf', color: '#708c47', hueJitter: 10, contact: 0.5 } },
  { label: 'Palms', band: 'close', kind: 'trees', p: { form: 'palm', count: 2, x0: 0.65, x1: 0.85, baseY: 0.95, height: 0.6, trunk: 10, lean: 0.4, foliage: 26, density: 5, vocab: 'leaf', color: '#4f7a3a' } },
  { label: 'Rule-grown bush', band: 'midfg', kind: 'trees', p: { form: 'lsystem', lsRule: 'bush', levels: 4, count: 3, x0: 0.2, x1: 0.8, baseY: 0.86, height: 0.12, trunk: 3, foliage: 10, density: 4, color: '#5f7d44' } },
  { label: 'Rock outcrop', band: 'close', kind: 'clusters', p: { count: 2, x0: 0.55, x1: 0.85, yTop: 0.88, yBottom: 0.93, clusterSize: 90, perCluster: 9, flat: 0.3, vocab: 'mix-hard', color: '#8a8478', lightGroup: 'shape', volume: 0.3, contact: 0.6, ground: false, valueJitter: 0.06 } },
  { label: 'Wildflower meadow', band: 'veryclose', kind: 'grass', p: { count: 90, yTop: 0.9, bladeHeight: 55, flowers: 0.9, flowerSize: 7, accentColor: '#e9c2d6', hueJitter: 14, groundDetail: 80 } },
  { label: 'Hedgerow fields', band: 'midfg', kind: 'rows', p: { rows: 7, yTop: 0.72, yBottom: 0.95, color: '#a3aa63', hueJitter: 24, jitterBy: 'object', vocab: 'mix-foliage' } },
  { label: 'Fence line', band: 'close', kind: 'rows', p: { rows: 1, yTop: 0.88, yBottom: 0.9, fields: false, hedges: false, fence: true, postGap: 70, trunkColor: '#6b5a4a' } },
  { label: 'Winding river', band: 'midfg', kind: 'path', p: { style: 'river', color: '#90abc6' } },
  { label: 'Dirt road', band: 'midfg', kind: 'path', p: { style: 'road', color: '#b39c7c', startX: 0.4, endX: 0.3, meander: 0.08, banks: 30, streaks: 20 } },
  { label: 'Lake reflection', band: 'middle', kind: 'water', p: { waterY: 0.68, color: '#6f8fae' } },
  { label: 'Snowy peaks', band: 'distant', kind: 'ridge', p: { baseY: 0.56, height: 0.26, sharp: 0.8, snow: 0.5, color: '#8f9cc3' } },
  { label: 'Mesas', band: 'distant', kind: 'ridge', p: { baseY: 0.62, height: 0.18, mesa: 0.8, sharp: 0.2, color: '#b98a6c' } },
  { label: 'Cirrus wisps', band: 'sky', kind: 'clouds', p: { cloudType: 'cirrus', count: 5, yTop: 0.05, yBottom: 0.25, cloudSize: 60, stretch: 4, puffs: 10, color: '#f6f2ec', valueNudge: 0.05 } },
  { label: 'Framing branch', band: 'veryclose', kind: 'branch', p: { side: 'right', anchor: 0.08, reach: 0.45, color: '#2f4a26', vocab: 'leaf', valueNudge: -0.12, trunkColor: '#3a2e26', clone: 0.5, cloneOffset: 16, cloneSoft: 6, rotJitter: 0.25, hueJitter: 8 } },
];

// status: built = in the app now, part = partly there, idea = not built yet
export const IDEAS = [
  { cat: 'Structure', status: 'built', title: 'Ordered depth bands', text: 'The scene runs back to front: sky, distant, middle, middle foreground, close, very close. Each band holds any number of layers. A layer’s depth (0 far, 1 near) comes from its band and its place inside it; depth drives haze, the default value group and the graph’s Depth input.' },
  { cat: 'Structure', status: 'built', title: 'Structure first, shapes second', text: 'Each structure lays down scaffolding (ridges, ground, branch tips, cluster centres) and marks slots. The shape vocabulary fills the slots. Shapes draw from their own random stream, so swapping the vocabulary keeps the scaffolding where it was.', tryLabel: 'Hard shapes everywhere', try: (s) => each(s, (l) => { if (l.kind !== 'ridge' && l.kind !== 'grass') l.p.vocab = 'mix-hard'; }) },
  { cat: 'Structure', status: 'built', title: 'Point extrusion trees', text: 'A tree starts as a point. A segment is pushed out from it with some wander, then splits into children that are shorter and thinner; repeat for a few levels. Branch tips (and some inner nodes) become foliage clumps. Forms: broadleaf, conifer (whorls up a straight trunk), poplar, shrub, bare.', tryLabel: 'Make the close trees conifers', try: (s) => { const t = s.layers.find((l) => l.band === 'close' && l.kind === 'trees'); if (t) Object.assign(t.p, { form: 'conifer', count: 4, x1: 0.4, vocab: 'spiky', rotJitter: 0.1 }); } },
  { cat: 'Structure', status: 'built', title: 'Mountain planes from peaks and valleys', text: 'The ridge line is walked and only turns bigger than a threshold count as peaks or valleys. A spur line drops from each; the plane between two spurs faces the way its slope points, so the sun picks out one side of every peak.' },
  { cat: 'Structure', status: 'built', title: 'Framing branch', text: 'A branch enters from a frame edge, droops under its own weight, forks into twigs and carries leaves. It is meant for the very close band, where a dark overhang frames the view.' },
  { cat: 'Structure', status: 'built', title: 'Rule-based growth (L-systems)', text: 'Tree form “Rule-grown”: a short string of drawing commands is rewritten a few times (“a branch becomes a branch plus two twigs”), then walked by a turtle. Presets: plant, bush, sparse tree, weed, or type your own rule.', tryLabel: 'Rule-grown trees up close', try: (s) => { const t = s.layers.find((l) => l.band === 'close' && l.kind === 'trees'); if (t) Object.assign(t.p, { form: 'lsystem', lsRule: 'plant', levels: 4 }); } },
  { cat: 'Structure', status: 'built', title: 'Rhythm structures', text: '“Fields, hedges & fences”: strips of field that widen toward you, hedges of shapes along each edge (with gaps), and an optional fence with posts and rails on the near edge.' },
  { cat: 'Structure', status: 'built', title: 'Rivers and roads as ribbons', text: '“River or road”: a ribbon that narrows toward the horizon and meanders more up close, with surface streaks and shapes along the banks.' },
  { cat: 'Structure', status: 'built', title: 'Water layer', text: '“Water (reflection)”: everything already painted above the water line is flipped into the water in thin strips nudged by ripples, then tinted and darkened with distance, with streaks and glints.' },

  { cat: 'Distortion & noise', status: 'built', title: 'Scene-wide node graph', text: 'One graph answers “how far does this point move?” for every outline point in the scene. Nodes: position, depth, noise, ridged noise, wave, swirl, ripple, maths and band masks.' },
  { cat: 'Distortion & noise', status: 'built', title: 'Graph amount per layer', text: 'Each layer multiplies the graph’s movement by its own amount, including negative (bend the other way) and zero (unaffected).', tryLabel: 'Bend the middle layers hard', try: (s) => s.layers.forEach((l) => { if (l.band === 'middle' || l.band === 'distant') l.p.distort = 3; }) },
  { cat: 'Distortion & noise', status: 'built', title: 'Layer noise and edge noise', text: 'Layer noise moves a whole layer’s outlines with one smooth field. Edge noise roughens each shape on its own, sized to that shape.' },
  { cat: 'Distortion & noise', status: 'built', title: 'Wind', text: 'Graph preset “Wind: tops sway, feet stay”: noise times a vertical ramp, so the higher a point is, the more it moves sideways.' },
  { cat: 'Distortion & noise', status: 'built', title: 'Graph drives more than position', text: 'The graph output now also has value, size and density. Value lightens or darkens shapes, size grows or shrinks them, density thins them out (clearings). Each layer sets how much it listens. See the graph presets “Patchy light”, “Forest clearings” and “Bigger shapes up close”.' },
  { cat: 'Distortion & noise', status: 'part', title: 'Graph per band, and saved graphs', text: 'Graph presets load in one click from the graph drawer. One graph per band is not built yet; per-layer amounts cover most of it.' },

  { cat: 'Values', status: 'built', title: 'Value groups', text: 'A handful of lightness bands. Each layer belongs to one; lighting only moves it inside that band’s range. Colour is picked for hue only; lightness always comes from the group.' },
  { cat: 'Values', status: 'built', title: 'Value checks', text: 'Values view removes colour. 2-value and 3-value views squash the picture to flat values to check the big pattern.', tryLabel: 'Show 2-value view', view: 'notan2' },
  { cat: 'Values', status: 'built', title: 'Atmospheric haze', text: 'Far layers lose their own colour toward the horizon colour. Only hue and saturation change, so value groups stay in control of lightness.' },
  { cat: 'Values', status: 'part', title: 'Suggested grouping', text: 'The value group editor now warns when two groups’ light–shadow ranges overlap, and “Even spacing” spreads them out. Automatic regrouping from the rendered picture is not built.' },
  { cat: 'Values', status: 'part', title: 'Colour groups', text: 'Near tint: layers pick up a warm tint as they come closer, while haze pulls far layers cool. Full named colour groups are not built.' },

  { cat: 'Grouping & lines', status: 'built', title: 'Four levels of grouping', text: 'The same shapes can be grouped per shape, per cluster (one foliage clump), per object (one tree) or as the whole layer. Groups decide outline unions, volume lighting and which objects get shadow clones.', tryLabel: 'Show groups view', view: 'groups' },
  { cat: 'Grouping & lines', status: 'built', title: 'One outline around a group', text: 'Every edge is stroked first, then the fills cover the inside, so only the outer contour of the group survives.' },
  { cat: 'Grouping & lines', status: 'built', title: 'Line weight follows the light', text: 'Each edge knows which way it faces. Edges facing away from the light get heavier lines; edges facing it can thin out or break.', tryLabel: 'Ink lines on everything', try: (s) => each(s, (l) => Object.assign(l.p, { lineMode: l.band === 'sky' ? 'object' : l.p.lineMode === 'none' ? 'object' : l.p.lineMode, lineTone: 'ink', lineWeight: 0.9, lineBreak: 0.35, lineWidth: l.band === 'distant' || l.band === 'sky' ? 0.9 : 1.8 })) },
  { cat: 'Grouping & lines', status: 'built', title: 'Sketchy lines', text: 'Wobble moves line points with noise; several passes give a loose, re-traced look.' },
  { cat: 'Grouping & lines', status: 'built', title: 'Rim light', text: 'A light edge inside the outline on the side facing the light, only near the lit edge of the whole group.' },
  { cat: 'Grouping & lines', status: 'built', title: 'Lost and found edges', text: '“Lose edges where values match”: each outline edge checks the value already painted just outside it and fades where the two are close.' },
  { cat: 'Grouping & lines', status: 'built', title: 'Hatching in shadow', text: 'Parallel strokes inside each light group, only on the side away from the light. Spacing, angle and depth into the shadow are adjustable.', tryLabel: 'Hatch the close layers', try: (s) => s.layers.forEach((l) => { if (l.band === 'close') l.p.hatch = 0.6; }) },

  { cat: 'Light', status: 'built', title: 'Outdoor sun', text: 'Two numbers: the on-screen angle the light comes from, and whether the sun is behind the viewer (front light, flat) or ahead (backlight, silhouettes and rims).', tryLabel: 'Backlight it', try: (s) => Object.assign(s.globals, { sunFront: -0.75 }) },
  { cat: 'Light', status: 'built', title: 'Measured roundness', text: 'Each outline is walked to see how its turning is spread. A circle turns a little everywhere (score 1); a square does all its turning at four corners (about 0.25). Round shapes get a smooth sphere-like gradient, square ones get flat planes like a bevelled block, and in-between shapes blend the two.' },
  { cat: 'Light', status: 'built', title: 'Group volume lighting', text: 'A foliage clump or a cloud is lit as if it were one big ball, so its many small shapes read as one form.' },
  { cat: 'Light', status: 'built', title: 'Shading steps', text: 'Light can be smooth or cut into 2–4 flat steps, for a poster or cel look.', tryLabel: 'Three steps', try: (s) => { s.globals.lightSteps = '3'; } },
  { cat: 'Light', status: 'built', title: 'Leaf translucency', text: '“Backlit glow”: when the sun is ahead of the viewer, a wide soft warm crescent lights the edges facing the sun.' },
  { cat: 'Light', status: 'built', title: 'Projected cast shadows', text: 'Clone kind “Cast onto the ground”: each object is flattened onto the ground from its foot, pushed away from the sun. Front or back light flips it up or down the picture.' },
  { cat: 'Light', status: 'built', title: 'Contact darkening', text: '“Contact shadow at feet”: a soft dark ellipse where each object meets the ground.' },

  { cat: 'Fake 2D light', status: 'built', title: 'Shadow clone', text: 'A dark copy of a close shape, nudged away from the light and slipped underneath, reads as a cast shadow on what is behind. The share slider clones only some objects, so not everything gets one.' },
  { cat: 'Fake 2D light', status: 'built', title: 'Dappled patches for distance', text: 'Far away, form is too small to model. A noise field split into lit and shadowed patches reads as cloud shadows drifting over hills.', tryLabel: 'Dapple the far layers', try: (s) => s.layers.forEach((l) => { if (l.band === 'distant' || l.band === 'middle') l.p.dapple = 0.6; }) },
  { cat: 'Fake 2D light', status: 'built', title: 'Separation halo', text: '“Separation halo”: a soft light glow behind a layer that pulls it away from what is behind it.' },
  { cat: 'Fake 2D light', status: 'built', title: 'Light shafts', text: 'Scene setting “Light shafts”: the visible bright sky is smeared outward from the sun; near shapes that block it cut the shafts.', tryLabel: 'Add light shafts', try: (s) => { s.globals.rays = 0.6; } },

  { cat: 'Workflow', status: 'built', title: 'Canvas tools', text: 'Select (drag objects, scroll to resize, Delete hides, R reseeds one object), Move layer, Add (click to place new trees, clouds, clusters, tufts), Draw (drag an outline that fills with shapes), Erase. Keys V M A D E.' },
  { cat: 'Workflow', status: 'built', title: 'Dice per section', text: 'The die on each settings section sets random values for that section only. Undo reverts.' },
  { cat: 'Workflow', status: 'built', title: 'Copy and paste a look', text: 'Copy one layer\u2019s colour, variety, light, fake-light and line settings onto another.' },
  { cat: 'Workflow', status: 'built', title: 'Layer presets', text: 'Ready-made layers (pines, poplars, willow, palms, rocks, meadow, fields, fence, river, road, lake, peaks, mesas, cirrus, framing branch), plus your own saved ones.' },
  { cat: 'Structure', status: 'built', title: 'More tree and cloud forms', text: 'Trees: willow (weeping strands), palm (curved trunk and fronds), lean. Clouds: cumulus, stratus bands, cirrus wisps. Ridges: snow caps and flat mesa tops.' },
  { cat: 'Structure', status: 'built', title: 'Drawn shapes', text: 'Draw any outline on the picture; it becomes a mass lit as one rounded form, filled with the layer\u2019s shapes and fringed along its edge.' },
  { cat: 'Values', status: 'built', title: 'Colour variety', text: 'Random value and hue shifts per shape, cluster or object, so repeated shapes do not look stamped.' },
  { cat: 'Light', status: 'built', title: 'Depth blur and finish', text: 'Layers soften with distance from a focus depth; paper grain, vignette, saturation, contrast and warmth finish the picture.' },
  { cat: 'Workflow', status: 'built', title: 'Undo, autosave, click to select', text: 'Undo/redo, the current scene survives a reload, and clicking the picture selects the layer under the pointer.' },
  { cat: 'Workflow', status: 'built', title: 'Reseed gallery', text: '“Pick from 8” in the layer panel: eight small renders of the scene with different seeds for that layer.' },
  { cat: 'Workflow', status: 'built', title: 'Seed locks', text: 'Locked layers keep their seed when “Reseed all” runs.' },
];

export function renderLibrary(el, state, act) {
  const scroll = el.scrollTop;
  el.innerHTML = '';
  const root = h('div', { class: 'lib' });

  root.append(h('h3', {}, 'Scene presets'));
  for (const p of PRESETS) {
    root.append(h('div', { class: 'card' }, h('h4', {}, p.label, h('button', { class: 'small', onclick: () => act.loadScene(p.make()) }, 'Load')), h('p', {}, p.text)));
  }

  root.append(h('h3', {}, 'Layer presets'));
  root.append(h('p', { class: 'note pad' }, 'Drop a ready-made layer into the current scene, in its usual band.'));
  const userLayers = store.get('shapelab.layerPresets', []);
  const lp = h('div', { class: 'btnrow pad' });
  for (const pr of LAYER_PRESETS) lp.append(h('button', { class: 'small', title: `${KINDS[pr.kind].label} \u2192 ${pr.band}`, onclick: () => act.insertLayer(makeLayer(pr.band, pr.kind, pr.label, pr.p)) }, pr.label));
  userLayers.forEach((l, i) => lp.append(h('span', {}, h('button', { class: 'small', style: { borderColor: 'var(--accent2)' }, onclick: () => act.insertLayer(l) }, l.name),
    h('button', { class: 'small ghost', title: 'Remove this saved layer', onclick: () => { const list = store.get('shapelab.layerPresets', []); list.splice(i, 1); store.set('shapelab.layerPresets', list); renderLibrary(el, state, act); } }, '\u2715'))));
  root.append(lp);
  const selLayer = state.scene.layers.find((l) => l.id === state.selected);
  root.append(h('div', { class: 'btnrow pad' }, h('button', {
    disabled: !selLayer,
    onclick: () => { const list = store.get('shapelab.layerPresets', []); list.unshift(deepClone(selLayer)); store.set('shapelab.layerPresets', list); renderLibrary(el, state, act); },
  }, selLayer ? `Save \u201c${selLayer.name}\u201d as a layer preset` : 'Select a layer to save it as a preset')));

  root.append(h('h3', {}, 'Saved scenes'));
  const saved = store.get('shapelab.saved', []);
  const name = h('input', { type: 'text', placeholder: 'Name this scene', style: { flex: 1 } });
  root.append(h('div', { class: 'item' }, name, h('button', {
    onclick: () => {
      const list = store.get('shapelab.saved', []);
      list.unshift({ name: name.value || `Scene ${new Date().toLocaleString()}`, scene: deepClone(state.scene) });
      store.set('shapelab.saved', list);
      renderLibrary(el, state, act);
    },
  }, 'Save')));
  if (!saved.length) root.append(h('p', { class: 'note pad' }, 'Nothing saved yet. Saved scenes stay in this browser.'));
  saved.forEach((s, i) => root.append(h('div', { class: 'item' }, h('span', {}, s.name),
    h('span', {}, h('button', { class: 'small', onclick: () => act.loadScene(deepClone(s.scene)) }, 'Load'), ' ',
      h('button', { class: 'small ghost', onclick: () => { const list = store.get('shapelab.saved', []); list.splice(i, 1); store.set('shapelab.saved', list); renderLibrary(el, state, act); } }, '✕')))));
  const file = h('input', { type: 'file', accept: '.json,application/json', style: { display: 'none' } });
  const importMsg = h('p', { class: 'note pad', hidden: true });
  file.addEventListener('change', async () => {
    const f = file.files[0];
    if (!f) return;
    try {
      act.loadScene(JSON.parse(await f.text()));
    } catch {
      importMsg.textContent = 'That file is not a Shape Lab scene. Pick a .json file saved with Export JSON.';
      importMsg.hidden = false;
    }
  });
  root.append(h('div', { class: 'btnrow pad' },
    window.SHAPELAB_HOSTED ? null : h('button', { onclick: () => download('shape-lab-scene.json', JSON.stringify(state.scene, null, 1), 'application/json') }, 'Export JSON'),
    h('button', { onclick: () => file.click() }, 'Import JSON'), file), importMsg);

  root.append(h('h3', {}, 'Techniques & ideas'));
  root.append(h('p', { class: 'note pad' }, 'What is in the app now (built), partly there, or still an idea. “Try” buttons change the current scene; Undo reverts them.'));
  let cat = null;
  for (const it of IDEAS) {
    if (it.cat !== cat) { cat = it.cat; root.append(h('div', { class: 'cat' }, cat)); }
    const badge = h('span', { class: `badge ${it.status}` }, it.status === 'built' ? 'built' : it.status === 'part' ? 'partly' : 'idea');
    const tryBtn = it.try || it.view ? h('button', { class: 'small', onclick: () => (it.view ? act.setView(it.view) : act.apply(it.try)) }, it.tryLabel || 'Try') : null;
    root.append(h('div', { class: 'card' }, h('h4', {}, h('span', {}, it.title, ' ', badge), tryBtn), h('p', {}, it.text)));
  }

  root.append(h('h3', {}, 'My notes'));
  const notes = store.get('shapelab.notes', []);
  const ta = h('textarea', { rows: 3, placeholder: 'An idea to try later…' });
  root.append(h('div', { class: 'pad' }, ta, h('div', { class: 'btnrow' }, h('button', {
    onclick: () => {
      if (!ta.value.trim()) return;
      const list = store.get('shapelab.notes', []);
      list.unshift({ text: ta.value.trim(), at: new Date().toISOString().slice(0, 10) });
      store.set('shapelab.notes', list);
      renderLibrary(el, state, act);
    },
  }, 'Add note'))));
  notes.forEach((n, i) => root.append(h('div', { class: 'card' }, h('h4', {}, h('span', { class: 'badge' }, n.at),
    h('button', { class: 'small ghost', onclick: () => { const list = store.get('shapelab.notes', []); list.splice(i, 1); store.set('shapelab.notes', list); renderLibrary(el, state, act); } }, '✕')), h('p', { style: { whiteSpace: 'pre-wrap' } }, n.text))));

  el.append(root);
  el.scrollTop = scroll;
}

export function download(name, data, type) {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const a = h('a', { href: URL.createObjectURL(blob), download: name });
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
