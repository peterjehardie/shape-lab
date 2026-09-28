// Polygon helpers and the shape vocabulary that fills structural "slots".
import { TAU } from './util.js';

export function signedArea(p) {
  let s = 0;
  for (let i = 0, n = p.length; i < n; i++) {
    const a = p[i], b = p[(i + 1) % n];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return s / 2;
}

export function bbox(p) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of p) {
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  return { x0, y0, x1, y1 };
}

export function centroid(p) {
  let A = 0, cx = 0, cy = 0;
  for (let i = 0, n = p.length; i < n; i++) {
    const a = p[i], b = p[(i + 1) % n];
    const f = a[0] * b[1] - b[0] * a[1];
    A += f;
    cx += (a[0] + b[0]) * f;
    cy += (a[1] + b[1]) * f;
  }
  if (Math.abs(A) < 1e-6) {
    let sx = 0, sy = 0;
    for (const q of p) { sx += q[0]; sy += q[1]; }
    return [sx / p.length, sy / p.length];
  }
  return [cx / (3 * A), cy / (3 * A)];
}

// Insert points so no edge is longer than maxLen. Returns new array.
export function densify(p, maxLen, closed = true) {
  const out = [];
  const n = p.length;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const a = p[i], b = p[(i + 1) % n];
    out.push([a[0], a[1]]);
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const k = Math.ceil(d / maxLen);
    for (let j = 1; j < k; j++) out.push([a[0] + ((b[0] - a[0]) * j) / k, a[1] + ((b[1] - a[1]) * j) / k]);
  }
  if (!closed) out.push([p[n - 1][0], p[n - 1][1]]);
  return out;
}

// Even spacing along the outline.
export function resample(p, n) {
  const segs = [];
  let total = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length];
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    segs.push(d);
    total += d;
  }
  const out = [];
  let si = 0, acc = 0;
  for (let k = 0; k < n; k++) {
    const target = (k / n) * total;
    while (si < segs.length - 1 && acc + segs[si] < target) acc += segs[si++];
    const a = p[si], b = p[(si + 1) % p.length];
    const t = segs[si] > 0 ? (target - acc) / segs[si] : 0;
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return out;
}

// Roundness from turning: walk the outline and see where it turns. A circle turns a
// little everywhere (score 1). A square does all its turning at four corners, so the
// turning is concentrated (score near 0.25). Triangles and spiky outlines score lower still.
export function measureRoundness(poly) {
  const N = 64;
  const q = resample(poly, N);
  const dir = [];
  for (let i = 0; i < N; i++) {
    const a = q[i], b = q[(i + 1) % N];
    dir.push(Math.atan2(b[1] - a[1], b[0] - a[0]));
  }
  let sum = 0, sum2 = 0, wiggle = 0;
  for (let i = 0; i < N; i++) {
    let t = dir[(i + 1) % N] - dir[i];
    while (t > Math.PI) t -= TAU;
    while (t < -Math.PI) t += TAU;
    wiggle += Math.abs(t);
    // turning across a two-edge window so a corner split between samples still counts whole
    let d = dir[(i + 2) % N] - dir[i];
    while (d > Math.PI) d -= TAU;
    while (d < -Math.PI) d += TAU;
    d = Math.abs(d);
    sum += d;
    sum2 += d * d;
  }
  if (sum < 1e-6) return 0.5;
  const c = (N * sum2) / (sum * sum);
  // An outline that turns back and forth (spikes, zig-zags) turns more than one full
  // circle in total; that also counts against roundness.
  const zig = Math.min(1, TAU / wiggle);
  return Math.exp(-(c - 1) / 5) * Math.pow(zig, 1.5);
}

function withCorners(verts, per) {
  const poly = [];
  const corners = [];
  for (let i = 0; i < verts.length; i++) {
    const a = verts[i], b = verts[(i + 1) % verts.length];
    corners.push(poly.length);
    for (let j = 0; j < per; j++) poly.push([a[0] + ((b[0] - a[0]) * j) / per, a[1] + ((b[1] - a[1]) * j) / per]);
  }
  return { poly, corners };
}
function ring(n, fn) {
  const poly = [];
  for (let i = 0; i < n; i++) poly.push(fn((i / n) * TAU, i));
  const corners = [];
  for (let i = 0; i < 8; i++) corners.push(Math.floor((i * n) / 8));
  return { poly, corners };
}

