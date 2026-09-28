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

const hasTrunk = (l) => ['trees', 'branch', 'rows'].includes(l.kind);
const noForm = (l) => l.kind === 'sky' || l.kind === 'water';

// Settings every layer has, grouped the way the inspector shows them.
export const LAYER_SECTIONS = [
  {
    id: 'shapes', title: 'Shape fill', note: 'The shapes dropped into the structure’s slots.',
    hide: noForm,
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
    id: 'variety', title: 'Colour variety', note: 'Small random shifts so repeated shapes do not look stamped.',
    hide: (l) => l.kind === 'sky' || l.kind === 'water',
    params: [
      R('valueJitter', 'Value variety', 0, 0.2, 0.005, 0.03),
      R('hueJitter', 'Hue variety (degrees)', 0, 60, 1, 8),
      S('jitterBy', 'Vary per', [['shape', 'Shape'], ['cluster', 'Cluster'], ['object', 'Object']], 'cluster'),
    ],
  },
  {
    id: 'value', title: 'Value & colour', note: 'Colour sets hue only. Lightness comes from the value group.',
    params: [
      C('color', 'Colour', '#6f8f5a'),
      C('trunkColor', 'Trunk colour', '#5a4636', { show: hasTrunk }),
      R('trunkValue', 'Trunk value shift', -0.4, 0.4, 0.005, -0.08, { show: hasTrunk }),
      C('accentColor', 'Accent colour (flowers, banks)', '#f2d65c', { show: (l) => l.kind === 'grass' || l.kind === 'path' }),
      R('accentValue', 'Accent value shift', -0.5, 0.5, 0.005, 0.25, { show: (l) => l.kind === 'grass' || l.kind === 'path' }),
      R('snowValue', 'Snow value shift', -0.3, 0.3, 0.005, 0, { show: (l) => l.kind === 'ridge' }),
      S('valueGroup', 'Value group', [], 'auto', { dynamic: 'valueGroups' }),
      R('valueNudge', 'Value nudge', -0.4, 0.4, 0.005, 0),
      R('chroma', 'Colour strength', 0, 2, 0.01, 1),
      R('haze', 'Haze amount', 0, 2, 0.01, 1),
    ],
  },
  {
    id: 'form', title: 'Light & form', hide: noForm,
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
    hide: noForm,
    params: [
      R('clone', 'Shadow clone', 0, 1, 0.01, 0),
      S('cloneMode', 'Clone kind', [['offset', 'Offset copy'], ['cast', 'Cast onto the ground']], 'offset', { rebuild: true }),
      R('castLen', 'Cast length', 0.1, 3, 0.01, 1, { show: (l) => l.p.cloneMode === 'cast' }),
      R('cloneOffset', 'Clone offset', 0, 80, 0.5, 10),
      R('cloneSoft', 'Clone softness', 0, 30, 0.5, 3),
      R('cloneFraction', 'Share of objects cloned', 0, 1, 0.01, 1),
      B('cloneOnSky', 'Clone may fall on sky', false),
      R('contact', 'Contact shadow at feet', 0, 1, 0.01, 0),
      R('halo', 'Separation halo', 0, 1, 0.01, 0),
      R('haloSize', 'Halo size', 1, 60, 0.5, 14),
      R('glow', 'Backlit glow (translucent edges)', 0, 1, 0.01, 0),
      R('dapple', 'Light/shadow patches', 0, 1, 0.01, 0),
      R('dappleScale', 'Patch scale', 0.2, 8, 0.01, 1.5),
      R('dappleStretch', 'Patch stretch', 0.2, 8, 0.01, 2),
      R('dappleCover', 'Shadow coverage', 0, 1, 0.01, 0.5),
    ],
  },
  {
    id: 'lines', title: 'Outline & line quality', hide: noForm,
    params: [
      S('lineMode', 'Outline around', [['none', 'Nothing'], ['shape', 'Each shape'], ['cluster', 'Each cluster'], ['object', 'Each object'], ['layer', 'Whole layer']], 'none', { rebuild: true }),
      R('lineWidth', 'Width', 0.2, 14, 0.1, 2, { show: (l) => l.p.lineMode !== 'none' }),
      S('lineTone', 'Tone', [['darker', 'Darker than fill'], ['ink', 'Ink colour'], ['lighter', 'Lighter than fill'], ['custom', 'Custom']], 'darker', { rebuild: true, show: (l) => l.p.lineMode !== 'none' }),
      C('lineColor', 'Line colour', '#1b1820', { show: (l) => l.p.lineMode !== 'none' && l.p.lineTone === 'custom' }),
      R('lineWeight', 'Heavier on shadow side', 0, 1, 0.01, 0.5, { show: (l) => l.p.lineMode !== 'none' }),
      R('lineBreak', 'Break on light side', 0, 1, 0.01, 0, { show: (l) => l.p.lineMode !== 'none' }),
      R('lineWobble', 'Wobble', 0, 1, 0.01, 0, { show: (l) => l.p.lineMode !== 'none' }),
      R('linePasses', 'Sketch passes', 1, 4, 1, 1, { show: (l) => l.p.lineMode !== 'none' }),
      R('lineLost', 'Lose edges where values match', 0, 1, 0.01, 0, { show: (l) => l.p.lineMode !== 'none' }),
      R('hatch', 'Hatching in shadow', 0, 1, 0.01, 0),
      R('hatchGap', 'Hatch spacing', 2, 30, 0.5, 6),
      R('hatchAngle', 'Hatch angle', 0, 180, 1, 60),
      R('hatchCut', 'How far into the shadow', -0.8, 0.8, 0.01, 0),
    ],
  },
  {
    id: 'distort', title: 'Distortion & noise', note: 'How strongly the scene-wide node graph bends this layer, plus the layer’s own noise.',
    hide: noForm,
    params: [
      R('distort', 'Node graph amount', -3, 3, 0.01, 1, { geo: true }),
      R('layerNoise', 'Layer noise (px)', 0, 80, 0.5, 0, { geo: true }),
      R('layerNoiseScale', 'Layer noise scale', 0.2, 12, 0.01, 2, { geo: true }),
      R('graphValue', 'Graph \u2192 value', -3, 3, 0.01, 1, { geo: true }),
      R('graphSize', 'Graph \u2192 size', -3, 3, 0.01, 1, { geo: true }),
      R('graphDensity', 'Graph \u2192 density', -3, 3, 0.01, 1, { geo: true }),
    ],
  },
  {
    id: 'edits', title: 'Position & hand edits', note: 'Canvas tools write here: drag objects, add them by clicking, draw shapes.',
    hide: (l) => l.kind === 'sky' || l.kind === 'water',
    params: [
      R('offX', 'Shift sideways', -0.5, 0.5, 0.001, 0, { geo: true }),
      R('offY', 'Shift up/down', -0.5, 0.5, 0.001, 0, { geo: true }),
      R('blur', 'Extra blur', 0, 12, 0.1, 0),
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
      R('rays', 'Light shafts', 0, 1, 0.01, 0),
      R('rayLength', 'Shaft length', 0.1, 1, 0.01, 0.6),
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
      C('nearTint', 'Near colour tint', '#c98a4a'),
      R('nearTintAmt', 'Near tint amount', 0, 1, 0.01, 0.12),
      R('dof', 'Depth blur', 0, 1, 0.01, 0),
      R('focus', 'Sharpest depth (0 far, 1 near)', 0, 1, 0.01, 0.8),
    ],
  },
  {
    id: 'finish', title: 'Finish', note: 'Whole-picture treatment applied last.',
    params: [
      R('grain', 'Paper grain', 0, 1, 0.01, 0),
      R('vignette', 'Vignette', 0, 1, 0.01, 0),
      R('saturation', 'Saturation', 0, 2, 0.01, 1),
      R('contrast', 'Contrast', 0.5, 1.5, 0.01, 1),
      R('warmth', 'Warm \u2194 cool', -1, 1, 0.01, 0),
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
  const layer = { id: newId('L'), name: name || KINDS[kind].label, band, kind, visible: true, locked: false, seed: Math.floor(Math.random() * 99999), p: {} };
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
  const soft = { vocab: 'mix-foliage', shapeNoise: 0.28, shapeNoiseScale: 1.6, valueJitter: 0.04, hueJitter: 10 };
  const layers = [
    L('sky', 'sky', 'Sky', { glow: 0.55, glowSize: 0.6 }),
    L('sky', 'clouds', 'Clouds far', { cloudType: 'stratus', count: 7, yTop: 0.38, yBottom: 0.52, cloudSize: 36, puffs: 14, perspective: 0.5, color: '#f4ece2', valueNudge: 0.01, volume: 0.6, shapeNoise: 0.15 }),
    L('sky', 'clouds', 'Clouds near', { count: 4, yTop: 0.05, yBottom: 0.3, cloudSize: 100, puffs: 20, puffSize: 0.5, color: '#f7f1e8', valueNudge: 0.04, volume: 0.8, rim: 0.25, shapeNoise: 0.22, valueJitter: 0.015, hueJitter: 4 }),
    L('distant', 'ridge', 'Far range', { baseY: 0.585, height: 0.22, color: '#8e9bc2', frequency: 2.4, sharp: 0.7, snow: 0.35, facetDetail: 0.5, dapple: 0.2, dappleScale: 2.2 }),
    L('distant', 'ridge', 'Near range', { baseY: 0.62, height: 0.11, color: '#7a92a6', frequency: 4, sharp: 0.3, facetDetail: 0.6, scatter: 260, scatterSize: 2.6, scatterDepth: 0.06, ...soft, hueJitter: 6 }),
    L('middle', 'hills', 'Hills', { baseY: 0.665, height: 0.055, bumps: 5, color: '#90a46c', scatter: 150, scatterSize: 4.5, scatterCluster: 4, ...soft, dapple: 0.45, dappleScale: 1.6 }),
    L('middle', 'trees', 'Tree line', { count: 30, baseY: 0.695, baseJitter: 0.01, height: 0.095, trunk: 2.2, levels: 3, foliage: 9, density: 9, shapeSize: 0.85, color: '#5f7f4c', ...soft, jitterBy: 'object', midFoliage: 0.9, volume: 0.75 }),
    L('midfg', 'rows', 'Fields', { rows: 6, yTop: 0.705, yBottom: 0.93, perspective: 1.5, tilt: 0.04, fieldContrast: 0.05, hedgeSize: 9, hedgeGaps: 0.3, color: '#9fa862', ...soft, hueJitter: 22, jitterBy: 'object', groundDetail: 0 }),
    L('midfg', 'path', 'River', { startX: 0.57, startY: 0.705, endX: 0.8, endY: 1.06, startWidth: 0.008, endWidth: 0.42, meander: 0.14, color: '#7fa6d2', banks: 90, bankSize: 10, ...soft, valueNudge: 0.04, chroma: 1.3, accentColor: '#5f7f45', accentValue: -0.12 }),
    L('close', 'trees', 'Trees', { count: 2, x0: 0.07, x1: 0.3, baseY: 0.95, height: 0.62, trunk: 13, levels: 4, foliage: 40, density: 16, shapeSize: 0.75, foliageSpread: 1.15, midFoliage: 0.7, color: '#4f6e39', trunkColor: '#4a3a31', ...soft, shapeNoise: 0.32, volume: 0.8, rim: 0.2, clone: 0.45, cloneMode: 'cast', castLen: 0.55, cloneSoft: 5, contact: 0.5, groundDetail: 140 }),
    L('close', 'clusters', 'Rocks', { count: 3, x0: 0.42, x1: 0.6, yTop: 0.9, yBottom: 0.95, clusterSize: 50, perCluster: 5, flat: 0.6, perspective: 0.3, color: '#8b8579', vocab: 'mix-hard', lightGroup: 'shape', volume: 0.3, contact: 0.6, valueNudge: 0.08, ground: false, chroma: 0.6, valueJitter: 0.05, hueJitter: 6 }),
    L('veryclose', 'grass', 'Grass', { count: 46, yTop: 0.955, bladeHeight: 80, color: '#667f3c', valueNudge: -0.02, flowers: 0.3, accentColor: '#efd780', hueJitter: 12, valueJitter: 0.04, jitterBy: 'object', groundDetail: 60 }),
  ];
  const globals = defaultGlobals();
  Object.assign(globals, {
    sunAngle: 148, sunFront: 0.15, sunHue: 72, sunWarm: 0.6, shadowHue: 250, shadowCool: 0.55,
    skyTop: '#7d9cc6', skyHorizon: '#f1dcc0', hazeColor: '#b8c2d6', horizonY: 0.62, haze: 0.8,
    nearTintAmt: 0.15, grain: 0.3, vignette: 0.35, dof: 0.3, focus: 0.85, saturation: 0.95, warmth: 0.1,
  });
  globals.valueGroups = [
    { name: 'Sky', value: 0.88, spread: 0.05 },
    { name: 'Far', value: 0.74, spread: 0.05 },
    { name: 'Middle', value: 0.58, spread: 0.07 },
    { name: 'Near', value: 0.36, spread: 0.1 },
  ];
  const graph = defaultGraph();
  graph.nodes.find((n) => n.type === 'output').params.scale = 5;
  return { version: 2, globals, layers, graph };
}
