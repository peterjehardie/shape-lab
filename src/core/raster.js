// Raster effects: they work on the pixels of a shape after it is filled.
// Buffers are plain { w, h, data: Uint8ClampedArray RGBA } (same layout as ImageData)
// so this file has no browser dependency.
//
// Every effect gets a context `cx` describing how pixels relate to the owner's local units:
//   lin  [a,b,c,d]  local vector -> pixel vector
//   inv  [a,b,c,d]  pixel vector -> local vector
//   ox, oy          pixel position of the local origin
//   ppu             pixels per local unit (mean)
//   polys           the owner's outline in local units (after geometry effects)
//   color           the owner's main colour (OKLCH), used by spatter
//   draft           true while dragging: effects may cut corners

import { noiseFor, sampleNoise, hash01, Rng } from './rng.js';
import { toRgb } from './color.js';
import { clamp, smoothstep, DEG, TAU } from './math.js';
import { polyLength, polysBounds } from './path.js';

export const makeBuf = (w, h) => ({ w, h, data: new Uint8ClampedArray(w * h * 4) });

function toLocalFn(cx) {
  const [a, b, c, d] = cx.inv;
  return (px, py) => {
    const X = px + 0.5 - cx.ox, Y = py + 0.5 - cx.oy;
    return [a * X + c * Y, b * X + d * Y];
  };
}

// Evaluate fn(localX, localY) for every pixel. Smooth fields are sampled on a coarser
// grid and blended, which keeps big soft noise cheap.
export function fieldPx(buf, cx, fn, featurePx = 1) {
  const { w, h } = buf;
  const out = new Float32Array(w * h);
  const step = clamp(Math.floor(featurePx / (cx.draft ? 3 : 5)), 1, 8);
  const L = toLocalFn(cx);
  if (step === 1) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[y * w + x] = fn(...L(x, y));
    return out;
  }
  const gw = Math.ceil(w / step) + 1, gh = Math.ceil(h / step) + 1;
  const g = new Float32Array(gw * gh);
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) g[j * gw + i] = fn(...L(i * step, j * step));
  for (let y = 0; y < h; y++) {
    const gy = y / step, j = Math.floor(gy), fy = gy - j;
    for (let x = 0; x < w; x++) {
      const gx = x / step, i = Math.floor(gx), fx = gx - i;
      const k = j * gw + i;
      const a = g[k] + (g[k + 1] - g[k]) * fx;
      const b = g[k + gw] + (g[k + gw + 1] - g[k + gw]) * fx;
      out[y * w + x] = a + (b - a) * fy;
    }
  }
  return out;
}

// Noise sampler with size, stretch and direction, returning 0..1.
function noiseSampler(p, seedSalt = 0) {
  const nz = noiseFor((p.seed || 1) + seedSalt);
  const sc = Math.max(0.5, p.scale || 40), st = Math.max(0.05, p.stretch || 1);
  const ang = (p.angle || 0) * DEG, ca = Math.cos(ang), sa = Math.sin(ang);
  const oct = Math.round(p.octaves || 3), kind = p.kind || 'fbm';
  const con = p.contrast ?? 1;
  return (x, y) => {
    const u = (x * ca + y * sa) / (sc * st), v = (-x * sa + y * ca) / sc;
    const n = sampleNoise(nz, kind, u, v, oct);
    return con === 1 ? n : clamp((n - 0.5) * con + 0.5);
  };
}
const finestPx = (p, cx) => ((p.scale || 40) * cx.ppu) / 2 ** (Math.round(p.octaves || 3) - 1);

export function alphaOf(buf) {
  const a = new Float32Array(buf.w * buf.h);
  for (let i = 0; i < a.length; i++) a[i] = buf.data[i * 4 + 3] / 255;
  return a;
}

