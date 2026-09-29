// The document: plain JSON, no classes, so it saves as-is and can be read by any host.
//
// doc = {
//   format: 'shapelab.doc', version: 1, id, name,
//   artboard: { w, h, bg: Paint|null },
//   root: 'root',                 // id of the top group; its children are the layers
//   nodes: { [id]: Node },        // flat map; parents list children ids in drawing order (bottom first)
//   assets: { [id]: Asset },      // baked swatches and images
//   palette: [Color],             // document colours for quick picking
// }
//
// Node (every type): { id, type, name, parent, visible, locked, transform, opacity, blend, effects, mask }
//   transform = { x, y, rot, sx, sy, skew }  (degrees for rot/skew)
//   mask      = null | 'alpha' | 'invert' | 'luma'  -> this node masks its siblings instead of drawing
// type 'layer' | 'group': { children }
// type 'shape': { geom, fill, stroke }       geom = primitive params { kind, ... } or { kind: 'path', path }
// type 'bool':  { op, children, fill, stroke }  combines its children's outlines (union/subtract/...)
// type 'gen':   { graph, fill, stroke }      shapes made by a node graph (see graph.js)
// type 'image': { asset, w, h }              a placed swatch or picture
//
// Paint:  { type: 'solid', color } | { type: 'linear', angle, stops } | { type: 'radial', cx, cy, r, stops }
//       | { type: 'noise', kind, scale, octaves, stretch, angle, contrast, seed, stops }
//       | { type: 'pattern', pattern, size, weight, angle, fg, bg } | { type: 'swatch', asset, scale, angle }
// Stroke: { paint, width, join, cap, profile, taper, jitter, seed }

import { oklch } from './color.js';
import { primDefaults } from './prims.js';
import { fromTransform, mul, identity } from './math.js';

export const FORMAT = 'shapelab.doc';
export const VERSION = 1;

let counter = 0;
export const uid = (prefix = 'n') => prefix + Date.now().toString(36).slice(-5) + (counter++).toString(36) + Math.random().toString(36).slice(2, 5);

export const solid = (color) => ({ type: 'solid', color });
export const defaultTransform = (x = 0, y = 0) => ({ x, y, rot: 0, sx: 1, sy: 1, skew: 0 });

export const DEFAULT_PALETTE = [
  oklch(0.97, 0.01, 90), oklch(0.86, 0.05, 80), oklch(0.72, 0.11, 60), oklch(0.62, 0.15, 35),
  oklch(0.5, 0.13, 20), oklch(0.36, 0.06, 30), oklch(0.2, 0.02, 270), oklch(0.45, 0.08, 250),
  oklch(0.62, 0.09, 220), oklch(0.78, 0.07, 190), oklch(0.66, 0.1, 140), oklch(0.46, 0.08, 150),
];

export function newDoc(name = 'Untitled') {
  const root = baseNode('group', { id: 'root', name: 'Document', parent: null, children: [] });
  const doc = {
    format: FORMAT, version: VERSION, id: uid('d'), name,
    artboard: { w: 1600, h: 1000, bg: solid(oklch(0.955, 0.012, 85)) },
    root: 'root',
    nodes: { root },
    assets: {},
    palette: DEFAULT_PALETTE.map((c) => ({ ...c })),
  };
  const layer = baseNode('layer', { name: 'Layer 1', parent: 'root', children: [] });
  doc.nodes[layer.id] = layer;
  root.children.push(layer.id);
  return doc;
}

export function baseNode(type, props = {}) {
  const n = {
    id: props.id || uid(),
    type,
    name: props.name || type[0].toUpperCase() + type.slice(1),
    parent: null,
    visible: true,
    locked: false,
    transform: defaultTransform(),
    opacity: 1,
    blend: 'normal',
    effects: [],
    mask: null,
  };
  if (type === 'layer' || type === 'group') n.children = [];
  return Object.assign(n, props);
}

export function makeShape(kind, props = {}) {
  const geom = kind === 'path' ? { kind: 'path', path: props.path || { subpaths: [] } } : { ...primDefaults(kind), ...(props.geom || {}) };
  const open = ['line', 'wave', 'spiral'].includes(kind) || (kind === 'path' && geom.path.subpaths.every((s) => !s.closed));
  const n = baseNode('shape', {
    name: props.name || (kind === 'path' ? 'Path' : kind[0].toUpperCase() + kind.slice(1)),
    geom,
    fill: open ? null : solid(oklch(0.62, 0.13, 40)),
    stroke: open ? makeStroke(oklch(0.25, 0.03, 270), 4) : null,
  });
  const { geom: _g, path: _p, ...rest } = props;
  return Object.assign(n, rest);
}

export function makeStroke(color, width = 2, extra = {}) {
  return { paint: solid(color), width, join: 'round', cap: 'round', profile: 'uniform', taper: 0.8, jitter: 0, seed: 1, ...extra };
}

