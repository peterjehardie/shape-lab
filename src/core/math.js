// 2D affine matrices as plain arrays [a, b, c, d, e, f]:
//   x' = a*x + c*y + e
//   y' = b*x + d*y + f
// Same layout as Canvas setTransform and SVG matrix(), so the core stays portable.

export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;
export const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a || 1e-9));
  return t * t * (3 - 2 * t);
};
export const fract = (x) => x - Math.floor(x);

export const identity = () => [1, 0, 0, 1, 0, 0];

export function mul(m, n) {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

export function invert(m) {
  const det = m[0] * m[3] - m[1] * m[2] || 1e-12;
  const a = m[3] / det, b = -m[1] / det, c = -m[2] / det, d = m[0] / det;
  return [a, b, c, d, -(a * m[4] + c * m[5]), -(b * m[4] + d * m[5])];
}

export const apply = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
export const applyVec = (m, x, y) => [m[0] * x + m[2] * y, m[1] * x + m[3] * y];

// Local transform of a node: translate, then rotate, then scale (with optional skew on x).
export function fromTransform(t) {
  if (!t) return identity();
  const r = (t.rot || 0) * DEG;
  const cs = Math.cos(r), sn = Math.sin(r);
  const sx = t.sx ?? 1, sy = t.sy ?? 1;
  const k = Math.tan((t.skew || 0) * DEG);
  // R * K * S, where K = [1, 0, k, 1]
  return [cs * sx, sn * sx, (cs * k - sn) * sy, (sn * k + cs) * sy, t.x || 0, t.y || 0];
}

// Mean scale factor of a matrix (for turning local sizes into pixels).
export const meanScale = (m) => Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) || 1e-9;

export function rotateAround(x, y, cx, cy, ang) {
  const c = Math.cos(ang), s = Math.sin(ang);
  const dx = x - cx, dy = y - cy;
  return [cx + dx * c - dy * s, cy + dx * s + dy * c];
}

export const emptyBounds = () => ({ x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity });
export function addPoint(b, x, y) {
  if (x < b.x0) b.x0 = x;
  if (y < b.y0) b.y0 = y;
  if (x > b.x1) b.x1 = x;
  if (y > b.y1) b.y1 = y;
  return b;
}
export const boundsValid = (b) => b.x1 >= b.x0 && b.y1 >= b.y0;
export function unionBounds(a, b) {
  return { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) };
}
export function transformBounds(m, b) {
  const r = emptyBounds();
  for (const [x, y] of [[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]]) addPoint(r, ...apply(m, x, y));
  return r;
}
