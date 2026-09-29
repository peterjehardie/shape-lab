// Vector paths and polygons.
//
// A path is what a person edits: anchor points with optional curve handles.
//   path = { subpaths: [ { closed, pts: [ { x, y, in: [dx,dy]|null, out: [dx,dy]|null, mode } ] } ] }
// Handles are stored relative to their anchor, so moving an anchor carries its handles.
// mode: 'corner' (handles independent), 'smooth' (handles stay in line), 'sym' (in line and equal length).
//
// A poly is what effects and renderers work on: a flat list of numbers [x0,y0,x1,y1,...].
//   poly = { pts: number[], closed }
// A shape's geometry after flattening is a list of polys (holes and separate islands included).

import { emptyBounds, addPoint, apply } from './math.js';

export const anchor = (x, y, inH = null, outH = null, mode = 'corner') => ({ x, y, in: inH, out: outH, mode });

function cubicPoint(p0, p1, p2, p3, t) {
  const u = 1 - t;
  const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  return [a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]];
}

// Control points of the segment from anchor a to anchor b, or null for a straight line.
export function segmentCtrl(a, b) {
  if (!a.out && !b.in) return null;
  return [
    [a.x, a.y],
    [a.x + (a.out ? a.out[0] : 0), a.y + (a.out ? a.out[1] : 0)],
    [b.x + (b.in ? b.in[0] : 0), b.y + (b.in ? b.in[1] : 0)],
    [b.x, b.y],
  ];
}

function flattenCubic(out, c, tol, depth = 0) {
  const [p0, p1, p2, p3] = c;
  // Flat enough when the control points sit close to the chord.
  const dx = p3[0] - p0[0], dy = p3[1] - p0[1];
  const d1 = Math.abs((p1[0] - p3[0]) * dy - (p1[1] - p3[1]) * dx);
  const d2 = Math.abs((p2[0] - p3[0]) * dy - (p2[1] - p3[1]) * dx);
  if (depth > 12 || (d1 + d2) * (d1 + d2) <= tol * tol * (dx * dx + dy * dy)) {
    out.push(p3[0], p3[1]);
    return;
  }
  const m01 = mid(p0, p1), m12 = mid(p1, p2), m23 = mid(p2, p3);
  const m012 = mid(m01, m12), m123 = mid(m12, m23), m = mid(m012, m123);
  flattenCubic(out, [p0, m01, m012, m], tol, depth + 1);
  flattenCubic(out, [m, m123, m23, p3], tol, depth + 1);
}
const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

export function flattenSubpath(sp, tol = 0.25) {
  const P = sp.pts;
  const pts = [];
  if (!P.length) return { pts, closed: sp.closed };
  pts.push(P[0].x, P[0].y);
  const n = sp.closed ? P.length : P.length - 1;
  for (let i = 0; i < n; i++) {
    const a = P[i], b = P[(i + 1) % P.length];
    const c = segmentCtrl(a, b);
    if (c) flattenCubic(pts, c, tol);
    else pts.push(b.x, b.y);
  }
  if (sp.closed && pts.length > 2) {
    // drop the duplicated start point
    const L = pts.length;
    if (Math.abs(pts[L - 2] - pts[0]) < 1e-9 && Math.abs(pts[L - 1] - pts[1]) < 1e-9) pts.length -= 2;
  }
  return { pts, closed: sp.closed };
}

export function flattenPath(path, tol = 0.25) {
  return path.subpaths.map((sp) => flattenSubpath(sp, tol)).filter((p) => p.pts.length >= 4);
}