// Each maker builds a unit-ish shape around 0,0 with "radius" s.
const MAKERS = {
  circle: (s) => ring(32, (t) => [Math.cos(t) * s, Math.sin(t) * s]),
  ellipse: (s, rng, o) => {
    const asp = o.aspect ?? rng.range(1.3, 2.0);
    return ring(32, (t) => [Math.cos(t) * s, (Math.sin(t) * s) / asp]);
  },
  blob: (s, rng) => {
    const h = [2, 3, 4].map((k) => [k, rng.range(0, 0.13), rng.range(0, TAU)]);
    return ring(32, (t) => {
      let r = 1;
      for (const [k, a, ph] of h) r += a * Math.cos(k * t + ph);
      return [Math.cos(t) * s * r, Math.sin(t) * s * r];
    });
  },
  leaf: (s, rng) => {
    const n = 16;
    const w = s * rng.range(0.32, 0.5);
    const poly = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      poly.push([(t * 2 - 1) * s, -w * Math.pow(Math.sin(Math.PI * t), 0.85)]);
    }
    for (let i = n - 1; i > 0; i--) {
      const t = i / n;
      poly.push([(t * 2 - 1) * s, w * Math.pow(Math.sin(Math.PI * t), 0.85)]);
    }
    return { poly, corners: [0, n / 2, n, n + n / 2] };
  },
  roundsq: (s) =>
    ring(32, (t) => {
      const c = Math.cos(t), sn = Math.sin(t);
      return [Math.sign(c) * Math.pow(Math.abs(c), 0.5) * s * 0.9, Math.sign(sn) * Math.pow(Math.abs(sn), 0.5) * s * 0.9];
    }),
  square: (s, rng) => {
    const a = rng.range(0.8, 1.25);
    const x = s * 0.85 * a, y = (s * 0.85) / a;
    return withCorners([[-x, -y], [x, -y], [x, y], [-x, y]], 6);
  },
  triangle: (s, rng) => {
    const v = [-90, 30, 150].map((d) => {
      const t = ((d + rng.range(-12, 12)) * Math.PI) / 180;
      return [Math.cos(t) * s, Math.sin(t) * s];
    });
    return withCorners(v, 7);
  },
  shard: (s, rng) => {
    const k = rng.int(5, 7);
    const angs = [];
    for (let i = 0; i < k; i++) angs.push(((i + rng.range(-0.3, 0.3)) / k) * TAU);
    const v = angs.map((t) => {
      const r = s * rng.range(0.75, 1.1);
      return [Math.cos(t) * r, Math.sin(t) * r * 0.85];
    });
    return withCorners(v, 4);
  },
  spiky: (s, rng) => {
    const k = rng.int(5, 9);
    const v = [];
    for (let i = 0; i < k * 2; i++) {
      const t = (i / (k * 2)) * TAU;
      const r = i % 2 ? s * rng.range(0.45, 0.6) : s * rng.range(0.9, 1.05);
      v.push([Math.cos(t) * r, Math.sin(t) * r]);
    }
    return withCorners(v, 2);
  },
};

export const VOCAB = [
  ['circle', 'Circle'],
  ['ellipse', 'Ellipse'],
  ['blob', 'Blob'],
  ['leaf', 'Leaf'],
  ['roundsq', 'Rounded square'],
  ['square', 'Square'],
  ['triangle', 'Triangle'],
  ['shard', 'Shard'],
  ['spiky', 'Spiky star'],
];
export const VOCAB_SETS = {
  'mix-soft': ['circle', 'ellipse', 'blob', 'leaf'],
  'mix-foliage': ['blob', 'blob', 'circle', 'leaf', 'ellipse'],
  'mix-hard': ['square', 'triangle', 'shard'],
  'mix-all': VOCAB.map((v) => v[0]),
};
export const VOCAB_OPTIONS = [
  ['mix-soft', 'Mix: soft'],
  ['mix-foliage', 'Mix: foliage'],
  ['mix-hard', 'Mix: hard'],
  ['mix-all', 'Mix: everything'],
  ...VOCAB,
];

export function makeShape(type, cx, cy, s, ang, rng, opts = {}) {
  const maker = MAKERS[type] || MAKERS.circle;
  const { poly, corners } = maker(s, rng, opts);
  const c = Math.cos(ang), sn = Math.sin(ang);
  for (const pt of poly) {
    const x = pt[0], y = pt[1];
    pt[0] = cx + x * c - y * sn;
    pt[1] = cy + x * sn + y * c;
  }
  return { poly, corners };
}

// Per-shape noise: push the outline in and out, scaled to the shape's own size.
export function wobble(poly, cx, cy, s, amt, scale, noise, off) {
  for (const pt of poly) {
    const dx = pt[0] - cx, dy = pt[1] - cy;
    const d = Math.hypot(dx, dy) || 1;
    const n = noise.fbm((pt[0] / s) * scale * 0.7 + off, (pt[1] / s) * scale * 0.7 - off, 2);
    const k = (n * amt * s * 0.45) / d;
    pt[0] += dx * k;
    pt[1] += dy * k;
  }
}