// Three box blurs in a row approximate a Gaussian blur.
export function blurFloat(src, w, h, r) {
  r = Math.round(r);
  if (r < 1) return src;
  let a = src.slice(), b = new Float32Array(src.length);
  const box = Math.max(1, Math.round(r / 1.7));
  for (let pass = 0; pass < 3; pass++) {
    // horizontal
    for (let y = 0; y < h; y++) {
      let s = 0;
      const row = y * w;
      for (let x = -box; x <= box; x++) s += a[row + clamp(x, 0, w - 1)];
      for (let x = 0; x < w; x++) {
        b[row + x] = s / (2 * box + 1);
        s += a[row + Math.min(w - 1, x + box + 1)] - a[row + Math.max(0, x - box)];
      }
    }
    // vertical
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let y = -box; y <= box; y++) s += b[clamp(y, 0, h - 1) * w + x];
      for (let y = 0; y < h; y++) {
        a[y * w + x] = s / (2 * box + 1);
        s += b[Math.min(h - 1, y + box + 1) * w + x] - b[Math.max(0, y - box) * w + x];
      }
    }
  }
  return a;
}

function premul(buf) {
  const n = buf.w * buf.h, c = [new Float32Array(n), new Float32Array(n), new Float32Array(n), new Float32Array(n)];
  const d = buf.data;
  for (let i = 0; i < n; i++) {
    const a = d[i * 4 + 3] / 255;
    c[0][i] = d[i * 4] * a;
    c[1][i] = d[i * 4 + 1] * a;
    c[2][i] = d[i * 4 + 2] * a;
    c[3][i] = a;
  }
  return c;
}
function unpremul(buf, c) {
  const d = buf.data, n = buf.w * buf.h;
  for (let i = 0; i < n; i++) {
    const a = c[3][i];
    d[i * 4 + 3] = a * 255;
    if (a > 1e-4) {
      d[i * 4] = c[0][i] / a;
      d[i * 4 + 1] = c[1][i] / a;
      d[i * 4 + 2] = c[2][i] / a;
    }
  }
}

// Sample a pixel-space shift for a local-space offset.
const localToPx = (cx, x, y) => [cx.lin[0] * x + cx.lin[2] * y, cx.lin[1] * x + cx.lin[3] * y];

function sampleBilinear(arr, w, h, x, y) {
  if (x < 0 || y < 0 || x > w - 1 || y > h - 1) return 0;
  const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
  const i1 = Math.min(w - 1, i + 1), j1 = Math.min(h - 1, j + 1);
  const a = arr[j * w + i] + (arr[j * w + i1] - arr[j * w + i]) * fx;
  const b = arr[j1 * w + i] + (arr[j1 * w + i1] - arr[j1 * w + i]) * fx;
  return a + (b - a) * fy;
}

const colRgb = (c) => (c ? toRgb(c) : [0, 0, 0]);

// ---------------- effects ----------------

export function noiseTexture(buf, p, cx) {
  const f = fieldPx(buf, cx, noiseSampler(p), finestPx(p, cx));
  const d = buf.data, amt = p.amount ?? 0.5, mode = p.mode || 'value';
  const [cr, cg, cb] = colRgb(p.color);
  for (let i = 0; i < f.length; i++) {
    const k = i * 4;
    if (!d[k + 3]) continue;
    const v = f[i];
    switch (mode) {
      case 'value': {
        const m = 1 + amt * (v - 0.5) * 2;
        d[k] *= m; d[k + 1] *= m; d[k + 2] *= m;
        break;
      }
      case 'darken': {
        const m = 1 - amt * v;
        d[k] *= m; d[k + 1] *= m; d[k + 2] *= m;
        break;
      }
      case 'lighten': {
        const m = amt * v;
        d[k] += (255 - d[k]) * m; d[k + 1] += (255 - d[k + 1]) * m; d[k + 2] += (255 - d[k + 2]) * m;
        break;
      }
      case 'color': {
        const m = amt * v;
        d[k] += (cr - d[k]) * m; d[k + 1] += (cg - d[k + 1]) * m; d[k + 2] += (cb - d[k + 2]) * m;
        break;
      }
      case 'alpha':
        d[k + 3] *= 1 - amt * (1 - v);
        break;
    }
  }
}

