// Canvas renderer. Walks the document tree and draws it through a view matrix.
//
// Plain shapes are drawn straight as vectors (crisp at any zoom). Anything that needs
// pixels (raster effects, noise paint, group opacity/blend, masks) is drawn into a
// bitmap, processed, and cached. The cache key leaves out where the bitmap sits, so
// panning and moving reuse it; zooming or editing rebuilds it.

import { mul, invert, meanScale, emptyBounds, addPoint, transformBounds, boundsValid, fromTransform, identity } from '../core/math.js';
import { transformPolys, polysBounds } from '../core/path.js';
import { EFFECTS, effectPad, hasStage, applyGeomEffects } from '../core/effects.js';
import { strokeOutline } from '../core/geometry.js';
import { rampTable, toCss } from '../core/color.js';
import { noisePaint, makeBuf } from '../core/raster.js';
import { fillStyleFor, makeCanvas, assetImage } from './paint.js';

const BLEND = (b) => (!b || b === 'normal' ? 'source-over' : b);
const MAX_DIM = 4096, MAX_AREA = 9e6;

function tracePolys(ctx, polys) {
  ctx.beginPath();
  for (const p of polys) {
    const P = p.pts;
    if (P.length < 4) continue;
    ctx.moveTo(P[0], P[1]);
    for (let i = 2; i < P.length; i += 2) ctx.lineTo(P[i], P[i + 1]);
    if (p.closed) ctx.closePath();
  }
}

const setM = (ctx, m) => ctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);

export class Renderer {
  constructor(store, geometry) {
    this.store = store;
    this.geo = geometry;
    this.bitmaps = new Map(); // id -> { key, canvas, rx, ry, lin }
    this.deformCache = new Map();
    this.stats = { bitmaps: 0, ms: 0 };
  }

  get doc() {
    return this.store.doc;
  }

  clearCaches() {
    this.bitmaps.clear();
    this.deformCache.clear();
  }

  // ---- entry points ----

  // Draw the whole artboard. V = document -> device matrix. clip = device rect to bother with.
  renderDoc(ctx, V, opts = {}) {
    const t0 = performance.now();
    this.stats.bitmaps = 0;
    const doc = this.doc;
    const ab = doc.artboard;
    const clip = opts.clip || { x0: 0, y0: 0, x1: ctx.canvas.width, y1: ctx.canvas.height };
    // artboard background (its paint may be noise, so it goes through the shape path)
    const abPolys = [{ pts: [0, 0, ab.w, 0, ab.w, ab.h, 0, ab.h], closed: true }];
    ctx.save();
    setM(ctx, V);
    tracePolys(ctx, abPolys);
    ctx.restore();
    ctx.save();
    ctx.clip();
    const root = doc.nodes[doc.root];
    if (ab.bg) this.drawLeafLike(ctx, { id: '__bg', rev: JSON.stringify(ab), sig: '', polys: abPolys, fill: ab.bg, stroke: null, effects: [], opacity: 1, blend: 'normal' }, V, clip, opts);
    this.drawContainer(ctx, root, V, [], clip, opts);
    ctx.restore();
    this.stats.ms = performance.now() - t0;
  }

  // Draw specific nodes (with their ancestors' transforms) into ctx through V. Used for baking swatches.
  renderNodes(ctx, ids, V, opts = {}) {
    const clip = opts.clip || { x0: 0, y0: 0, x1: ctx.canvas.width, y1: ctx.canvas.height };
    for (const id of ids) {
      const n = this.doc.nodes[id];
      if (!n) continue;
      const Mp = mul(V, this.parentWorld(id));
      this.drawNode(ctx, n, Mp, [], clip, { ...opts, force: true });
    }
  }

  parentWorld(id) {
    const doc = this.doc;
    const chain = [];
    let n = doc.nodes[doc.nodes[id].parent];
    while (n && n.id !== doc.root) {
      chain.unshift(n);
      n = doc.nodes[n.parent];
    }
    let m = identity();
    for (const a of chain) m = mul(m, fromTransform(a.transform));
    return m;
  }