// Split long straight runs so warps have points to move.
export function resample(poly, maxSeg) {
  const P = poly.pts, n = P.length / 2;
  if (n < 2 || !(maxSeg > 0)) return poly;
  const out = [];
  const m = poly.closed ? n : n - 1;
  for (let i = 0; i < m; i++) {
    const x0 = P[i * 2], y0 = P[i * 2 + 1];
    const j = (i + 1) % n;
    const x1 = P[j * 2], y1 = P[j * 2 + 1];
    const len = Math.hypot(x1 - x0, y1 - y0);
    const k = Math.max(1, Math.min(2000, Math.ceil(len / maxSeg)));
    for (let s = 0; s < k; s++) out.push(x0 + ((x1 - x0) * s) / k, y0 + ((y1 - y0) * s) / k);
  }
  if (!poly.closed) out.push(P[(n - 1) * 2], P[(n - 1) * 2 + 1]);
  return { pts: out, closed: poly.closed };
}

export function polyLength(poly) {
  const P = poly.pts, n = P.length / 2;
  let L = 0;
  const m = poly.closed ? n : n - 1;
  for (let i = 0; i < m; i++) {
    const j = (i + 1) % n;
    L += Math.hypot(P[j * 2] - P[i * 2], P[j * 2 + 1] - P[i * 2 + 1]);
  }
  return L;
}

export function polyArea(pts) {
  let a = 0;
  const n = pts.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) a += pts[j * 2] * pts[i * 2 + 1] - pts[i * 2] * pts[j * 2 + 1];
  return a / 2;
}

export function polysBounds(polys, b = emptyBounds()) {
  for (const p of polys) for (let i = 0; i < p.pts.length; i += 2) addPoint(b, p.pts[i], p.pts[i + 1]);
  return b;
}

export function polysCentroid(polys) {
  const b = polysBounds(polys);
  return [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2];
}

export function transformPolys(polys, m) {
  return polys.map((p) => {
    const q = new Array(p.pts.length);
    for (let i = 0; i < p.pts.length; i += 2) {
      const x = p.pts[i], y = p.pts[i + 1];
      q[i] = m[0] * x + m[2] * y + m[4];
      q[i + 1] = m[1] * x + m[3] * y + m[5];
    }
    return { pts: q, closed: p.closed };
  });
}

export const clonePolys = (polys) => polys.map((p) => ({ pts: p.pts.slice(), closed: p.closed }));

// Winding number test across all polys (nonzero fill rule).
export function pointInPolys(polys, x, y) {
  let w = 0;
  for (const p of polys) {
    if (!p.closed) continue;
    const P = p.pts, n = P.length / 2;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = P[i * 2], yi = P[i * 2 + 1], xj = P[j * 2], yj = P[j * 2 + 1];
      if (yj <= y) {
        if (yi > y && (xi - xj) * (y - yj) - (x - xj) * (yi - yj) > 0) w++;
      } else if (yi <= y && (xi - xj) * (y - yj) - (x - xj) * (yi - yj) < 0) w--;
    }
  }
  return w !== 0;
}

export function distToPolys(polys, x, y) {
  let best = Infinity;
  for (const p of polys) {
    const P = p.pts, n = P.length / 2;
    const m = p.closed ? n : n - 1;
    for (let i = 0; i < m; i++) {
      const j = (i + 1) % n;
      const d = distSeg(x, y, P[i * 2], P[i * 2 + 1], P[j * 2], P[j * 2 + 1]);
      if (d < best) best = d;
    }
  }
  return best;
}
function distSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const L = dx * dx + dy * dy;
  let t = L ? ((px - ax) * dx + (py - ay) * dy) / L : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}

// ---------- path editing helpers ----------

export const clonePath = (path) => JSON.parse(JSON.stringify(path));

export function pathBounds(path) {
  return polysBounds(flattenPath(path, 0.5));
}

export function transformPath(path, m) {
  const out = clonePath(path);
  for (const sp of out.subpaths)
    for (const p of sp.pts) {
      [p.x, p.y] = apply(m, p.x, p.y);
      if (p.in) p.in = [m[0] * p.in[0] + m[2] * p.in[1], m[1] * p.in[0] + m[3] * p.in[1]];
      if (p.out) p.out = [m[0] * p.out[0] + m[2] * p.out[1], m[1] * p.out[0] + m[3] * p.out[1]];
    }
  return out;
}

