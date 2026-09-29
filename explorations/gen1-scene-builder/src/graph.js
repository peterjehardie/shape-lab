// Distortion node graph: a small data-flow graph evaluated at every outline point.
// It answers one question per point: how far should this point move (dx, dy)?
import { noiseFor } from './rng.js';
import { TAU, deg, clamp, newId } from './util.js';

const cint = (v, a, b) => Math.max(a, Math.min(b, Math.round(v)));
// Warp helpers work in frame-height units (x runs 0..aspect); output is hundredths of the height.
const warpOut = (i, c, f) => {
  const X = i[0] * c.aspect, Y = i[1];
  const q = f(X, Y);
  return [(q[0] - X) * 100, (q[1] - Y) * 100];
};
const hashF = (a, b, s) => {
  let h = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(s | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// inputs: [name, default]. A default of 'x' or 'y' means "the point's own position".
export const NODE_TYPES = {
  position: { label: 'Position', cat: 'Input', inputs: [], outputs: ['x', 'y'], params: {}, fn: (i, p, c) => [c.x, c.y] },
  time: { label: 'Time', cat: 'Input', inputs: [], outputs: ['seconds'], params: { speed: 1 }, fn: (i, p, c) => [(c.time || 0) * p.speed], help: 'Counts up while Motion is playing' },
  depth: { label: 'Layer depth', cat: 'Input', inputs: [], outputs: ['depth'], params: {}, fn: (i, p, c) => [c.depth], help: '0 = far, 1 = near' },
  constant: { label: 'Number', cat: 'Input', inputs: [], outputs: ['value'], params: { value: 1 }, fn: (i, p) => [p.value] },
  noise: {
    label: 'Noise', cat: 'Pattern', inputs: [['x', 'x'], ['y', 'y']], outputs: ['value'],
    params: { scale: 3, octaves: 3, seed: 1, amp: 1 },
    fn: (i, p, c) => [noiseFor(1000 + cint(p.seed, 0, 9999)).fbm(i[0] * p.scale * c.aspect, i[1] * p.scale, cint(p.octaves, 1, 6)) * p.amp],
  },
  ridged: {
    label: 'Ridged noise', cat: 'Pattern', inputs: [['x', 'x'], ['y', 'y']], outputs: ['value'],
    params: { scale: 3, octaves: 3, seed: 3, amp: 1 },
    fn: (i, p, c) => [(noiseFor(2000 + cint(p.seed, 0, 9999)).ridged(i[0] * p.scale * c.aspect, i[1] * p.scale, cint(p.octaves, 1, 6)) * 2 - 1) * p.amp],
  },
  wave: {
    label: 'Wave', cat: 'Pattern', inputs: [['t', 'x']], outputs: ['value'],
    params: { freq: 3, phase: 0, amp: 1 },
    fn: (i, p) => [Math.sin((i[0] * p.freq + p.phase) * TAU) * p.amp],
  },
  swirl: {
    label: 'Swirl', cat: 'Warp', inputs: [['x', 'x'], ['y', 'y']], outputs: ['dx', 'dy'],
    params: { cx: 0.5, cy: 0.4, radius: 0.4, angle: 40 },
    fn: (i, p, c) => {
      const dx = (i[0] - p.cx) * c.aspect, dy = i[1] - p.cy;
      const r = Math.max(0.01, p.radius);
      const f = Math.max(0, 1 - Math.hypot(dx, dy) / r);
      const a = deg(p.angle) * f * f;
      const cs = Math.cos(a), sn = Math.sin(a);
      return [(dx * cs - dy * sn - dx) / r, (dx * sn + dy * cs - dy) / r];
    },
  },
  ripple: {
    label: 'Ripple', cat: 'Warp', inputs: [['x', 'x'], ['y', 'y']], outputs: ['dx', 'dy'],
    params: { cx: 0.5, cy: 0.6, freq: 6, radius: 0.8, amp: 1 },
    fn: (i, p, c) => {
      const dx = (i[0] - p.cx) * c.aspect, dy = i[1] - p.cy;
      const d = Math.hypot(dx, dy) || 1e-6;
      const w = Math.sin(d * p.freq * TAU) * p.amp * Math.max(0, 1 - d / Math.max(0.01, p.radius));
      return [(dx / d) * w, (dy / d) * w];
    },
  },

  // Warps from Chroma Mat. They output movement in hundredths of the frame height:
  // with Graph out scale 9 the movement is true to size.
  persp: {
    label: 'Perspective (1 point)', cat: 'Warp', inputs: [['x', 'x'], ['y', 'y']], outputs: ['dx', 'dy'],
    params: { vx: 0.5, vy: -0.7, amount: 0.5, fixed: 0 },
    fn: (i, p, c) => warpOut(i, c, (X, Y) => {
      const A = c.aspect, C = [A / 2, 0.5], V = [p.vx * A, p.vy];
      let dx = V[0] - C[0], dy = V[1] - C[1], l = Math.hypot(dx, dy);
      if (l < 1e-3) { dx = 0; dy = -1; l = 1; }
      const n = [dx / l, dy / l];
      let mn = 1e9, mx = -1e9;
      for (const [x, y] of [[0, 0], [A, 0], [A, 1], [0, 1]]) { const q = (x - C[0]) * n[0] + (y - C[1]) * n[1]; mn = Math.min(mn, q); mx = Math.max(mx, q); }
      const q = mn + (mx - mn) * p.fixed, P0 = [C[0] + n[0] * q, C[1] + n[1] * q];
      const mu = 1 - 0.9 * clamp(p.amount, -1, 1), E = (V[0] - P0[0]) * n[0] + (V[1] - P0[1]) * n[1];
      if (Math.abs(E) < 1e-6) return [X, Y];
      const k = (mu - 1) / E, e = (X - P0[0]) * n[0] + (Y - P0[1]) * n[1];
      const den = Math.max(0.15, 1 + k * e);
      return [(X + k * e * V[0]) / den, (Y + k * e * V[1]) / den];
    }),
    help: 'Pulls everything toward a vanishing point (vx, vy in frame fractions); one line stays fixed',
  },
  fisheye: {
    label: 'Fisheye (curvilinear)', cat: 'Warp', inputs: [['x', 'x'], ['y', 'y']], outputs: ['dx', 'dy'],
    params: { cx: 0.5, cy: 0.5, radius: 0.6, amount: 0.5 },
    fn: (i, p, c) => warpOut(i, c, (X, Y) => {
      const cx = p.cx * c.aspect, cy = p.cy, R = Math.max(0.01, p.radius * Math.max(c.aspect, 1)), k = p.amount * 3;
      const dx = X - cx, dy = Y - cy, r = Math.hypot(dx, dy);
      if (r < 1e-6 || Math.abs(k) < 0.01) return [X, Y];
      const r2 = k > 0 ? (R / k) * Math.atan((k * r) / R) : (R / -k) * Math.tan(Math.min((-k * r) / R, 1.4));
      return [cx + (dx / r) * r2, cy + (dy / r) * r2];
    }),
  },
  bulge: {
    label: 'Bulge / pinch', cat: 'Warp', inputs: [['x', 'x'], ['y', 'y']], outputs: ['dx', 'dy'],
    params: { cx: 0.5, cy: 0.5, radius: 0.35, amount: 0.5 },
    fn: (i, p, c) => warpOut(i, c, (X, Y) => {
      const cx = p.cx * c.aspect, cy = p.cy, R = Math.max(0.01, p.radius), dx = X - cx, dy = Y - cy, r = Math.hypot(dx, dy);
      if (r >= R) return [X, Y];
      const k = 1 + p.amount * (1 - (r / R) ** 2) ** 2;
      return [cx + dx * k, cy + dy * k];
    }),
  },
  shear: {
    label: 'Shear', cat: 'Warp', inputs: [['x', 'x'], ['y', 'y']], outputs: ['dx', 'dy'],
    params: { angle: 0, amount: 0.3 },
    fn: (i, p, c) => warpOut(i, c, (X, Y) => {
      const a = deg(p.angle), ca = Math.cos(a), sa = Math.sin(a), tc = -(X - c.aspect / 2) * sa + (Y - 0.5) * ca, dv = tc * p.amount;
      return [X + ca * dv, Y + sa * dv];
    }),
  },
  zigzag: {
    label: 'Zigzag', cat: 'Warp', inputs: [['x', 'x'], ['y', 'y']], outputs: ['dx', 'dy'],
    params: { angle: 90, freq: 6, amount: 0.35, phase: 0 },
    fn: (i, p, c) => warpOut(i, c, (X, Y) => {
      const a = deg(p.angle), ca = Math.cos(a), sa = Math.sin(a), L = Math.max(c.aspect, 1), A = p.amount * 0.08 * Math.min(c.aspect, 1);
      const u = ((-X * sa + Y * ca) / L) * p.freq + p.phase, tri = 1 - 4 * Math.abs(u - Math.floor(u + 0.5));
      return [X + ca * A * tri, Y + sa * A * tri];
    }),
  },
  shatter: {
    label: 'Shatter (angled slices)', cat: 'Warp', inputs: [['x', 'x'], ['y', 'y']], outputs: ['dx', 'dy'],
    params: { angle: 30, freq: 7, amount: 0.35, seed: 3 },
    fn: (i, p, c) => warpOut(i, c, (X, Y) => {
      const a = deg(p.angle), ca = Math.cos(a), sa = Math.sin(a), L = Math.max(c.aspect, 1), A = p.amount * 0.08 * Math.min(c.aspect, 1);
      const k = Math.floor(((-X * sa + Y * ca) / L) * p.freq), r = Math.sin(k * 12.9898 + (p.seed || 1) * 78.233) * 43758.5453, off = (r - Math.floor(r)) * 2 - 1;
      return [X + ca * A * off * 1.5, Y + sa * A * off * 1.5];
    }),
  },
  shimmer: {
    label: 'Heat shimmer', cat: 'Warp', inputs: [['x', 'x'], ['y', 'y']], outputs: ['dx', 'dy'],
    params: { horizon: 0.6, band: 0.15, freq: 14, amount: 0.35, seed: 5 },
    fn: (i, p, c) => warpOut(i, c, (X, Y) => {
      const ph = (c.time || 0) * 1.5 + p.seed, L = Math.max(c.aspect, 1), A = p.amount * 0.08 * Math.min(c.aspect, 1);
      const w = Math.exp(-(((Y - p.horizon) / Math.max(0.02, p.band)) ** 2)), v = (Y / L) * p.freq;
      const dx = Math.sin(v * TAU + ph + Math.sin((X / L) * 3 + ph * 0.7) * 1.5) + 0.5 * Math.sin(v * 2.3 * TAU + ph * 1.3);
      return [X + A * 1.4 * w * dx, Y + A * 0.25 * w * Math.sin((X / L) * p.freq * 0.7 * TAU + ph)];
    }),
    help: 'Wobbles a band around the horizon; animates while Motion plays',
  },
  add: { label: 'Add', cat: 'Math', inputs: [['a', 0], ['b', 0]], outputs: ['value'], params: {}, fn: (i) => [i[0] + i[1]] },
  subtract: { label: 'Subtract', cat: 'Math', inputs: [['a', 0], ['b', 0]], outputs: ['value'], params: {}, fn: (i) => [i[0] - i[1]] },
  multiply: { label: 'Multiply', cat: 'Math', inputs: [['a', 1], ['b', 1]], outputs: ['value'], params: {}, fn: (i) => [i[0] * i[1]] },
  mix: { label: 'Mix', cat: 'Math', inputs: [['a', 0], ['b', 1], ['t', 0.5]], outputs: ['value'], params: {}, fn: (i) => [i[0] + (i[1] - i[0]) * i[2]] },
  abs: { label: 'Absolute', cat: 'Math', inputs: [['value', 0]], outputs: ['value'], params: {}, fn: (i) => [Math.abs(i[0])] },
  remap: {
    label: 'Remap', cat: 'Math', inputs: [['value', 0]], outputs: ['value'],
    params: { inMin: -1, inMax: 1, outMin: 0, outMax: 1, clamp: 1 },
    fn: (i, p) => {
      let t = (i[0] - p.inMin) / (p.inMax - p.inMin || 1e-6);
      if (p.clamp) t = clamp(t);
      return [p.outMin + (p.outMax - p.outMin) * t];
    },
  },
  band: {
    label: 'Band mask', cat: 'Math', inputs: [['value', 'y']], outputs: ['mask'],
    params: { center: 0.5, width: 0.2, soft: 0.1 },
    fn: (i, p) => {
      const d = Math.abs(i[0] - p.center) - p.width / 2;
      return [clamp(1 - d / Math.max(1e-4, p.soft))];
    },
    help: '1 inside the band, fading to 0 outside',
  },
  quantize: {
    label: 'Steps', cat: 'Math', inputs: [['value', 0]], outputs: ['value'], params: { steps: 4 },
    fn: (i, p) => { const n = Math.max(1, p.steps); return [Math.round(i[0] * n) / n]; },
    help: 'Snaps to terraces',
  },
  clamp: { label: 'Clamp', cat: 'Math', inputs: [['value', 0]], outputs: ['value'], params: { min: 0, max: 1 }, fn: (i, p) => [clamp(i[0], p.min, p.max)] },
  smooth: {
    label: 'Smooth step', cat: 'Math', inputs: [['value', 0]], outputs: ['value'], params: { edge0: 0, edge1: 1 },
    fn: (i, p) => { const t = clamp((i[0] - p.edge0) / (p.edge1 - p.edge0 || 1e-6)); return [t * t * (3 - 2 * t)]; },
  },
  power: { label: 'Power', cat: 'Math', inputs: [['value', 0]], outputs: ['value'], params: { exp: 2 }, fn: (i, p) => [Math.sign(i[0]) * Math.pow(Math.abs(i[0]), p.exp)] },
  gradient: {
    label: 'Linear gradient', cat: 'Pattern', inputs: [['x', 'x'], ['y', 'y']], outputs: ['value'], params: { angle: 90 },
    fn: (i, p) => { const a = deg(p.angle); return [i[0] * Math.cos(a) + i[1] * Math.sin(a)]; },
    help: '90 = top to bottom',
  },
  cells: {
    label: 'Cells', cat: 'Pattern', inputs: [['x', 'x'], ['y', 'y']], outputs: ['edge', 'center'], params: { scale: 6, seed: 1, jitter: 1 },
    fn: (i, p, c) => {
      const X = i[0] * p.scale * c.aspect, Y = i[1] * p.scale;
      const cx = Math.floor(X), cy = Math.floor(Y);
      let d1 = 9, d2 = 9;
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
        const h1 = hashF(cx + a, cy + b, p.seed), h2 = hashF(cx + a, cy + b, p.seed + 17);
        const d = Math.hypot(cx + a + 0.5 + (h1 - 0.5) * p.jitter - X, cy + b + 0.5 + (h2 - 0.5) * p.jitter - Y);
        if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
      }
      return [d2 - d1, d1];
    },
    help: 'edge: 0 on cell borders; center: 0 at cell centres',
  },
  output: {
    label: 'Graph out', cat: 'Output', inputs: [['dx', 0], ['dy', 0], ['value', 0], ['size', 0], ['density', 0]], outputs: [],
    params: { scale: 10 },
    fn: (i, p) => [i[0] * p.scale, i[1] * p.scale, i[2], i[3], i[4]],
    help: 'dx/dy move points (scale = pixels per 1). value lightens/darkens shapes, size grows/shrinks them, density thins them out. Each layer sets how much it listens.',
  },
};

export function makeNode(type, x, y) {
  const T = NODE_TYPES[type];
  const ins = {};
  for (const [name, def] of T.inputs) if (typeof def === 'number') ins[name] = def;
  return { id: newId('n'), type, x, y, params: { ...T.params }, ins };
}

export function defaultGraph() {
  const pos = makeNode('position', 30, 70);
  const nx = makeNode('noise', 230, 20);
  const ny = makeNode('noise', 230, 200);
  ny.params.seed = 2;
  nx.params.scale = ny.params.scale = 2.2;
  const out = makeNode('output', 470, 110);
  out.params.scale = 8;
  return {
    nodes: [pos, nx, ny, out],
    links: [
      { from: pos.id, fromPort: 'x', to: nx.id, toPort: 'x' },
      { from: pos.id, fromPort: 'y', to: nx.id, toPort: 'y' },
      { from: pos.id, fromPort: 'x', to: ny.id, toPort: 'x' },
      { from: pos.id, fromPort: 'y', to: ny.id, toPort: 'y' },
      { from: nx.id, fromPort: 'value', to: out.id, toPort: 'dx' },
      { from: ny.id, fromPort: 'value', to: out.id, toPort: 'dy' },
    ],
  };
}

// Would linking from -> to create a loop?
export function createsCycle(graph, fromId, toId) {
  const stack = [toId];
  const seen = new Set();
  while (stack.length) {
    const id = stack.pop();
    if (id === fromId) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const l of graph.links) if (l.from === id) stack.push(l.to);
  }
  return false;
}

