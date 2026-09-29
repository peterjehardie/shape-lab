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

// Abstract families from Chroma Mat. Each returns points on a unit-ish outline.
function superellipse(s, rng) {
  const n = rng.pick([0.6, 1, 1.5, 2, 2, 3, 5, 9]), e = 2 / n;
  return ring(64, (t) => {
    const c = Math.cos(t), si = Math.sin(t);
    return [Math.sign(c) * Math.abs(c) ** e * s, Math.sign(si) * Math.abs(si) ** e * s];
  });
}
function starPoly(s, rng) {
  const k = rng.int(3, 7), inset = rng.range(0.25, 0.7);
  const v = [];
  for (let j = 0; j < 2 * k; j++) {
    const t = (j / (2 * k)) * TAU - Math.PI / 2, r = j % 2 ? 1 - inset : 1;
    v.push([Math.cos(t) * r * s, Math.sin(t) * r * s]);
  }
  return withCorners(v, 4);
}
function crescent(s, rng) {
  const d = rng.range(0.3, 1.2), hx = d / 2, hy = Math.sqrt(Math.max(1 - hx * hx, 1e-4)), al = Math.atan2(hy, hx);
  const pts = [];
  for (let i = 0; i < 40; i++) { const t = al + ((TAU - 2 * al) * i) / 39; pts.push([Math.cos(t), Math.sin(t)]); }
  for (let i = 0; i < 26; i++) { const t = Math.PI + al - (2 * al * i) / 25; pts.push([d + Math.cos(t), Math.sin(t)]); }
  const cx = pts.reduce((a, q) => a + q[0], 0) / pts.length;
  return { poly: pts.map(([x, y]) => [(x - cx) * s, y * s]), corners: [0, 39] };
}
function wedgeOrArc(s, rng, arc) {
  const span = rng.range(0.3, 1.6) / 1.8 * TAU * 0.92, m = 28, v = [];
  if (!arc) {
    v.push([0, 0]);
    for (let i = 0; i <= m; i++) { const t = -span / 2 + (span * i) / m; v.push([Math.cos(t), Math.sin(t)]); }
  } else {
    const ri = 1 - rng.range(0.25, 0.6);
    for (let i = 0; i <= m; i++) { const t = -span / 2 + (span * i) / m; v.push([Math.cos(t), Math.sin(t)]); }
    for (let i = m; i >= 0; i--) { const t = -span / 2 + (span * i) / m; v.push([ri * Math.cos(t), ri * Math.sin(t)]); }
  }
  const b = bbox(v), cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
  return { poly: v.map(([x, y]) => [(x - cx) * s, (y - cy) * s]), corners: arc ? [0, m, m + 1, 2 * m + 1] : [0, 1, m + 1] };
}
function band(s, rng) {
  const harm = rng.int(2, 5), amp = rng.range(0.12, 0.4), H = [];
  for (let h = 1; h <= harm; h++) H.push([h, rng.range(0, TAU), (0.4 + rng.next()) / h ** 0.8]);
  const nt = 32, top = [], bot = [];
  for (let i = 0; i <= nt; i++) {
    const x = -1 + (2 * i) / nt;
    let a = 0, b = 0;
    for (const [h, ph, w] of H) { a += w * Math.sin(h * (x + 1) * 2 + ph); b += w * Math.cos(h * (x + 1) * 1.7 + ph * 1.3); }
    top.push([x * s, (-0.35 + amp * a * 0.35) * s]);
    bot.push([x * s, (0.35 + amp * b * 0.35) * s]);
  }
  return { poly: [...top, ...bot.reverse()], corners: [0, nt, nt + 1, 2 * nt + 1] };
}
MAKERS.superellipse = superellipse;
MAKERS.star = starPoly;
MAKERS.crescent = crescent;
MAKERS.wedge = (s, rng) => wedgeOrArc(s, rng, false);
MAKERS.arcband = (s, rng) => wedgeOrArc(s, rng, true);
MAKERS.band = band;

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
  ['superellipse', 'Superellipse'],
  ['star', 'Star polygon'],
  ['crescent', 'Crescent'],
  ['wedge', 'Wedge'],
  ['arcband', 'Arc band'],
  ['band', 'Wavy band'],
];
export const VOCAB_SETS = {
  'mix-soft': ['circle', 'ellipse', 'blob', 'leaf'],
  'mix-foliage': ['blob', 'blob', 'circle', 'leaf', 'ellipse'],
  'mix-hard': ['square', 'triangle', 'shard'],
  'mix-abstract': ['superellipse', 'star', 'blob', 'shard', 'crescent', 'wedge', 'arcband', 'band'],
  'mix-all': VOCAB.map((v) => v[0]),
};
export const VOCAB_OPTIONS = [
  ['mix-soft', 'Mix: soft'],
  ['mix-foliage', 'Mix: foliage'],
  ['mix-hard', 'Mix: hard'],
  ['mix-abstract', 'Mix: abstract (Chroma Mat)'],
  ['mix-all', 'Mix: everything'],
  ...VOCAB,
];