  // ---- tree ----

  drawContainer(ctx, node, M, deformers, clip, opts) {
    const doc = this.doc;
    for (const cid of node.children) {
      const c = doc.nodes[cid];
      if (!c || !c.visible || c.mask) continue;
      this.drawNode(ctx, c, M, deformers, clip, opts);
    }
  }

  drawNode(ctx, node, Mparent, deformers, clip, opts) {
    if (!node.visible && !opts.force) return;
    const M = mul(Mparent, fromTransform(node.transform));
    if (node.type === 'group' || node.type === 'layer') return this.drawGroup(ctx, node, M, deformers, clip, opts);
    const leaf = this.leafData(node, M, deformers);
    if (!leaf) return;
    this.drawLeafLike(ctx, leaf, M, clip, opts);
  }

  groupNeedsBitmap(node) {
    return hasStage(node.effects, 'raster') || node.opacity < 1 || (node.blend && node.blend !== 'normal') || node.children.some((c) => this.doc.nodes[c]?.mask && this.doc.nodes[c]?.visible);
  }

  drawGroup(ctx, node, M, deformers, clip, opts) {
    let defs = deformers;
    if (hasStage(node.effects, 'geom')) defs = [{ node, M, sig: node.id + ':' + this.store.revOf(node.id) }, ...deformers];
    if (!this.groupNeedsBitmap(node) || opts.outline) return this.drawContainer(ctx, node, M, defs, clip, opts);

    // Bitmap path: where does the group's content land on the device?
    const b = this.groupDeviceBounds(node, M);
    if (!boundsValid(b)) return;
    const pad = effectPad(node.effects) * meanScale(M);
    const R = this.region(b, pad, clip, 1, M);
    if (!R) return;
    const key = ['g', this.store.revOf(node.id), this.defSig(defs, M), this.linKey(M), R.rx, R.ry, R.w, R.h, opts.draft ? 1 : 0, this.doc.assetsRev || 0].join('|');
    let bm = this.bitmaps.get(node.id);
    if (!bm || bm.key !== key) {
      const c = makeCanvas(R.w, R.h);
      const g = c.getContext('2d');
      const T = [R.scale, 0, 0, R.scale, -R.x * R.scale, -R.y * R.scale];
      const Mb = mul(T, M);
      const localClip = { x0: 0, y0: 0, x1: R.w, y1: R.h };
      for (const cid of node.children) {
        const ch = this.doc.nodes[cid];
        if (!ch || !ch.visible || ch.mask) continue;
        this.drawNode(g, ch, Mb, defs, localClip, opts);
      }
      g.setTransform(1, 0, 0, 1, 0, 0);
      this.applyMasks(g, node, Mb, defs, R, opts);
      this.applyRaster(g, node.effects, Mb, R, null, null, opts);
      bm = { key, canvas: c, rx: R.rx, ry: R.ry, dw: R.dw, dh: R.dh };
      this.bitmaps.set(node.id, bm);
      this.stats.bitmaps++;
    }
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha *= node.opacity;
    ctx.globalCompositeOperation = BLEND(node.blend);
    ctx.drawImage(bm.canvas, Math.floor(M[4]) + bm.rx, Math.floor(M[5]) + bm.ry, bm.dw, bm.dh);
    ctx.restore();
  }

