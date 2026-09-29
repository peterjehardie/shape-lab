// Procedural shape graphs.
//
// graph = { nodes: { [id]: { id, type, x, y, params } }, links: [ { from, to, port } ], out: id }
// Each graph node has one output of a type, and named inputs.
// Data types flowing along links:
//   points  list of { x, y, attrs }            positions to put things at
//   shapes  list of { polys, x, y, attrs }     outlines, each with its own attributes
//   field   (x, y) -> 0..1                    a value everywhere on the page (noise, gradients)
//   list    either points or shapes (attribute nodes accept both)
// Attributes are per-item numbers (and colour) that later nodes read: index, t (0..1 along
// the list), rand (a stable random 0..1), u/v (position 0..1 across the set), plus any
// attribute a node writes. This is how one idea drives another (a noise field sets
// size, size sets colour, and so on).

import { Rng, hash01, noiseFor, sampleNoise } from './rng.js';
import { PRIMS, primPath, primDefaults } from './prims.js';
import { flattenPath, polysBounds, transformPolys, distToPolys, pointInPolys, polyLength, resample } from './path.js';
import { EFFECTS } from './effects.js';
import { combine } from './bool.js';
import { TAU, DEG, clamp, lerp, smoothstep } from './math.js';
import { sampleRamp, oklch } from './color.js';

const n = (key, label, min, max, step, def, extra = {}) => ({ key, label, type: 'number', min, max, step, default: def, ...extra });
const seed = () => n('seed', 'Seed', 0, 999999, 1, 1, { seed: true });
const sel = (key, label, options, def) => ({ key, label, type: 'select', options, default: def });
const attr = (key, label, def) => ({ key, label, type: 'attr', default: def });
const bool = (key, label, def) => ({ key, label, type: 'bool', default: def });
const col = (key, label, def) => ({ key, label, type: 'color', default: def });

const itemCenter = (it) => [it.x, it.y];

function stdAttrs(items, seedv = 1) {
  const N = items.length;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const it of items) (x0 = Math.min(x0, it.x)), (x1 = Math.max(x1, it.x)), (y0 = Math.min(y0, it.y)), (y1 = Math.max(y1, it.y));
  items.forEach((it, i) => {
    it.attrs ||= {};
    it.attrs.index = i;
    it.attrs.t = N > 1 ? i / (N - 1) : 0;
    it.attrs.rand = hash01(i, seedv, 77);
    it.attrs.u = x1 > x0 ? (it.x - x0) / (x1 - x0) : 0.5;
    it.attrs.v = y1 > y0 ? (it.y - y0) / (y1 - y0) : 0.5;
  });
  return items;
}

const readAttr = (it, name, fallback = 0.5) => {
  if (!name || name === 'none') return fallback;
  const v = it.attrs?.[name];
  return typeof v === 'number' ? v : fallback;
};

function shapeItem(polys, attrs = {}) {
  const b = polysBounds(polys);
  return { polys, x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, attrs };
}

function transformItem(it, m, cx, cy) {
  // m applied around (cx, cy)
  const T = [m[0], m[1], m[2], m[3], cx - m[0] * cx - m[2] * cy + (m[4] || 0), cy - m[1] * cx - m[3] * cy + (m[5] || 0)];
  const polys = transformPolys(it.polys, T);
  return { polys, x: T[0] * it.x + T[2] * it.y + T[4], y: T[1] * it.x + T[3] * it.y + T[5], attrs: { ...it.attrs } };
}

const rotScale = (rot, sx, sy = sx) => {
  const c = Math.cos(rot * DEG), s = Math.sin(rot * DEG);
  return [c * sx, s * sx, -s * sy, c * sy, 0, 0];
};

function noiseFieldFn(p) {
  const nz = noiseFor(p.seed || 1);
  const sc = Math.max(1, p.scale || 200), st = Math.max(0.05, p.stretch || 1);
  const a = (p.angle || 0) * DEG, ca = Math.cos(a), sa = Math.sin(a);
  const oct = Math.round(p.octaves || 3), con = p.contrast ?? 1;
  return (x, y) => {
    const u = (x * ca + y * sa) / (sc * st), v = (-x * sa + y * ca) / sc;
    return clamp((sampleNoise(nz, p.kind || 'fbm', u, v, oct) - 0.5) * con + 0.5);
  };
}

