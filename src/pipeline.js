// Geometry pipeline: structure -> shapes -> edits -> distortion. Each stage is cached per
// layer (and per picture size), so changing a colour never regenerates trees, and
// editing the graph never re-grows them.
import { KINDS } from './structures.js';
import { Rng, noiseFor } from './rng.js';
import { hashInts, hashStr, hash01 } from './util.js';
import { makeShape, wobble, roughen, measureRoundness, VOCAB_SETS, densify, bbox, centroid, signedArea, ribbon, resample } from './geom.js';
import { LAYER_SECTIONS, kindParams, layerDepth } from './scene.js';

const DISTORT_KEYS = ['distort', 'layerNoise', 'layerNoiseScale', 'graphValue', 'graphSize', 'graphDensity', 'offX', 'offY'];
const genCache = new Map();
const distCache = new Map();

function genKey(layer, scene, W, H) {
  const keys = {};
  for (const s of LAYER_SECTIONS) for (const spec of s.params) if (spec.geo && !DISTORT_KEYS.includes(spec.key)) keys[spec.key] = layer.p[spec.key];
  for (const spec of kindParams(layer.kind)) keys[spec.key] = layer.p[spec.key];
  const reseeds = {};
  for (const [ob, e] of Object.entries(layer.p.edits || {})) if (e.seed) reseeds[ob] = e.seed;
  return JSON.stringify([layer.kind, layer.seed, scene.globals.seed, W, H, keys, layer.p.extras || [], layer.p.drawn || [], reseeds]);
}

export function graphHash(graph) {
  return hashStr(JSON.stringify([graph.nodes.map((n) => [n.id, n.type, n.params, n.ins]), graph.links]));
}

export const AUX = 100000; // object ids from here up are grounds and other helpers

