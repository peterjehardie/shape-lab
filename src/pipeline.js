// Geometry pipeline: structure -> shapes -> distortion. Each stage is cached per layer so
// changing a colour never regenerates trees, and editing the graph never re-grows them.
import { KINDS } from './structures.js';
import { Rng, noiseFor } from './rng.js';
import { hashInts, hashStr } from './util.js';
import { makeShape, wobble, measureRoundness, VOCAB_SETS, densify, bbox, centroid, signedArea } from './geom.js';
import { LAYER_SECTIONS, kindParams, layerDepth } from './scene.js';

const DISTORT_KEYS = ['distort', 'layerNoise', 'layerNoiseScale'];
const genCache = new Map();
const distCache = new Map();

function genKey(layer, scene, W, H) {
  const keys = {};
  for (const s of LAYER_SECTIONS) for (const spec of s.params) if (spec.geo && !DISTORT_KEYS.includes(spec.key)) keys[spec.key] = layer.p[spec.key];
  for (const spec of kindParams(layer.kind)) keys[spec.key] = layer.p[spec.key];
  return JSON.stringify([layer.kind, layer.seed, scene.globals.seed, W, H, keys]);
}

export function graphHash(graph) {
  return hashStr(JSON.stringify([graph.nodes.map((n) => [n.id, n.type, n.params, n.ins]), graph.links]));
}

function generate(layer, scene, W, H) {
  const p = layer.p;
  const u = Math.min(W, H) / 900;
  const rng = new Rng(hashInts(scene.globals.seed, layer.seed));
  // Shapes draw from their own random stream, so swapping the vocabulary keeps the structure.
  const shapeRng = new Rng(hashInts(scene.globals.seed, layer.seed, 99));
  const noise = noiseFor(hashInts(scene.globals.seed, layer.seed, 7));
  const items = [];
  const debug = { lines: [], points: [] };
  let ob = 0, cl = 0;
  const vocab = VOCAB_SETS[p.vocab] || [p.vocab];
  const c = {
    W, H, u, p, rng, noise, debug,
    newOb: () => ++ob,
    newCl: () => ++cl,
    shape(x, y, size, o = {}) {
      const t = o.type || shapeRng.pick(vocab);
      const s = Math.max(0.6 * u, o.fixed ? size : size * p.shapeSize * (1 + p.sizeJitter * shapeRng.signed() * 0.8));
      const a = (o.angle || 0) + (o.fixed ? 0 : p.rotJitter * shapeRng.signed() * Math.PI);
      const shp = makeShape(t, x, y, s, a, shapeRng, o);
      const round = measureRoundness(shp.poly);
      if (p.shapeNoise > 0) wobble(shp.poly, x, y, s, p.shapeNoise, p.shapeNoiseScale, noise, shapeRng.range(0, 500));
      items.push({ poly: shp.poly, corners: shp.corners, round, ob: o.ob || 0, cl: o.cl || 0, col: o.col, lOff: o.lOff || 0, kind: 'shape', shapeType: t });
    },
    mass(poly, o = {}) {
      items.push({ poly, kind: 'mass', ob: o.ob || 0, cl: o.cl || 0, facets: o.facets || null, fade: o.fade || null, vol: o.vol || null, n3: o.n3 || null, round: o.round ?? 0, fixedRound: true, ground: !!o.ground, col: o.col, lOff: o.lOff || 0 });
    },
    limb(x0, y0, x1, y1, w0, w1, o = {}) {
      const dx = x1 - x0, dy = y1 - y0;
      const l = Math.hypot(dx, dy) || 1;
      const nx = -dy / l, ny = dx / l, tx = dx / l, ty = dy / l;
      const a0 = w0 / 2, a1 = w1 / 2;
      const poly = [[x0 + nx * a0, y0 + ny * a0], [x1 + nx * a1, y1 + ny * a1]];
      for (let k = 1; k < 4; k++) {
        const t = (k / 4) * Math.PI;
        poly.push([x1 + (nx * Math.cos(t) + tx * Math.sin(t)) * a1, y1 + (ny * Math.cos(t) + ty * Math.sin(t)) * a1]);
      }
      poly.push([x1 - nx * a1, y1 - ny * a1], [x0 - nx * a0, y0 - ny * a0]);
      items.push({ poly, kind: 'limb', ob: o.ob || 0, cl: o.cl || 0, col: o.col, round: 0.8, fixedRound: true, vol: { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, r: Math.max(a0, a1) * 1.3 }, lOff: 0 });
    },
  };
  (KINDS[layer.kind] || KINDS.clouds).generate(c);
  return { items, debug };
}

function finalize(item) {
  // One winding direction for every outline: outward normals and unions then just work.
  if (signedArea(item.poly) < 0) {
    const n = item.poly.length;
    item.poly.reverse();
    if (item.corners) item.corners = item.corners.map((i) => n - 1 - i).reverse();
  }
  const bb = bbox(item.poly);
  item.bb = bb;
  item.c = centroid(item.poly);
  item.r = Math.max(bb.x1 - bb.x0, bb.y1 - bb.y0) / 2 || 1;
  item.p2d = null;
  return item;
}