  applyMasks(g, node, Mb, defs, R, opts) {
    const masks = node.children.map((c) => this.doc.nodes[c]).filter((c) => c && c.visible && c.mask);
    if (!masks.length) return;
    const mc = makeCanvas(R.w, R.h);
    const mg = mc.getContext('2d');
    for (const m of masks) {
      const mm = { ...m, mask: null, opacity: 1, blend: 'normal' };
      this.drawNode(mg, mm, Mb, defs, { x0: 0, y0: 0, x1: R.w, y1: R.h }, { ...opts, force: true, maskPass: true });
    }
    mg.setTransform(1, 0, 0, 1, 0, 0);
    const mode = masks[0].mask;
    if (mode === 'luma') {
      const id = mg.getImageData(0, 0, R.w, R.h), d = id.data;
      for (let i = 0; i < d.length; i += 4) {
        d[i + 3] = ((0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) * d[i + 3]) / 255;
      }
      mg.putImageData(id, 0, 0);
    }
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = mode === 'invert' ? 'destination-out' : 'destination-in';
    g.drawImage(mc, 0, 0);
    g.restore();
  }

  // ---- leaves ----

  leafData(node, M, deformers) {
    const tol = 0.35 / meanScale(M);
    const g = this.geo.of(node.id, tol);
    let polys = g.polys;
    let items = g.items;
    let sig = '';
    if (deformers.length) {
      sig = this.defSig(deformers, M);
      const ck = node.id + '|' + this.store.revOf(node.id) + '|' + sig + '|' + Math.round(Math.log2(tol) * 2);
      let hit = this.deformCache.get(ck);
      if (!hit) {
        const deform = (ps) => {
          for (const d of deformers) {
            const R = mul(invert(d.M), M); // node local -> group local
            ps = transformPolys(applyGeomEffects(transformPolys(ps, R), d.node.effects), invert(R));
          }
          return ps;
        };
        hit = items ? { items: items.map((it) => ({ ...it, polys: deform(it.polys) })) } : { polys: deform(polys) };
        if (hit.items) hit.polys = hit.items.flatMap((it) => it.polys);
        if (this.deformCache.size > 2000) this.deformCache.clear();
        this.deformCache.set(ck, hit);
      }
      polys = hit.polys;
      items = hit.items;
    }
    return {
      id: node.id, node, rev: this.store.revOf(node.id), sig, polys, items,
      fill: node.fill, stroke: node.stroke, effects: node.effects, opacity: node.opacity, blend: node.blend, type: node.type,
    };
  }

  leafNeedsBitmap(L) {
    return hasStage(L.effects, 'raster') || L.fill?.type === 'noise' || L.stroke?.paint?.type === 'noise';
  }

  drawLeafLike(ctx, L, M, clip, opts) {
    if (opts.outline) {
      ctx.save();
      setM(ctx, M);
      tracePolys(ctx, L.polys);
      ctx.restore();
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.strokeStyle = opts.outlineColor || '#6aa0ff';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
      return;
    }
    if (!this.leafNeedsBitmap(L)) {
      ctx.save();
      ctx.globalAlpha *= L.opacity ?? 1;
      ctx.globalCompositeOperation = BLEND(L.blend);
      this.paintLeaf(ctx, L, M);
      ctx.restore();
      return;
    }
    const lb = this.leafDeviceBounds(L, M);
    if (!boundsValid(lb)) return;
    const pad = effectPad(L.effects) * meanScale(M);
    const R = this.region(lb, pad, clip, opts.draft && (lb.x1 - lb.x0) * (lb.y1 - lb.y0) > 250000 ? 0.5 : 1, M);
    if (!R) return;
    const key = ['l', L.rev, L.sig, this.linKey(M), R.rx, R.ry, R.w, R.h, R.scale, this.doc.assetsRev || 0].join('|');
    let bm = this.bitmaps.get(L.id);
    if (!bm || bm.key !== key) {
      const c = makeCanvas(R.w, R.h);
      const g = c.getContext('2d');
      const T = [R.scale, 0, 0, R.scale, -R.x * R.scale, -R.y * R.scale];
      const Mb = mul(T, M);
      this.paintLeaf(g, L, Mb, true);
      g.setTransform(1, 0, 0, 1, 0, 0);
      this.applyRaster(g, L.effects, Mb, R, L.polys, L.fill?.color || L.fill?.stops?.[0]?.color || L.stroke?.paint?.color, opts);
      bm = { key, canvas: c, rx: R.rx, ry: R.ry, scale: R.scale, dw: R.dw, dh: R.dh };
      this.bitmaps.set(L.id, bm);
      this.stats.bitmaps++;
    }
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha *= L.opacity ?? 1;
    ctx.globalCompositeOperation = BLEND(L.blend);
    const x = Math.floor(M[4]) + bm.rx, y = Math.floor(M[5]) + bm.ry;
    if (bm.scale === 1) ctx.drawImage(bm.canvas, x, y);
    else ctx.drawImage(bm.canvas, x, y, bm.dw, bm.dh);
    ctx.restore();
  }

