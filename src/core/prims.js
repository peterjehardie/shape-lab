// Primitive shapes. Each kind turns a small set of numbers into a path centred on (0,0).
// A primitive stays live (its numbers stay editable) until it is converted to a path.
// The `params` lists describe each number, so the interface can build its controls from data.

import { anchor, smoothAnchors } from './path.js';
import { TAU, DEG } from './math.js';
import { Rng, noiseFor } from './rng.js';

const K = 0.5522847498; // handle length for a quarter circle

const num = (key, label, min, max, step, def, extra = {}) => ({ key, label, type: 'number', min, max, step, default: def, ...extra });

export const PRIMS = {
  rect: {
    label: 'Rectangle', icon: 'rect', closed: true,
    params: [num('w', 'W', 1, 5000, 1, 200), num('h', 'H', 1, 5000, 1, 140), num('r', 'Corner', 0, 1000, 1, 0)],
  },
  ellipse: {
    label: 'Ellipse', icon: 'ellipse', closed: true,
    params: [
      num('w', 'W', 1, 5000, 1, 180), num('h', 'H', 1, 5000, 1, 180),
      num('sweep', 'Sweep', 1, 360, 1, 360, { unit: '°' }), num('start', 'Start', -360, 360, 1, 0, { unit: '°' }),
      num('inner', 'Hole', 0, 0.98, 0.01, 0),
    ],
  },
  polygon: {
    label: 'Polygon', icon: 'polygon', closed: true,
    params: [num('w', 'W', 1, 5000, 1, 180), num('h', 'H', 1, 5000, 1, 180), num('sides', 'Sides', 3, 40, 1, 6), num('round', 'Round', 0, 1, 0.01, 0)],
  },
  star: {
    label: 'Star', icon: 'star', closed: true,
    params: [
      num('w', 'W', 1, 5000, 1, 180), num('h', 'H', 1, 5000, 1, 180), num('points', 'Points', 2, 60, 1, 5),
      num('inner', 'Inner', 0.02, 1, 0.01, 0.45), num('round', 'Round', 0, 1, 0.01, 0), num('twist', 'Twist', -1, 1, 0.01, 0),
    ],
  },
  squircle: {
    label: 'Squircle', icon: 'squircle', closed: true,
    params: [num('w', 'W', 1, 5000, 1, 180), num('h', 'H', 1, 5000, 1, 180), num('n', 'Squareness', 0.3, 12, 0.05, 4)],
  },
  blob: {
    label: 'Blob', icon: 'blob', closed: true,
    params: [
      num('w', 'W', 1, 5000, 1, 200), num('h', 'H', 1, 5000, 1, 170), num('lobes', 'Points', 3, 24, 1, 7),
      num('wobble', 'Wobble', 0, 1, 0.01, 0.35), num('seed', 'Seed', 0, 999999, 1, 1, { seed: true }),
    ],
  },
  crescent: {
    label: 'Crescent', icon: 'crescent', closed: true,
    params: [num('w', 'W', 1, 5000, 1, 120), num('h', 'H', 1, 5000, 1, 200), num('thick', 'Thickness', 0.02, 1, 0.01, 0.35)],
  },
  line: {
    label: 'Line', icon: 'line', closed: false,
    params: [num('w', 'Length', 1, 5000, 1, 240), num('bend', 'Bend', -2, 2, 0.01, 0)],
  },
  wave: {
    label: 'Wave', icon: 'wave', closed: false,
    params: [num('w', 'Length', 1, 5000, 1, 300), num('h', 'Height', 0, 2000, 1, 40), num('cycles', 'Cycles', 0.25, 40, 0.25, 3)],
  },
  spiral: {
    label: 'Spiral', icon: 'spiral', closed: false,
    params: [num('w', 'Size', 1, 5000, 1, 220), num('turns', 'Turns', 0.25, 30, 0.25, 3), num('grow', 'Grow', 0.2, 4, 0.05, 1)],
  },
};

export function primDefaults(kind) {
  const g = { kind };
  for (const p of PRIMS[kind].params) g[p.key] = p.default;
  return g;
}

export function primHasSize(kind) {
  return PRIMS[kind].params.some((p) => p.key === 'h');
}

