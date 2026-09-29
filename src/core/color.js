// Colours are stored as OKLCH: l = perceived lightness 0..1 (the "value" of a colour),
// c = chroma (colourfulness, 0..~0.37), h = hue angle in degrees, a = alpha 0..1.
// OKLab/OKLCH is a colour space built so equal steps look equal, which makes
// value studies and mixing behave the way a painter expects.
import { clamp } from './math.js';

const lin2srgb = (x) => (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055);
const srgb2lin = (x) => (x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4));

function labToLin(L, a, b) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}
const inGamut = (c) => c[0] >= -1e-4 && c[0] <= 1.0001 && c[1] >= -1e-4 && c[1] <= 1.0001 && c[2] >= -1e-4 && c[2] <= 1.0001;

// Out-of-gamut colours lose chroma, never lightness, so values stay exact.
export function labToRgb(L, a, b) {
  L = clamp(L, 0, 1);
  let c = labToLin(L, a, b);
  if (!inGamut(c)) {
    let lo = 0, hi = 1;
    for (let i = 0; i < 12; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(labToLin(L, a * mid, b * mid))) lo = mid;
      else hi = mid;
    }
    c = labToLin(L, a * lo, b * lo);
  }
  return [0, 1, 2].map((i) => Math.round(clamp(lin2srgb(clamp(c[i]))) * 255));
}

export function rgbToLab(r, g, b) {
  const R = srgb2lin(r / 255), G = srgb2lin(g / 255), B = srgb2lin(b / 255);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

export const oklch = (l, c, h, a = 1) => ({ l, c, h, a });

export function lchToLab(col) {
  const r = (col.h * Math.PI) / 180;
  return [col.l, col.c * Math.cos(r), col.c * Math.sin(r)];
}
export function labToLch(L, a, b, alpha = 1) {
  const c = Math.hypot(a, b);
  let h = (Math.atan2(b, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { l: L, c, h: c < 1e-4 ? 0 : h, a: alpha };
}

const rgbCache = new Map();
export function toRgb(col) {
  const k = `${col.l.toFixed(4)},${col.c.toFixed(4)},${col.h.toFixed(2)}`;
  let v = rgbCache.get(k);
  if (!v) {
    v = labToRgb(...lchToLab(col));
    if (rgbCache.size > 4000) rgbCache.clear();
    rgbCache.set(k, v);
  }
  return v;
}
export function toCss(col, alphaMul = 1) {
  const [r, g, b] = toRgb(col);
  const a = (col.a ?? 1) * alphaMul;
  return a >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${+a.toFixed(4)})`;
}
export function toHex(col) {
  return '#' + toRgb(col).map((v) => v.toString(16).padStart(2, '0')).join('');
}
export function fromHex(hex, a = 1) {
  const v = hex.replace('#', '').trim();
  const s = v.length === 3 ? v.split('').map((c) => c + c).join('') : v.slice(0, 6);
  const n = parseInt(s, 16);
  if (Number.isNaN(n)) return null;
  const [L, A, B] = rgbToLab((n >> 16) & 255, (n >> 8) & 255, n & 255);
  return labToLch(L, A, B, a);
}

// Mix in OKLab so blends stay clean (no muddy grey middle).
export function mix(c1, c2, t) {
  const a = lchToLab(c1), b = lchToLab(c2);
  const L = a[0] + (b[0] - a[0]) * t, A = a[1] + (b[1] - a[1]) * t, B = a[2] + (b[2] - a[2]) * t;
  return labToLch(L, A, B, (c1.a ?? 1) + ((c2.a ?? 1) - (c1.a ?? 1)) * t);
}

// A colour ramp: sorted stops [{t, color}] -> colour at t. Returns RGBA 0..255 via a 256-entry table.
export function rampTable(stops) {
  const s = [...stops].sort((a, b) => a.t - b.t);
  const out = new Uint8ClampedArray(256 * 4);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let col;
    if (t <= s[0].t) col = s[0].color;
    else if (t >= s[s.length - 1].t) col = s[s.length - 1].color;
    else {
      let k = 0;
      while (k < s.length - 2 && t > s[k + 1].t) k++;
      const u = (t - s[k].t) / (s[k + 1].t - s[k].t || 1);
      col = mix(s[k].color, s[k + 1].color, u);
    }
    const [r, g, b] = toRgb(col);
    out.set([r, g, b, Math.round((col.a ?? 1) * 255)], i * 4);
  }
  return out;
}

export function sampleRamp(stops, t) {
  const s = [...stops].sort((a, b) => a.t - b.t);
  if (t <= s[0].t) return s[0].color;
  if (t >= s[s.length - 1].t) return s[s.length - 1].color;
  let k = 0;
  while (k < s.length - 2 && t > s[k + 1].t) k++;
  return mix(s[k].color, s[k + 1].color, (t - s[k].t) / (s[k + 1].t - s[k].t || 1));
}

// Relative luminance-ish lightness of an sRGB pixel, 0..1 (OKLab L).
export function pixelL(r, g, b) {
  return rgbToLab(r, g, b)[0];
}