const NOISE_KINDS = [['fbm', 'Cloudy'], ['ridged', 'Ridged'], ['billow', 'Billow'], ['cells', 'Cells'], ['simple', 'Smooth']];
const GEOM_FX = Object.entries(EFFECTS).filter(([, d]) => d.stage === 'geom').map(([k, d]) => [k, d.label]);

// ---------------------------------------------------------------------------

export const GNODES = {
  // ---- points ----
  grid: {
    label: 'Grid', cat: 'Points', out: 'points', inputs: [],
    params: [n('cols', 'Columns', 1, 200, 1, 8), n('rows', 'Rows', 1, 200, 1, 6), n('w', 'Width', 0, 5000, 1, 800), n('h', 'Height', 0, 5000, 1, 600), n('stagger', 'Stagger', 0, 1, 0.01, 0)],
    eval(_, p) {
      const out = [];
      const C = Math.round(p.cols), R = Math.round(p.rows);
      for (let j = 0; j < R; j++)
        for (let i = 0; i < C; i++) {
          const off = j % 2 ? p.stagger * 0.5 : 0;
          const x = C > 1 ? -p.w / 2 + ((i + off) / (C - 1)) * p.w : 0;
          const y = R > 1 ? -p.h / 2 + (j / (R - 1)) * p.h : 0;
          out.push({ x, y, attrs: { col: C > 1 ? i / (C - 1) : 0, row: R > 1 ? j / (R - 1) : 0 } });
        }
      return stdAttrs(out);
    },
  },
  scatter: {
    label: 'Scatter', cat: 'Points', out: 'points', inputs: [],
    params: [n('count', 'Count', 1, 5000, 1, 60), n('w', 'Width', 0, 5000, 1, 900), n('h', 'Height', 0, 5000, 1, 600), sel('area', 'Area', [['rect', 'Box'], ['ellipse', 'Oval']], 'rect'), n('spacing', 'Min gap', 0, 500, 0.5, 0), seed()],
    eval(_, p) {
      const rng = new Rng(p.seed * 31 + 5);
      const out = [];
      const N = Math.round(p.count);
      let tries = 0;
      while (out.length < N && tries < N * 30) {
        tries++;
        let x = rng.signed() * p.w * 0.5, y = rng.signed() * p.h * 0.5;
        if (p.area === 'ellipse' && (x / (p.w / 2 || 1)) ** 2 + (y / (p.h / 2 || 1)) ** 2 > 1) continue;
        if (p.spacing > 0 && out.some((q) => (q.x - x) ** 2 + (q.y - y) ** 2 < p.spacing * p.spacing)) continue;
        out.push({ x, y, attrs: {} });
      }
      return stdAttrs(out, p.seed);
    },
  },
  ring: {
    label: 'Ring', cat: 'Points', out: 'points', inputs: [],
    params: [n('count', 'Count', 1, 2000, 1, 12), n('radius', 'Radius', 0, 3000, 1, 220), n('ry', 'Squash', 0, 2, 0.01, 1), n('arc', 'Arc', 1, 360, 1, 360, { unit: '°' }), n('start', 'Start', -360, 360, 1, -90, { unit: '°' })],
    eval(_, p) {
      const out = [], N = Math.round(p.count), full = p.arc >= 360;
      for (let i = 0; i < N; i++) {
        const a = (p.start + (full ? (i / N) * 360 : N > 1 ? (i / (N - 1)) * p.arc : 0)) * DEG;
        out.push({ x: Math.cos(a) * p.radius, y: Math.sin(a) * p.radius * p.ry, attrs: { angle: ((a / DEG) % 360 + 360) % 360 / 360, dir: a / DEG + 90 } });
      }
      return stdAttrs(out);
    },
  },
  line: {
    label: 'Line', cat: 'Points', out: 'points', inputs: [],
    params: [n('count', 'Count', 1, 2000, 1, 10), n('length', 'Length', 0, 5000, 1, 800), n('angle', 'Angle', -360, 360, 1, 0, { unit: '°' })],
    eval(_, p) {
      const out = [], N = Math.round(p.count), a = p.angle * DEG;
      for (let i = 0; i < N; i++) {
        const t = N > 1 ? i / (N - 1) - 0.5 : 0;
        out.push({ x: Math.cos(a) * t * p.length, y: Math.sin(a) * t * p.length, attrs: { dir: p.angle } });
      }
      return stdAttrs(out);
    },
  },
  sunflower: {
    label: 'Sunflower', cat: 'Points', out: 'points', inputs: [],
    params: [n('count', 'Count', 1, 5000, 1, 200), n('radius', 'Radius', 1, 3000, 1, 300), n('angle', 'Angle', 100, 180, 0.01, 137.51, { unit: '°' })],
    eval(_, p) {
      const out = [], N = Math.round(p.count);
      for (let i = 0; i < N; i++) {
        const r = p.radius * Math.sqrt((i + 0.5) / N), a = i * p.angle * DEG;
        out.push({ x: Math.cos(a) * r, y: Math.sin(a) * r, attrs: { dist: Math.sqrt((i + 0.5) / N), dir: a / DEG } });
      }
      return stdAttrs(out);
    },
  },
  alongOutline: {
    label: 'Along outline', cat: 'Points', out: 'points', inputs: [{ key: 'shapes', type: 'shapes', label: 'Shapes' }],
    params: [n('spacing', 'Spacing', 1, 1000, 0.5, 30), n('offset', 'Offset', -500, 500, 0.5, 0)],
    eval({ shapes }, p) {
      const out = [];
      for (const it of shapes || [])
        for (const poly of it.polys) {
          const r = resample(poly, p.spacing / 4);
          const P = r.pts, m = P.length / 2;
          let acc = 0, next = 0;
          for (let i = 0; i < m - (r.closed ? 0 : 1); i++) {
            const j = (i + 1) % m;
            const dx = P[j * 2] - P[i * 2], dy = P[j * 2 + 1] - P[i * 2 + 1];
            const L = Math.hypot(dx, dy);
            while (next <= acc + L) {
              const t = (next - acc) / (L || 1);
              const nx = dy / (L || 1), ny = -dx / (L || 1);
              out.push({ x: P[i * 2] + dx * t + nx * p.offset, y: P[i * 2 + 1] + dy * t + ny * p.offset, attrs: { ...it.attrs, dir: (Math.atan2(dy, dx) / DEG) } });
              next += p.spacing;
            }
            acc += L;
          }
        }
      return stdAttrs(out);
    },
  },
  insideShape: {
    label: 'Fill shape', cat: 'Points', out: 'points', inputs: [{ key: 'shapes', type: 'shapes', label: 'Shapes' }],
    params: [n('count', 'Count', 1, 5000, 1, 80), n('spacing', 'Min gap', 0, 500, 0.5, 0), n('edge', 'Near edge', 0, 1, 0.01, 0), seed()],
    eval({ shapes }, p) {
      const polys = (shapes || []).flatMap((s) => s.polys);
      if (!polys.length) return [];
      const b = polysBounds(polys), rng = new Rng(p.seed * 17 + 3);
      const out = [];
      let tries = 0;
      while (out.length < p.count && tries < p.count * 60) {
        tries++;
        const x = lerp(b.x0, b.x1, rng.next()), y = lerp(b.y0, b.y1, rng.next());
        if (!pointInPolys(polys, x, y)) continue;
        const d = distToPolys(polys, x, y);
        if (p.edge > 0 && rng.next() < p.edge * smoothstep(0, (b.x1 - b.x0 + b.y1 - b.y0) / 12, d)) continue;
        if (p.spacing > 0 && out.some((q) => (q.x - x) ** 2 + (q.y - y) ** 2 < p.spacing * p.spacing)) continue;
        out.push({ x, y, attrs: { edge: d } });
      }
      return stdAttrs(out, p.seed);
    },
  },
  jitter: {
    label: 'Jitter', cat: 'Points', out: 'list', inputs: [{ key: 'list', type: 'list', label: 'In' }],
    params: [n('amount', 'Amount', 0, 1000, 0.5, 20), attr('by', 'Scale by', 'none'), seed()],
    eval({ list }, p) {
      return (list || []).map((it, i) => {
        const k = p.amount * (p.by && p.by !== 'none' ? readAttr(it, p.by) : 1);
        const dx = (hash01(i, p.seed, 1) - 0.5) * 2 * k, dy = (hash01(i, p.seed, 2) - 0.5) * 2 * k;
        if (it.polys) return transformItem(it, [1, 0, 0, 1, dx, dy], it.x, it.y);
        return { x: it.x + dx, y: it.y + dy, attrs: { ...it.attrs } };
      });
    },
  },

  // ---- shapes ----
  shape: {
    label: 'Shape', cat: 'Shapes', out: 'shapes', inputs: [],
    params: [sel('kind', 'Kind', Object.entries(PRIMS).map(([k, d]) => [k, d.label]), 'blob')],
    dynamicParams: (p) => PRIMS[p.kind || 'blob'].params,
    eval(_, p) {
      const g = { ...primDefaults(p.kind || 'blob'), ...p };
      const polys = flattenPath(primPath(g), 0.3);
      return stdAttrs([shapeItem(polys)]);
    },
  },
  instance: {
    label: 'Copy to points', cat: 'Shapes', out: 'shapes',
    inputs: [{ key: 'points', type: 'points', label: 'Points' }, { key: 'shapes', type: 'shapes', label: 'Shapes' }],
    params: [
      n('scale', 'Scale', 0, 20, 0.01, 0.3), attr('scaleBy', 'Scale by', 'rand'), n('scaleAmt', 'Scale amount', 0, 1, 0.01, 0.6),
      n('rot', 'Rotate', -360, 360, 1, 0, { unit: '°' }), attr('rotBy', 'Rotate by', 'rand'), n('rotAmt', 'Rotate amount', -720, 720, 1, 0, { unit: '°' }),
      bool('align', 'Follow direction', false), sel('pick', 'Pick shape', [['cycle', 'In turn'], ['random', 'Random']], 'cycle'),
    ],
    eval({ points, shapes }, p) {
      if (!points?.length || !shapes?.length) return [];
      return points.map((pt, i) => {
        const src = p.pick === 'random' ? shapes[Math.floor(hash01(i, 91) * shapes.length)] : shapes[i % shapes.length];
        const sa = readAttr(pt, p.scaleBy, 1);
        const s = p.scale * (1 - p.scaleAmt + p.scaleAmt * sa);
        const r = p.rot + readAttr(pt, p.rotBy, 0) * p.rotAmt + (p.align ? pt.attrs?.dir || 0 : 0);
        const m = rotScale(r, s);
        const T = [m[0], m[1], m[2], m[3], pt.x - (m[0] * src.x + m[2] * src.y), pt.y - (m[1] * src.x + m[3] * src.y)];
        return { polys: transformPolys(src.polys, T), x: pt.x, y: pt.y, attrs: { ...src.attrs, ...pt.attrs, size: s } };
      });
    },
  },
  transform: {
    label: 'Transform', cat: 'Shapes', out: 'shapes', inputs: [{ key: 'shapes', type: 'shapes', label: 'Shapes' }],
    params: [
      n('x', 'Move X', -5000, 5000, 1, 0), n('y', 'Move Y', -5000, 5000, 1, 0), n('rot', 'Rotate', -360, 360, 1, 0, { unit: '°' }),
      n('scale', 'Scale', 0, 20, 0.01, 1), n('sy', 'Squash', 0, 5, 0.01, 1),
      attr('by', 'Driven by', 'none'), sel('drive', 'Drives', [['scale', 'Scale'], ['rot', 'Rotate'], ['x', 'Move X'], ['y', 'Move Y']], 'scale'), n('amount', 'Amount', -1000, 1000, 0.01, 1),
    ],
    eval({ shapes }, p) {
      return (shapes || []).map((it) => {
        const a = p.by && p.by !== 'none' ? readAttr(it, p.by) : null;
        let s = p.scale, r = p.rot, x = p.x, y = p.y;
        if (a != null) {
          if (p.drive === 'scale') s *= 1 + (a - 0.5) * 2 * p.amount;
          else if (p.drive === 'rot') r += a * p.amount * 360;
          else if (p.drive === 'x') x += a * p.amount;
          else y += a * p.amount;
        }
        const m = rotScale(r, Math.max(0, s), Math.max(0, s * p.sy));
        m[4] = x;
        m[5] = y;
        return transformItem(it, m, it.x, it.y);
      });
    },
  },
  edgeFx: {
    label: 'Outline effect', cat: 'Shapes', out: 'shapes', inputs: [{ key: 'shapes', type: 'shapes', label: 'Shapes' }],
    params: [sel('fx', 'Effect', GEOM_FX, 'roughen'), attr('by', 'Strength by', 'none'), bool('vary', 'Vary seed per item', true)],
    dynamicParams: (p) => EFFECTS[p.fx || 'roughen'].params,
    eval({ shapes }, p) {
      const d = EFFECTS[p.fx || 'roughen'];
      return (shapes || []).map((it, i) => {
        const q = { ...p };
        if (p.by && p.by !== 'none' && 'amount' in q) q.amount *= readAttr(it, p.by);
        if (p.vary && 'seed' in q) q.seed = (q.seed || 1) + i * 7;
        // effects expect shapes around their own centre
        const polys = d.fn(transformPolys(it.polys, [1, 0, 0, 1, -it.x, -it.y]), q);
        return { polys: transformPolys(polys, [1, 0, 0, 1, it.x, it.y]), x: it.x, y: it.y, attrs: it.attrs };
      });
    },
  },
  repeat: {
    label: 'Repeat', cat: 'Shapes', out: 'shapes', inputs: [{ key: 'shapes', type: 'shapes', label: 'Shapes' }],
    params: [n('count', 'Copies', 1, 500, 1, 8), n('dx', 'Step X', -2000, 2000, 0.5, 30), n('dy', 'Step Y', -2000, 2000, 0.5, 0), n('rot', 'Step rotate', -180, 180, 0.5, 0, { unit: '°' }), n('scale', 'Step scale', 0.5, 1.5, 0.005, 1), n('cx', 'Pivot X', -3000, 3000, 1, 0), n('cy', 'Pivot Y', -3000, 3000, 1, 0)],
    eval({ shapes }, p) {
      const out = [];
      const N = Math.round(p.count);
      for (let k = 0; k < N; k++) {
        const s = p.scale ** k, r = p.rot * k;
        const m = rotScale(r, s);
        m[4] = p.dx * k;
        m[5] = p.dy * k;
        for (const it of shapes || []) {
          const o = transformItem(it, m, p.cx, p.cy);
          o.attrs.copy = N > 1 ? k / (N - 1) : 0;
          out.push(o);
        }
      }
      return stdAttrs(out);
    },
  },
  mirror: {
    label: 'Mirror', cat: 'Shapes', out: 'shapes', inputs: [{ key: 'shapes', type: 'shapes', label: 'Shapes' }],
    params: [sel('axis', 'Axis', [['x', 'Left-right'], ['y', 'Up-down'], ['xy', 'Both']], 'x'), bool('keep', 'Keep original', true)],
    eval({ shapes }, p) {
      const list = shapes || [];
      const out = p.keep ? [...list] : [];
      const flip = (sx, sy) => list.map((it) => ({ polys: transformPolys(it.polys, [sx, 0, 0, sy, 0, 0]).map((q) => ({ ...q, pts: sx * sy < 0 ? reversePts(q.pts) : q.pts })), x: it.x * sx, y: it.y * sy, attrs: { ...it.attrs } }));
      if (p.axis.includes('x')) out.push(...flip(-1, 1));
      if (p.axis.includes('y')) out.push(...flip(1, -1));
      if (p.axis === 'xy') out.push(...flip(-1, -1));
      return out;
    },
  },
  boolean: {
    label: 'Combine', cat: 'Shapes', out: 'shapes',
    inputs: [{ key: 'a', type: 'shapes', label: 'A' }, { key: 'b', type: 'shapes', label: 'B' }],
    params: [sel('op', 'Operation', [['union', 'Union'], ['subtract', 'A minus B'], ['intersect', 'Intersect'], ['exclude', 'Exclude'], ['each', 'Cut each A by B']], 'union')],
    eval({ a, b }, p) {
      a ||= [];
      b ||= [];
      if (p.op === 'each') {
        const cut = b.flatMap((s) => s.polys);
        return a.map((it) => ({ ...it, polys: combine('subtract', [it.polys, cut]) })).filter((it) => it.polys.length);
      }
      const polys = combine(p.op, [a.flatMap((s) => s.polys), ...(b.length ? [b.flatMap((s) => s.polys)] : [])]);
      return polys.length ? stdAttrs([shapeItem(polys)]) : [];
    },
  },
  merge: {
    label: 'Merge', cat: 'Shapes', out: 'list',
    inputs: [{ key: 'a', type: 'list', label: 'A' }, { key: 'b', type: 'list', label: 'B' }, { key: 'c', type: 'list', label: 'C' }],
    params: [],
    eval({ a, b, c }) {
      return stdAttrs([...(a || []), ...(b || []), ...(c || [])].map((it) => ({ ...it, attrs: { ...it.attrs } })));
    },
  },
  filter: {
    label: 'Keep some', cat: 'Shapes', out: 'list', inputs: [{ key: 'list', type: 'list', label: 'In' }],
    params: [attr('by', 'Attribute', 'rand'), n('min', 'From', -1000, 1000, 0.01, 0), n('max', 'To', -1000, 1000, 0.01, 0.6), bool('invert', 'Invert', false)],
    eval({ list }, p) {
      return (list || []).filter((it) => {
        const v = readAttr(it, p.by);
        const inside = v >= p.min && v <= p.max;
        return p.invert ? !inside : inside;
      });
    },
  },

  // ---- attributes ----
  attrRandom: {
    label: 'Random value', cat: 'Attributes', out: 'list', inputs: [{ key: 'list', type: 'list', label: 'In' }],
    params: [{ key: 'name', label: 'Name', type: 'text', default: 'r' }, n('min', 'Min', -1000, 1000, 0.01, 0), n('max', 'Max', -1000, 1000, 0.01, 1), n('bias', 'Bias', 0.1, 10, 0.05, 1), seed()],
    eval({ list }, p) {
      return (list || []).map((it, i) => ({ ...it, attrs: { ...it.attrs, [p.name || 'r']: lerp(p.min, p.max, hash01(i, p.seed, 13) ** p.bias) } }));
    },
  },
  attrField: {
    label: 'Read field', cat: 'Attributes', out: 'list',
    inputs: [{ key: 'list', type: 'list', label: 'In' }, { key: 'field', type: 'field', label: 'Field' }],
    params: [{ key: 'name', label: 'Name', type: 'text', default: 'f' }, n('min', 'Min', -1000, 1000, 0.01, 0), n('max', 'Max', -1000, 1000, 0.01, 1)],
    eval({ list, field }, p) {
      return (list || []).map((it) => ({ ...it, attrs: { ...it.attrs, [p.name || 'f']: lerp(p.min, p.max, field ? field(it.x, it.y) : 0.5) } }));
    },
  },
  attrMath: {
    label: 'Value math', cat: 'Attributes', out: 'list', inputs: [{ key: 'list', type: 'list', label: 'In' }],
    params: [
      { key: 'name', label: 'Write to', type: 'text', default: 'm' }, attr('a', 'A', 'rand'),
      sel('op', 'Operation', [['mul', 'A × B'], ['add', 'A + B'], ['pow', 'A ^ B'], ['step', 'A > B → 1'], ['invert', '1 − A'], ['wave', 'sin(A·B)'], ['snap', 'Snap A to steps B']], 'mul'),
      n('b', 'B', -1000, 1000, 0.01, 2), attr('bAttr', 'B from', 'none'),
    ],
    eval({ list }, p) {
      return (list || []).map((it) => {
        const a = readAttr(it, p.a, 0);
        const b = p.bAttr && p.bAttr !== 'none' ? readAttr(it, p.bAttr, 0) * p.b : p.b;
        let v;
        switch (p.op) {
          case 'add': v = a + b; break;
          case 'pow': v = Math.pow(Math.max(0, a), b); break;
          case 'step': v = a > b ? 1 : 0; break;
          case 'invert': v = 1 - a; break;
          case 'wave': v = Math.sin(a * b * TAU) * 0.5 + 0.5; break;
          case 'snap': v = b > 0 ? Math.round(a * b) / b : a; break;
          default: v = a * b;
        }
        return { ...it, attrs: { ...it.attrs, [p.name || 'm']: v } };
      });
    },
  },
  colorRamp: {
    label: 'Colour by value', cat: 'Attributes', out: 'list', inputs: [{ key: 'list', type: 'list', label: 'In' }],
    params: [attr('by', 'Value', 'rand'), col('c0', 'Low', oklch(0.35, 0.08, 260)), col('c1', 'Middle', oklch(0.62, 0.14, 40)), col('c2', 'High', oklch(0.9, 0.08, 85)), n('opacity', 'Opacity', 0, 1, 0.01, 1)],
    eval({ list }, p) {
      const stops = [{ t: 0, color: p.c0 }, { t: 0.5, color: p.c1 }, { t: 1, color: p.c2 }];
      return (list || []).map((it) => ({ ...it, attrs: { ...it.attrs, color: sampleRamp(stops, clamp(readAttr(it, p.by))), opacity: p.opacity } }));
    },
  },

  // ---- fields ----
  noiseField: {
    label: 'Noise field', cat: 'Fields', out: 'field', inputs: [],
    params: [sel('kind', 'Kind', NOISE_KINDS, 'fbm'), n('scale', 'Size', 1, 5000, 1, 250), n('octaves', 'Detail', 1, 6, 1, 3), n('stretch', 'Stretch', 0.05, 20, 0.05, 1), n('angle', 'Angle', -360, 360, 1, 0, { unit: '°' }), n('contrast', 'Contrast', 0, 8, 0.05, 1.6), seed()],
    eval(_, p) {
      return noiseFieldFn(p);
    },
  },
  radialField: {
    label: 'Radial field', cat: 'Fields', out: 'field', inputs: [],
    params: [n('cx', 'Centre X', -5000, 5000, 1, 0), n('cy', 'Centre Y', -5000, 5000, 1, 0), n('radius', 'Radius', 1, 5000, 1, 400), n('falloff', 'Falloff', 0.1, 8, 0.05, 1), bool('invert', 'Invert', false)],
    eval(_, p) {
      return (x, y) => {
        const v = clamp(1 - Math.hypot(x - p.cx, y - p.cy) / p.radius) ** p.falloff;
        return p.invert ? 1 - v : v;
      };
    },
  },
  linearField: {
    label: 'Linear field', cat: 'Fields', out: 'field', inputs: [],
    params: [n('angle', 'Angle', -360, 360, 1, 0, { unit: '°' }), n('width', 'Width', 1, 10000, 1, 900), n('offset', 'Offset', -5000, 5000, 1, 0), bool('mirror', 'Mirror', false)],
    eval(_, p) {
      const a = p.angle * DEG, ca = Math.cos(a), sa = Math.sin(a);
      return (x, y) => {
        const t = (x * ca + y * sa - p.offset) / p.width + 0.5;
        return p.mirror ? 1 - Math.abs(clamp(t) * 2 - 1) : clamp(t);
      };
    },
  },
  shapeField: {
    label: 'Near shapes', cat: 'Fields', out: 'field', inputs: [{ key: 'shapes', type: 'shapes', label: 'Shapes' }],
    params: [n('reach', 'Reach', 1, 3000, 1, 120), bool('inside', 'Inside = 1', true)],
    eval({ shapes }, p) {
      const polys = (shapes || []).flatMap((s) => s.polys);
      if (!polys.length) return () => 0;
      return (x, y) => {
        if (p.inside && pointInPolys(polys, x, y)) return 1;
        return clamp(1 - distToPolys(polys, x, y) / p.reach);
      };
    },
  },
  fieldMath: {
    label: 'Field math', cat: 'Fields', out: 'field',
    inputs: [{ key: 'a', type: 'field', label: 'A' }, { key: 'b', type: 'field', label: 'B' }],
    params: [sel('op', 'Operation', [['mul', 'Multiply'], ['add', 'Add'], ['sub', 'Subtract'], ['max', 'Lighter'], ['min', 'Darker'], ['mix', 'Mix']], 'mul'), n('t', 'Mix', 0, 1, 0.01, 0.5), n('gain', 'Gain', 0, 8, 0.05, 1)],
    eval({ a, b }, p) {
      const A = a || (() => 0.5), B = b || (() => 0.5);
      return (x, y) => {
        const u = A(x, y), v = B(x, y);
        let r;
        switch (p.op) {
          case 'add': r = u + v; break;
          case 'sub': r = u - v; break;
          case 'max': r = Math.max(u, v); break;
          case 'min': r = Math.min(u, v); break;
          case 'mix': r = lerp(u, v, p.t); break;
          default: r = u * v;
        }
        return clamp(r * p.gain);
      };
    },
  },

  // ---- output ----
  output: {
    label: 'Output', cat: 'Output', out: null, inputs: [{ key: 'shapes', type: 'shapes', label: 'Shapes' }],
    params: [],
    eval({ shapes }) {
      return shapes || [];
    },
  },
};

