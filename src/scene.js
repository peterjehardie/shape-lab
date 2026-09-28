// Scene model: ordered depth bands, layers inside them, and scene-wide settings.
import { KINDS } from './structures.js';
import { VOCAB_OPTIONS } from './geom.js';
import { newId, lerp } from './util.js';
import { defaultGraph } from './graph.js';

export const BANDS = [
  { id: 'sky', label: 'Sky', range: [0, 0.08], kind: 'clouds', frac: 0 },
  { id: 'distant', label: 'Distant hills & mountains', range: [0.14, 0.3], kind: 'ridge', frac: 1 / 3 },
  { id: 'middle', label: 'Middle distance', range: [0.36, 0.55], kind: 'hills', frac: 2 / 3 },
  { id: 'midfg', label: 'Middle foreground', range: [0.6, 0.74], kind: 'clusters', frac: 2 / 3 },
  { id: 'close', label: 'Close foreground', range: [0.8, 0.9], kind: 'trees', frac: 1 },
  { id: 'veryclose', label: 'Very close foreground', range: [0.94, 1], kind: 'grass', frac: 1 },
];
export const bandById = (id) => BANDS.find((b) => b.id === id) || BANDS[0];

const R = (key, label, min, max, step, def, extra = {}) => ({ key, label, type: 'range', min, max, step, def, ...extra });
const S = (key, label, options, def, extra = {}) => ({ key, label, type: 'select', options, def, ...extra });
const B = (key, label, def, extra = {}) => ({ key, label, type: 'bool', def, ...extra });
const C = (key, label, def, extra = {}) => ({ key, label, type: 'color', def, ...extra });

const hasTrunk = (l) => l.kind === 'trees' || l.kind === 'branch';

