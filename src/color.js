// Colour in OKLab: L is perceived lightness (the "value" of a colour), a/b hold hue and
// chroma. Working in this space means a value group really is a lightness band.
import { clamp, lerp } from './util.js';

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

export function hexToRgb(hex) {
  const v = hex.replace('#', '');
  const n = parseInt(v.length === 3 ? v.split('').map((c) => c + c).join('') : v, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export const hexToLab = (hex) => rgbToLab(...hexToRgb(hex));
export const rgbCss = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;
export const labCss = (L, a, b) => rgbCss(labToRgb(L, a, b));
export const hueAB = (hDeg, C) => [C * Math.cos((hDeg * Math.PI) / 180), C * Math.sin((hDeg * Math.PI) / 180)];

// A style turns a "shade" (-1 = full shadow, +1 = full light) into a colour.
// Two kinds share one cache and interface:
//  - makeStyle: free colour. Lightness moves inside a value band; hue drifts warm in light, cool in shadow.
//  - makeRampStyle: palette colour. Shade walks along a role's five-step ramp.
function styleCore(o, labOf) {
  const cache = new Map();
  const shadeMap = (shade) => {
    let s = clamp(shade * o.strength + o.bias, -1, 1);
    if (o.steps >= 2) {
      const n = o.steps;
      s = (Math.round(((s + 1) / 2) * (n - 1)) / (n - 1)) * 2 - 1;
    }
    return s;
  };
  function lab(shade, lOff = 0, hr = 0) {
    let [L, a, b] = labOf(shadeMap(shade));
    L += lOff;
    if (hr) {
      const c = Math.cos((hr * Math.PI) / 180), sn = Math.sin((hr * Math.PI) / 180);
      [a, b] = [a * c - b * sn, a * sn + b * c];
    }
    if (o.grey) a = b = 0;
    return [L, a, b];
  }
  function rgb(shade, lOff = 0, hr = 0) {
    const hq = Math.round(hr / 2) * 2;
    const key = `${Math.round(shade * 128)}|${Math.round(lOff * 200)}|${hq}`;
    let c = cache.get(key);
    if (!c) {
      const q = lab(Math.round(shade * 128) / 128, Math.round(lOff * 200) / 200, hq);
      const r = labToRgb(q[0], q[1], q[2]);
      c = { rgb: r, css: rgbCss(r) };
      cache.set(key, c);
    }
    return c;
  }
  return {
    L: labOf(0)[0],
    css: (shade, lOff, hr) => rgb(shade, lOff, hr).css,
    rgb: (shade, lOff, hr) => rgb(shade, lOff, hr).rgb,
    lab,
    steps: o.steps,
  };
}

export function makeStyle(o) {
  return styleCore(o, (s) => {
    const L = o.L + o.spread * s;
    let a = o.ab[0], b = o.ab[1];
    if (s > 0) {
      const w = o.sunWarm * s * 0.6;
      a = lerp(a, o.sunAB[0], w);
      b = lerp(b, o.sunAB[1], w);
    } else {
      const w = o.shadowCool * -s * 0.6;
      a = lerp(a, o.shadowAB[0], w);
      b = lerp(b, o.shadowAB[1], w);
    }
    return [L, a, b];
  });
}

// o.ramp: five OKLab colours (shadow to light); o.pos: where "no shading" sits (2 = base);
// o.spread: how many steps full light or full shadow moves; o.haze: {lab, t, desat}.
export function makeRampStyle(o) {
  return styleCore(o, (s) => {
    const pos = clamp(o.pos + s * o.spread, 0, 4);
    const i = Math.min(3, Math.floor(pos)), f = pos - i;
    const A = o.ramp[i], B = o.ramp[i + 1];
    let L = lerp(A[0], B[0], f), a = lerp(A[1], B[1], f), b = lerp(A[2], B[2], f);
    const h = o.haze;
    if (h && h.t > 0) {
      L = lerp(L, h.lab[0], h.t);
      a = lerp(a, h.lab[1], h.t) * (1 - (h.desat || 0) * h.t);
      b = lerp(b, h.lab[2], h.t) * (1 - (h.desat || 0) * h.t);
    }
    return [L + (o.lOff || 0), a, b];
  });
}