  // Vector fill + stroke of a leaf in local space through M.
  paintLeaf(ctx, L, M, inBitmap = false) {
    const px = meanScale(M);
    const doc = this.doc;
    ctx.save();
    setM(ctx, M);
    if (L.type === 'image') {
      const asset = doc.assets[L.node.asset];
      const img = assetImage(asset);
      const n = L.node;
      if (img) ctx.drawImage(img, -n.w / 2, -n.h / 2, n.w, n.h);
      else {
        ctx.fillStyle = 'rgba(128,128,128,0.2)';
        ctx.fillRect(-n.w / 2, -n.h / 2, n.w, n.h);
      }
      ctx.restore();
      return;
    }
    const noiseFill = L.fill?.type === 'noise';
    if (L.items && L.items.some((it) => it.attrs?.color)) {
      for (const it of L.items) {
        tracePolys(ctx, it.polys);
        const c = it.attrs?.color;
        ctx.globalAlpha = it.attrs?.opacity ?? 1;
        ctx.fillStyle = c ? toCss(c) : fillStyleFor(ctx, L.fill, it.polys, px, doc) || 'transparent';
        if (c || L.fill) ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else if (L.fill) {
      tracePolys(ctx, L.polys);
      ctx.fillStyle = fillStyleFor(ctx, L.fill, L.polys, px, doc);
      ctx.fill();
    }
    if (noiseFill && inBitmap) {
      ctx.restore();
      this.applyNoisePaint(ctx, L.fill, M, L.polys);
      ctx.save();
      setM(ctx, M);
    }
    const s = L.stroke;
    if (s && s.width > 0 && s.paint) {
      if (s.profile && s.profile !== 'uniform') {
        const outline = strokeOutline(L.polys, s);
        tracePolys(ctx, outline);
        ctx.fillStyle = fillStyleFor(ctx, s.paint, outline, px, doc);
        ctx.fill('nonzero');
      } else {
        tracePolys(ctx, L.polys);
        ctx.lineWidth = s.width;
        ctx.lineJoin = s.join || 'round';
        ctx.lineCap = s.cap || 'round';
        ctx.strokeStyle = fillStyleFor(ctx, s.paint, L.polys, px, doc);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  applyNoisePaint(ctx, paint, M, polys) {
    const cv = ctx.canvas;
    const img = ctx.getImageData(0, 0, cv.width, cv.height);
    const buf = { w: img.width, h: img.height, data: img.data };
    const table = rampTable(paint.stops);
    noisePaint(buf, paint, this.rasterCtx(M, polys), table);
    ctx.putImageData(img, 0, 0);
  }

  rasterCtx(Mb, polys, color, opts = {}) {
    const inv = invert([Mb[0], Mb[1], Mb[2], Mb[3], 0, 0]);
    return { lin: [Mb[0], Mb[1], Mb[2], Mb[3]], inv: [inv[0], inv[1], inv[2], inv[3]], ox: Mb[4], oy: Mb[5], ppu: meanScale(Mb), polys, color, draft: !!opts.draft };
  }

  applyRaster(g, effects, Mb, R, polys, color, opts) {
    const list = (effects || []).filter((e) => e.on && EFFECTS[e.type]?.stage === 'raster');
    if (!list.length) return;
    const img = g.getImageData(0, 0, R.w, R.h);
    const buf = { w: img.width, h: img.height, data: img.data };
    const cx = this.rasterCtx(Mb, polys, color, opts);
    for (const e of list) EFFECTS[e.type].fn(buf, e.params, cx);
    g.putImageData(img, 0, 0);
  }

  // ---- bounds & regions ----

  leafDeviceBounds(L, M) {
    let b = transformBounds(M, polysBounds(L.polys));
    if (!boundsValid(b) && L.type === 'image') b = transformBounds(M, { x0: -L.node.w / 2, y0: -L.node.h / 2, x1: L.node.w / 2, y1: L.node.h / 2 });
    const sw = L.stroke?.width ? L.stroke.width * meanScale(M) : 0;
    return { x0: b.x0 - sw, y0: b.y0 - sw, x1: b.x1 + sw, y1: b.y1 + sw };
  }

  groupDeviceBounds(node, M) {
    const b = emptyBounds();
    for (const cid of node.children) {
      const c = this.doc.nodes[cid];
      if (!c || !c.visible) continue;
      const Mc = mul(M, fromTransform(c.transform));
      let cb;
      if (c.type === 'group' || c.type === 'layer') {
        cb = this.groupDeviceBounds(c, Mc);
        const pad = effectPad(c.effects) * meanScale(Mc);
        cb = { x0: cb.x0 - pad, y0: cb.y0 - pad, x1: cb.x1 + pad, y1: cb.y1 + pad };
      } else {
        const L = this.leafData(c, Mc, []);
        cb = this.leafDeviceBounds(L, Mc);
        const pad = effectPad(c.effects) * meanScale(Mc);
        cb = { x0: cb.x0 - pad, y0: cb.y0 - pad, x1: cb.x1 + pad, y1: cb.y1 + pad };
      }
      if (boundsValid(cb)) {
        addPoint(b, cb.x0, cb.y0);
        addPoint(b, cb.x1, cb.y1);
      }
    }
    if (hasStage(node.effects, 'geom') && boundsValid(b)) {
      // geometry effects on a group can push content outward; allow some room
      const m = Math.max(b.x1 - b.x0, b.y1 - b.y0) * 0.15;
      return { x0: b.x0 - m, y0: b.y0 - m, x1: b.x1 + m, y1: b.y1 + m };
    }
    return b;
  }

  // Integer device rect for a bitmap, relative to the node origin so it survives panning.
  region(b, pad, clip, quality = 1, M = [1, 0, 0, 1, 0, 0]) {
    const margin = 64;
    let x0 = Math.floor(Math.max(b.x0 - pad - 2, clip.x0 - margin - pad));
    let y0 = Math.floor(Math.max(b.y0 - pad - 2, clip.y0 - margin - pad));
    let x1 = Math.ceil(Math.min(b.x1 + pad + 2, clip.x1 + margin + pad));
    let y1 = Math.ceil(Math.min(b.y1 + pad + 2, clip.y1 + margin + pad));
    if (x1 <= x0 || y1 <= y0) return null;
    let w = x1 - x0, h = y1 - y0;
    let scale = quality;
    if (w * scale > MAX_DIM || h * scale > MAX_DIM) scale = Math.min(scale, MAX_DIM / w, MAX_DIM / h);
    if (w * h * scale * scale > MAX_AREA) scale = Math.min(scale, Math.sqrt(MAX_AREA / (w * h)));
    return { x: x0, y: y0, w: Math.max(1, Math.ceil(w * scale)), h: Math.max(1, Math.ceil(h * scale)), dw: w, dh: h, scale, rx: x0 - Math.floor(M[4]), ry: y0 - Math.floor(M[5]) };
  }

  linKey(M) {
    return [M[0], M[1], M[2], M[3]].map((v) => v.toFixed(4)).join(',');
  }

  defSig(defs, M) {
    if (!defs.length) return '';
    return defs.map((d) => d.sig + '@' + mul(invert(d.M), M).map((v) => v.toFixed(2)).join(',')).join(';');
  }
}