export function grain(buf, p, cx) {
  const d = buf.data, amt = (p.amount ?? 0.1) * 255, size = Math.max(0.2, p.size || 1);
  const L = toLocalFn(cx), seed = p.seed || 1, mono = p.mono !== false;
  for (let y = 0; y < buf.h; y++)
    for (let x = 0; x < buf.w; x++) {
      const k = (y * buf.w + x) * 4;
      if (!d[k + 3]) continue;
      const [lx, ly] = L(x, y);
      const gx = Math.floor(lx / size), gy = Math.floor(ly / size);
      const r = (hash01(gx, gy, seed) - 0.5) * amt;
      if (mono) {
        d[k] += r; d[k + 1] += r; d[k + 2] += r;
      } else {
        d[k] += r; d[k + 1] += (hash01(gx, gy, seed + 1) - 0.5) * amt; d[k + 2] += (hash01(gx, gy, seed + 2) - 0.5) * amt;
      }
    }
}

// Dissolve / dry edge: noise eats the alpha, optionally mostly near the edges.
export function dissolve(buf, p, cx) {
  const f = fieldPx(buf, cx, noiseSampler(p, 101), finestPx(p, cx));
  const d = buf.data, th = p.amount ?? 0.4, soft = Math.max(0.005, p.softness ?? 0.05), edge = p.edge ?? 0.6;
  let A = null;
  if (edge > 0) A = blurFloat(alphaOf(buf), buf.w, buf.h, Math.max(1, (p.edgeWidth || 20) * cx.ppu));
  for (let i = 0; i < f.length; i++) {
    const k = i * 4;
    if (!d[k + 3]) continue;
    let s = f[i];
    if (A) s += edge * (A[i] - 0.5) * 2;
    d[k + 3] *= smoothstep(th - soft, th + soft, s);
  }
}

// Displace: pixels are pushed around by a noise flow; smears and ripples inside and past the edge.
export function displace(buf, p, cx) {
  const sx = noiseSampler({ ...p, contrast: 1 }, 211), sy = noiseSampler({ ...p, contrast: 1 }, 307);
  const fx = fieldPx(buf, cx, sx, finestPx(p, cx)), fy = fieldPx(buf, cx, sy, finestPx(p, cx));
  const src = premul(buf), w = buf.w, h = buf.h, amt = p.amount || 0;
  const dst = [new Float32Array(w * h), new Float32Array(w * h), new Float32Array(w * h), new Float32Array(w * h)];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const [dx, dy] = localToPx(cx, (fx[i] - 0.5) * 2 * amt, (fy[i] - 0.5) * 2 * amt);
      const X = x - dx, Y = y - dy;
      for (let c = 0; c < 4; c++) dst[c][i] = sampleBilinear(src[c], w, h, X, Y);
    }
  unpremul(buf, dst);
}

export function blur(buf, p, cx) {
  const r = (p.radius || 0) * cx.ppu;
  if (r < 0.5) return;
  const c = premul(buf);
  for (let k = 0; k < 4; k++) c[k] = blurFloat(c[k], buf.w, buf.h, r);
  unpremul(buf, c);
}

// Motion blur along a direction (smear), like a dragged brush.
export function smear(buf, p, cx) {
  const len = (p.length || 0) * cx.ppu;
  if (len < 1) return;
  const [ux, uy] = localToPx(cx, Math.cos((p.angle || 0) * DEG), Math.sin((p.angle || 0) * DEG));
  const ul = Math.hypot(ux, uy) || 1;
  const dx = ux / ul, dy = uy / ul;
  const src = premul(buf), w = buf.w, h = buf.h;
  const N = Math.min(48, Math.max(4, Math.round(len / 2)));
  const dst = [new Float32Array(w * h), new Float32Array(w * h), new Float32Array(w * h), new Float32Array(w * h)];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let s0 = 0, s1 = 0, s2 = 0, s3 = 0;
      for (let k = 0; k < N; k++) {
        const t = (k / (N - 1) - (p.centered ? 0.5 : 0)) * len;
        const X = x - dx * t, Y = y - dy * t;
        s0 += sampleBilinear(src[0], w, h, X, Y);
        s1 += sampleBilinear(src[1], w, h, X, Y);
        s2 += sampleBilinear(src[2], w, h, X, Y);
        s3 += sampleBilinear(src[3], w, h, X, Y);
      }
      dst[0][i] = s0 / N; dst[1][i] = s1 / N; dst[2][i] = s2 / N; dst[3][i] = s3 / N;
    }
  unpremul(buf, dst);
}