function reversePts(pts) {
  const out = new Array(pts.length);
  const n = pts.length / 2;
  for (let i = 0; i < n; i++) {
    out[i * 2] = pts[(n - 1 - i) * 2];
    out[i * 2 + 1] = pts[(n - 1 - i) * 2 + 1];
  }
  return out;
}

export const GNODE_CATS = ['Points', 'Shapes', 'Attributes', 'Fields', 'Output'];

export function paramsOf(gn) {
  const d = GNODES[gn.type];
  return d.dynamicParams ? [...d.params, ...d.dynamicParams(gn.params)] : d.params;
}

export function makeGNode(type, x = 0, y = 0, params = {}) {
  const d = GNODES[type];
  const p = {};
  for (const q of d.params) p[q.key] = typeof q.default === 'object' ? { ...q.default } : q.default;
  if (d.dynamicParams) for (const q of d.dynamicParams({ ...p, ...params })) if (!(q.key in p)) p[q.key] = typeof q.default === 'object' ? { ...q.default } : q.default;
  if ('seed' in p) p.seed = (Math.random() * 1e5) | 0;
  return { id: 'g' + Math.random().toString(36).slice(2, 8), type, x, y, params: { ...p, ...params } };
}

// Type compatibility for links.
export function canConnect(outType, inType) {
  if (!outType) return false;
  if (inType === 'list') return outType === 'points' || outType === 'shapes' || outType === 'list';
  if (outType === 'list') return inType === 'points' || inType === 'shapes';
  return outType === inType;
}