function generate(layer, scene, W, H) {
  const p = layer.p;
  const u = Math.min(W, H) / 900;
  const base = hashInts(scene.globals.seed, layer.seed);
  let rng = new Rng(base);
  // Shapes draw from their own random stream, so swapping the vocabulary keeps the structure.
  let shapeRng = new Rng(hashInts(base, 99));
  const noise = noiseFor(hashInts(base, 7));
  const items = [];
  const debug = { lines: [], points: [] };
  let aux = AUX, cl = 0;
  const vocab = VOCAB_SETS[p.vocab] || [p.vocab];
  const edits = p.edits || {};
  const c = {
    W, H, u, p, noise, debug,
    get rng() { return rng; },
    newOb: () => ++aux,
    newCl: () => ++cl,
    // Each object gets its own random streams, keyed by its id: adding, moving or
    // reseeding one object never changes the others.
    scope(id, fn) {
      const r0 = rng, s0 = shapeRng;
      const re = edits[id]?.seed || 0;
      rng = new Rng(hashInts(base, id, re, 1));
      shapeRng = new Rng(hashInts(base, id, re, 2));
      try { fn(rng); } finally { rng = r0; shapeRng = s0; }
    },
    // Anchors = the places objects stand. Extras are ones the user added by clicking.
    extras: (p.extras || []).map((e, i) => ({ id: 1000 + i, x: e[0] * W, y: e[1] * H, extra: true })),
    shape(x, y, size, o = {}) {
      const t = o.type || shapeRng.pick(vocab);
      const s = Math.max(0.6 * u, o.fixed ? size : size * p.shapeSize * (1 + p.sizeJitter * shapeRng.signed() * 0.8));
      const a = (o.angle || 0) + (o.fixed || o.keepAngle ? 0 : p.rotJitter * shapeRng.signed() * Math.PI);
      const shp = makeShape(t, x, y, s, a, shapeRng, o);
      const round = measureRoundness(shp.poly);
      if (p.shapeNoise > 0 && !o.noWobble) {
        if (p.edgeStyle === 'rough') {
          // rough edges need even, dense points to tear nicely
          shp.poly = resample(shp.poly, 160);
          shp.corners = null;
          roughen(shp.poly, x, y, p.shapeNoise * 2, p.shapeNoiseScale, shapeRng);
        } else wobble(shp.poly, x, y, s, p.shapeNoise, p.shapeNoiseScale, noise, shapeRng.range(0, 500));
      }
      items.push({ poly: shp.poly, corners: shp.corners, round, ob: o.ob || 0, cl: o.cl || 0, col: o.col, lOff: o.lOff || 0, kind: 'shape', detail: !!o.detail, rid: shapeRng.next(), area: s * s });
    },
    mass(poly, o = {}) {
      items.push({ poly, kind: 'mass', ob: o.ob || 0, cl: o.cl || 0, facets: o.facets || null, fade: o.fade || null, vol: o.vol || null, n3: o.n3 || null, round: o.round ?? 0, fixedRound: true, ground: !!o.ground, grad: o.grad || null, col: o.col, lOff: o.lOff || 0, rid: 0 });
    },
    // A whole branch as one tapered shape along a centre line (no joints between segments).
    branch(pts, widths, o = {}) {
      if (pts.length < 2) return;
      items.push({ poly: ribbon(pts, widths), spine: pts.map((q, i) => [q[0], q[1], widths[i]]), kind: 'branch', ob: o.ob || 0, cl: o.cl || 0, col: o.col, round: 0.8, fixedRound: true, lOff: 0, rid: 0 });
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

// Per-object edits: move, scale about the object's foot, hide.
function applyEdits(items, p, W, H) {
  const edits = p.edits || {};
  const ids = Object.keys(edits).filter((k) => { const e = edits[k]; return e.hide || e.dx || e.dy || (e.s && e.s !== 1); });
  const offX = (p.offX || 0) * W, offY = (p.offY || 0) * H;
  if (!ids.length && !offX && !offY) return items;
  const foot = new Map();
  for (const it of items) {
    if (!edits[it.ob]) continue;
    const b = bbox(it.poly);
    const f = foot.get(it.ob) || { x0: Infinity, x1: -Infinity, y1: -Infinity };
    f.x0 = Math.min(f.x0, b.x0); f.x1 = Math.max(f.x1, b.x1); f.y1 = Math.max(f.y1, b.y1);
    foot.set(it.ob, f);
  }
  const out = [];
  for (const it of items) {
    const e = edits[it.ob];
    if (e?.hide) continue;
    let T = null;
    if (e && (e.dx || e.dy || (e.s && e.s !== 1))) {
      const f = foot.get(it.ob);
      const ax = (f.x0 + f.x1) / 2, ay = f.y1, s = e.s || 1;
      const dx = (e.dx || 0) * W + offX, dy = (e.dy || 0) * H + offY;
      T = (q) => [ax + (q[0] - ax) * s + dx, ay + (q[1] - ay) * s + dy];
    } else if (offX || offY) {
      T = (q) => [q[0] + offX, q[1] + offY];
    }
    if (!T) { out.push(it); continue; }
    const s = e?.s || 1;
    out.push({
      ...it,
      poly: it.poly.map(T),
      spine: it.spine && it.spine.map((q) => [...T(q), q[2] * s]),
      facets: it.facets && it.facets.map((f) => ({ n3: f.n3, poly: f.poly.map(T) })),
      vol: it.vol && (() => { const v = T([it.vol.cx, it.vol.cy]); return { cx: v[0], cy: v[1], r: it.vol.r * s }; })(),
      fade: it.fade && { ...it.fade, y0: it.fade.y0 + offY, y1: it.fade.y1 + offY },
      grad: it.grad && { ...it.grad, y0: it.grad.y0 + offY, y1: it.grad.y1 + offY },
    });
  }
  return out;
}

function displace(gen, layer, scene, graph, W, H, depth) {
  const p = layer.p;
  const u = Math.min(W, H) / 900;
  const fn = graph && graph.fn;
  const useGraph = fn && fn.uses.move && p.distort !== 0;
  const useNoise = p.layerNoise > 0;
  const nz = noiseFor(hashInts(layer.seed, 31));
  const ctx = { x: 0, y: 0, depth, aspect: W / H, time: (graph && graph.time) || 0 };
  const sc = p.layerNoiseScale;
  const D = (pt) => {
    let dx = 0, dy = 0;
    if (useGraph) {
      ctx.x = pt[0] / W;
      ctx.y = pt[1] / H;
      const r = fn(ctx);
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
  const perItem = fn && (fn.uses.value || fn.uses.size || fn.uses.density);
  const items = [];
  applyEdits(gen.items, p, W, H).forEach((it, idx) => {
    const out = { ...it };
    // Graph outputs read once per shape at its centre: value shift, size, density.
    if (perItem && it.kind !== 'mass') {
      const cc = centroid(it.poly);
      ctx.x = cc[0] / W; ctx.y = cc[1] / H;
      const r = fn(ctx);
      if (fn.uses.density && it.kind === 'shape' && !it.detail) {
        const keep = Math.min(1, Math.max(0, 0.5 + r[4] * p.graphDensity * 0.5));
        if (hash01(layer.seed, idx, 'd') > keep) return;
      }
      out.gv = fn.uses.value ? r[2] * p.graphValue * 0.12 : 0;
      if (fn.uses.size && it.kind === 'shape') {
        const k = Math.max(0.05, 1 + r[3] * p.graphSize * 0.5);
        out.poly = it.poly.map((q) => [cc[0] + (q[0] - cc[0]) * k, cc[1] + (q[1] - cc[1]) * k]);
      }
    }
    if (moving) {
      const src = it.kind === 'mass' ? densify(out.poly, 14 * u) : out.poly;
      out.poly = src.map(D);
      if (it.facets) out.facets = it.facets.map((f) => ({ n3: f.n3, poly: densify(f.poly, 14 * u).map(D) }));
      if (it.spine) out.spine = it.spine.map((q) => [...D(q), q[2]]);
      if (it.vol) {
        const v = D([it.vol.cx, it.vol.cy]);
        out.vol = { cx: v[0], cy: v[1], r: it.vol.r };
      }
    } else {
      out.poly = out.poly.map((q) => [q[0], q[1]]);
      if (it.facets) out.facets = it.facets.map((f) => ({ n3: f.n3, poly: f.poly }));
    }
    if (out.corners) out.corners = [...out.corners];
    items.push(finalize(out));
  });
  const debug = moving
    ? { lines: gen.debug.lines.map((l) => l.map(D)), points: gen.debug.points.map((q) => [...D(q), q[2]]) }
    : gen.debug;
  return { items, debug, groups: {} };
}

export function buildGeometry(layer, scene, graph, gHash, W, H) {
  const ck = `${layer.id}|${W}x${H}`;
  const gk = genKey(layer, scene, W, H);
  let g = genCache.get(ck);
  if (!g || g.key !== gk) {
    g = { key: gk, gen: generate(layer, scene, W, H) };
    genCache.set(ck, g);
  }
  const depth = layerDepth(scene, layer);
  const tk = graph && graph.fn && graph.fn.uses.time ? graph.time : 0;
  const dk = `${gk}|${gHash}|${tk}|${DISTORT_KEYS.map((k) => layer.p[k]).join(',')}|${JSON.stringify(layer.p.edits || {})}|${depth.toFixed(4)}`;
  let d = distCache.get(ck);
  if (!d || d.key !== dk) {
    d = { key: dk, geo: displace(g.gen, layer, scene, graph, W, H, depth) };
    distCache.set(ck, d);
  }
  return d.geo;
}

export function dropCache(layerId) {
  for (const m of [genCache, distCache]) for (const k of [...m.keys()]) if (k.startsWith(`${layerId}|`)) m.delete(k);
}

// Shape groups: the same items can be grouped by shape, cluster, object or layer.
// Groups drive outline unions, volume lighting, colour variety and shadow picks.
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
    if (!a) acc.set(k, (a = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity, foot: -Infinity, n: 0 }));
    const b = it.bb;
    a.x0 = Math.min(a.x0, b.x0); a.y0 = Math.min(a.y0, b.y0);
    a.x1 = Math.max(a.x1, b.x1);
    // Offscreen ground bottoms would drag layer-wide volumes down; clip to the frame.
    a.y1 = Math.max(a.y1, it.kind === 'mass' ? Math.min(b.y1, it.c[1] + it.r * 0.3) : b.y1);
    a.foot = Math.max(a.foot, b.y1);
    a.n++;
  });
  const map = new Map();
  for (const [k, a] of acc) map.set(k, { cx: (a.x0 + a.x1) / 2, cy: (a.y0 + a.y1) / 2, r: Math.max(a.x1 - a.x0, a.y1 - a.y0) / 2 || 1, n: a.n, x0: a.x0, x1: a.x1, y0: a.y0, y1: a.y1, foot: a.foot });
  return (geo.groups[mode] = { keys, map });
}