// Settings every layer has, grouped the way the inspector shows them.
export const LAYER_SECTIONS = [
  {
    id: 'shapes', title: 'Shape fill', note: 'The shapes dropped into the structure’s slots.',
    hide: (l) => l.kind === 'sky',
    params: [
      S('vocab', 'Shapes', VOCAB_OPTIONS, 'mix-soft', { geo: true }),
      R('shapeSize', 'Size', 0.2, 3, 0.01, 1, { geo: true }),
      R('sizeJitter', 'Size variety', 0, 1, 0.01, 0.4, { geo: true }),
      R('rotJitter', 'Rotation variety', 0, 1, 0.01, 1, { geo: true }),
      R('shapeNoise', 'Edge noise (per shape)', 0, 1, 0.01, 0.15, { geo: true }),
      R('shapeNoiseScale', 'Edge noise scale', 0.2, 6, 0.01, 1.5, { geo: true }),
    ],
  },
  {
    id: 'value', title: 'Value & colour', note: 'Colour sets hue only. Lightness comes from the value group.',
    params: [
      C('color', 'Colour', '#6f8f5a'),
      C('trunkColor', 'Trunk colour', '#5a4636', { show: hasTrunk }),
      R('trunkValue', 'Trunk value shift', -0.4, 0.4, 0.005, -0.08, { show: hasTrunk }),
      C('accentColor', 'Accent colour', '#f2d65c', { show: (l) => l.kind === 'grass' }),
      R('accentValue', 'Accent value shift', -0.5, 0.5, 0.005, 0.25, { show: (l) => l.kind === 'grass' }),
      S('valueGroup', 'Value group', [], 'auto', { dynamic: 'valueGroups' }),
      R('valueNudge', 'Value nudge', -0.4, 0.4, 0.005, 0),
      R('chroma', 'Colour strength', 0, 2, 0.01, 1),
      R('haze', 'Haze amount', 0, 2, 0.01, 1),
    ],
  },
  {
    id: 'form', title: 'Light & form', hide: (l) => l.kind === 'sky',
    params: [
      B('roundAuto', 'Measure roundness from each shape', true, { rebuild: true }),
      R('roundness', 'Roundness', 0, 1, 0.01, 0.8, { show: (l) => !l.p.roundAuto }),
      S('lightGroup', 'Light as one volume per', [['shape', 'Each shape'], ['cluster', 'Cluster'], ['object', 'Object (tree, cloud…)'], ['layer', 'Whole layer']], 'object'),
      R('volume', 'Volume lighting', 0, 1, 0.01, 0.6),
      R('spreadMul', 'Light/shadow range', 0, 3, 0.01, 1),
      R('lightBias', 'Light bias', -1, 1, 0.01, 0),
      S('lightSteps', 'Shading steps', [['inherit', 'Scene setting'], ['0', 'Smooth'], ['2', '2 steps'], ['3', '3 steps'], ['4', '4 steps']], 'inherit'),
      R('rim', 'Rim light', 0, 1, 0.01, 0),
    ],
  },
  {
    id: 'fake', title: 'Fake 2D light', note: 'Shadow clones for close things, dappled patches for far things.',
    hide: (l) => l.kind === 'sky',
    params: [
      R('clone', 'Shadow clone', 0, 1, 0.01, 0),
      R('cloneOffset', 'Clone offset', 0, 80, 0.5, 10),
      R('cloneSoft', 'Clone softness', 0, 30, 0.5, 3),
      R('cloneFraction', 'Share of objects cloned', 0, 1, 0.01, 1),
      B('cloneOnSky', 'Clone may fall on sky', false),
      R('dapple', 'Light/shadow patches', 0, 1, 0.01, 0),
      R('dappleScale', 'Patch scale', 0.2, 8, 0.01, 1.5),
      R('dappleStretch', 'Patch stretch', 0.2, 8, 0.01, 2),
      R('dappleCover', 'Shadow coverage', 0, 1, 0.01, 0.5),
    ],
  },
  {
    id: 'lines', title: 'Outline & line quality', hide: (l) => l.kind === 'sky',
    params: [
      S('lineMode', 'Outline around', [['none', 'Nothing'], ['shape', 'Each shape'], ['cluster', 'Each cluster'], ['object', 'Each object'], ['layer', 'Whole layer']], 'none', { rebuild: true }),
      R('lineWidth', 'Width', 0.2, 14, 0.1, 2, { show: (l) => l.p.lineMode !== 'none' }),
      S('lineTone', 'Tone', [['darker', 'Darker than fill'], ['ink', 'Ink colour'], ['lighter', 'Lighter than fill'], ['custom', 'Custom']], 'darker', { rebuild: true, show: (l) => l.p.lineMode !== 'none' }),
      C('lineColor', 'Line colour', '#1b1820', { show: (l) => l.p.lineMode !== 'none' && l.p.lineTone === 'custom' }),
      R('lineWeight', 'Heavier on shadow side', 0, 1, 0.01, 0.5, { show: (l) => l.p.lineMode !== 'none' }),
      R('lineBreak', 'Break on light side', 0, 1, 0.01, 0, { show: (l) => l.p.lineMode !== 'none' }),
      R('lineWobble', 'Wobble', 0, 1, 0.01, 0, { show: (l) => l.p.lineMode !== 'none' }),
      R('linePasses', 'Sketch passes', 1, 4, 1, 1, { show: (l) => l.p.lineMode !== 'none' }),
    ],
  },
  {
    id: 'distort', title: 'Distortion & noise', note: 'How strongly the scene-wide node graph bends this layer, plus the layer’s own noise.',
    hide: (l) => l.kind === 'sky',
    params: [
      R('distort', 'Node graph amount', -3, 3, 0.01, 1, { geo: true }),
      R('layerNoise', 'Layer noise (px)', 0, 80, 0.5, 0, { geo: true }),
      R('layerNoiseScale', 'Layer noise scale', 0.2, 12, 0.01, 2, { geo: true }),
    ],
  },
];