// Evaluate the graph; returns { items, error }. Items are the output node's shapes.
export function evalGraph(graph) {
  const memo = new Map();
  const visiting = new Set();
  const errors = [];
  const evalNode = (id) => {
    if (memo.has(id)) return memo.get(id);
    if (visiting.has(id)) {
      errors.push('Loop in graph');
      return null;
    }
    visiting.add(id);
    const gn = graph.nodes[id];
    const d = gn && GNODES[gn.type];
    let v = null;
    if (d) {
      const ins = {};
      for (const inp of d.inputs) {
        const l = graph.links.find((q) => q.to === id && q.port === inp.key);
        ins[inp.key] = l && graph.nodes[l.from] ? evalNode(l.from) : null;
      }
      try {
        const p = {};
        for (const q of paramsOf(gn)) p[q.key] = gn.params[q.key] ?? q.default;
        v = d.eval(ins, p);
      } catch (e) {
        errors.push(`${d.label}: ${e.message}`);
      }
    }
    visiting.delete(id);
    memo.set(id, v);
    return v;
  };
  const out = graph.out && graph.nodes[graph.out] ? evalNode(graph.out) : null;
  return { items: Array.isArray(out) ? out.filter((it) => it.polys) : [], error: errors[0] || null, memo };
}

// Attribute names seen upstream of a node (for suggestions in the editor).
export function attrNames(graph, memo) {
  const names = new Set(['none', 'rand', 't', 'index', 'u', 'v']);
  if (memo) for (const v of memo.values()) if (Array.isArray(v)) for (const it of v.slice(0, 5)) for (const k in it.attrs || {}) if (typeof it.attrs[k] === 'number') names.add(k);
  return [...names];
}

