// Geometry effects: they move the outline itself (before any colour is laid down).
// Each takes polys in the owner's local units and returns new polys.

import { resample, polyLength, polysBounds, pathFromPolys, simplify } from './path.js';
import { offsetPolys } from './bool.js';
import { Rng, noiseFor } from './rng.js';
import { TAU, DEG, clamp } from './math.js';

const MAXPTS = 6000;

function spacingFor(polys, want) {
  let L = 0;
  for (const p of polys) L += polyLength(p);
  return Math.max(want, L / MAXPTS);
}

function normals(P, closed) {
  const n = P.length / 2;
  const N = new Float64Array(P.length);
  for (let i = 0; i < n; i++) {
    const a = closed ? (i - 1 + n) % n : Math.max(0, i - 1);
    const b = closed ? (i + 1) % n : Math.min(n - 1, i + 1);
    let tx = P[b * 2] - P[a * 2], ty = P[b * 2 + 1] - P[a * 2 + 1];
    const l = Math.hypot(tx, ty) || 1;
    N[i * 2] = ty / l;
    N[i * 2 + 1] = -tx / l;
  }
  return N;
}

// Torn edge: pushes the outline in and out along its normal with layered waves
// (Fibonacci frequencies so no single ripple dominates) plus a random jag.
export function roughen(polys, p) {
  const amt = p.amount || 0;
  if (!amt) return polys;
  const rng = new Rng((p.seed || 1) * 131 + 7);
  const sp = spacingFor(polys, clamp(amt / 4, 0.6, 4) / Math.max(0.25, p.detail || 1));
  return polys.map((poly, pi) => {
    const r = resample(poly, sp);
    const P = r.pts, n = P.length / 2;
    const N = normals(P, r.closed);
    const L = polyLength(r) || 1;
    const base = Math.max(1, L / 180) * (p.detail || 1);
    const fs = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89].map((f) => [
      Math.max(1, Math.round(f * base)), rng.range(0, TAU), 0.6 + rng.next() * 0.8,
    ]);
    let nrm = 0;
    for (const [f, , w] of fs) nrm += w / f ** 0.55;
    const jag = p.jag ?? 0.3;
    const out = new Array(P.length);
    for (let i = 0; i < n; i++) {
      const u = i / n;
      let d = 0;
      for (const [f, ph, w] of fs) d += (Math.sin(f * u * TAU + ph + pi) * w) / f ** 0.55;
      d = (d / nrm) * 1.6 + (rng.next() - 0.5) * jag;
      const bias = p.bias || 0; // push outward (+) or inward (-)
      const k = amt * (d + bias);
      out[i * 2] = P[i * 2] + N[i * 2] * k;
      out[i * 2 + 1] = P[i * 2 + 1] + N[i * 2 + 1] * k;
    }
    return { pts: out, closed: r.closed };
  });
}

// Noise warp: every point slides through a smooth random flow field.
export function warp(polys, p) {
  const amt = p.amount || 0;
  if (!amt) return polys;
  const nz = noiseFor(p.seed || 1), nz2 = noiseFor((p.seed || 1) + 9973);
  const sc = Math.max(1, p.scale || 80), st = Math.max(0.1, p.stretch || 1);
  const ang = (p.angle || 0) * DEG, ca = Math.cos(ang), sa = Math.sin(ang);
  const oct = Math.round(p.octaves || 2);
  const sp = spacingFor(polys, Math.max(0.8, sc / (6 * 2 ** (oct - 1))));
  return polys.map((poly) => {
    const r = resample(poly, sp);
    const P = r.pts, out = new Array(P.length);
    for (let i = 0; i < P.length; i += 2) {
      const x = P[i], y = P[i + 1];
      const u = (x * ca + y * sa) / (sc * st), v = (-x * sa + y * ca) / sc;
      const dx = nz.fbm(u, v, oct), dy = nz2.fbm(u + 5.2, v - 1.3, oct);
      out[i] = x + dx * amt;
      out[i + 1] = y + dy * amt;
    }
    return { pts: out, closed: r.closed };
  });
}

export function wave(polys, p) {
  const amp = p.amount || 0;
  if (!amp) return polys;
  const wl = Math.max(1, p.wavelength || 60);
  const ang = (p.angle || 0) * DEG, ca = Math.cos(ang), sa = Math.sin(ang);
  const ph = (p.phase || 0) * DEG;
  const sp = spacingFor(polys, wl / 16);
  return polys.map((poly) => {
    const r = resample(poly, sp);
    const P = r.pts, out = new Array(P.length);
    for (let i = 0; i < P.length; i += 2) {
      const x = P[i], y = P[i + 1];
      const along = x * ca + y * sa;
      const d = Math.sin((along / wl) * TAU + ph) * amp;
      out[i] = x - sa * d;
      out[i + 1] = y + ca * d;
    }
    return { pts: out, closed: r.closed };
  });
}

export function zigzag(polys, p) {
  const amt = p.amount || 0;
  if (!amt) return polys;
  const size = Math.max(1, p.size || 10);
  return polys.map((poly) => {
    const r = resample(poly, size / (p.smooth ? 4 : 1));
    const P = r.pts, n = P.length / 2;
    const N = normals(P, r.closed);
    const out = new Array(P.length);
    for (let i = 0; i < n; i++) {
      const s = p.smooth ? Math.sin((i / 4) * Math.PI) : i % 2 ? 1 : -1;
      out[i * 2] = P[i * 2] + N[i * 2] * s * amt;
      out[i * 2 + 1] = P[i * 2 + 1] + N[i * 2 + 1] * s * amt;
    }
    return { pts: out, closed: r.closed };
  });
}