function roundedPoly(pts, round) {
  // pts: [[x,y],...] corners; round 0..1 makes each corner a curve.
  const n = pts.length;
  if (round <= 0) return pts.map(([x, y]) => anchor(x, y));
  const out = [];
  for (let i = 0; i < n; i++) {
    const p = pts[i], a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
    const la = Math.hypot(a[0] - p[0], a[1] - p[1]), lb = Math.hypot(b[0] - p[0], b[1] - p[1]);
    const r = Math.min(la, lb) * 0.5 * round;
    const ua = [(a[0] - p[0]) / la, (a[1] - p[1]) / la], ub = [(b[0] - p[0]) / lb, (b[1] - p[1]) / lb];
    const s = [p[0] + ua[0] * r, p[1] + ua[1] * r], e = [p[0] + ub[0] * r, p[1] + ub[1] * r];
    const k = r * 0.55;
    out.push(anchor(s[0], s[1], null, [-ua[0] * k, -ua[1] * k]));
    out.push(anchor(e[0], e[1], [-ub[0] * k, -ub[1] * k], null));
  }
  return out;
}

function ellipsePts(w, h, sweep, start, inner) {
  const rx = w / 2, ry = h / 2;
  const full = sweep >= 359.99;
  const segs = Math.max(1, Math.ceil(sweep / 90));
  const step = (sweep * DEG) / segs;
  const kk = (4 / 3) * Math.tan(step / 4);
  const arc = (sx, sy, a0, dir) => {
    const pts = [];
    const n = full ? segs : segs + 1;
    for (let i = 0; i < n; i++) {
      const a = a0 + dir * i * step;
      const c = Math.cos(a), s = Math.sin(a);
      const x = c * sx, y = s * sy;
      const tx = -s * sx * kk * dir, ty = c * sy * kk * dir;
      pts.push(anchor(x, y, full || i > 0 ? [-tx, -ty] : null, full || i < n - 1 ? [tx, ty] : null, 'smooth'));
    }
    return pts;
  };
  const a0 = (start - 90) * DEG;
  if (full && inner <= 0) return [{ closed: true, pts: arc(rx, ry, a0, 1) }];
  if (full) return [{ closed: true, pts: arc(rx, ry, a0, 1) }, { closed: true, pts: arc(rx * inner, ry * inner, a0, -1) }];
  const outer = arc(rx, ry, a0, 1);
  const inn = inner > 0 ? arc(rx * inner, ry * inner, a0 + sweep * DEG, -1) : [anchor(0, 0)];
  return [{ closed: true, pts: [...outer, ...inn] }];
}