// Watercolour edge: pigment pools where the wash meets dry paper, so the rim darkens.
export function edgePool(buf, p, cx) {
  const d = buf.data, amt = p.amount ?? 0.4;
  const A = blurFloat(alphaOf(buf), buf.w, buf.h, Math.max(1, (p.width || 8) * cx.ppu));
  for (let i = 0; i < A.length; i++) {
    const k = i * 4;
    const a = d[k + 3] / 255;
    if (!a) continue;
    const f = clamp((1 - A[i]) * 2.2) * a;
    const m = 1 - amt * f;
    d[k] *= m; d[k + 1] *= m; d[k + 2] *= m;
  }
}

// Edge light / inner shadow: the side facing a light direction picks up a colour.
// Built by testing whether the shape continues a short step toward the light.
export function edgeLight(buf, p, cx) {
  const d = buf.data, w = buf.w, h = buf.h, amt = p.amount ?? 0.6;
  const A = blurFloat(alphaOf(buf), w, h, Math.max(0, (p.softness ?? 4) * cx.ppu));
  const ang = (p.angle ?? -45) * DEG, dist = p.width ?? 10;
  const [sx, sy] = localToPx(cx, Math.cos(ang) * dist, Math.sin(ang) * dist);
  const [cr, cg, cb] = colRgb(p.color);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x, k = i * 4;
      const a = d[k + 3] / 255;
      if (!a) continue;
      const f = clamp(1 - sampleBilinear(A, w, h, x + sx, y + sy)) * a * amt;
      d[k] += (cr - d[k]) * f; d[k + 1] += (cg - d[k + 1]) * f; d[k + 2] += (cb - d[k + 2]) * f;
    }
}

// Drop shadow and glow sit outside the shape, underneath it.
export function shadow(buf, p, cx) {
  const w = buf.w, h = buf.h, d = buf.data;
  let A = alphaOf(buf);
  const spread = p.spread || 0;
  if (spread) for (let i = 0; i < A.length; i++) A[i] = Math.min(1, A[i] * (1 + spread * 6));
  A = blurFloat(A, w, h, (p.blur ?? 10) * cx.ppu);
  const [sx, sy] = localToPx(cx, p.dx || 0, p.dy || 0);
  const [cr, cg, cb] = colRgb(p.color);
  const op = p.opacity ?? 0.5;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x, k = i * 4;
      const sa = sampleBilinear(A, w, h, x - sx, y - sy) * op;
      const a = d[k + 3] / 255;
      const oa = a + sa * (1 - a);
      if (oa <= 0) continue;
      d[k] = (d[k] * a + cr * sa * (1 - a)) / oa;
      d[k + 1] = (d[k + 1] * a + cg * sa * (1 - a)) / oa;
      d[k + 2] = (d[k + 2] * a + cb * sa * (1 - a)) / oa;
      d[k + 3] = oa * 255;
    }
}

