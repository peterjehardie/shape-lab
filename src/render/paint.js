// Paint -> Canvas fill styles. Gradients are built with extra stops mixed in OKLab,
// so a blend between two colours stays clean instead of passing through grey.

import { toCss, mix } from '../core/color.js';
import { polysBounds } from '../core/path.js';
import { DEG } from '../core/math.js';

export const makeCanvas = (w, h) => {
  const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(Math.max(1, w), Math.max(1, h)) : Object.assign(document.createElement('canvas'), { width: Math.max(1, w), height: Math.max(1, h) });
  return c;
};

function addStops(g, stops) {
  const s = [...stops].sort((a, b) => a.t - b.t);
  for (let i = 0; i < s.length; i++) {
    g.addColorStop(Math.min(1, Math.max(0, s[i].t)), toCss(s[i].color));
    if (i < s.length - 1)
      for (let k = 1; k < 6; k++) {
        const u = k / 6;
        g.addColorStop(Math.min(1, Math.max(0, s[i].t + (s[i + 1].t - s[i].t) * u)), toCss(mix(s[i].color, s[i + 1].color, u)));
      }
  }
}

// ---- assets (swatch images) ----
const images = new Map();
let onImageLoad = () => {};
export const setImageLoadHandler = (fn) => (onImageLoad = fn);

export function assetImage(asset) {
  if (!asset?.data) return null;
  let e = images.get(asset.data);
  if (!e) {
    e = { img: null, ready: false };
    images.set(asset.data, e);
    if (typeof Image !== 'undefined') {
      const img = new Image();
      img.onload = () => {
        e.ready = true;
        onImageLoad();
      };
      img.src = asset.data;
      e.img = img;
    }
  }
  return e.ready ? e.img : null;
}

// ---- patterns ----
const tiles = new Map();
function patternTile(p, px) {
  const size = Math.max(2, Math.round(p.size * px));
  const key = [p.pattern, size, p.weight, toCss(p.fg), toCss(p.bg)].join('|');
  let t = tiles.get(key);
  if (t) return t;
  const kind = p.pattern;
  const W = kind === 'bricks' ? size * 2 : size;
  const c = makeCanvas(W, size);
  const g = c.getContext('2d');
  g.fillStyle = toCss(p.bg);
  g.fillRect(0, 0, W, size);
  g.fillStyle = g.strokeStyle = toCss(p.fg);
  const w = Math.max(0.5, p.weight * size);
  switch (kind) {
    case 'lines': g.fillRect(0, 0, W, w); break;
    case 'grid': g.fillRect(0, 0, W, w / 2); g.fillRect(0, 0, w / 2, size); g.fillRect(0, size - w / 2, W, w / 2); g.fillRect(W - w / 2, 0, w / 2, size); break;
    case 'dots': g.beginPath(); g.arc(size / 2, size / 2, (w / 2) * 1.2, 0, Math.PI * 2); g.fill(); break;
    case 'checker': g.fillRect(0, 0, size / 2, size / 2); g.fillRect(size / 2, size / 2, size / 2, size / 2); break;
    case 'cross': g.lineWidth = w / 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(size, size); g.moveTo(size, 0); g.lineTo(0, size); g.stroke(); break;
    case 'waves': {
      g.lineWidth = w / 2;
      g.beginPath();
      for (let x = 0; x <= size; x++) g.lineTo(x, size / 2 + Math.sin((x / size) * Math.PI * 2) * size * 0.25);
      g.stroke();
      break;
    }
    case 'bricks': {
      const m = Math.max(0.5, w / 3);
      g.fillRect(0, 0, W, m); g.fillRect(0, size / 2, W, m);
      g.fillRect(0, 0, m, size / 2); g.fillRect(size, size / 2, m, size / 2);
      break;
    }
  }
  t = { canvas: c, size };
  if (tiles.size > 200) tiles.clear();
  tiles.set(key, t);
  return t;
}

// Returns something usable as fillStyle, in the local space of `polys`.
// px = device pixels per local unit (for pattern crispness).
export function fillStyleFor(ctx, paint, polys, px, doc) {
  if (!paint) return null;
  switch (paint.type) {
    case 'solid': return toCss(paint.color);
    case 'linear': {
      const b = polysBounds(polys);
      const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
      const a = (paint.angle ?? 90) * DEG, dx = Math.cos(a), dy = Math.sin(a);
      const half = (Math.abs(dx) * (b.x1 - b.x0) + Math.abs(dy) * (b.y1 - b.y0)) / 2 || 1;
      const g = ctx.createLinearGradient(cx - dx * half, cy - dy * half, cx + dx * half, cy + dy * half);
      addStops(g, paint.stops);
      return g;
    }
    case 'radial': {
      const b = polysBounds(polys);
      const w = b.x1 - b.x0, h = b.y1 - b.y0;
      const cx = b.x0 + w * (paint.cx ?? 0.5), cy = b.y0 + h * (paint.cy ?? 0.5);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(1, (paint.r ?? 0.6) * Math.max(w, h)));
      addStops(g, paint.stops);
      return g;
    }
    case 'pattern': {
      const t = patternTile(paint, px);
      const pat = ctx.createPattern(t.canvas, 'repeat');
      const s = paint.size / t.size;
      const a = (paint.angle || 0) * DEG;
      if (pat.setTransform && typeof DOMMatrix !== 'undefined') pat.setTransform(new DOMMatrix([Math.cos(a) * s, Math.sin(a) * s, -Math.sin(a) * s, Math.cos(a) * s, 0, 0]));
      return pat;
    }
    case 'swatch': {
      const asset = doc?.assets?.[paint.asset];
      const img = assetImage(asset);
      if (!img) return 'rgba(128,128,128,0.25)';
      const pat = ctx.createPattern(img, 'repeat');
      const s = (paint.scale || 1) * ((asset.unit || 1) / 1);
      const a = (paint.angle || 0) * DEG;
      if (pat.setTransform && typeof DOMMatrix !== 'undefined') pat.setTransform(new DOMMatrix([Math.cos(a) * s, Math.sin(a) * s, -Math.sin(a) * s, Math.cos(a) * s, 0, 0]));
      return pat;
    }
    case 'noise':
      return '#fff'; // filled as a mask; the renderer replaces the pixels
  }
  return null;
}