export function primPath(g) {
  const w = g.w ?? 100, h = g.h ?? w;
  switch (g.kind) {
    case 'rect': {
      const x = w / 2, y = h / 2;
      const r = Math.min(g.r || 0, x, y);
      if (r <= 0) return { subpaths: [{ closed: true, pts: [anchor(-x, -y), anchor(x, -y), anchor(x, y), anchor(-x, y)] }] };
      const k = r * K;
      return {
        subpaths: [{
          closed: true,
          pts: [
            anchor(-x + r, -y, [-k, 0], null), anchor(x - r, -y, null, [k, 0]),
            anchor(x, -y + r, [0, -k], null), anchor(x, y - r, null, [0, k]),
            anchor(x - r, y, [k, 0], null), anchor(-x + r, y, null, [-k, 0]),
            anchor(-x, y - r, [0, k], null), anchor(-x, -y + r, null, [0, -k]),
          ],
        }],
      };
    }
    case 'ellipse':
      return { subpaths: ellipsePts(w, h, g.sweep ?? 360, g.start ?? 0, g.inner ?? 0) };
    case 'polygon': {
      const n = Math.max(3, Math.round(g.sides || 6));
      const pts = [];
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (i * TAU) / n;
        pts.push([(Math.cos(a) * w) / 2, (Math.sin(a) * h) / 2]);
      }
      return { subpaths: [{ closed: true, pts: roundedPoly(pts, g.round || 0) }] };
    }
    case 'star': {
      const n = Math.max(2, Math.round(g.points || 5));
      const pts = [];
      for (let i = 0; i < n * 2; i++) {
        const inner = i % 2 === 1;
        const a = -Math.PI / 2 + (i * Math.PI) / n + (inner ? (g.twist || 0) * (Math.PI / n) : 0);
        const r = inner ? g.inner ?? 0.45 : 1;
        pts.push([(Math.cos(a) * w * r) / 2, (Math.sin(a) * h * r) / 2]);
      }
      return { subpaths: [{ closed: true, pts: roundedPoly(pts, g.round || 0) }] };
    }
    case 'squircle': {
      const n = g.n || 4, N = 48;
      const pts = [];
      for (let i = 0; i < N; i++) {
        const a = (i / N) * TAU;
        const c = Math.cos(a), s = Math.sin(a);
        pts.push([(Math.sign(c) * Math.abs(c) ** (2 / n) * w) / 2, (Math.sign(s) * Math.abs(s) ** (2 / n) * h) / 2]);
      }
      return { subpaths: [{ closed: true, pts: smoothAnchors(pts, true, 0.9) }] };
    }
    case 'blob': {
      const n = Math.max(3, Math.round(g.lobes || 7));
      const rng = new Rng((g.seed || 1) * 7919);
      const nz = noiseFor(g.seed || 1);
      const pts = [];
      const ph = rng.next() * 10;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + (rng.next() - 0.5) * (g.wobble || 0) * (TAU / n) * 0.6;
        const r = 1 + (g.wobble || 0) * 0.9 * (nz.n2(Math.cos(a) * 1.3 + ph, Math.sin(a) * 1.3) * 0.7 + (rng.next() - 0.5) * 0.5);
        pts.push([(Math.cos(a) * w * r) / 2, (Math.sin(a) * h * r) / 2]);
      }
      // Normalise back into the requested box.
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const [x, y] of pts) (x0 = Math.min(x0, x)), (x1 = Math.max(x1, x)), (y0 = Math.min(y0, y)), (y1 = Math.max(y1, y));
      const sx = w / (x1 - x0 || 1), sy = h / (y1 - y0 || 1), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      const norm = pts.map(([x, y]) => [(x - cx) * sx * 0.92, (y - cy) * sy * 0.92]);
      return { subpaths: [{ closed: true, pts: smoothAnchors(norm, true, 1.15) }] };
    }
    case 'crescent': {
      const N = 14, t = g.thick ?? 0.35;
      const outer = [], inner = [];
      for (let i = 0; i <= N; i++) {
        const a = -Math.PI / 2 + (i / N) * Math.PI;
        outer.push([(Math.cos(a) * w) / 2, (Math.sin(a) * h) / 2]);
      }
      for (let i = N - 1; i >= 1; i--) {
        const a = -Math.PI / 2 + (i / N) * Math.PI;
        inner.push([(Math.cos(a) * w * (1 - 2 * t)) / 2, (Math.sin(a) * h) / 2]);
      }
      const all = smoothAnchors([...outer, ...inner], true, 1);
      // sharp tips
      all[0].in = all[0].out = null;
      all[N].in = all[N].out = null;
      all[0].mode = all[N].mode = 'corner';
      return { subpaths: [{ closed: true, pts: all }] };
    }
    case 'line': {
      const x = w / 2, b = (g.bend || 0) * w * 0.5;
      if (!b) return { subpaths: [{ closed: false, pts: [anchor(-x, 0), anchor(x, 0)] }] };
      return { subpaths: [{ closed: false, pts: [anchor(-x, 0, null, [w / 3, -b]), anchor(x, 0, [-w / 3, -b], null)] }] };
    }
    case 'wave': {
      const cyc = g.cycles || 3, N = Math.max(4, Math.round(cyc * 8));
      const pts = [];
      for (let i = 0; i <= N; i++) {
        const u = i / N;
        pts.push([-w / 2 + u * w, (-Math.sin(u * cyc * TAU) * h) / 2]);
      }
      return { subpaths: [{ closed: false, pts: smoothAnchors(pts, false, 1) }] };
    }
    case 'spiral': {
      const turns = g.turns || 3, N = Math.max(8, Math.round(turns * 16)), grow = g.grow || 1;
      const pts = [];
      for (let i = 0; i <= N; i++) {
        const u = i / N;
        const a = u * turns * TAU;
        const r = (w / 2) * u ** grow;
        pts.push([Math.cos(a) * r, Math.sin(a) * r]);
      }
      return { subpaths: [{ closed: false, pts: smoothAnchors(pts, false, 1) }] };
    }
  }
  return { subpaths: [] };
}