export const GLOBAL_SECTIONS = [
  {
    id: 'scene', title: 'Scene',
    params: [
      R('seed', 'Scene seed', 0, 9999, 1, 7),
      S('aspect', 'Frame', [['16:9', '16 : 9'], ['2:1', '2 : 1 panorama'], ['4:3', '4 : 3'], ['1:1', 'Square'], ['3:4', '3 : 4 portrait']], '16:9'),
    ],
  },
  {
    id: 'sun', title: 'Sun (outdoor light)', note: 'Angle is where the light comes from on screen. Front/back is whether the sun is behind the viewer (flat, front-lit) or ahead (backlit).',
    params: [
      R('sunAngle', 'Light from angle', 0, 360, 1, 130),
      R('sunFront', 'Sun behind viewer ↔ ahead', -0.95, 0.95, 0.01, 0.3),
      R('lightStrength', 'Light strength', 0, 2, 0.01, 1),
      S('lightSteps', 'Shading steps', [['0', 'Smooth'], ['2', '2 steps'], ['3', '3 steps'], ['4', '4 steps']], '0'),
      R('sunHue', 'Light hue', 0, 360, 1, 80),
      R('sunWarm', 'Light tint', 0, 1, 0.01, 0.45),
      R('shadowHue', 'Shadow hue', 0, 360, 1, 255),
      R('shadowCool', 'Shadow tint', 0, 1, 0.01, 0.45),
    ],
  },
  {
    id: 'sky', title: 'Sky & atmosphere', note: 'Haze pulls far layers toward the haze colour. Only hue and saturation shift; value groups keep control of lightness.',
    params: [
      C('skyTop', 'Sky top', '#5f93d0'),
      C('skyHorizon', 'Horizon', '#efdfc6'),
      C('hazeColor', 'Haze colour', '#a9bbd6'),
      R('horizonY', 'Horizon height', 0.1, 1, 0.005, 0.6),
      R('haze', 'Haze', 0, 1, 0.01, 0.7),
      R('hazeCurve', 'Haze falloff', 0.3, 4, 0.01, 1.3),
    ],
  },
  {
    id: 'lines', title: 'Lines & value checks',
    params: [
      C('ink', 'Ink colour', '#1c1a24'),
      R('notan1', 'Value-check threshold 1', 0, 1, 0.01, 0.45),
      R('notan2', 'Value-check threshold 2', 0, 1, 0.01, 0.72),
    ],
  },
];

export function defaultValueGroups() {
  return [
    { name: 'Sky', value: 0.86, spread: 0.06 },
    { name: 'Far', value: 0.72, spread: 0.08 },
    { name: 'Middle', value: 0.54, spread: 0.1 },
    { name: 'Near', value: 0.32, spread: 0.12 },
  ];
}

export function defaultGlobals() {
  const g = { valueGroups: defaultValueGroups() };
  for (const s of GLOBAL_SECTIONS) for (const p of s.params) g[p.key] = p.def;
  return g;
}

export function kindParams(kind) {
  return (KINDS[kind] || KINDS.clouds).params;
}

export function ensureParams(layer) {
  layer.p = layer.p || {};
  for (const s of LAYER_SECTIONS) for (const spec of s.params) if (layer.p[spec.key] === undefined) layer.p[spec.key] = spec.def;
  for (const spec of kindParams(layer.kind)) if (layer.p[spec.key] === undefined) layer.p[spec.key] = spec.def;
  return layer;
}

export function makeLayer(band, kind, name, overrides = {}) {
  const layer = { id: newId('L'), name: name || KINDS[kind].label, band, kind, visible: true, seed: Math.floor(Math.random() * 99999), p: {} };
  ensureParams(layer);
  if (kind === 'sky') { layer.p.distort = 0; }
  Object.assign(layer.p, overrides);
  return layer;
}

// Depth 0 = farthest, 1 = nearest. Layers share their band's slice evenly.
export function layerDepth(scene, layer) {
  const band = bandById(layer.band);
  const same = scene.layers.filter((l) => l.band === layer.band);
  const i = same.indexOf(layer);
  const t = same.length <= 1 ? 0.5 : i / (same.length - 1);
  return lerp(band.range[0], band.range[1], t);
}

export function valueGroupIndex(scene, layer) {
  const n = scene.globals.valueGroups.length;
  const v = layer.p.valueGroup;
  if (v !== 'auto' && v !== undefined && +v < n) return +v;
  return Math.round(bandById(layer.band).frac * (n - 1));
}

