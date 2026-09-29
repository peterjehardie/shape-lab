// The canvas area: drawing, pan/zoom, selection overlay and all pointer tools.

import { mul, invert, apply, fromTransform, applyVec, transformBounds, boundsValid, DEG, clamp } from '../core/math.js';
import { polysBounds, flattenPath, segmentCtrl, nearestOnPath, splitSegment, fitFreehand, clonePath, transformPath, anchor, smoothAnchors } from '../core/path.js';
import { primPath, PRIMS, primHasSize } from '../core/prims.js';
import { makeShape, worldMatrix, parentMatrix, solid, makeStroke } from '../core/doc.js';
import { toCss } from '../core/color.js';
import { oklch } from '../core/color.js';

const ACCENT = '#4d8dff';
const HANDLE = 7;
const SHAPE_TOOLS = ['rect', 'ellipse', 'polygon', 'star', 'blob', 'squircle', 'crescent', 'line', 'wave', 'spiral'];

export class Viewport {
  constructor(app, host) {
    this.app = app;
    this.host = host;
    this.docC = document.createElement('canvas');
    this.ovC = document.createElement('canvas');
    this.docC.className = 'vp-doc';
    this.ovC.className = 'vp-ov';
    host.append(this.docC, this.ovC);
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = 1;
    this.h = 1;
    this.dirtyDoc = true;
    this.dirtyOv = true;
    this.mouse = null; // last pointer position (screen)
    this.hover = null;
    this.drag = null;
    this.anchorSel = new Set();
    this.guides = [];
    this.spaceDown = false;
    new ResizeObserver(() => this.resize()).observe(host);
    this.resize();
    app.on('render', () => this.invalidate());
    app.on('selection', () => {
      const n = app.selectedNodes();
      if (!(n.length === 1 && n[0].id === this.editId)) this.anchorSel.clear();
      this.editId = n.length === 1 && n[0].type === 'shape' ? n[0].id : null;
      this.invalidate(false);
    });
    app.on('tool', (t) => {
      if (this.pen && t !== 'pen') this.finishPen();
      this.updateCursor();
    });
    app.on('fit', () => this.fit());
    this.bindPointer();
    const loop = () => {
      this.frame();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  get V() {
    const { zoom, x, y } = this.app.view;
    const d = this.dpr;
    return [zoom * d, 0, 0, zoom * d, x * d, y * d];
  }

  resize() {
    const r = this.host.getBoundingClientRect();
    this.w = Math.max(1, r.width);
    this.h = Math.max(1, r.height);
    for (const c of [this.docC, this.ovC]) {
      c.width = Math.round(this.w * this.dpr);
      c.height = Math.round(this.h * this.dpr);
      c.style.width = this.w + 'px';
      c.style.height = this.h + 'px';
    }
    if (!this.fitted && this.w > 50) {
      this.fitted = true;
      this.fit();
    }
    this.invalidate();
  }

  fit() {
    this.app.fit(this.w, this.h);
  }

  invalidate(doc = true) {
    if (doc) this.dirtyDoc = true;
    this.dirtyOv = true;
  }

  get interacting() {
    return !!this.drag || !!this.app.store.open;
  }

  frame() {
    if (this.dirtyDoc) {
      this.dirtyDoc = false;
      const draft = this.interacting;
      this.renderDoc(draft);
      clearTimeout(this.settle);
      if (draft) this.settle = setTimeout(() => {
        if (!this.interacting) {
          this.dirtyDoc = true;
        } else this.settle = setTimeout(() => (this.dirtyDoc = true), 200);
      }, 180);
    }
    if (this.dirtyOv) {
      this.dirtyOv = false;
      this.renderOverlay();
    }
  }

  renderDoc(draft) {
    const ctx = this.docC.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.docC.width, this.docC.height);
    const ab = this.app.doc.artboard;
    const V = this.V;
    // artboard shadow
    const [x0, y0] = apply(V, 0, 0), [x1, y1] = apply(V, ab.w, ab.h);
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 24 * this.dpr;
    ctx.shadowOffsetY = 4 * this.dpr;
    ctx.fillStyle = '#000';
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    ctx.restore();
    // transparency checker under the artboard (shows when the background is off)
    if (!ab.bg) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(x0, y0, x1 - x0, y1 - y0);
      ctx.clip();
      const s = 8 * this.dpr;
      for (let yy = Math.floor(y0 / s) * s; yy < y1; yy += s)
        for (let xx = Math.floor(x0 / s) * s; xx < x1; xx += s) {
          ctx.fillStyle = (Math.round(xx / s) + Math.round(yy / s)) % 2 ? '#d8d8d8' : '#f2f2f2';
          ctx.fillRect(xx, yy, s, s);
        }
      ctx.restore();
    }
    try {
      this.app.renderer.renderDoc(ctx, V, { draft, outline: this.app.outline, clip: { x0: 0, y0: 0, x1: this.docC.width, y1: this.docC.height } });
    } catch (e) {
      console.error(e);
    }
    this.app.emit('rendered', this.app.renderer.stats);
  }

  // ------------------------------------------------------------------ overlay

  renderOverlay() {
    const ctx = this.ovC.getContext('2d');
    const d = this.dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.ovC.width, this.ovC.height);
    ctx.setTransform(d, 0, 0, d, 0, 0);
    const app = this.app;
    const doc = app.doc;
    // artboard label
    const [ax, ay] = app.docToScreen(0, 0);
    ctx.font = '11px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#8b8f98';
    ctx.fillText(`${doc.name} · ${doc.artboard.w} × ${doc.artboard.h}`, ax, ay - 8);

    // graph node preview
    this.drawGraphPreview(ctx);

    // hover
    if (this.hover && !app.sel.has(this.hover) && doc.nodes[this.hover] && !this.drag) this.outlineNode(ctx, this.hover, ACCENT, 1.5);
    for (const id of app.sel) if (doc.nodes[id]?.type !== 'layer') this.outlineNode(ctx, id, ACCENT, 1);

