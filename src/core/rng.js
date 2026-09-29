// Seeded randomness and 2D simplex noise (carried from gen1).
export class Rng {
  constructor(seed) {
    this.s = seed >>> 0 || 1;
  }
  next() {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a, b) {
    return a + (b - a) * this.next();
  }
  int(a, b) {
    return Math.floor(this.range(a, b + 1));
  }
  pick(arr) {
    return arr[Math.floor(this.next() * arr.length)];
  }
  signed() {
    return this.next() * 2 - 1;
  }
  chance(p) {
    return this.next() < p;
  }
}

// Stable per-item random number in 0..1 from integers (no state).
export function hash01(a, b = 0, c = 0) {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// A new seed for dice buttons.
export const newSeed = () => (Math.random() * 1e6) | 0;

const GRAD = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];
const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;

export function makeNoise(seed) {
  const rng = new Rng(seed);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];

  // Simplex noise, roughly -1..1.
  function n2(xin, yin) {
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const x0 = xin - (i - t);
    const y0 = yin - (j - t);
    const i1 = x0 > y0 ? 1 : 0;
    const j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    let n = 0;
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 > 0) { const g = GRAD[perm[ii + perm[jj]] & 7]; t0 *= t0; n += t0 * t0 * (g[0] * x0 + g[1] * y0); }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 > 0) { const g = GRAD[perm[ii + i1 + perm[jj + j1]] & 7]; t1 *= t1; n += t1 * t1 * (g[0] * x1 + g[1] * y1); }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 > 0) { const g = GRAD[perm[ii + 1 + perm[jj + 1]] & 7]; t2 *= t2; n += t2 * t2 * (g[0] * x2 + g[1] * y2); }
    return 64 * n;
  }
  // Layered noise ("octaves"): big soft shapes plus finer detail. Roughly -1..1.
  function fbm(x, y, oct = 4, lac = 2, gain = 0.5) {
    let a = 1, f = 1, s = 0, norm = 0;
    for (let o = 0; o < oct; o++) {
      s += a * n2(x * f + o * 17.3, y * f - o * 9.1);
      norm += a;
      a *= gain;
      f *= lac;
    }
    return s / norm;
  }
  // 0..1 with sharp crests, like veins or cracks.
  function ridged(x, y, oct = 4, lac = 2, gain = 0.5) {
    let a = 1, f = 1, s = 0, norm = 0;
    for (let o = 0; o < oct; o++) {
      const v = 1 - Math.abs(n2(x * f + o * 17.3, y * f - o * 9.1));
      s += a * v * v;
      norm += a;
      a *= gain;
      f *= lac;
    }
    return s / norm;
  }
  // 0..1, billowy (absolute value of noise), like clouds or cauliflower.
  function billow(x, y, oct = 4, lac = 2, gain = 0.5) {
    let a = 1, f = 1, s = 0, norm = 0;
    for (let o = 0; o < oct; o++) {
      s += a * Math.abs(n2(x * f + o * 17.3, y * f - o * 9.1));
      norm += a;
      a *= gain;
      f *= lac;
    }
    return s / norm;
  }
  // 0..1 distance to the nearest random cell point, like pebbles or cells.
  function cells(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    let d1 = 9;
    for (let j = -1; j <= 1; j++)
      for (let i = -1; i <= 1; i++) {
        const cx = xi + i, cy = yi + j;
        const h = perm[(cx & 255) + perm[cy & 255]];
        const px = cx + ((h * 37) % 256) / 256, py = cy + ((h * 91) % 256) / 256;
        const d = (px - x) ** 2 + (py - y) ** 2;
        if (d < d1) d1 = d;
      }
    return Math.min(1, Math.sqrt(d1));
  }
  return { n2, fbm, ridged, billow, cells };
}

const cache = new Map();
export function noiseFor(seed) {
  let n = cache.get(seed);
  if (!n) {
    n = makeNoise(seed);
    if (cache.size > 300) cache.clear();
    cache.set(seed, n);
  }
  return n;
}

// One call for every noise kind, returning 0..1. Used by fields, paints and effects.
export function sampleNoise(nz, kind, x, y, oct) {
  switch (kind) {
    case 'ridged': return nz.ridged(x, y, oct);
    case 'billow': return nz.billow(x, y, oct);
    case 'cells': return nz.cells(x, y);
    case 'simple': return nz.n2(x, y) * 0.5 + 0.5;
    default: return nz.fbm(x, y, oct) * 0.5 + 0.5;
  }
}
