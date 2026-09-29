// Boolean operations (union, subtract, intersect, exclude) and offsetting (grow/shrink an outline).
// Wraps Clipper, a polygon clipping library by Angus Johnson (vendor/clipper.js, Boost licence).
// The browser loads it as a global; other hosts call setClipper().

let CL = globalThis.ClipperLib || null;
export const setClipper = (lib) => (CL = lib);

const SCALE = 100; // Clipper works in integers; 1/100 unit precision.

function toClip(polys) {
  return polys
    .filter((p) => p.closed && p.pts.length >= 6)
    .map((p) => {
      const out = [];
      for (let i = 0; i < p.pts.length; i += 2) out.push({ X: Math.round(p.pts[i] * SCALE), Y: Math.round(p.pts[i + 1] * SCALE) });
      return out;
    });
}
function fromClip(paths) {
  return paths
    .filter((p) => p.length >= 3)
    .map((p) => {
      const pts = [];
      for (const q of p) pts.push(q.X / SCALE, q.Y / SCALE);
      return { pts, closed: true };
    });
}

const OPS = () => ({
  union: CL.ClipType.ctUnion,
  subtract: CL.ClipType.ctDifference,
  intersect: CL.ClipType.ctIntersection,
  exclude: CL.ClipType.ctXor,
});

// subject, clip: lists of polys. Returns polys.
export function boolOp(op, subject, clip) {
  if (!CL) return op === 'subtract' || op === 'intersect' ? subject : [...subject, ...clip];
  const c = new CL.Clipper();
  c.AddPaths(toClip(subject), CL.PolyType.ptSubject, true);
  c.AddPaths(toClip(clip), CL.PolyType.ptClip, true);
  const sol = new CL.Paths();
  c.Execute(OPS()[op], sol, CL.PolyFillType.pftNonZero, CL.PolyFillType.pftNonZero);
  return fromClip(sol);
}

// Combine a list of poly-groups (one per child, bottom first) with one operation.
// union: all merged. subtract: first minus the rest. intersect: common area of all. exclude: odd overlaps.
export function combine(op, groups) {
  if (!groups.length) return [];
  let acc = groups[0];
  if (op === 'subtract') {
    const rest = groups.slice(1).flat();
    return rest.length ? boolOp('subtract', acc, rest) : acc;
  }
  if (groups.length === 1) return op === 'union' ? boolOp('union', acc, []) : acc;
  for (let i = 1; i < groups.length; i++) acc = boolOp(op, acc, groups[i]);
  return acc;
}

export function offsetPolys(polys, delta, join = 'round') {
  if (!CL || !delta) return polys;
  const co = new CL.ClipperOffset(2, 0.25 * SCALE);
  const jt = join === 'miter' ? CL.JoinType.jtMiter : join === 'square' ? CL.JoinType.jtSquare : CL.JoinType.jtRound;
  const closed = toClip(polys);
  co.AddPaths(closed, jt, CL.EndType.etClosedPolygon);
  const open = polys.filter((p) => !p.closed);
  for (const p of open) {
    const q = [];
    for (let i = 0; i < p.pts.length; i += 2) q.push({ X: Math.round(p.pts[i] * SCALE), Y: Math.round(p.pts[i + 1] * SCALE) });
    co.AddPath(q, jt, CL.EndType.etOpenRound);
  }
  const sol = new CL.Paths();
  co.Execute(sol, delta * SCALE);
  return fromClip(sol);
}

// Clean self-overlaps into a proper outline (used after heavy warps).
export function cleanUnion(polys) {
  if (!CL) return polys;
  return boolOp('union', polys, []);
}

export const hasClipper = () => !!CL;