// Nearest point on a path's segments: { si, seg, t, x, y, d }.
export function nearestOnPath(path, x, y) {
  let best = { d: Infinity };
  path.subpaths.forEach((sp, si) => {
    const P = sp.pts;
    const n = sp.closed ? P.length : P.length - 1;
    for (let i = 0; i < n; i++) {
      const a = P[i], b = P[(i + 1) % P.length];
      const c = segmentCtrl(a, b) || [[a.x, a.y], [a.x, a.y], [b.x, b.y], [b.x, b.y]];
      for (let k = 0; k <= 40; k++) {
        const t = k / 40;
        const [px, py] = cubicPoint(...c, t);
        const d = Math.hypot(px - x, py - y);
        if (d < best.d) best = { si, seg: i, t, x: px, y: py, d };
      }
    }
  });
  return best;
}

// Insert an anchor at parameter t of a segment, keeping the curve's shape (de Casteljau split).
export function splitSegment(path, si, seg, t) {
  const out = clonePath(path);
  const sp = out.subpaths[si];
  const P = sp.pts;
  const a = P[seg], b = P[(seg + 1) % P.length];
  const c = segmentCtrl(a, b);
  if (!c) {
    P.splice(seg + 1, 0, anchor(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t));
    return out;
  }
  const [p0, p1, p2, p3] = c;
  const L = (u, v) => [u[0] + (v[0] - u[0]) * t, u[1] + (v[1] - u[1]) * t];
  const q0 = L(p0, p1), q1 = L(p1, p2), q2 = L(p2, p3);
  const r0 = L(q0, q1), r1 = L(q1, q2);
  const s = L(r0, r1);
  a.out = [q0[0] - a.x, q0[1] - a.y];
  b.in = [q2[0] - b.x, q2[1] - b.y];
  P.splice(seg + 1, 0, anchor(s[0], s[1], [r0[0] - s[0], r0[1] - s[1]], [r1[0] - s[0], r1[1] - s[1]], 'smooth'));
  return out;
}

// Smooth handles through points (Catmull-Rom turned into Bezier handles).
export function smoothAnchors(pts, closed, tension = 1) {
  const n = pts.length;
  return pts.map((p, i) => {
    const prev = pts[closed ? (i - 1 + n) % n : Math.max(0, i - 1)];
    const next = pts[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
    if (!closed && (i === 0 || i === n - 1)) return anchor(p[0], p[1]);
    const tx = ((next[0] - prev[0]) / 6) * tension, ty = ((next[1] - prev[1]) / 6) * tension;
    return anchor(p[0], p[1], [-tx, -ty], [tx, ty], 'smooth');
  });
}

// Ramer-Douglas-Peucker simplification of a point list [[x,y],...].
export function simplify(pts, eps) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop();
    let md = 0, mi = -1;
    for (let i = s + 1; i < e; i++) {
      const d = distSeg(pts[i][0], pts[i][1], pts[s][0], pts[s][1], pts[e][0], pts[e][1]);
      if (d > md) (md = d), (mi = i);
    }
    if (md > eps && mi > 0) {
      keep[mi] = 1;
      stack.push([s, mi], [mi, e]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

// Freehand stroke -> editable smooth path.
export function fitFreehand(points, closed, eps = 2) {
  let pts = simplify(points, eps);
  if (closed && pts.length > 3) pts = pts.slice(0, -1);
  return { subpaths: [{ closed, pts: smoothAnchors(pts, closed) }] };
}

// Polys -> path with straight segments (used when turning effect or boolean output into editable paths).
export function pathFromPolys(polys, eps = 0) {
  return {
    subpaths: polys.map((p) => {
      let pts = [];
      for (let i = 0; i < p.pts.length; i += 2) pts.push([p.pts[i], p.pts[i + 1]]);
      if (eps > 0) pts = simplify(p.closed ? [...pts, pts[0]] : pts, eps).slice(0, p.closed ? -1 : undefined);
      return { closed: p.closed, pts: pts.map(([x, y]) => anchor(x, y)) };
    }),
  };
}
