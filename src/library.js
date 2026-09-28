// Library: scene presets, saved scenes, a catalogue of techniques and ideas, and notes.
import { h, deepClone } from './util.js';
import { defaultScene, makeLayer, BANDS } from './scene.js';

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
  { id: 'valley', label: 'Morning valley', text: 'The default: every band filled, side light from the upper left.', make: () => defaultScene() },
  {
    id: 'backlit', label: 'Backlit evening', text: 'Sun ahead of the viewer, low and warm. Shapes turn to silhouettes with rim light.',
    make: () => {
      const s = defaultScene();
      Object.assign(s.globals, { sunAngle: 100, sunFront: -0.75, sunHue: 60, sunWarm: 0.8, shadowHue: 280, skyTop: '#6978b5', skyHorizon: '#f2b27c', haze: 0.85 });
      s.globals.valueGroups = [
        { name: 'Sky', value: 0.82, spread: 0.08 },
        { name: 'Far', value: 0.6, spread: 0.05 },
        { name: 'Middle', value: 0.42, spread: 0.06 },
        { name: 'Near', value: 0.2, spread: 0.07 },
      ];
      byName(s, 'Sky').p.glow = 1;
      for (const n of ['Clouds near', 'Trees', 'Overhang', 'Bushes', 'Tree line']) byName(s, n).p.rim = 0.8;
      byName(s, 'Grass').p.rim = 0.6;
      return s;
    },
  },
  {
    id: 'misty', label: 'Misty ridges', text: 'Many ridge layers stepping back in small, even value steps. A study in atmosphere.',
    make: () => {
      const s = defaultScene();
      const sky = byName(s, 'Sky');
      const clouds = byName(s, 'Clouds far');
      clouds.p.count = 4;
      const ridge = (band, name, baseY, height, freq, color) => makeLayer(band, 'ridge', name, { baseY, height, frequency: freq, color, sharp: 0.5, facetDetail: 0.35, dapple: 0.15 });
      s.layers = [
        sky, clouds,
        ridge('distant', 'Ridge 1', 0.5, 0.2, 2, '#8a97c0'),
        ridge('distant', 'Ridge 2', 0.56, 0.17, 3, '#7d8fb5'),
        ridge('middle', 'Ridge 3', 0.63, 0.16, 3.5, '#6c86a4'),
        ridge('middle', 'Ridge 4', 0.71, 0.15, 4.5, '#5d7e8f'),
        makeLayer('midfg', 'hills', 'Low hills', { baseY: 0.82, height: 0.08, color: '#58745c', scatter: 60, vocab: 'mix-foliage', scatterSize: 9 }),
        makeLayer('close', 'trees', 'Pines', { form: 'conifer', count: 5, x0: 0.62, x1: 0.95, baseY: 0.97, height: 0.5, trunk: 5, foliage: 26, density: 4, vocab: 'spiky', color: '#35523d', rotJitter: 0.1 }),
      ];
      Object.assign(s.globals, { haze: 1, hazeCurve: 0.8, horizonY: 0.55, skyTop: '#9fb3cf', skyHorizon: '#e8e4dc', sunFront: 0.5 });
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
    id: 'poster', label: 'Graphic poster', text: 'Two-step shading, ink outlines heavier on the shadow side, three value groups.',
    make: () => {
      const s = defaultScene();
      s.globals.lightSteps = '2';
      s.globals.valueGroups = [
        { name: 'Light', value: 0.88, spread: 0.07 },
        { name: 'Mid', value: 0.6, spread: 0.1 },
        { name: 'Dark', value: 0.3, spread: 0.1 },
      ];
      each(s, (l) => Object.assign(l.p, { lineMode: l.kind === 'grass' ? 'object' : l.p.lineMode === 'none' ? 'object' : l.p.lineMode, lineTone: 'ink', lineWidth: l.band === 'distant' ? 1 : 1.8, lineWeight: 0.8, lineBreak: 0.25, chroma: 1.25, dapple: 0, shapeNoise: 0.05 }));
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

// status: built = in the app now, part = partly there, idea = not built yet
export const IDEAS = [
  { cat: 'Structure', status: 'built', title: 'Ordered depth bands', text: 'The scene runs back to front: sky, distant, middle, middle foreground, close, very close. Each band holds any number of layers. A layer’s depth (0 far, 1 near) comes from its band and its place inside it; depth drives haze, the default value group and the graph’s Depth input.' },
  { cat: 'Structure', status: 'built', title: 'Structure first, shapes second', text: 'Each structure lays down scaffolding (ridges, ground, branch tips, cluster centres) and marks slots. The shape vocabulary fills the slots. Shapes draw from their own random stream, so swapping the vocabulary keeps the scaffolding where it was.', tryLabel: 'Hard shapes everywhere', try: (s) => each(s, (l) => { if (l.kind !== 'ridge' && l.kind !== 'grass') l.p.vocab = 'mix-hard'; }) },
  { cat: 'Structure', status: 'built', title: 'Point extrusion trees', text: 'A tree starts as a point. A segment is pushed out from it with some wander, then splits into children that are shorter and thinner; repeat for a few levels. Branch tips (and some inner nodes) become foliage clumps. Forms: broadleaf, conifer (whorls up a straight trunk), poplar, shrub, bare.', tryLabel: 'Make the close trees conifers', try: (s) => { const t = s.layers.find((l) => l.band === 'close' && l.kind === 'trees'); if (t) Object.assign(t.p, { form: 'conifer', count: 4, x1: 0.4, vocab: 'spiky', rotJitter: 0.1 }); } },
  { cat: 'Structure', status: 'built', title: 'Mountain planes from peaks and valleys', text: 'The ridge line is walked and only turns bigger than a threshold count as peaks or valleys. A spur line drops from each; the plane between two spurs faces the way its slope points, so the sun picks out one side of every peak.' },
  { cat: 'Structure', status: 'built', title: 'Framing branch', text: 'A branch enters from a frame edge, droops under its own weight, forks into twigs and carries leaves. It is meant for the very close band, where a dark overhang frames the view.' },
  { cat: 'Structure', status: 'idea', title: 'Rule-based growth (L-systems)', text: 'Rewrite rules (“a branch becomes a branch plus two twigs at 30°”) would give each species a consistent character instead of random splitting.' },
  { cat: 'Structure', status: 'idea', title: 'Rhythm structures', text: 'Fences, field rows, terraces and hedges: repeated elements whose spacing shrinks with distance.' },
  { cat: 'Structure', status: 'idea', title: 'Rivers and roads as ribbons', text: 'A path that narrows toward the horizon, laid across the bands, with shapes along its banks.' },
  { cat: 'Structure', status: 'idea', title: 'Water layer', text: 'A flipped, darker, slightly broken copy of everything above a water line.' },

  { cat: 'Distortion & noise', status: 'built', title: 'Scene-wide node graph', text: 'One graph answers “how far does this point move?” for every outline point in the scene. Nodes: position, depth, noise, ridged noise, wave, swirl, ripple, maths and band masks.' },
  { cat: 'Distortion & noise', status: 'built', title: 'Graph amount per layer', text: 'Each layer multiplies the graph’s movement by its own amount, including negative (bend the other way) and zero (unaffected).', tryLabel: 'Bend the middle layers hard', try: (s) => s.layers.forEach((l) => { if (l.band === 'middle' || l.band === 'distant') l.p.distort = 3; }) },
  { cat: 'Distortion & noise', status: 'built', title: 'Layer noise and edge noise', text: 'Layer noise moves a whole layer’s outlines with one smooth field. Edge noise roughens each shape on its own, sized to that shape.' },
  { cat: 'Distortion & noise', status: 'part', title: 'Wind', text: 'Possible now with a Wave plus Noise into dx, masked by a Band on y so only tall things sway. A dedicated wind node could bend blades and branches from their roots instead.' },
  { cat: 'Distortion & noise', status: 'idea', title: 'Graph drives more than position', text: 'The same graph outputs could steer value, colour, shape size or density: e.g. denser foliage where a noise is high.' },
  { cat: 'Distortion & noise', status: 'idea', title: 'Graph per band, and saved graphs', text: 'Separate graphs for sky, land and foreground, and a small library of graph presets.' },

  { cat: 'Values', status: 'built', title: 'Value groups', text: 'A handful of lightness bands. Each layer belongs to one; lighting only moves it inside that band’s range. Colour is picked for hue only; lightness always comes from the group.' },
  { cat: 'Values', status: 'built', title: 'Value checks', text: 'Values view removes colour. 2-value and 3-value views squash the picture to flat values to check the big pattern.', tryLabel: 'Show 2-value view', view: 'notan2' },
  { cat: 'Values', status: 'built', title: 'Atmospheric haze', text: 'Far layers lose their own colour toward the horizon colour. Only hue and saturation change, so value groups stay in control of lightness.' },
  { cat: 'Values', status: 'idea', title: 'Suggested grouping', text: 'Measure each layer’s rendered average value and propose a grouping that separates the bands best.' },
  { cat: 'Values', status: 'idea', title: 'Colour groups', text: 'The same idea as value groups, for hue families: warm near, cool far, one accent.' },

  { cat: 'Grouping & lines', status: 'built', title: 'Four levels of grouping', text: 'The same shapes can be grouped per shape, per cluster (one foliage clump), per object (one tree) or as the whole layer. Groups decide outline unions, volume lighting and which objects get shadow clones.', tryLabel: 'Show groups view', view: 'groups' },
  { cat: 'Grouping & lines', status: 'built', title: 'One outline around a group', text: 'Every edge is stroked first, then the fills cover the inside, so only the outer contour of the group survives.' },
  { cat: 'Grouping & lines', status: 'built', title: 'Line weight follows the light', text: 'Each edge knows which way it faces. Edges facing away from the light get heavier lines; edges facing it can thin out or break.', tryLabel: 'Ink lines on everything', try: (s) => each(s, (l) => Object.assign(l.p, { lineMode: l.band === 'sky' ? 'object' : l.p.lineMode === 'none' ? 'object' : l.p.lineMode, lineTone: 'ink', lineWeight: 0.9, lineBreak: 0.35, lineWidth: l.band === 'distant' || l.band === 'sky' ? 0.9 : 1.8 })) },
  { cat: 'Grouping & lines', status: 'built', title: 'Sketchy lines', text: 'Wobble moves line points with noise; several passes give a loose, re-traced look.' },
  { cat: 'Grouping & lines', status: 'built', title: 'Rim light', text: 'A light edge inside the outline on the side facing the light, only near the lit edge of the whole group.' },
  { cat: 'Grouping & lines', status: 'idea', title: 'Lost and found edges', text: 'Fade an edge where the two sides are close in value, keep it sharp where they contrast.' },
  { cat: 'Grouping & lines', status: 'idea', title: 'Hatching in shadow', text: 'Parallel strokes clipped to the shadow side of each group, angled by the light.' },

  { cat: 'Light', status: 'built', title: 'Outdoor sun', text: 'Two numbers: the on-screen angle the light comes from, and whether the sun is behind the viewer (front light, flat) or ahead (backlight, silhouettes and rims).', tryLabel: 'Backlight it', try: (s) => Object.assign(s.globals, { sunFront: -0.75 }) },
  { cat: 'Light', status: 'built', title: 'Measured roundness', text: 'Each outline is walked to see how its turning is spread. A circle turns a little everywhere (score 1); a square does all its turning at four corners (about 0.25). Round shapes get a smooth sphere-like gradient, square ones get flat planes like a bevelled block, and in-between shapes blend the two.' },
  { cat: 'Light', status: 'built', title: 'Group volume lighting', text: 'A foliage clump or a cloud is lit as if it were one big ball, so its many small shapes read as one form.' },
  { cat: 'Light', status: 'built', title: 'Shading steps', text: 'Light can be smooth or cut into 2–4 flat steps, for a poster or cel look.', tryLabel: 'Three steps', try: (s) => { s.globals.lightSteps = '3'; } },
  { cat: 'Light', status: 'idea', title: 'Leaf translucency', text: 'When backlit, foliage edges glow warm instead of going dark.' },
  { cat: 'Light', status: 'idea', title: 'Projected cast shadows', text: 'Shadows squashed onto the ground plane along the sun direction, rather than a simple offset.' },
  { cat: 'Light', status: 'idea', title: 'Contact darkening', text: 'Darken where shapes in a cluster overlap or touch the ground.' },

  { cat: 'Fake 2D light', status: 'built', title: 'Shadow clone', text: 'A dark copy of a close shape, nudged away from the light and slipped underneath, reads as a cast shadow on what is behind. The share slider clones only some objects, so not everything gets one.' },
  { cat: 'Fake 2D light', status: 'built', title: 'Dappled patches for distance', text: 'Far away, form is too small to model. A noise field split into lit and shadowed patches reads as cloud shadows drifting over hills.', tryLabel: 'Dapple the far layers', try: (s) => s.layers.forEach((l) => { if (l.band === 'distant' || l.band === 'middle') l.p.dapple = 0.6; }) },
  { cat: 'Fake 2D light', status: 'idea', title: 'Separation halo', text: 'A slightly lighter band in the layer behind, just around a near dark shape, to pull the two apart.' },
  { cat: 'Fake 2D light', status: 'idea', title: 'Light shafts', text: 'When backlit, soft rays from gaps in near shapes.' },

  { cat: 'Workflow', status: 'built', title: 'Undo, autosave, click to select', text: 'Undo/redo, the current scene survives a reload, and clicking the picture selects the layer under the pointer.' },
  { cat: 'Workflow', status: 'idea', title: 'Reseed gallery', text: 'A grid of thumbnails with different seeds for one layer, to pick the best arrangement.' },
  { cat: 'Workflow', status: 'idea', title: 'Seed locks', text: 'Keep chosen layers fixed while reseeding everything else.' },
];

export function renderLibrary(el, state, act) {
  const scroll = el.scrollTop;
  el.innerHTML = '';
  const root = h('div', { class: 'lib' });

  root.append(h('h3', {}, 'Scene presets'));
  for (const p of PRESETS) {
    root.append(h('div', { class: 'card' }, h('h4', {}, p.label, h('button', { class: 'small', onclick: () => act.loadScene(p.make()) }, 'Load')), h('p', {}, p.text)));
  }

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