function displace(gen, layer, scene, graphFn, W, H, depth) {
  const p = layer.p;
  const u = Math.min(W, H) / 900;
  const useGraph = graphFn && p.distort !== 0;
  const useNoise = p.layerNoise > 0;
  const nz = noiseFor(hashInts(layer.seed, 31));
  const ctx = { x: 0, y: 0, depth, aspect: W / H };
  const sc = p.layerNoiseScale;
  const D = (pt) => {
    let dx = 0, dy = 0;
    if (useGraph) {
      ctx.x = pt[0] / W;
      ctx.y = pt[1] / H;
      const r = graphFn(ctx);
      dx += r[0] * p.distort * u;
      dy += r[1] * p.distort * u;
    }
    if (useNoise) {
      const X = (pt[0] / H) * sc, Y = (pt[1] / H) * sc;
      dx += nz.fbm(X, Y, 3) * p.layerNoise * u;
      dy += nz.fbm(X + 17.3, Y - 9.1, 3) * p.layerNoise * u;
    }
    return [pt[0] + dx, pt[1] + dy];
  };
  const moving = useGraph || useNoise;
  const items = gen.items.map((it) => {
    const out = { ...it };
    if (moving) {
      const src = it.kind === 'mass' ? densify(it.poly, 14 * u) : it.poly;
      out.poly = src.map(D);
      if (it.facets) out.facets = it.facets.map((f) => ({ n3: f.n3, poly: densify(f.poly, 14 * u).map(D) }));
      if (it.vol) {
        const v = D([it.vol.cx, it.vol.cy]);
        out.vol = { cx: v[0], cy: v[1], r: it.vol.r };
      }
    } else {
      out.poly = it.poly.map((q) => [q[0], q[1]]);
      if (it.facets) out.facets = it.facets.map((f) => ({ n3: f.n3, poly: f.poly }));
    }
    if (out.corners) out.corners = [...out.corners];
    return finalize(out);
  });
  const debug = moving
    ? { lines: gen.debug.lines.map((l) => l.map(D)), points: gen.debug.points.map((q) => [...D(q), q[2]]) }
    : gen.debug;
  return { items, debug, groups: {} };
}

export function buildGeometry(layer, scene, graphFn, gHash, W, H) {
  const gk = genKey(layer, scene, W, H);
  let g = genCache.get(layer.id);
  if (!g || g.key !== gk) {
    g = { key: gk, gen: generate(layer, scene, W, H) };
    genCache.set(layer.id, g);
  }
  const depth = layerDepth(scene, layer);
  const dk = `${gk}|${gHash}|${DISTORT_KEYS.map((k) => layer.p[k]).join(',')}|${depth.toFixed(4)}`;
  let d = distCache.get(layer.id);
  if (!d || d.key !== dk) {
    d = { key: dk, geo: displace(g.gen, layer, scene, graphFn, W, H, depth) };
    distCache.set(layer.id, d);
  }
  return d.geo;
}

export function dropCache(layerId) {
  genCache.delete(layerId);
  distCache.delete(layerId);
}

// Shape groups: the same items can be grouped by shape, cluster, object or layer.
// Groups drive outline unions, volume lighting and shadow-clone picks.
export function groupKey(item, i, mode) {
  if (mode === 'shape') return `i${i}`;
  if (mode === 'cluster') return `c${item.cl}`;
  if (mode === 'object') return `o${item.ob}`;
  return 'L';
}

export function groupsFor(geo, mode) {
  if (geo.groups[mode]) return geo.groups[mode];
  const keys = [];
  const acc = new Map();
  geo.items.forEach((it, i) => {
    const k = it.ground && mode === 'layer' ? `g${i}` : groupKey(it, i, mode);
    keys.push(k);
    let a = acc.get(k);
    if (!a) acc.set(k, (a = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity, n: 0 }));
    const b = it.bb;
    // Offscreen ground bottoms would drag layer-wide volumes down; clip to the frame.
    a.x0 = Math.min(a.x0, b.x0); a.y0 = Math.min(a.y0, b.y0);
    a.x1 = Math.max(a.x1, b.x1); a.y1 = Math.max(a.y1, it.kind === 'mass' ? Math.min(b.y1, it.c[1] + it.r * 0.3) : b.y1);
    a.n++;
  });
  const map = new Map();
  for (const [k, a] of acc) map.set(k, { cx: (a.x0 + a.x1) / 2, cy: (a.y0 + a.y1) / 2, r: Math.max(a.x1 - a.x0, a.y1 - a.y0) / 2 || 1, n: a.n });
  return (geo.groups[mode] = { keys, map });
}
