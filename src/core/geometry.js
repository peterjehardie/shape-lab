// Node geometry: what outline a node has in its own local space, after its own
// geometry effects. Cached by the store's per-node change counters.

import { primPath } from './prims.js';
import { flattenPath, transformPolys, resample, polyLength } from './path.js';
import { applyGeomEffects } from './effects.js';
import { combine } from './bool.js';
import { evalGraph } from './graph.js';
import { fromTransform, clamp } from './math.js';
import { noiseFor } from './rng.js';

export class Geometry {
  constructor(store) {
    this.store = store;
    this.cache = new Map();
  }
  clear() {
    this.cache.clear();
  }

  // tol: flattening tolerance in local units (smaller = smoother curves)
  // Returns { polys, items? , error? }
  of(id, tol = 0.25) {
    const doc = this.store.doc;
    const node = doc.nodes[id];
    if (!node) return { polys: [] };
    const tb = Math.max(0.02, 2 ** Math.round(Math.log2(tol)));
    const key = id + '|' + this.store.revOf(id) + '|' + tb;
    let g = this.cache.get(key);
    if (g) return g;
    g = this.compute(node, tb);
    if (this.cache.size > 3000) this.cache.clear();
    this.cache.set(key, g);
    return g;
  }

  // Geometry before this node's own effects.
  base(node, tol) {
    const doc = this.store.doc;
    switch (node.type) {
      case 'shape': {
        const path = node.geom.kind === 'path' ? node.geom.path : primPath(node.geom);
        return { polys: flattenPath(path, tol) };
      }
      case 'image': {
        const w = node.w / 2, h = node.h / 2;
        return { polys: [{ pts: [-w, -h, w, -h, w, h, -w, h], closed: true }] };
      }
      case 'bool': {
        const groups = [];
        for (const cid of node.children) {
          const c = doc.nodes[cid];
          if (!c || !c.visible) continue;
          const cg = this.of(cid, tol);
          groups.push(transformPolys(cg.polys, fromTransform(c.transform)));
        }
        return { polys: combine(node.op || 'union', groups) };
      }
      case 'gen': {
        const r = evalGraph(node.graph);
        return { polys: r.items.flatMap((it) => it.polys), items: r.items, error: r.error };
      }
    }
    return { polys: [] };
  }

  compute(node, tol) {
    const b = this.base(node, tol);
    if (!node.effects?.length) return b;
    if (b.items) {
      // effects act per item so each keeps its own colour
      const items = b.items.map((it) => ({ ...it, polys: applyGeomEffects(it.polys, node.effects) }));
      return { polys: items.flatMap((it) => it.polys), items, error: b.error };
    }
    return { polys: applyGeomEffects(b.polys, node.effects) };
  }
}

// ---------- stroke outlines with a width profile ----------
// Uniform strokes are drawn by the renderer directly. Other profiles (tapered, brushy)
// are turned into filled outlines here, so the line quality is geometry like any other.

export function strokeProfile(stroke, t, i, nz, tj = t) {
  const tp = clamp(stroke.taper ?? 0.8, 0.01, 1);
  let w = 1;
  switch (stroke.profile) {
    case 'taper': w = Math.min(1, Math.sin(Math.PI * t) / tp) ** 0.8; break;
    case 'taperStart': w = Math.min(1, t / tp) ** 0.8; break;
    case 'taperEnd': w = Math.min(1, (1 - t) / tp) ** 0.8; break;
    case 'swell': w = 0.35 + 0.65 * Math.sin(Math.PI * t); break;
  }
  if (stroke.jitter) w *= clamp(1 + stroke.jitter * nz.fbm(tj * 12, 0.37, 3) * 1.6, 0.05, 3);
  return w;
}

export function strokeOutline(polys, stroke) {
  const out = [];
  const nz = noiseFor(stroke.seed || 1);
  for (const poly of polys) {
    const r = resample(poly, Math.max(0.5, stroke.width / 3));
    const P = r.pts, n = P.length / 2;
    if (n < 2) continue;
    const L = polyLength(r) || 1;
    const left = [], right = [];
    let acc = 0;
    for (let i = 0; i < n; i++) {
      const a = r.closed ? (i - 1 + n) % n : Math.max(0, i - 1);
      const b = r.closed ? (i + 1) % n : Math.min(n - 1, i + 1);
      const tx = P[b * 2] - P[a * 2], ty = P[b * 2 + 1] - P[a * 2 + 1];
      const tl = Math.hypot(tx, ty) || 1;
      if (i > 0) acc += Math.hypot(P[i * 2] - P[i * 2 - 2], P[i * 2 + 1] - P[i * 2 - 1]);
      const t = acc / L;
      // closed outlines have no ends to taper, so only the brush jitter varies along them
      const w = (stroke.width / 2) * strokeProfile(stroke, r.closed ? 0.5 : t, i, nz, t);
      const nx = ty / tl, ny = -tx / tl;
      left.push(P[i * 2] + nx * w, P[i * 2 + 1] + ny * w);
      right.push(P[i * 2] - nx * w, P[i * 2 + 1] - ny * w);
    }
    if (r.closed) {
      out.push({ pts: left, closed: true });
      const rev = [];
      for (let i = right.length / 2 - 1; i >= 0; i--) rev.push(right[i * 2], right[i * 2 + 1]);
      out.push({ pts: rev, closed: true });
    } else {
      const ring = left.slice();
      for (let i = right.length / 2 - 1; i >= 0; i--) ring.push(right[i * 2], right[i * 2 + 1]);
      out.push({ pts: ring, closed: true });
    }
  }
  return out;
}
