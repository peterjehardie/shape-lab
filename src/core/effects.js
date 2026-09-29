// Effect registry. An effect instance in a document is plain data:
//   { id, type, on: true, params: { ... } }
// The registry says which stage it runs in and describes its parameters, so any
// interface (this browser one or a native one later) can build controls from it.
//
// Stages:
//   geom    moves the outline (runs first, in order)
//   raster  works on pixels after the fill (runs after, in order)
// An effect on a shape acts on that shape. On a group or layer, geom effects act on
// every shape inside (in the group's space) and raster effects act on the combined picture.
// On the document they act on everything.

import * as G from './geomfx.js';
import * as R from './raster.js';
import { oklch } from './color.js';

const n = (key, label, min, max, step, def, extra = {}) => ({ key, label, type: 'number', min, max, step, default: def, ...extra });
const seed = () => ({ key: 'seed', label: 'Seed', type: 'number', min: 0, max: 999999, step: 1, default: 1, seed: true });
const sel = (key, label, options, def) => ({ key, label, type: 'select', options, default: def });
const col = (key, label, def) => ({ key, label, type: 'color', default: def });
const bool = (key, label, def) => ({ key, label, type: 'bool', default: def });
const ang = (key = 'angle', label = 'Angle', def = 0) => n(key, label, -360, 360, 1, def, { unit: '°', angle: true });

const NOISE_KINDS = [['fbm', 'Cloudy'], ['ridged', 'Ridged'], ['billow', 'Billow'], ['cells', 'Cells'], ['simple', 'Smooth']];