// Turn the graph into a function ctx -> [dx, dy]. Returns null when nothing moves.
export function compileGraph(graph) {
  const out = graph.nodes.find((n) => n.type === 'output');
  if (!out) return null;
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const inLinks = new Map();
  for (const l of graph.links) inLinks.set(`${l.to}:${l.toPort}`, l);
  const order = [];
  const done = new Set();
  const visit = (id, onPath) => {
    if (done.has(id) || onPath.has(id)) return;
    onPath.add(id);
    const n = byId.get(id);
    for (const [name] of NODE_TYPES[n.type].inputs) {
      const l = inLinks.get(`${id}:${name}`);
      if (l && byId.has(l.from)) visit(l.from, onPath);
    }
    onPath.delete(id);
    done.add(id);
    order.push(n);
  };
  visit(out.id, new Set());
  if (order.length === 1) return null;
  const linked = (name) => inLinks.has(`${out.id}:${name}`);
  const uses = { move: linked('dx') || linked('dy'), value: linked('value'), size: linked('size'), density: linked('density'), time: order.some((n) => n.type === 'time' || n.type === 'shimmer') };
  const idx = new Map(order.map((n, i) => [n.id, i]));
  const steps = order.map((n) => {
    const T = NODE_TYPES[n.type];
    const ins = T.inputs.map(([name, def]) => {
      const l = inLinks.get(`${n.id}:${name}`);
      if (l && idx.has(l.from)) {
        const src = byId.get(l.from);
        return { node: idx.get(l.from), port: Math.max(0, NODE_TYPES[src.type].outputs.indexOf(l.fromPort)) };
      }
      if (def === 'x' || def === 'y') return { ctx: def };
      return { val: n.ins?.[name] ?? def };
    });
    return { fn: T.fn, p: n.params, ins };
  });
  const vals = new Array(steps.length);
  const fn = (ctx) => {
    for (let s = 0; s < steps.length; s++) {
      const st = steps[s];
      const input = new Array(st.ins.length);
      for (let k = 0; k < st.ins.length; k++) {
        const q = st.ins[k];
        input[k] = q.node !== undefined ? vals[q.node][q.port] : q.ctx ? ctx[q.ctx] : q.val;
      }
      vals[s] = st.fn(input, st.p, ctx);
    }
    return vals[steps.length - 1];
  };
  fn.uses = uses;
  return fn;
}