function mapPoints(polys, sp, fn) {
  return polys.map((poly) => {
    const r = sp ? resample(poly, sp) : poly;
    const P = r.pts, out = new Array(P.length);
    for (let i = 0; i < P.length; i += 2) {
      const [x, y] = fn(P[i], P[i + 1]);
      out[i] = x;
      out[i + 1] = y;
    }
    return { pts: out, closed: r.closed };
  });
}

export function twist(polys, p) {
  const ang = (p.angle || 0) * DEG;
  if (!ang) return polys;
  const b = polysBounds(polys);
  const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
  const R = Math.max(1, Math.hypot(b.x1 - b.x0, b.y1 - b.y0) / 2);
  return mapPoints(polys, spacingFor(polys, R / 40), (x, y) => {
    const dx = x - cx, dy = y - cy;
    const r = Math.hypot(dx, dy) / R;
    const a = ang * (p.inward ? 1 - r : r);
    const c = Math.cos(a), s = Math.sin(a);
    return [cx + dx * c - dy * s, cy + dx * s + dy * c];
  });
}

// Pinch (negative) pulls the middle inward; bloat (positive) swells it.
export function pinch(polys, p) {
  const k = p.amount || 0;
  if (!k) return polys;
  const b = polysBounds(polys);
  const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
  const R = Math.max(1, Math.hypot(b.x1 - b.x0, b.y1 - b.y0) / 2);
  const e = Math.pow(2, -k * 1.5);
  return mapPoints(polys, spacingFor(polys, R / 40), (x, y) => {
    const dx = x - cx, dy = y - cy;
    const r = Math.hypot(dx, dy);
    if (r < 1e-9) return [x, y];
    const r2 = R * Math.pow(r / R, e);
    return [cx + (dx / r) * r2, cy + (dy / r) * r2];
  });
}

// Taper: narrows one end, like perspective on a flat card.
export function taper(polys, p) {
  const k = p.amount || 0;
  if (!k) return polys;
  const b = polysBounds(polys);
  const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
  const hh = Math.max(1e-6, (b.y1 - b.y0) / 2), hw = Math.max(1e-6, (b.x1 - b.x0) / 2);
  const vert = (p.axis || 'vertical') === 'vertical';
  return mapPoints(polys, spacingFor(polys, (hh + hw) / 30), (x, y) => {
    if (vert) {
      const t = (y - cy) / hh; // -1 top .. 1 bottom
      return [cx + (x - cx) * (1 + k * t), y];
    }
    const t = (x - cx) / hw;
    return [x, cy + (y - cy) * (1 + k * t)];
  });
}

// Bend: curls the shape along an arc, as if drawn on a bent strip.
export function bend(polys, p) {
  const k = p.amount || 0;
  if (!k) return polys;
  const b = polysBounds(polys);
  const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
  const hw = Math.max(1e-6, (b.x1 - b.x0) / 2);
  const theta = k * Math.PI; // total arc angle
  const R = hw / (theta / 2);
  return mapPoints(polys, spacingFor(polys, hw / 30), (x, y) => {
    const a = ((x - cx) / hw) * (theta / 2);
    const r = R - (y - cy);
    return [cx + Math.sin(a) * r, cy + R - Math.cos(a) * r];
  });
}

export function offset(polys, p) {
  return offsetPolys(polys, p.amount || 0, p.join || 'round');
}

// Chaikin corner cutting: each pass rounds every corner a little more.
export function smooth(polys, p) {
  let out = polys;
  const it = Math.round(p.iterations || 0);
  for (let k = 0; k < it; k++)
    out = out.map((poly) => {
      const P = poly.pts, n = P.length / 2;
      if (n < 3) return poly;
      const q = [];
      const m = poly.closed ? n : n - 1;
      if (!poly.closed) q.push(P[0], P[1]);
      for (let i = 0; i < m; i++) {
        const j = (i + 1) % n;
        const x0 = P[i * 2], y0 = P[i * 2 + 1], x1 = P[j * 2], y1 = P[j * 2 + 1];
        q.push(0.75 * x0 + 0.25 * x1, 0.75 * y0 + 0.25 * y1, 0.25 * x0 + 0.75 * x1, 0.25 * y0 + 0.75 * y1);
      }
      if (!poly.closed) q.push(P[(n - 1) * 2], P[(n - 1) * 2 + 1]);
      return { pts: q, closed: poly.closed };
    });
  return out;
}

// Facet: reduces the outline to a few straight cuts, like a chiselled or paper-cut edge.
export function facet(polys, p) {
  const eps = p.amount || 0;
  if (!eps) return polys;
  return polys.map((poly) => {
    const pts = [];
    for (let i = 0; i < poly.pts.length; i += 2) pts.push([poly.pts[i], poly.pts[i + 1]]);
    let s = simplify(poly.closed ? [...pts, pts[0]] : pts, eps);
    if (poly.closed) s = s.slice(0, -1);
    if (s.length < 3 && poly.closed) return poly;
    return { pts: s.flat(), closed: poly.closed };
  });
}

// Scatter-jitter: every point hops randomly; crystalline or shaky edges.
export function jitter(polys, p) {
  const amt = p.amount || 0;
  if (!amt) return polys;
  const rng = new Rng((p.seed || 1) * 53 + 1);
  return mapPoints(polys, spacingFor(polys, Math.max(0.5, p.spacing || 6)), (x, y) => [x + rng.signed() * amt, y + rng.signed() * amt]);
}

export { pathFromPolys };