export const EFFECTS = {
  // ---- Edge (geometry) ----
  roughen: {
    label: 'Torn edge', group: 'Edge', stage: 'geom', fn: G.roughen,
    hint: 'Pushes the outline in and out in layered ripples, like torn paper or a rough brush edge.',
    params: [n('amount', 'Amount', 0, 200, 0.5, 8), n('detail', 'Detail', 0.1, 6, 0.05, 1), n('jag', 'Jag', 0, 2, 0.01, 0.3), n('bias', 'Push', -1, 1, 0.01, 0), seed()],
  },
  warp: {
    label: 'Noise warp', group: 'Distort', stage: 'geom', fn: G.warp,
    hint: 'Slides the outline through a smooth random flow.',
    params: [n('amount', 'Amount', 0, 400, 0.5, 20), n('scale', 'Size', 2, 2000, 1, 120), n('octaves', 'Detail', 1, 6, 1, 2), n('stretch', 'Stretch', 0.1, 10, 0.05, 1), ang(), seed()],
  },
  wave: {
    label: 'Wave', group: 'Distort', stage: 'geom', fn: G.wave,
    params: [n('amount', 'Height', 0, 300, 0.5, 10), n('wavelength', 'Length', 2, 2000, 1, 80), ang(), n('phase', 'Phase', 0, 360, 1, 0, { unit: '°' })],
  },
  zigzag: {
    label: 'Zigzag', group: 'Edge', stage: 'geom', fn: G.zigzag,
    params: [n('amount', 'Amount', 0, 100, 0.5, 5), n('size', 'Spacing', 1, 200, 0.5, 10), bool('smooth', 'Smooth', false)],
  },
  jitter: {
    label: 'Jitter', group: 'Edge', stage: 'geom', fn: G.jitter,
    params: [n('amount', 'Amount', 0, 100, 0.25, 3), n('spacing', 'Spacing', 0.5, 100, 0.5, 6), seed()],
  },
  facet: {
    label: 'Facet', group: 'Edge', stage: 'geom', fn: G.facet,
    hint: 'Reduces the outline to a few straight cuts, like a chiselled or cut-paper edge.',
    params: [n('amount', 'Tolerance', 0, 200, 0.5, 8)],
  },
  smooth: {
    label: 'Smooth', group: 'Edge', stage: 'geom', fn: G.smooth,
    params: [n('iterations', 'Passes', 0, 6, 1, 2)],
  },
  offset: {
    label: 'Grow / shrink', group: 'Edge', stage: 'geom', fn: G.offset,
    params: [n('amount', 'Amount', -300, 300, 0.5, 6), sel('join', 'Corners', [['round', 'Round'], ['miter', 'Sharp'], ['square', 'Square']], 'round')],
  },
  twist: {
    label: 'Twist', group: 'Distort', stage: 'geom', fn: G.twist,
    params: [n('angle', 'Angle', -1080, 1080, 1, 60, { unit: '°' }), bool('inward', 'Twist centre', false)],
  },
  pinch: {
    label: 'Pinch / bloat', group: 'Distort', stage: 'geom', fn: G.pinch,
    params: [n('amount', 'Amount', -2, 2, 0.01, 0.5)],
  },
  taper: {
    label: 'Taper', group: 'Distort', stage: 'geom', fn: G.taper,
    params: [n('amount', 'Amount', -1, 1, 0.01, 0.4), sel('axis', 'Axis', [['vertical', 'Vertical'], ['horizontal', 'Horizontal']], 'vertical')],
  },
  bend: {
    label: 'Bend', group: 'Distort', stage: 'geom', fn: G.bend,
    params: [n('amount', 'Amount', -1.9, 1.9, 0.01, 0.3)],
  },

  // ---- Texture (raster) ----
  noiseTexture: {
    label: 'Noise texture', group: 'Texture', stage: 'raster', fn: R.noiseTexture,
    hint: 'Noise inside the shape. Stretch it for brush streaks.',
    params: [
      sel('kind', 'Kind', NOISE_KINDS, 'fbm'),
      sel('mode', 'Acts on', [['value', 'Value'], ['darken', 'Darken'], ['lighten', 'Lighten'], ['color', 'Colour'], ['alpha', 'Opacity']], 'value'),
      n('amount', 'Amount', 0, 1, 0.01, 0.35), n('scale', 'Size', 0.5, 2000, 0.5, 40), n('octaves', 'Detail', 1, 7, 1, 4),
      n('stretch', 'Stretch', 0.05, 40, 0.05, 1), ang(), n('contrast', 'Contrast', 0, 8, 0.05, 1), col('color', 'Colour', oklch(0.3, 0.05, 250)), seed(),
    ],
  },
  grain: {
    label: 'Grain', group: 'Texture', stage: 'raster', fn: R.grain,
    params: [n('amount', 'Amount', 0, 1, 0.01, 0.12), n('size', 'Size', 0.2, 20, 0.1, 1), bool('mono', 'Mono', true), seed()],
  },
  halftone: {
    label: 'Halftone', group: 'Texture', stage: 'raster', fn: R.halftone,
    params: [n('size', 'Cell', 1, 200, 0.5, 10), ang('angle', 'Angle', 45), n('gain', 'Gain', 0.2, 2, 0.01, 1), n('softness', 'Softness', 0.3, 4, 0.05, 0.8), sel('mode', 'Colour', [['keep', 'Keep'], ['ink', 'Ink']], 'keep'), col('color', 'Ink', oklch(0.2, 0.02, 260))],
  },
  posterize: {
    label: 'Value steps', group: 'Texture', stage: 'raster', fn: R.posterize,
    hint: 'Snaps lightness into a few steps, like a value study.',
    params: [n('levels', 'Steps', 2, 12, 1, 4)],
  },
  adjust: {
    label: 'Adjust colour', group: 'Texture', stage: 'raster', fn: R.adjust,
    params: [n('lightness', 'Lightness', -1, 1, 0.01, 0), n('chroma', 'Chroma', 0, 3, 0.01, 1), n('hue', 'Hue', -180, 180, 1, 0, { unit: '°' })],
  },

  // ---- Paint edge / wear (raster) ----
  dissolve: {
    label: 'Dry edge', group: 'Wear', stage: 'raster', fn: R.dissolve, pad: () => 0,
    hint: 'Noise eats into the shape, mostly near its edge, like dry brush or worn print.',
    params: [
      n('amount', 'Amount', 0, 1.5, 0.01, 0.45), n('edge', 'Edge focus', 0, 2, 0.01, 0.7), n('edgeWidth', 'Edge width', 1, 400, 1, 24),
      n('softness', 'Softness', 0.005, 0.5, 0.005, 0.04), sel('kind', 'Kind', NOISE_KINDS, 'fbm'), n('scale', 'Size', 0.5, 1000, 0.5, 14),
      n('octaves', 'Detail', 1, 7, 1, 4), n('stretch', 'Stretch', 0.05, 40, 0.05, 1), ang(), seed(),
    ],
  },
  fade: {
    label: 'Fade', group: 'Wear', stage: 'raster', fn: R.fade,
    params: [ang('angle', 'Direction', 0), n('start', 'Start', 0, 1, 0.01, 0.45), n('end', 'End', 0, 1.5, 0.01, 1), n('amount', 'Amount', 0, 1, 0.01, 1)],
  },
  edgePool: {
    label: 'Pooled edge', group: 'Wear', stage: 'raster', fn: R.edgePool,
    hint: 'Darkens the rim, like watercolour drying at its edge.',
    params: [n('amount', 'Amount', 0, 1, 0.01, 0.35), n('width', 'Width', 0.5, 200, 0.5, 6)],
  },

  // ---- Distort pixels (raster) ----
  displace: {
    label: 'Displace', group: 'Distort', stage: 'raster', fn: R.displace, pad: (p) => Math.abs(p.amount || 0),
    hint: 'Pushes pixels around, smearing inside and spilling past the edge.',
    params: [n('amount', 'Amount', 0, 300, 0.5, 12), n('scale', 'Size', 1, 2000, 1, 60), n('octaves', 'Detail', 1, 6, 1, 3), n('stretch', 'Stretch', 0.05, 20, 0.05, 1), ang(), seed()],
  },
  smear: {
    label: 'Smear', group: 'Distort', stage: 'raster', fn: R.smear, pad: (p) => Math.abs(p.length || 0),
    params: [n('length', 'Length', 0, 400, 0.5, 20), ang(), bool('centered', 'Both ways', false)],
  },
  blur: {
    label: 'Blur', group: 'Distort', stage: 'raster', fn: R.blur, pad: (p) => (p.radius || 0) * 2,
    params: [n('radius', 'Radius', 0, 200, 0.25, 4)],
  },

  // ---- Light (raster) ----
  edgeLight: {
    label: 'Edge light', group: 'Light', stage: 'raster', fn: R.edgeLight,
    hint: 'The side facing the light picks up a colour. Point it the other way with a dark colour for form shadow.',
    params: [ang('angle', 'Light from', -135), n('width', 'Reach', 0, 300, 0.5, 10), n('softness', 'Softness', 0, 100, 0.5, 4), n('amount', 'Amount', 0, 1, 0.01, 0.7), col('color', 'Colour', oklch(0.95, 0.06, 85))],
  },
  innerShadow: {
    label: 'Form shadow', group: 'Light', stage: 'raster', fn: R.edgeLight,
    params: [ang('angle', 'Shadow side', 45), n('width', 'Reach', 0, 300, 0.5, 24), n('softness', 'Softness', 0, 100, 0.5, 12), n('amount', 'Amount', 0, 1, 0.01, 0.5), col('color', 'Colour', oklch(0.25, 0.05, 280))],
  },
  shadow: {
    label: 'Cast shadow', group: 'Outside', stage: 'raster', fn: R.shadow, pad: (p) => Math.hypot(p.dx || 0, p.dy || 0) + (p.blur || 0) * 2 + 4,
    params: [n('dx', 'Offset X', -500, 500, 0.5, 8), n('dy', 'Offset Y', -500, 500, 0.5, 12), n('blur', 'Blur', 0, 200, 0.5, 10), n('spread', 'Spread', 0, 1, 0.01, 0), n('opacity', 'Opacity', 0, 1, 0.01, 0.45), col('color', 'Colour', oklch(0.15, 0.03, 270))],
  },
  glow: {
    label: 'Glow', group: 'Outside', stage: 'raster', fn: R.shadow, pad: (p) => (p.blur || 0) * 2 + 4,
    params: [n('blur', 'Size', 0, 300, 0.5, 20), n('spread', 'Spread', 0, 1, 0.01, 0.2), n('opacity', 'Opacity', 0, 1, 0.01, 0.6), col('color', 'Colour', oklch(0.92, 0.1, 90))],
  },
  spatter: {
    label: 'Spatter', group: 'Outside', stage: 'raster', fn: R.spatter, pad: (p) => (p.spread || 0) + (p.size || 0) * 2,
    hint: 'Droplets flung off the edge.',
    params: [n('count', 'Count', 0, 2000, 1, 60), n('spread', 'Spread', 0, 600, 0.5, 40), n('size', 'Size', 0.2, 60, 0.1, 3), n('variance', 'Variance', 0, 3, 0.01, 1), bool('useFill', 'Fill colour', true), col('color', 'Colour', oklch(0.3, 0.05, 30)), seed()],
  },
};

export const EFFECT_GROUPS = ['Edge', 'Distort', 'Wear', 'Texture', 'Light', 'Outside'];

let _eid = 0;
export function makeEffect(type, overrides = {}) {
  const def = EFFECTS[type];
  const params = {};
  for (const p of def.params) params[p.key] = p.type === 'color' ? { ...p.default } : p.default;
  if ('seed' in params) params.seed = (Math.random() * 1e5) | 0;
  Object.assign(params, overrides);
  return { id: 'fx' + Date.now().toString(36) + (_eid++).toString(36), type, on: true, params };
}

export function effectPad(effects) {
  let pad = 0;
  for (const e of effects || []) {
    if (!e.on) continue;
    const d = EFFECTS[e.type];
    if (d?.stage === 'raster' && d.pad) pad += d.pad(e.params);
  }
  return pad;
}

export function applyGeomEffects(polys, effects) {
  for (const e of effects || []) {
    if (!e.on) continue;
    const d = EFFECTS[e.type];
    if (d?.stage === 'geom') polys = d.fn(polys, e.params);
  }
  return polys;
}

export const hasStage = (effects, stage) => (effects || []).some((e) => e.on && EFFECTS[e.type]?.stage === stage);