// Spatter: droplets flung off the edge, thinning with distance.
export function spatter(buf, p, cx) {
  const polys = cx.polys || [];
  if (!polys.length) return;
  const rng = new Rng((p.seed || 1) * 977);
  const count = Math.round(p.count ?? 60);
  const lens = polys.map(polyLength), total = lens.reduce((a, b) => a + b, 0);
  if (!total) return;
  const col = p.useFill !== false && cx.color ? cx.color : p.color;
  const [cr, cg, cb] = colRgb(col);
  const d = buf.data, w = buf.w, h = buf.h;
  const b = polysBounds(polys);
  const mx = (b.x0 + b.x1) / 2, my = (b.y0 + b.y1) / 2;
  for (let n = 0; n < count; n++) {
    // pick a point along the outline
    let s = rng.next() * total, pi = 0;
    while (pi < lens.length - 1 && s > lens[pi]) s -= lens[pi++];
    const P = polys[pi].pts, m = P.length / 2;
    let acc = 0, x = P[0], y = P[1], nx = 0, ny = 0;
    for (let i = 0; i < m; i++) {
      const j = (i + 1) % m;
      const sl = Math.hypot(P[j * 2] - P[i * 2], P[j * 2 + 1] - P[i * 2 + 1]);
      if (acc + sl >= s) {
        const t = (s - acc) / (sl || 1);
        x = P[i * 2] + (P[j * 2] - P[i * 2]) * t;
        y = P[i * 2 + 1] + (P[j * 2 + 1] - P[i * 2 + 1]) * t;
        nx = (P[j * 2 + 1] - P[i * 2 + 1]) / (sl || 1);
        ny = -(P[j * 2] - P[i * 2]) / (sl || 1);
        break;
      }
      acc += sl;
    }
    // make the normal point away from the middle
    if ((x - mx) * nx + (y - my) * ny < 0) (nx = -nx), (ny = -ny);
    const dist = Math.pow(rng.next(), 2.2) * (p.spread ?? 40);
    const jit = (rng.next() - 0.5) * 0.9;
    const ex = x + (nx + -ny * jit) * dist, ey = y + (ny + nx * jit) * dist;
    const r = Math.max(0.3, (p.size ?? 3) * (1 - (dist / (p.spread || 40)) * 0.6) * (0.4 + rng.next() * (p.variance ?? 1)));
    const px = cx.ox + cx.lin[0] * ex + cx.lin[2] * ey, py = cx.oy + cx.lin[1] * ex + cx.lin[3] * ey;
    const rp = r * cx.ppu;
    const x0 = Math.max(0, Math.floor(px - rp - 1)), x1 = Math.min(w - 1, Math.ceil(px + rp + 1));
    const y0 = Math.max(0, Math.floor(py - rp - 1)), y1 = Math.min(h - 1, Math.ceil(py + rp + 1));
    for (let yy = y0; yy <= y1; yy++)
      for (let xx = x0; xx <= x1; xx++) {
        const cov = clamp(rp - Math.hypot(xx + 0.5 - px, yy + 0.5 - py) + 0.5);
        if (cov <= 0) continue;
        const k = (yy * w + xx) * 4, a = d[k + 3] / 255;
        const oa = cov + a * (1 - cov);
        d[k] = (cr * cov + d[k] * a * (1 - cov)) / oa;
        d[k + 1] = (cg * cov + d[k + 1] * a * (1 - cov)) / oa;
        d[k + 2] = (cb * cov + d[k + 2] * a * (1 - cov)) / oa;
        d[k + 3] = oa * 255;
      }
  }
}

const lum = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

// Posterize: snaps lightness into a few value steps (a value study).
export function posterize(buf, p) {
  const n = Math.max(2, Math.round(p.levels || 4)), d = buf.data;
  for (let k = 0; k < d.length; k += 4) {
    if (!d[k + 3]) continue;
    const L = Math.max(1e-3, lum(d[k], d[k + 1], d[k + 2]));
    const q = Math.round(L * (n - 1)) / (n - 1);
    const m = q / L;
    d[k] *= m; d[k + 1] *= m; d[k + 2] *= m;
  }
}