// Ready-made graphs. Each builds nodes and wires; the output node is always last.
function build(spec) {
  const nodes = spec.nodes.map(([type, x, y, params = {}]) => { const n = makeNode(type, x, y); Object.assign(n.params, params); return n; });
  const links = spec.links.map(([a, ap, b, bp]) => ({ from: nodes[a].id, fromPort: ap, to: nodes[b].id, toPort: bp }));
  return { nodes, links };
}
export const GRAPH_PRESETS = {
  wobble: { label: 'Gentle wobble', make: defaultGraph },
  none: { label: 'Nothing (straight shapes)', make: () => build({ nodes: [['output', 400, 100]], links: [] }) },
  wind: {
    label: 'Wind: tops sway, feet stay',
    make: () => build({
      nodes: [['position', 20, 60], ['noise', 200, 20, { scale: 1.2, octaves: 2 }], ['remap', 200, 220, { inMin: 0, inMax: 1, outMin: 1, outMax: 0 }], ['multiply', 420, 100], ['output', 620, 80, { scale: 26 }]],
      links: [[0, 'x', 1, 'x'], [0, 'y', 1, 'y'], [0, 'y', 2, 'value'], [1, 'value', 3, 'a'], [2, 'value', 3, 'b'], [3, 'value', 4, 'dx']],
    }),
  },
  vortex: {
    label: 'Vortex in the sky',
    make: () => build({ nodes: [['swirl', 60, 40, { cx: 0.62, cy: 0.22, radius: 0.45, angle: 70 }], ['output', 330, 60, { scale: 40 }]], links: [[0, 'dx', 1, 'dx'], [0, 'dy', 1, 'dy']] }),
  },
  terraces: {
    label: 'Terraced, stepped edges',
    make: () => build({
      nodes: [['position', 20, 60], ['noise', 200, 20, { scale: 3 }], ['quantize', 420, 40, { steps: 3 }], ['output', 620, 60, { scale: 14 }]],
      links: [[0, 'x', 1, 'x'], [0, 'y', 1, 'y'], [1, 'value', 2, 'value'], [2, 'value', 3, 'dy']],
    }),
  },
  patchy: {
    label: 'Patchy light (value)',
    make: () => build({ nodes: [['noise', 60, 40, { scale: 2.5, octaves: 2 }], ['output', 330, 60, { scale: 0 }]], links: [[0, 'value', 1, 'value']] }),
  },
  clearings: {
    label: 'Forest clearings (density)',
    make: () => build({
      nodes: [['cells', 40, 30, { scale: 3 }], ['remap', 260, 30, { inMin: 0, inMax: 0.6, outMin: -1, outMax: 1 }], ['output', 480, 60, { scale: 0 }]],
      links: [[0, 'center', 1, 'value'], [1, 'value', 2, 'density']],
    }),
  },
  perspective: {
    label: 'Perspective: pull toward a vanishing point',
    make: () => build({ nodes: [['persp', 60, 40, { vx: 0.5, vy: -0.6, amount: 0.45, fixed: 0 }], ['output', 330, 60, { scale: 9 }]], links: [[0, 'dx', 1, 'dx'], [0, 'dy', 1, 'dy']] }),
  },
  fisheye: {
    label: 'Fisheye lens',
    make: () => build({ nodes: [['fisheye', 60, 40, { amount: 0.45 }], ['output', 330, 60, { scale: 9 }]], links: [[0, 'dx', 1, 'dx'], [0, 'dy', 1, 'dy']] }),
  },
  shimmer: {
    label: 'Heat shimmer at the horizon (animated)',
    make: () => build({ nodes: [['shimmer', 60, 40, { horizon: 0.62, band: 0.12, amount: 0.5 }], ['output', 330, 60, { scale: 9 }]], links: [[0, 'dx', 1, 'dx'], [0, 'dy', 1, 'dy']] }),
  },
  windAnim: {
    label: 'Wind gusts (animated)',
    make: () => build({
      nodes: [['position', 20, 60], ['time', 20, 220, { speed: 0.35 }], ['add', 200, 120], ['noise', 380, 40, { scale: 1.2, octaves: 2 }], ['remap', 380, 260, { inMin: 0, inMax: 1, outMin: 1, outMax: 0 }], ['multiply', 580, 120], ['output', 780, 100, { scale: 24 }]],
      links: [[0, 'x', 2, 'a'], [1, 'seconds', 2, 'b'], [2, 'value', 3, 'x'], [0, 'y', 3, 'y'], [0, 'y', 4, 'value'], [3, 'value', 5, 'a'], [4, 'value', 5, 'b'], [5, 'value', 6, 'dx']],
    }),
  },
  depthSize: {
    label: 'Bigger shapes up close (size)',
    make: () => build({
      nodes: [['depth', 40, 40], ['remap', 240, 30, { inMin: 0, inMax: 1, outMin: -0.6, outMax: 0.6 }], ['output', 460, 60, { scale: 0 }]],
      links: [[0, 'depth', 1, 'value'], [1, 'value', 2, 'size']],
    }),
  },
};