    const tool = app.tool;
    if (tool === 'select' && app.sel.size && !(this.drag?.kind === 'marquee')) this.drawSelectionBox(ctx);
    if (tool === 'direct' && this.editId) this.drawAnchors(ctx);
    if (this.pen) this.drawPenPreview(ctx);
    if (this.drag?.kind === 'pencil') {
      ctx.strokeStyle = ACCENT;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      this.drag.pts.forEach(([x, y], i) => {
        const [sx, sy] = app.docToScreen(x, y);
        i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy);
      });
      ctx.stroke();
    }
    if (this.drag?.kind === 'marquee' || this.drag?.kind === 'amarquee') {
      const { x0, y0, x1, y1 } = this.drag;
      ctx.fillStyle = 'rgba(77,141,255,0.08)';
      ctx.strokeStyle = ACCENT;
      ctx.lineWidth = 1;
      ctx.fillRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
      ctx.strokeRect(Math.min(x0, x1) + 0.5, Math.min(y0, y1) + 0.5, Math.abs(x1 - x0), Math.abs(y1 - y0));
    }
    // snap guides
    ctx.strokeStyle = '#ff4fa3';
    ctx.lineWidth = 1;
    for (const g of this.guides) {
      ctx.beginPath();
      if (g.axis === 'x') {
        const [sx] = app.docToScreen(g.v, 0);
        ctx.moveTo(Math.round(sx) + 0.5, 0);
        ctx.lineTo(Math.round(sx) + 0.5, this.h);
      } else {
        const [, sy] = app.docToScreen(0, g.v);
        ctx.moveTo(0, Math.round(sy) + 0.5);
        ctx.lineTo(this.w, Math.round(sy) + 0.5);
      }
      ctx.stroke();
    }
    // size readout while dragging a shape tool
    if (this.drag?.readout) {
      const [mx, my] = this.mouse || [0, 0];
      ctx.font = '11px Inter, system-ui, sans-serif';
      const t = this.drag.readout;
      const w = ctx.measureText(t).width + 10;
      ctx.fillStyle = 'rgba(20,21,24,0.9)';
      ctx.fillRect(mx + 14, my + 14, w, 18);
      ctx.fillStyle = '#e6e8ec';
      ctx.fillText(t, mx + 19, my + 27);
    }
  }

  screenMatrix(id) {
    const { zoom, x, y } = this.app.view;
    return mul([zoom, 0, 0, zoom, x, y], worldMatrix(this.app.doc, id));
  }

  outlineNode(ctx, id, color, width) {
    const n = this.app.doc.nodes[id];
    if (!n) return;
    if (n.children && n.type !== 'bool') {
      const b = this.app.nodeBounds(id);
      if (!boundsValid(b)) return;
      const [x0, y0] = this.app.docToScreen(b.x0, b.y0), [x1, y1] = this.app.docToScreen(b.x1, b.y1);
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.strokeRect(Math.round(x0) + 0.5, Math.round(y0) + 0.5, Math.round(x1 - x0), Math.round(y1 - y0));
      ctx.setLineDash([]);
      return;
    }
    const M = this.screenMatrix(id);
    const g = this.app.geo.of(id, 0.5 / Math.sqrt(Math.abs(M[0] * M[3] - M[1] * M[2]) || 1));
    let polys = g.polys;
    if (n.type === 'image') polys = [{ pts: [-n.w / 2, -n.h / 2, n.w / 2, -n.h / 2, n.w / 2, n.h / 2, -n.w / 2, n.h / 2], closed: true }];
    ctx.beginPath();
    let count = 0;
    for (const p of polys) {
      const P = p.pts;
      for (let i = 0; i < P.length; i += 2) {
        const [sx, sy] = apply(M, P[i], P[i + 1]);
        i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy);
        if (++count > 60000) break;
      }
      if (p.closed) ctx.closePath();
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  }

  // The selection frame: oriented for one object, page-aligned for several.
  selectionFrame() {
    const app = this.app;
    const nodes = app.selectedNodes().filter((n) => n.type !== 'layer');
    if (!nodes.length) return null;
    if (nodes.length === 1 && !(nodes[0].children && nodes[0].type !== 'bool')) {
      const n = nodes[0];
      const g = app.geo.of(n.id, 0.5);
      let lb = n.type === 'image' ? { x0: -n.w / 2, y0: -n.h / 2, x1: n.w / 2, y1: n.h / 2 } : polysBounds(g.polys);
      if (!boundsValid(lb)) return null;
      if (lb.x1 - lb.x0 < 1e-6) (lb.x0 -= 0.5), (lb.x1 += 0.5);
      if (lb.y1 - lb.y0 < 1e-6) (lb.y0 -= 0.5), (lb.y1 += 0.5);
      return { W: worldMatrix(app.doc, n.id), lb, single: n };
    }
    const b = app.selectionBounds(nodes.map((n) => n.id));
    if (!boundsValid(b)) return null;
    return { W: [1, 0, 0, 1, 0, 0], lb: b, single: null };
  }

  handlesOf(frame) {
    const { W, lb } = frame;
    const cx = (lb.x0 + lb.x1) / 2, cy = (lb.y0 + lb.y1) / 2;
    const pts = {
      nw: [lb.x0, lb.y0], n: [cx, lb.y0], ne: [lb.x1, lb.y0], e: [lb.x1, cy],
      se: [lb.x1, lb.y1], s: [cx, lb.y1], sw: [lb.x0, lb.y1], w: [lb.x0, cy],
    };
    const out = {};
    for (const k in pts) {
      const [dx, dy] = apply(W, ...pts[k]);
      out[k] = { local: pts[k], screen: this.app.docToScreen(dx, dy) };
    }
    // rotation knob sits above the top edge
    const top = out.n.screen, bot = out.s.screen;
    let ux = top[0] - bot[0], uy = top[1] - bot[1];
    const ul = Math.hypot(ux, uy) || 1;
    out.rot = { screen: [top[0] + (ux / ul) * 22, top[1] + (uy / ul) * 22] };
    return out;
  }

  drawSelectionBox(ctx) {
    const f = this.selectionFrame();
    if (!f) return;
    const H = this.handlesOf(f);
    ctx.strokeStyle = ACCENT;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ['nw', 'ne', 'se', 'sw'].forEach((k, i) => (i ? ctx.lineTo(...H[k].screen) : ctx.moveTo(...H[k].screen)));
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(...H.n.screen);
    ctx.lineTo(...H.rot.screen);
    ctx.stroke();
    for (const k of ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']) {
      const [x, y] = H[k].screen;
      ctx.fillStyle = '#fff';
      ctx.fillRect(Math.round(x - HANDLE / 2) + 0.5, Math.round(y - HANDLE / 2) + 0.5, HANDLE - 1, HANDLE - 1);
      ctx.strokeRect(Math.round(x - HANDLE / 2) + 0.5, Math.round(y - HANDLE / 2) + 0.5, HANDLE - 1, HANDLE - 1);
    }
    ctx.beginPath();
    ctx.arc(...H.rot.screen, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.stroke();
    // dimension label
    if (f.single || this.drag) {
      const b = this.app.selectionBounds();
      const t = `${Math.round(b.x1 - b.x0)} × ${Math.round(b.y1 - b.y0)}`;
      const [x, y] = H.s.screen;
      ctx.font = '10.5px Inter, system-ui, sans-serif';
      const w = ctx.measureText(t).width + 8;
      ctx.fillStyle = ACCENT;
      ctx.fillRect(x - w / 2, y + 10, w, 16);
      ctx.fillStyle = '#fff';
      ctx.fillText(t, x - w / 2 + 4, y + 22);
    }
  }

  // ---- direct editing ----

  editPath() {
    const n = this.app.doc.nodes[this.editId];
    if (!n || n.type !== 'shape') return null;
    return n.geom.kind === 'path' ? n.geom.path : primPath(n.geom);
  }

  anchorScreens() {
    const path = this.editPath();
    if (!path) return [];
    const M = this.screenMatrix(this.editId);
    const out = [];
    path.subpaths.forEach((sp, si) =>
      sp.pts.forEach((p, i) => {
        const s = apply(M, p.x, p.y);
        out.push({ si, i, p, s, hin: p.in ? apply(M, p.x + p.in[0], p.y + p.in[1]) : null, hout: p.out ? apply(M, p.x + p.out[0], p.y + p.out[1]) : null });
      }),
    );
    return out;
  }

  drawAnchors(ctx) {
    const path = this.editPath();
    if (!path) return;
    const M = this.screenMatrix(this.editId);
    // the raw path (before effects) in thin blue
    ctx.strokeStyle = ACCENT;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const p of flattenPath(path, 0.5)) {
      for (let i = 0; i < p.pts.length; i += 2) {
        const [x, y] = apply(M, p.pts[i], p.pts[i + 1]);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      if (p.closed) ctx.closePath();
    }
    ctx.stroke();
    for (const a of this.anchorScreens()) {
      const selected = this.anchorSel.has(a.si + ':' + a.i);
      if (selected || this.anchorSel.size === 0 || true) {
        for (const hh of [a.hin, a.hout]) {
          if (!hh) continue;
          ctx.strokeStyle = 'rgba(77,141,255,0.7)';
          ctx.beginPath();
          ctx.moveTo(...a.s);
          ctx.lineTo(...hh);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(...hh, 3, 0, Math.PI * 2);
          ctx.fillStyle = '#fff';
          ctx.fill();
          ctx.stroke();
        }
      }
      ctx.fillStyle = selected ? ACCENT : '#fff';
      ctx.strokeStyle = ACCENT;
      const s = 6;
      if (a.p.in || a.p.out) {
        ctx.beginPath();
        ctx.arc(a.s[0], a.s[1], s / 2 + 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillRect(a.s[0] - s / 2, a.s[1] - s / 2, s, s);
        ctx.strokeRect(a.s[0] - s / 2, a.s[1] - s / 2, s, s);
      }
    }
    const n = this.app.doc.nodes[this.editId];
    if (n.geom.kind !== 'path') {
      const b = this.app.nodeBounds(n.id);
      const [x, y] = this.app.docToScreen(b.x0, b.y1);
      ctx.font = '11px Inter, system-ui, sans-serif';
      ctx.fillStyle = '#8b8f98';
      ctx.fillText(`${PRIMS[n.geom.kind].label}: dragging a point turns it into a free path`, x, y + 18);
    }
  }

  drawPenPreview(ctx) {
    const n = this.app.doc.nodes[this.pen.id];
    if (!n) return;
    const sp = n.geom.path.subpaths[0];
    const last = sp.pts[sp.pts.length - 1];
    if (!last || !this.mouse) return;
    const M = this.screenMatrix(n.id);
    const a = apply(M, last.x, last.y);
    const c1 = last.out ? apply(M, last.x + last.out[0], last.y + last.out[1]) : a;
    ctx.strokeStyle = ACCENT;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(...a);
    ctx.bezierCurveTo(...c1, ...this.mouse, ...this.mouse);
    ctx.stroke();
    ctx.setLineDash([]);
    this.editId = n.id;
    this.drawAnchors(ctx);
    const first = apply(M, sp.pts[0].x, sp.pts[0].y);
    if (sp.pts.length > 1 && Math.hypot(first[0] - this.mouse[0], first[1] - this.mouse[1]) < 9) {
      ctx.beginPath();
      ctx.arc(...first, 7, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  drawGraphPreview(ctx) {
    const pd = this.app.previewData();
    if (!pd || !pd.value) return;
    const { zoom, x, y } = this.app.view;
    const M = mul([zoom, 0, 0, zoom, x, y], pd.M);
    const v = pd.value;
    ctx.save();
    if (typeof v === 'function') {
      // field: sample on a grid of dots, bigger = higher value
      const b = this.app.nodeBounds(pd.node.id);
      const ab = this.app.doc.artboard;
      const Minv = invert(pd.M);
      const step = 18;
      for (let sy = 0; sy < this.h; sy += step)
        for (let sx = 0; sx < this.w; sx += step) {
          const [dx, dy] = this.app.screenToDoc(sx, sy);
          if (dx < 0 || dy < 0 || dx > ab.w || dy > ab.h) continue;
          const [lx, ly] = apply(Minv, dx, dy);
          const val = clamp(v(lx, ly));
          ctx.fillStyle = `rgba(255,79,163,${0.25 + val * 0.6})`;
          ctx.beginPath();
          ctx.arc(sx, sy, 1 + val * 5, 0, Math.PI * 2);
          ctx.fill();
        }
    } else if (Array.isArray(v)) {
      ctx.strokeStyle = '#ff4fa3';
      ctx.fillStyle = '#ff4fa3';
      ctx.lineWidth = 1.2;
      for (const it of v.slice(0, 4000)) {
        if (it.polys) {
          ctx.beginPath();
          for (const p of it.polys) {
            for (let i = 0; i < p.pts.length; i += 2) {
              const [sx, sy] = apply(M, p.pts[i], p.pts[i + 1]);
              i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy);
            }
            if (p.closed) ctx.closePath();
          }
          ctx.stroke();
        } else {
          const [sx, sy] = apply(M, it.x, it.y);
          ctx.beginPath();
          ctx.arc(sx, sy, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.restore();
  }

  // ------------------------------------------------------------------ pointer

  bindPointer() {
    const el = this.ovC;
    el.addEventListener('pointerdown', (e) => this.onDown(e));
    el.addEventListener('pointermove', (e) => this.onMove(e));
    el.addEventListener('pointerup', (e) => this.onUp(e));
    el.addEventListener('pointercancel', (e) => this.onUp(e));
    el.addEventListener('dblclick', (e) => this.onDbl(e));
    el.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.app.emit('contextmenu', e);
    });
    el.addEventListener('pointerleave', () => {
      this.hover = null;
      this.mouse = null;
      this.invalidate(false);
    });
  }

  pos(e) {
    const r = this.ovC.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  onWheel(e) {
    e.preventDefault();
    const [sx, sy] = this.pos(e);
    if (e.ctrlKey || e.metaKey) {
      this.app.zoomAt(Math.exp(-e.deltaY * (e.deltaMode ? 0.05 : 0.0022)), sx, sy);
    } else {
      const k = e.deltaMode ? 16 : 1;
      this.app.view.x -= (e.shiftKey ? e.deltaY : e.deltaX) * k;
      this.app.view.y -= e.shiftKey ? 0 : e.deltaY * k;
      this.app.emit('view');
      this.invalidate();
    }
  }

  updateCursor() {
    const t = this.app.tool;
    let c = 'default';
    if (this.spaceDown || t === 'hand') c = this.drag?.kind === 'pan' ? 'grabbing' : 'grab';
    else if (t === 'pen' || t === 'pencil' || SHAPE_TOOLS.includes(t)) c = 'crosshair';
    else if (this.hoverHandle) c = this.hoverHandle;
    this.ovC.style.cursor = c;
  }

  onDown(e) {
    const app = this.app;
    this.ovC.setPointerCapture(e.pointerId);
    const s = this.pos(e);
    const d = app.screenToDoc(...s);
    this.mouse = s;
    document.activeElement?.blur?.();
    if (e.button === 1 || this.spaceDown || app.tool === 'hand') {
      this.drag = { kind: 'pan', s0: s, v0: { ...app.view } };
      this.updateCursor();
      return;
    }
    if (e.button !== 0) return;
    const tool = app.tool;
    if (tool === 'select') return this.downSelect(e, s, d);
    if (tool === 'direct') return this.downDirect(e, s, d);
    if (tool === 'pen') return this.downPen(e, s, d);
    if (tool === 'pencil') {
      this.drag = { kind: 'pencil', pts: [d], s0: s };
      return;
    }
    if (SHAPE_TOOLS.includes(tool)) {
      this.drag = { kind: 'create', tool, d0: d, s0: s, id: null };
      return;
    }
  }

  onMove(e) {
    const app = this.app;
    const s = this.pos(e);
    const d = app.screenToDoc(...s);
    this.mouse = s;
    app.emit('cursor', d);
    const dr = this.drag;
    if (!dr) {
      // hover feedback
      if (app.tool === 'select' || app.tool === 'direct') {
        const hh = app.tool === 'select' ? this.handleAt(s) : null;
        this.hoverHandle = hh ? hh.cursor : null;
        this.hover = hh ? null : app.hitTest(...d, { deep: app.tool === 'direct' || e.metaKey || e.ctrlKey });
        this.updateCursor();
      }
      this.invalidate(false);
      return;
    }
    switch (dr.kind) {
      case 'pan':
        app.view.x = dr.v0.x + s[0] - dr.s0[0];
        app.view.y = dr.v0.y + s[1] - dr.s0[1];
        app.emit('view');
        this.invalidate();
        break;
      case 'move': this.dragMove(e, s, d); break;
      case 'scale': this.dragScale(e, s, d); break;
      case 'rotate': this.dragRotate(e, s, d); break;
      case 'marquee':
      case 'amarquee':
        dr.x1 = s[0];
        dr.y1 = s[1];
        this.invalidate(false);
        break;
      case 'anchors': this.dragAnchors(e, s, d); break;
      case 'handle': this.dragHandle(e, s, d); break;
      case 'pen': this.dragPen(e, s, d); break;
      case 'pencil': {
        const last = dr.pts[dr.pts.length - 1];
        const [lx, ly] = app.docToScreen(...last);
        if (Math.hypot(lx - s[0], ly - s[1]) > 1.5) dr.pts.push(d);
        this.invalidate(false);
        break;
      }
      case 'create': this.dragCreate(e, s, d); break;
    }
  }

  onUp(e) {
    const app = this.app;
    const dr = this.drag;
    this.drag = null;
    this.guides = [];
    if (!dr) return;
    const s = this.pos(e);
    switch (dr.kind) {
      case 'marquee': {
        const a = app.screenToDoc(dr.x0, dr.y0), b = app.screenToDoc(dr.x1 ?? dr.x0, dr.y1 ?? dr.y0);
        const box = { x0: Math.min(a[0], b[0]), y0: Math.min(a[1], b[1]), x1: Math.max(a[0], b[0]), y1: Math.max(a[1], b[1]) };
        if (box.x1 - box.x0 > 1 || box.y1 - box.y0 > 1) {
          const ids = [];
          const layers = app.doc.nodes[app.doc.root].children;
          const scope = app.entered ? [app.entered] : layers;
          for (const lid of scope) {
            const L = app.doc.nodes[lid];
            if (!L.visible || L.locked) continue;
            for (const cid of L.children) {
              const c = app.doc.nodes[cid];
              if (!c.visible || c.locked) continue;
              const nb = app.nodeBounds(cid);
              if (boundsValid(nb) && nb.x0 < box.x1 && nb.x1 > box.x0 && nb.y0 < box.y1 && nb.y1 > box.y0) ids.push(cid);
            }
          }
          app.select(ids, e.shiftKey ? 'add' : 'replace');
        }
        break;
      }
      case 'amarquee': {
        const a = [Math.min(dr.x0, dr.x1 ?? dr.x0), Math.min(dr.y0, dr.y1 ?? dr.y0)], b = [Math.max(dr.x0, dr.x1 ?? dr.x0), Math.max(dr.y0, dr.y1 ?? dr.y0)];
        if (!e.shiftKey) this.anchorSel.clear();
        for (const an of this.anchorScreens()) if (an.s[0] >= a[0] && an.s[0] <= b[0] && an.s[1] >= a[1] && an.s[1] <= b[1]) this.anchorSel.add(an.si + ':' + an.i);
        break;
      }
      case 'pencil': this.finishPencil(dr); break;
      case 'create':
        if (!dr.id) this.createAt(dr.tool, dr.d0, null);
        app.commitLive();
        if (!e.altKey) app.setTool('select');
        break;
      case 'pen':
        break;
      default:
        app.commitLive();
    }
    this.updateCursor();
    this.invalidate();
  }

  onDbl(e) {
    const app = this.app;
    const s = this.pos(e);
    const d = app.screenToDoc(...s);
    if (app.tool === 'select') {
      const deep = app.hitTest(...d, { deep: true });
      if (!deep) {
        app.entered = null;
        return;
      }
      const sel = app.selectedNodes()[0];
      if (sel && sel.children && sel.type !== 'bool') {
        // step into the group: pick the child under the pointer
        app.entered = sel.id;
        app.select(app.scopeTarget(deep));
      } else if (sel?.type === 'shape') {
        app.setTool('direct');
      } else if (sel?.type === 'gen') {
        app.emit('open-graph', sel.id);
      }
      return;
    }
    if (app.tool === 'direct' && this.editId) {
      const hit = this.anchorAt(s);
      const n = app.doc.nodes[this.editId];
      if (hit && hit.kind === 'anchor') {
        // toggle smooth / corner
        const path = n.geom.kind === 'path' ? clonePath(n.geom.path) : primPath(n.geom);
        const sp = path.subpaths[hit.si];
        const p = sp.pts[hit.i];
        if (p.in || p.out) {
          p.in = p.out = null;
          p.mode = 'corner';
        } else {
          const sm = smoothAnchors(sp.pts.map((q) => [q.x, q.y]), sp.closed)[hit.i];
          p.in = sm.in;
          p.out = sm.out;
          p.mode = 'smooth';
        }
        app.setProps([n.id], 'geom', { kind: 'path', path }, false, 'Toggle smooth point');
        return;
      }
      // add a point on the segment
      const M = worldMatrix(app.doc, n.id);
      const [lx, ly] = apply(invert(M), ...d);
      const path = n.geom.kind === 'path' ? n.geom.path : primPath(n.geom);
      const near = nearestOnPath(path, lx, ly);
      if (near.d * app.view.zoom < 8) {
        app.setProps([n.id], 'geom', { kind: 'path', path: splitSegment(path, near.si, near.seg, near.t) }, false, 'Add point');
      }
    }
  }

  // ---------------------------------------------------------------- select tool

  handleAt(s) {
    const f = this.selectionFrame();
    if (!f) return null;
    const H = this.handlesOf(f);
    if (Math.hypot(H.rot.screen[0] - s[0], H.rot.screen[1] - s[1]) < 8) return { key: 'rot', frame: f, H, cursor: 'grab' };
    for (const k of ['nw', 'ne', 'se', 'sw', 'n', 'e', 's', 'w']) {
      const [x, y] = H[k].screen;
      if (Math.abs(x - s[0]) <= HANDLE && Math.abs(y - s[1]) <= HANDLE) {
        const cursor = { n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize', nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize' }[k];
        return { key: k, frame: f, H, cursor };
      }
    }
    // just outside a corner rotates
    for (const k of ['nw', 'ne', 'se', 'sw']) {
      const [x, y] = H[k].screen;
      const dd = Math.hypot(x - s[0], y - s[1]);
      if (dd > HANDLE && dd < 20) {
        const inside = this.insideFrame(f, s);
        if (!inside) return { key: 'rot', frame: f, H, cursor: 'grab' };
      }
    }
    return null;
  }

  insideFrame(f, s) {
    const d = this.app.screenToDoc(...s);
    const [lx, ly] = apply(invert(f.W), ...d);
    return lx >= f.lb.x0 && lx <= f.lb.x1 && ly >= f.lb.y0 && ly <= f.lb.y1;
  }

  snapshot(ids) {
    const doc = this.app.doc;
    return ids.map((id) => {
      const n = doc.nodes[id];
      return { id, node: JSON.parse(JSON.stringify(n)), W: worldMatrix(doc, id), PW: parentMatrix(doc, id) };
    });
  }

  downSelect(e, s, d) {
    const app = this.app;
    const hh = app.sel.size ? this.handleAt(s) : null;
    const ids = [...app.sel].filter((id) => app.doc.nodes[id]?.type !== 'layer');
    if (hh && ids.length) {
      const snap = this.snapshot(ids);
      if (hh.key === 'rot') {
        const b = hh.frame.single ? null : app.selectionBounds(ids);
        const c = hh.frame.single
          ? apply(hh.frame.W, (hh.frame.lb.x0 + hh.frame.lb.x1) / 2, (hh.frame.lb.y0 + hh.frame.lb.y1) / 2)
          : [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2];
        this.drag = { kind: 'rotate', snap, c, a0: Math.atan2(d[1] - c[1], d[0] - c[0]) };
        app.store.begin('Rotate', 'rotate');
      } else {
        this.drag = { kind: 'scale', snap, key: hh.key, frame: hh.frame, H: hh.H };
        app.store.begin('Resize', 'resize');
      }
      return;
    }
    const hit = app.hitTest(...d, { deep: e.metaKey || e.ctrlKey });
    if (hit) {
      if (e.shiftKey) app.select(hit, 'toggle');
      else if (!app.sel.has(hit)) app.select(hit);
      let move = [...app.sel].filter((id) => app.doc.nodes[id]?.type !== 'layer');
      if (e.altKey && move.length) {
        app.duplicate(0);
        move = [...app.sel];
      }
      this.drag = { kind: 'move', snap: this.snapshot(move), d0: d, bounds: app.selectionBounds(move), moved: false };
      return;
    }
    if (!e.shiftKey) {
      app.select([]);
      app.entered = null;
    }
    this.drag = { kind: 'marquee', x0: s[0], y0: s[1], x1: s[0], y1: s[1] };
  }

  snapTargets(exclude) {
    const app = this.app;
    const ab = app.doc.artboard;
    const xs = [0, ab.w / 2, ab.w], ys = [0, ab.h / 2, ab.h];
    for (const lid of app.doc.nodes[app.doc.root].children) {
      const L = app.doc.nodes[lid];
      if (!L.visible) continue;
      for (const cid of L.children) {
        if (exclude.has(cid) || !app.doc.nodes[cid].visible) continue;
        const b = app.nodeBounds(cid);
        if (!boundsValid(b)) continue;
        xs.push(b.x0, (b.x0 + b.x1) / 2, b.x1);
        ys.push(b.y0, (b.y0 + b.y1) / 2, b.y1);
      }
    }
    return { xs, ys };
  }

  dragMove(e, s, d) {
    const app = this.app;
    const dr = this.drag;
    let dx = d[0] - dr.d0[0], dy = d[1] - dr.d0[1];
    if (!dr.moved && Math.hypot(dx, dy) * app.view.zoom < 3) return;
    if (!dr.moved) {
      dr.moved = true;
      app.store.begin('Move', 'move');
      dr.targets = this.snapTargets(new Set(dr.snap.map((q) => q.id)));
    }
    if (e.shiftKey) Math.abs(dx) > Math.abs(dy) ? (dy = 0) : (dx = 0);
    this.guides = [];
    if (!(e.metaKey || e.ctrlKey) && boundsValid(dr.bounds)) {
      const th = 6 / app.view.zoom;
      const b = dr.bounds;
      const snap1 = (vals, cands, axis) => {
        let best = null;
        for (const v of vals) for (const c of cands) if (Math.abs(c - v) < th && (!best || Math.abs(c - v) < Math.abs(best.d))) best = { d: c - v, v: c };
        if (best) this.guides.push({ axis, v: best.v });
        return best ? best.d : 0;
      };
      dx += snap1([b.x0 + dx, (b.x0 + b.x1) / 2 + dx, b.x1 + dx], dr.targets.xs, 'x');
      dy += snap1([b.y0 + dy, (b.y0 + b.y1) / 2 + dy, b.y1 + dy], dr.targets.ys, 'y');
    }
    const ops = [];
    for (const q of dr.snap) {
      const inv = invert([q.PW[0], q.PW[1], q.PW[2], q.PW[3], 0, 0]);
      const [lx, ly] = applyVec(inv, dx, dy);
      ops.push({ op: 'set', id: q.id, path: 'transform.x', value: q.node.transform.x + lx });
      ops.push({ op: 'set', id: q.id, path: 'transform.y', value: q.node.transform.y + ly });
    }
    app.store.exec(ops);
    this.invalidate();
  }

  // Resize one node by factors (fx, fy) about local point (ax, ay), starting from its snapshot.
  resizeOps(q, fx, fy, ax, ay) {
    const n = q.node;
    const t = n.transform;
    const L = fromTransform(t);
    const [nx, ny] = apply(L, ax * (1 - fx), ay * (1 - fy));
    const ops = [];
    const set = (path, value) => ops.push({ op: 'set', id: n.id, path, value });
    if (n.type === 'shape' && n.geom.kind !== 'path') {
      const g = { ...n.geom };
      g.w = Math.max(0.5, Math.abs(g.w * fx));
      if (primHasSize(g.kind)) g.h = Math.max(0.5, Math.abs(g.h * fy));
      set('geom', g);
      set('transform', { ...t, x: nx, y: ny, sx: Math.abs(t.sx) * Math.sign(t.sx || 1) * Math.sign(fx || 1), sy: Math.abs(t.sy) * Math.sign(t.sy || 1) * (primHasSize(g.kind) ? Math.sign(fy || 1) : 1) });
    } else if (n.type === 'shape') {
      set('geom', { kind: 'path', path: transformPath(n.geom.path, [fx, 0, 0, fy, ax * (1 - fx), ay * (1 - fy)]) });
    } else if (n.type === 'image') {
      set('w', Math.max(0.5, Math.abs(n.w * fx)));
      set('h', Math.max(0.5, Math.abs(n.h * fy)));
      set('transform', { ...t, x: nx, y: ny, sx: t.sx * Math.sign(fx || 1), sy: t.sy * Math.sign(fy || 1) });
    } else {
      set('transform', { ...t, x: nx, y: ny, sx: t.sx * fx, sy: t.sy * fy });
    }
    return ops;
  }

  dragScale(e, s, d) {
    const app = this.app;
    const dr = this.drag;
    const { frame, key } = dr;
    const lb = frame.lb;
    const cx = (lb.x0 + lb.x1) / 2, cy = (lb.y0 + lb.y1) / 2;
    const hp = [key.includes('w') ? lb.x0 : key.includes('e') ? lb.x1 : cx, key.includes('n') ? lb.y0 : key.includes('s') ? lb.y1 : cy];
    const ap = e.altKey ? [cx, cy] : [key.includes('w') ? lb.x1 : key.includes('e') ? lb.x0 : cx, key.includes('n') ? lb.y1 : key.includes('s') ? lb.y0 : cy];
    const [qx, qy] = apply(invert(frame.W), ...d);
    let fx = key.includes('w') || key.includes('e') ? (qx - ap[0]) / (hp[0] - ap[0] || 1e-9) : 1;
    let fy = key.includes('n') || key.includes('s') ? (qy - ap[1]) / (hp[1] - ap[1] || 1e-9) : 1;
    if (e.shiftKey) {
      if (key.length === 2) {
        const f = Math.max(Math.abs(fx), Math.abs(fy));
        fx = f * Math.sign(fx || 1);
        fy = f * Math.sign(fy || 1);
      } else if (fx !== 1) fy = Math.abs(fx);
      else fx = Math.abs(fy);
    }
    if (Math.abs(fx) < 1e-3) fx = 1e-3 * Math.sign(fx || 1);
    if (Math.abs(fy) < 1e-3) fy = 1e-3 * Math.sign(fy || 1);
    const ops = [];
    for (const q of dr.snap) {
      // the anchor in this node's own local space
      const a = frame.single ? ap : apply(invert(q.W), ...apply(frame.W, ...ap));
      if (frame.single) ops.push(...this.resizeOps(q, fx, fy, a[0], a[1]));
      else {
        // page-aligned frame: map doc-axis factors into the node's axes (exact when unrotated)
        const r = Math.abs(Math.sin(Math.atan2(q.W[1], q.W[0])));
        const lfx = r > 0.7 ? fy : fx, lfy = r > 0.7 ? fx : fy;
        ops.push(...this.resizeOps(q, lfx, lfy, a[0], a[1]));
      }
    }
    app.store.exec(ops);
    this.invalidate();
  }

  dragRotate(e, s, d) {
    const app = this.app;
    const dr = this.drag;
    let da = Math.atan2(d[1] - dr.c[1], d[0] - dr.c[0]) - dr.a0;
    if (e.shiftKey) {
      const base = dr.snap[0].node.transform.rot * DEG;
      da = Math.round((base + da) / (15 * DEG)) * 15 * DEG - base;
    }
    const ops = [];
    const c = Math.cos(da), sn = Math.sin(da);
    for (const q of dr.snap) {
      const o = apply(q.W, 0, 0);
      const ox = dr.c[0] + (o[0] - dr.c[0]) * c - (o[1] - dr.c[1]) * sn;
      const oy = dr.c[1] + (o[0] - dr.c[0]) * sn + (o[1] - dr.c[1]) * c;
      const [px, py] = apply(invert(q.PW), ox, oy);
      const flip = q.PW[0] * q.PW[3] - q.PW[1] * q.PW[2] < 0 ? -1 : 1;
      let rot = q.node.transform.rot + (flip * da) / DEG;
      rot = ((rot % 360) + 540) % 360 - 180;
      ops.push({ op: 'set', id: q.id, path: 'transform', value: { ...q.node.transform, x: px, y: py, rot } });
    }
    app.store.exec(ops);
    this.dragAngle = da;
    this.invalidate();
  }

  // ---------------------------------------------------------------- direct tool

  anchorAt(s) {
    let best = null;
    for (const a of this.anchorScreens()) {
      for (const [kind, p] of [['in', a.hin], ['out', a.hout]]) {
        if (p && Math.hypot(p[0] - s[0], p[1] - s[1]) < 6) best = { kind: 'handle', which: kind, si: a.si, i: a.i };
      }
      if (Math.hypot(a.s[0] - s[0], a.s[1] - s[1]) < 7) return { kind: 'anchor', si: a.si, i: a.i };
    }
    return best;
  }

  ensurePathOp(n) {
    // editing a primitive's points converts it to a free path first
    if (n.geom.kind !== 'path') this.app.store.exec({ op: 'set', id: n.id, path: 'geom', value: { kind: 'path', path: primPath(n.geom) } });
  }

  downDirect(e, s, d) {
    const app = this.app;
    const n = app.doc.nodes[this.editId];
    if (n) {
      const hit = this.anchorAt(s);
      if (hit) {
        app.store.begin('Edit points', 'points');
        this.ensurePathOp(n);
        const path = clonePath(app.doc.nodes[n.id].geom.path);
        const Minv = invert(worldMatrix(app.doc, n.id));
        if (hit.kind === 'anchor') {
          const k = hit.si + ':' + hit.i;
          if (e.shiftKey) this.anchorSel.has(k) ? this.anchorSel.delete(k) : this.anchorSel.add(k);
          else if (!this.anchorSel.has(k)) this.anchorSel = new Set([k]);
          this.drag = { kind: 'anchors', id: n.id, path, Minv, d0: apply(Minv, ...d) };
        } else {
          this.drag = { kind: 'handle', id: n.id, path, Minv, hit };
        }
        this.invalidate(false);
        return;
      }
    }
    const hit = app.hitTest(...d, { deep: true });
    if (hit) {
      if (hit !== this.editId) {
        this.anchorSel.clear();
        app.select(hit);
      }
      // drag the whole shape
      this.drag = { kind: 'move', snap: this.snapshot([hit]), d0: d, bounds: app.selectionBounds([hit]), moved: false };
      return;
    }
    if (this.editId) {
      this.drag = { kind: 'amarquee', x0: s[0], y0: s[1], x1: s[0], y1: s[1] };
      return;
    }
    app.select([]);
  }

  dragAnchors(e, s, d) {
    const dr = this.drag;
    const [lx, ly] = apply(dr.Minv, ...d);
    let dx = lx - dr.d0[0], dy = ly - dr.d0[1];
    if (e.shiftKey) Math.abs(dx) > Math.abs(dy) ? (dy = 0) : (dx = 0);
    const path = clonePath(dr.path);
    for (const k of this.anchorSel) {
      const [si, i] = k.split(':').map(Number);
      const p = path.subpaths[si]?.pts[i];
      if (p) {
        p.x += dx;
        p.y += dy;
      }
    }
    this.app.store.exec({ op: 'set', id: dr.id, path: 'geom', value: { kind: 'path', path } });
    this.invalidate();
  }

  dragHandle(e, s, d) {
    const dr = this.drag;
    const [lx, ly] = apply(dr.Minv, ...d);
    const path = clonePath(dr.path);
    const p = path.subpaths[dr.hit.si].pts[dr.hit.i];
    const v = [lx - p.x, ly - p.y];
    const other = dr.hit.which === 'in' ? 'out' : 'in';
    p[dr.hit.which] = v;
    if (e.altKey) p.mode = 'corner';
    else if (p.mode === 'sym') p[other] = [-v[0], -v[1]];
    else if (p.mode === 'smooth' && p[other]) {
      const L = Math.hypot(...p[other]);
      const vl = Math.hypot(...v) || 1;
      p[other] = [(-v[0] / vl) * L, (-v[1] / vl) * L];
    }
    this.app.store.exec({ op: 'set', id: dr.id, path: 'geom', value: { kind: 'path', path } });
    this.invalidate();
  }

  deleteAnchors() {
    const app = this.app;
    const n = app.doc.nodes[this.editId];
    if (!n || !this.anchorSel.size) return false;
    const path = n.geom.kind === 'path' ? clonePath(n.geom.path) : primPath(n.geom);
    const kill = new Set(this.anchorSel);
    path.subpaths = path.subpaths
      .map((sp, si) => ({ ...sp, pts: sp.pts.filter((_, i) => !kill.has(si + ':' + i)) }))
      .filter((sp) => sp.pts.length >= 2);
    this.anchorSel.clear();
    if (!path.subpaths.length) app.deleteSelection();
    else app.setProps([n.id], 'geom', { kind: 'path', path }, false, 'Delete points');
    return true;
  }

  // ---------------------------------------------------------------- pen

  downPen(e, s, d) {
    const app = this.app;
    if (this.pen) {
      const n = app.doc.nodes[this.pen.id];
      const sp = n.geom.path.subpaths[0];
      const M = this.screenMatrix(n.id);
      const first = apply(M, sp.pts[0].x, sp.pts[0].y);
      if (sp.pts.length > 1 && Math.hypot(first[0] - s[0], first[1] - s[1]) < 9) {
        const path = clonePath(n.geom.path);
        path.subpaths[0].closed = true;
        app.store.exec({ op: 'set', id: n.id, path: 'geom', value: { kind: 'path', path } });
        if (!n.fill) app.store.exec({ op: 'set', id: n.id, path: 'fill', value: solid(app.nextColor()) });
        this.finishPen();
        return;
      }
      const [lx, ly] = apply(invert(worldMatrix(app.doc, n.id)), ...d);
      const path = clonePath(n.geom.path);
      path.subpaths[0].pts.push(anchor(lx, ly));
      app.store.exec({ op: 'set', id: n.id, path: 'geom', value: { kind: 'path', path } });
      this.drag = { kind: 'pen', id: n.id, a: [lx, ly], Minv: invert(worldMatrix(app.doc, n.id)) };
      return;
    }
    const parent = app.activeParent();
    const PW = worldMatrix(app.doc, parent === app.doc.root ? parent : parent);
    const [lx, ly] = apply(invert(parent === app.doc.root ? [1, 0, 0, 1, 0, 0] : PW), ...d);
    const node = makeShape('path', { path: { subpaths: [{ closed: false, pts: [anchor(lx, ly)] }] }, name: 'Path' });
    node.fill = null;
    node.stroke = makeStroke(oklch(0.22, 0.02, 270), 3);
    app.store.begin('Pen', 'pen');
    app.store.exec({ op: 'insert', node, parent });
    app.sel = new Set([node.id]);
    app.emit('selection');
    this.pen = { id: node.id };
    this.drag = { kind: 'pen', id: node.id, a: [lx, ly], Minv: invert(worldMatrix(app.doc, node.id)) };
  }

  dragPen(e, s, d) {
    const app = this.app;
    const dr = this.drag;
    const n = app.doc.nodes[dr.id];
    const [lx, ly] = apply(dr.Minv, ...d);
    const v = [lx - dr.a[0], ly - dr.a[1]];
    if (Math.hypot(...v) * app.view.zoom < 3) return;
    const path = clonePath(n.geom.path);
    const pts = path.subpaths[0].pts;
    const p = pts[pts.length - 1];
    p.out = v;
    p.in = [-v[0], -v[1]];
    p.mode = 'sym';
    app.store.exec({ op: 'set', id: n.id, path: 'geom', value: { kind: 'path', path } });
    this.invalidate();
  }

  finishPen() {
    const app = this.app;
    const pen = this.pen;
    this.pen = null;
    if (!pen) return;
    const n = app.doc.nodes[pen.id];
    if (!n || n.geom.path.subpaths[0].pts.length < 2) {
      app.store.cancel();
      app.select([]);
      return;
    }
    this.recenter(n.id);
    app.store.commit();
    app.select(n.id);
  }

  // Move a path's points so its origin sits at the middle of its outline.
  recenter(id) {
    const app = this.app;
    const n = app.doc.nodes[id];
    const b = polysBounds(flattenPath(n.geom.path, 0.5));
    if (!boundsValid(b)) return;
    const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
    const L = fromTransform(n.transform);
    const [x, y] = apply(L, cx, cy);
    app.store.exec([
      { op: 'set', id, path: 'geom', value: { kind: 'path', path: transformPath(n.geom.path, [1, 0, 0, 1, -cx, -cy]) } },
      { op: 'set', id, path: 'transform.x', value: x },
      { op: 'set', id, path: 'transform.y', value: y },
    ]);
  }

  // ---------------------------------------------------------------- pencil

  finishPencil(dr) {
    const app = this.app;
    if (dr.pts.length < 3) return;
    const parent = app.activeParent();
    const Pinv = invert(parent === app.doc.root ? [1, 0, 0, 1, 0, 0] : worldMatrix(app.doc, parent));
    const pts = dr.pts.map((p) => apply(Pinv, ...p));
    const [fx, fy] = app.docToScreen(...dr.pts[0]), [lx, ly] = app.docToScreen(...dr.pts[dr.pts.length - 1]);
    const closed = Math.hypot(fx - lx, fy - ly) < 16 && dr.pts.length > 8;
    const path = fitFreehand(pts, closed, 1.6 / app.view.zoom);
    const node = makeShape('path', { path, name: closed ? 'Drawn shape' : 'Stroke' });
    if (closed) {
      node.fill = solid(app.nextColor());
      node.stroke = null;
    } else {
      node.fill = null;
      node.stroke = makeStroke(oklch(0.25, 0.03, 270), Math.max(2, 10 / Math.sqrt(app.view.zoom)), { profile: 'taper', taper: 0.5 });
    }
    app.store.begin('Draw');
    app.store.exec({ op: 'insert', node, parent });
    this.recenter(node.id);
    app.store.commit();
    app.select(node.id);
  }

  // ---------------------------------------------------------------- shape tools

  primFor(tool, w, h) {
    const g = {};
    if (tool === 'line') return { w: Math.max(1, w) };
    g.w = Math.max(1, w);
    g.h = Math.max(1, h);
    return g;
  }

  createAt(tool, d, _) {
    const app = this.app;
    const parent = app.activeParent();
    const Pinv = invert(parent === app.doc.root ? [1, 0, 0, 1, 0, 0] : worldMatrix(app.doc, parent));
    const [x, y] = apply(Pinv, ...d);
    const node = makeShape(tool);
    node.transform.x = x;
    node.transform.y = y;
    if (node.fill) node.fill = solid(app.nextColor());
    app.addNode(node, parent, null, 'Add ' + tool);
  }

  dragCreate(e, s, d) {
    const app = this.app;
    const dr = this.drag;
    let dx = d[0] - dr.d0[0], dy = d[1] - dr.d0[1];
    if (!dr.id && Math.hypot(dx, dy) * app.view.zoom < 4) return;
    const parent = app.activeParent();
    const PW = parent === app.doc.root ? [1, 0, 0, 1, 0, 0] : worldMatrix(app.doc, parent);
    const Pinv = invert(PW);
    let t;
    let geom;
    if (dr.tool === 'line') {
      if (e.shiftKey) {
        const a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4), L = Math.hypot(dx, dy);
        dx = Math.cos(a) * L;
        dy = Math.sin(a) * L;
      }
      const mid = apply(Pinv, dr.d0[0] + dx / 2, dr.d0[1] + dy / 2);
      t = { x: mid[0], y: mid[1], rot: (Math.atan2(dy, dx) * 180) / Math.PI, sx: 1, sy: 1, skew: 0 };
      geom = { w: Math.hypot(dx, dy) };
      dr.readout = `${Math.round(Math.hypot(dx, dy))} at ${Math.round((Math.atan2(-dy, dx) * 180) / Math.PI)}°`;
    } else {
      if (e.shiftKey) {
        const m = Math.max(Math.abs(dx), Math.abs(dy));
        dx = m * Math.sign(dx || 1);
        dy = m * Math.sign(dy || 1);
      }
      const c = e.altKey ? dr.d0 : [dr.d0[0] + dx / 2, dr.d0[1] + dy / 2];
      const w = e.altKey ? Math.abs(dx) * 2 : Math.abs(dx), h = e.altKey ? Math.abs(dy) * 2 : Math.abs(dy);
      const lc = apply(Pinv, ...c);
      t = { x: lc[0], y: lc[1], rot: 0, sx: 1, sy: 1, skew: 0 };
      geom = this.primFor(dr.tool, w, h);
      dr.readout = `${Math.round(w)} × ${Math.round(h)}`;
    }
    if (!dr.id) {
      const node = makeShape(dr.tool);
      Object.assign(node.geom, geom);
      node.transform = t;
      if (node.fill) node.fill = solid(app.nextColor());
      app.store.begin('Add ' + dr.tool, 'create');
      app.store.exec({ op: 'insert', node, parent });
      dr.id = node.id;
      app.sel = new Set([node.id]);
      app.emit('selection');
    } else {
      const n = app.doc.nodes[dr.id];
      app.store.exec([
        { op: 'set', id: dr.id, path: 'geom', value: { ...n.geom, ...geom } },
        { op: 'set', id: dr.id, path: 'transform', value: t },
      ]);
    }
    this.invalidate();
  }
}