export function makeShape(type, cx, cy, s, ang, rng, opts = {}) {
  const maker = MAKERS[type] || MAKERS.circle;
  const { poly, corners } = maker(s, rng, opts);
  const c = Math.cos(ang), sn = Math.sin(ang);
  const sx = opts.stretch || 1, sy = 1 / (opts.stretch || 1);
  for (const pt of poly) {
    const x = pt[0] * sx, y = pt[1] * sy;
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

// Corner cutting: each pass rounds the outline a little more.
export function chaikin(p, passes = 1) {
  let q = p;
  for (let k = 0; k < passes; k++) {
    const out = [];
    for (let i = 0; i < q.length; i++) {
      const a = q[i], b = q[(i + 1) % q.length];
      out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    q = out;
  }
  return q;
}

export function pointInPoly(x, y, p) {
  let inside = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const a = p[i], b = p[j];
    if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1] || 1e-9) + a[0]) inside = !inside;
  }
  return inside;
}

// Drop points closer than minDist to the previous kept point.
export function thin(p, minDist) {
  const out = [p[0]];
  for (const q of p) {
    const l = out[out.length - 1];
    if (Math.hypot(q[0] - l[0], q[1] - l[1]) >= minDist) out.push(q);
  }
  return out;
}

// A tapered ribbon around a centre line: left side out, tip cap, right side back.
export function ribbon(pts, widths) {
  const n = pts.length;
  const left = [], right = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l, ny = dx / l, w = widths[i] / 2;
    left.push([pts[i][0] + nx * w, pts[i][1] + ny * w]);
    right.push([pts[i][0] - nx * w, pts[i][1] - ny * w]);
  }
  const e = pts[n - 1], p = pts[n - 2] || pts[0];
  const tx = e[0] - p[0], ty = e[1] - p[1], tl = Math.hypot(tx, ty) || 1;
  const w = widths[n - 1] / 2;
  const cap = [];
  for (let k = 1; k < 4; k++) {
    const t = (k / 4) * Math.PI;
    const nx = -ty / tl, ny = tx / tl;
    cap.push([e[0] + (nx * Math.cos(t) + (tx / tl) * Math.sin(t)) * w, e[1] + (ny * Math.cos(t) + (ty / tl) * Math.sin(t)) * w]);
  }
  return [...left, ...cap, ...right.reverse()];
}

// Torn edges (Chroma Mat's roughness): many sine ripples at Fibonacci-like frequencies
// push the outline in and out, plus a little random jitter.
export function roughen(poly, cx, cy, amt, grain, rng) {
  const N = poly.length;
  const fmax = N / 3;
  const fs = [2, 3, 5, 8, 13, 21, 34, 55, 89].map((f) => [Math.min(fmax, Math.max(1, Math.round(f * grain))), rng.range(0, TAU), 0.6 + rng.next() * 0.8]);
  let nrm = 0;
  for (const [f, , w] of fs) nrm += w / f ** 0.6;
  for (let i = 0; i < N; i++) {
    const u = i / N;
    let d = 0;
    for (const [f, ph, w] of fs) d += (Math.sin(f * u * TAU + ph) * w) / f ** 0.6;
    d = (d / nrm) * 2.2 + (rng.next() - 0.5) * 0.35 * grain;
    const k = 1 + d * amt * 0.12;
    poly[i][0] = cx + (poly[i][0] - cx) * k;
    poly[i][1] = cy + (poly[i][1] - cy) * k;
  }
}