export const PAINT_TYPES = [
  ['solid', 'Solid'], ['linear', 'Linear'], ['radial', 'Radial'], ['noise', 'Noise'], ['pattern', 'Pattern'], ['swatch', 'Swatch'],
];

export function makePaint(type, base) {
  const c0 = base?.color || base?.stops?.[0]?.color || oklch(0.62, 0.13, 40);
  const c1 = { ...c0, l: Math.min(0.97, c0.l + 0.3), c: c0.c * 0.5 };
  const stops = base?.stops || [{ t: 0, color: { ...c0 } }, { t: 1, color: c1 }];
  switch (type) {
    case 'solid': return { type, color: { ...c0 } };
    case 'linear': return { type, angle: 90, stops };
    case 'radial': return { type, cx: 0.5, cy: 0.5, r: 0.6, stops };
    case 'noise': return { type, kind: 'fbm', scale: 60, octaves: 4, stretch: 1, angle: 0, contrast: 1.4, seed: (Math.random() * 1e5) | 0, stops };
    case 'pattern': return { type, pattern: 'lines', size: 12, weight: 0.35, angle: 45, fg: { ...c0 }, bg: { ...c1, a: 0 } };
    case 'swatch': return { type, asset: base?.asset || null, scale: 1, angle: 0 };
  }
  return null;
}

export const PATTERNS = [['lines', 'Lines'], ['grid', 'Grid'], ['dots', 'Dots'], ['checker', 'Checker'], ['cross', 'Cross-hatch'], ['waves', 'Waves'], ['bricks', 'Bricks']];
export const BLENDS = ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'soft-light', 'hard-light', 'difference', 'hue', 'saturation', 'color', 'luminosity'];

// ---------- tree helpers ----------

export const isContainer = (n) => n && (n.type === 'group' || n.type === 'layer' || n.type === 'bool');

export function ancestors(doc, id) {
  const out = [];
  let n = doc.nodes[id];
  while (n && n.parent) {
    out.push(n.parent);
    n = doc.nodes[n.parent];
  }
  return out;
}

export function isDescendant(doc, id, ofId) {
  return ancestors(doc, id).includes(ofId);
}

export function walk(doc, id, fn, depth = 0) {
  const n = doc.nodes[id];
  if (!n) return;
  if (fn(n, depth) === false) return;
  if (n.children) for (const c of n.children) walk(doc, c, fn, depth + 1);
}

export function localMatrix(n) {
  return fromTransform(n.transform);
}

// Matrix from a node's local space to document (artboard) space.
export function worldMatrix(doc, id) {
  const chain = [id, ...ancestors(doc, id)].reverse();
  let m = identity();
  for (const cid of chain) if (cid !== doc.root) m = mul(m, localMatrix(doc.nodes[cid]));
  return m;
}

export function parentMatrix(doc, id) {
  const n = doc.nodes[id];
  return n.parent ? worldMatrix(doc, n.parent) : identity();
}

// Deep copy of a subtree with fresh ids. Returns { rootId, nodes } (nodes keyed by new id).
export function cloneSubtree(doc, id, newParent = null) {
  const nodes = {};
  const copy = (oid, parent) => {
    const src = doc.nodes[oid];
    const n = JSON.parse(JSON.stringify(src));
    n.id = uid();
    n.parent = parent;
    nodes[n.id] = n;
    if (src.children) n.children = src.children.map((c) => copy(c, n.id));
    return n.id;
  };
  const rootId = copy(id, newParent);
  return { rootId, nodes };
}

// Gather a subtree's nodes by their existing ids (for recipes and clipboard).
export function subtreeNodes(doc, id) {
  const nodes = {};
  walk(doc, id, (n) => {
    nodes[n.id] = JSON.parse(JSON.stringify(n));
  });
  return nodes;
}

// Re-id a stored { rootId, nodes } so it can be inserted again.
export function reidSubtree(sub, newParent) {
  const map = {};
  for (const id in sub.nodes) map[id] = uid();
  const nodes = {};
  for (const id in sub.nodes) {
    const n = JSON.parse(JSON.stringify(sub.nodes[id]));
    n.id = map[id];
    n.parent = id === sub.rootId ? newParent : map[n.parent];
    if (n.children) n.children = n.children.map((c) => map[c]);
    nodes[n.id] = n;
  }
  return { rootId: map[sub.rootId], nodes };
}

export function validateDoc(doc) {
  if (!doc || doc.format !== FORMAT) throw new Error('Not a Shape Lab document');
  if (doc.version > VERSION) throw new Error('Document is from a newer version');
  if (!doc.nodes[doc.root]) throw new Error('Document has no root');
  doc.assets ||= {};
  doc.palette ||= DEFAULT_PALETTE.map((c) => ({ ...c }));
  for (const id in doc.nodes) {
    const n = doc.nodes[id];
    n.effects ||= [];
    n.transform ||= defaultTransform();
    if (n.mask === undefined) n.mask = null;
  }
  return doc;
}