// Keep layers sorted back-to-front by band while preserving order inside a band.
export function sortLayers(scene) {
  const order = new Map(BANDS.map((b, i) => [b.id, i]));
  scene.layers = scene.layers
    .map((l, i) => [l, i])
    .sort((a, b) => order.get(a[0].band) - order.get(b[0].band) || a[1] - b[1])
    .map((x) => x[0]);
}

export function aspectSize(aspect) {
  switch (aspect) {
    case '2:1': return [1800, 900];
    case '4:3': return [1440, 1080];
    case '1:1': return [1200, 1200];
    case '3:4': return [1080, 1440];
    default: return [1600, 900];
  }
}

// ---------------------------------------------------------------------------------
export function defaultScene() {
  const L = makeLayer;
  const layers = [
    L('sky', 'sky', 'Sky'),
    L('sky', 'clouds', 'Clouds far', { count: 9, yTop: 0.3, yBottom: 0.5, cloudSize: 40, perspective: 0.6, color: '#f3ede2', valueNudge: 0.02, volume: 0.7, dapple: 0, shapeNoise: 0.1 }),
    L('sky', 'clouds', 'Clouds near', { count: 5, yTop: 0.04, yBottom: 0.28, cloudSize: 95, color: '#f6f1e8', valueNudge: 0.05, volume: 0.75, rim: 0.3 }),
    L('distant', 'ridge', 'Far range', { baseY: 0.58, height: 0.24, color: '#7c8fb8', frequency: 2.6, dapple: 0.25, dappleScale: 2, sharp: 0.7 }),
    L('distant', 'ridge', 'Near range', { baseY: 0.61, height: 0.12, color: '#6d8aa0', frequency: 4, sharp: 0.3, facetDetail: 0.6, scatter: 160, scatterSize: 3, vocab: 'mix-foliage' }),
    L('middle', 'hills', 'Hills', { baseY: 0.66, height: 0.07, bumps: 5, color: '#88a060', scatter: 90, scatterSize: 6, vocab: 'mix-foliage', dapple: 0.45, dappleScale: 1.6 }),
    L('middle', 'trees', 'Tree line', { count: 22, baseY: 0.69, baseJitter: 0.012, height: 0.09, trunk: 2.5, levels: 3, foliage: 10, density: 5, color: '#5e8448', vocab: 'mix-foliage', form: 'broadleaf', midFoliage: 0.8 }),
    L('midfg', 'clusters', 'Bushes', { count: 9, yTop: 0.75, yBottom: 0.82, color: '#5f8a3e', vocab: 'mix-foliage', clone: 0.25, cloneOffset: 6 }),
    L('close', 'trees', 'Trees', { count: 2, x0: 0.06, x1: 0.3, baseY: 0.93, height: 0.56, trunk: 14, foliage: 42, density: 7, color: '#4c7534', vocab: 'mix-foliage', lineMode: 'object', lineWidth: 2, clone: 0.45, cloneOffset: 12, cloneSoft: 4 }),
    L('close', 'clusters', 'Rocks', { count: 4, x0: 0.45, x1: 0.95, yTop: 0.87, yBottom: 0.93, clusterSize: 62, perCluster: 5, perspective: 0.3, flat: 0.6, color: '#8e877a', vocab: 'mix-hard', lightGroup: 'shape', volume: 0.3, lineMode: 'cluster', lineWidth: 1.6, clone: 0.5, cloneOffset: 8, valueNudge: 0.1, ground: false, chroma: 0.6 }),
    L('veryclose', 'grass', 'Grass', { count: 36, yTop: 0.95, color: '#56803a', valueNudge: -0.02, flowers: 0.25, lineMode: 'none' }),
    L('veryclose', 'branch', 'Overhang', { side: 'right', anchor: 0.08, reach: 0.45, color: '#2f4a26', vocab: 'leaf', valueNudge: -0.12, trunkColor: '#3a2e26', clone: 0.55, cloneOffset: 16, cloneSoft: 6, lineMode: 'object', lineWidth: 2.5, lineWeight: 0.8, lineBreak: 0.35, rotJitter: 0.25 }),
  ];
  return { version: 1, globals: defaultGlobals(), layers, graph: defaultGraph() };
}