// Halftone: turns value into dots on a rotated grid (dark = big dots).
export function halftone(buf, p, cx) {
  const src = buf.data.slice(), d = buf.data, w = buf.w, h = buf.h;
  const size = Math.max(1, p.size || 8), ang = (p.angle ?? 45) * DEG, ca = Math.cos(ang), sa = Math.sin(ang);
  const L = toLocalFn(cx), soft = Math.max(0.3, (p.softness ?? 0.6) * 1);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const k = (y * w + x) * 4;
      if (!src[k + 3]) continue;
      const [lx, ly] = L(x, y);
      const u = (lx * ca + ly * sa) / size, v = (-lx * sa + ly * ca) / size;
      const cu = Math.floor(u) + 0.5, cv = Math.floor(v) + 0.5;
      // cell centre back to pixels to read its value
      const clx = (cu * ca - cv * sa) * size, cly = (cu * sa + cv * ca) * size;
      const px = Math.round(cx.ox + cx.lin[0] * clx + cx.lin[2] * cly), py = Math.round(cx.oy + cx.lin[1] * clx + cx.lin[3] * cly);
      let value = 1;
      if (px >= 0 && py >= 0 && px < w && py < h) {
        const q = (py * w + px) * 4;
        value = src[q + 3] ? lum(src[q], src[q + 1], src[q + 2]) : 1;
      }
      const r = Math.sqrt(1 - value) * 0.72 * (p.gain ?? 1);
      const dist = Math.hypot(u - cu, v - cv);
      const cov = clamp((r - dist) * size * cx.ppu * (1 / soft) + 0.5);
      if (p.mode === 'ink') {
        const [cr, cg, cb] = colRgb(p.color);
        d[k] = cr; d[k + 1] = cg; d[k + 2] = cb;
      }
      d[k + 3] = src[k + 3] * cov;
    }
}

// Fade: alpha falls off along a direction across the shape (for swatches and soft ends).
export function fade(buf, p, cx) {
  const polys = cx.polys || [];
  const b = polys.length ? polysBounds(polys) : { x0: -1, x1: 1, y0: -1, y1: 1 };
  const ang = (p.angle || 0) * DEG, ca = Math.cos(ang), sa = Math.sin(ang);
  const corners = [[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]].map(([x, y]) => x * ca + y * sa);
  const lo = Math.min(...corners), hi = Math.max(...corners);
  const s0 = p.start ?? 0.4, s1 = p.end ?? 1;
  const L = toLocalFn(cx), d = buf.data;
  for (let y = 0; y < buf.h; y++)
    for (let x = 0; x < buf.w; x++) {
      const k = (y * buf.w + x) * 4;
      if (!d[k + 3]) continue;
      const [lx, ly] = L(x, y);
      const t = ((lx * ca + ly * sa) - lo) / (hi - lo || 1);
      d[k + 3] *= 1 - smoothstep(s0, s1, t) * (p.amount ?? 1);
    }
}

// Colour adjust in OKLab: lightness shift, chroma scale, hue rotation.
export function adjust(buf, p) {
  const d = buf.data;
  const dl = p.lightness || 0, cs = p.chroma ?? 1, hr = (p.hue || 0) * DEG;
  const ch = Math.cos(hr), sh = Math.sin(hr);
  const s2l = (x) => (x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4));
  const l2s = (x) => (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055);
  for (let k = 0; k < d.length; k += 4) {
    if (!d[k + 3]) continue;
    const R = s2l(d[k] / 255), G = s2l(d[k + 1] / 255), B = s2l(d[k + 2] / 255);
    const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
    const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
    const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
    let L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s + dl;
    let A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
    let Bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
    [A, Bb] = [(A * ch - Bb * sh) * cs, (A * sh + Bb * ch) * cs];
    const l_ = L + 0.3963377774 * A + 0.2158037573 * Bb, m_ = L - 0.1055613458 * A - 0.0638541728 * Bb, s_ = L - 0.0894841775 * A - 1.291485548 * Bb;
    const l3 = l_ ** 3, m3 = m_ ** 3, s3 = s_ ** 3;
    d[k] = l2s(clamp(4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3)) * 255;
    d[k + 1] = l2s(clamp(-1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3)) * 255;
    d[k + 2] = l2s(clamp(-0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3)) * 255;
  }
}

// Noise paint: fills the shape's pixels with noise run through a colour ramp.
export function noisePaint(buf, paint, cx, table) {
  const f = fieldPx(buf, cx, noiseSampler(paint), finestPx(paint, cx));
  const d = buf.data;
  for (let i = 0; i < f.length; i++) {
    const k = i * 4;
    if (!d[k + 3]) continue;
    const t = Math.round(clamp(f[i]) * 255) * 4;
    d[k] = table[t]; d[k + 1] = table[t + 1]; d[k + 2] = table[t + 2];
    d[k + 3] = (d[k + 3] * table[t + 3]) / 255;
  }
}

export { TAU };