// A starter graph: scattered blobs sized by a noise field and coloured by size.
export function starterGraph() {
  const sc = makeGNode('scatter', 40, 40, { count: 70, w: 1100, h: 700, spacing: 30 });
  const nf = makeGNode('noiseField', 40, 300, { scale: 380 });
  const af = makeGNode('attrField', 300, 120, { name: 'f' });
  const sh = makeGNode('shape', 300, 330, { kind: 'blob', w: 160, h: 130, wobble: 0.45 });
  const inst = makeGNode('instance', 560, 160, { scale: 0.6, scaleBy: 'f', scaleAmt: 0.9, rotBy: 'rand', rotAmt: 360 });
  const colr = makeGNode('colorRamp', 820, 160, { by: 'f' });
  const out = makeGNode('output', 1080, 180);
  return {
    nodes: Object.fromEntries([sc, nf, af, sh, inst, colr, out].map((g) => [g.id, g])),
    links: [
      { from: sc.id, to: af.id, port: 'list' },
      { from: nf.id, to: af.id, port: 'field' },
      { from: af.id, to: inst.id, port: 'points' },
      { from: sh.id, to: inst.id, port: 'shapes' },
      { from: inst.id, to: colr.id, port: 'list' },
      { from: colr.id, to: out.id, port: 'shapes' },
    ],
    out: out.id,
  };
}
