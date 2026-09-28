// Distortion node graph: a small data-flow graph evaluated at every outline point.
// It answers one question per point: how far should this point move (dx, dy)?
import { noiseFor } from './rng.js';
import { TAU, deg, clamp, newId } from './util.js';

const cint = (v, a, b) => Math.max(a, Math.min(b, Math.round(v)));

// inputs: [name, default]. A default of 'x' or 'y' means "the point's own position".
export const NODE_TYPES = {
  position: { label: 'Position', cat: 'Input', inputs: [], outputs: ['x', 'y'], params: {}, fn: (i, p, c) => [c.x, c.y] },
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
  output: {
    label: 'Displacement out', cat: 'Output', inputs: [['dx', 0], ['dy', 0]], outputs: [],
    params: { scale: 10 },
    fn: (i, p) => [i[0] * p.scale, i[1] * p.scale],
    help: 'scale = pixels of movement for a value of 1',
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
  return (ctx) => {
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
}
