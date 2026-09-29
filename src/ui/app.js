// Application controller: owns the store, selection, tools and commands.
// Panels and the viewport talk to the document only through here and the store.

import { Store } from '../core/store.js';
import { Geometry } from '../core/geometry.js';
import { Renderer } from '../render/renderer.js';
import { setImageLoadHandler } from '../render/paint.js';
import {
  newDoc, baseNode, makeShape, isContainer, ancestors, worldMatrix, parentMatrix, cloneSubtree, subtreeNodes, reidSubtree, walk, solid, validateDoc, uid,
} from '../core/doc.js';
import { primPath } from '../core/prims.js';
import { pathFromPolys, transformPolys, polysBounds, clonePath } from '../core/path.js';
import { mul, invert, apply, fromTransform, transformBounds, emptyBounds, addPoint, boundsValid, unionBounds } from '../core/math.js';
import { evalGraph } from '../core/graph.js';
import { EFFECTS } from '../core/effects.js';
import { toast } from './widgets.js';

export class App {
  constructor() {
    this.store = new Store(newDoc());
    this.geo = new Geometry(this.store);
    this.renderer = new Renderer(this.store, this.geo);
    this.sel = new Set();
    this.tool = 'select';
    this.view = { zoom: 0.5, x: 0, y: 0 };
    this.listeners = {};
    this.clipboard = null;
    this.outline = false;
    this.graphPreview = null; // { gen, gid }
    this.colorCycle = 0;
    this.commands = {};
    this.store.subscribe((e) => this.onStore(e));
    setImageLoadHandler(() => {
      this.renderer.clearCaches();
      this.requestRender();
    });
  }

  get doc() {
    return this.store.doc;
  }

  on(evt, fn) {
    (this.listeners[evt] ||= []).push(fn);
  }
  emit(evt, data) {
    for (const fn of this.listeners[evt] || []) fn(data);
  }

  onStore(e) {
    if (e.type === 'load') {
      this.sel.clear();
      this.geo?.clear();
      this.renderer?.clearCaches();
    }
    // drop selected ids that no longer exist
    for (const id of [...this.sel]) if (!this.doc.nodes[id]) this.sel.delete(id);
    this.emit('doc', e);
    this.requestRender();
    if (e.type === 'commit' || e.undo || e.redo || e.type === 'load') this.scheduleAutosave();
  }

  requestRender() {
    this.emit('render');
  }

  // ---------- selection ----------

  select(ids, mode = 'replace') {
    ids = (Array.isArray(ids) ? ids : [ids]).filter((id) => id && this.doc.nodes[id] && id !== this.doc.root);
    if (mode === 'replace') this.sel = new Set(ids);
    else if (mode === 'add') ids.forEach((id) => this.sel.add(id));
    else if (mode === 'toggle') ids.forEach((id) => (this.sel.has(id) ? this.sel.delete(id) : this.sel.add(id)));
    // a node and its ancestor are never both selected
    for (const id of [...this.sel]) if (ancestors(this.doc, id).some((a) => this.sel.has(a))) this.sel.delete(id);
    const gen = this.selectedNodes().find((n) => n.type === 'gen');
    if (gen && this.graphPreview?.gen !== gen.id) this.graphPreview = null;
    this.emit('selection');
    this.requestRender();
  }

  selectedNodes() {
    return [...this.sel].map((id) => this.doc.nodes[id]).filter(Boolean);
  }

  // Where new things go: the layer (or group) of the selection, else the top layer.
  activeParent() {
    const d = this.doc;
    const first = this.selectedNodes()[0];
    if (first) {
      if (first.type === 'layer') return first.id;
      return first.parent;
    }
    if (this.activeLayer && d.nodes[this.activeLayer]) return this.activeLayer;
    const layers = d.nodes[d.root].children;
    return layers[layers.length - 1] || d.root;
  }

  nextColor() {
    const pal = this.doc.palette.filter((c) => c.l > 0.3 && c.l < 0.9);
    const c = pal[this.colorCycle++ % pal.length] || { l: 0.6, c: 0.12, h: 40, a: 1 };
    return { ...c };
  }

  // Insert a node (or subtree) and select it.
  addNode(node, parent = this.activeParent(), index = null, label = 'Add ' + node.type) {
    const d = this.doc;
    if (d.nodes[parent]?.type === 'bool' && node.type === 'layer') parent = d.root;
    this.store.exec({ op: 'insert', node, parent, index }, label);
    this.select(node.id);
    return node.id;
  }

  addSubtree(sub, parent = this.activeParent(), index = null, label = 'Add') {
    const ops = this.store.insertSubtree(sub, parent, index);
    this.store.exec(ops, label);
    this.select(sub.rootId);
    return sub.rootId;
  }

  // Change a property on several nodes. live=true keeps the undo step open (dragging).
  setProps(ids, path, valueOrFn, live = false, label) {
    const key = 'set:' + [...ids].join(',') + ':' + path;
    if (live) this.store.begin(label || 'Change ' + path, key);
    const ops = [...ids].map((id) => ({ op: 'set', id, path, value: typeof valueOrFn === 'function' ? valueOrFn(this.doc.nodes[id], id) : valueOrFn }));
    this.store.exec(ops, label || 'Change ' + path);
    if (!live && this.store.open?.key === key) this.store.commit();
  }

  commitLive() {
    if (this.store.open) this.store.commit();
  }

  // ---------- geometry helpers ----------

  // Document-space bounds of a node (after its outline effects).
  nodeBounds(id) {
    const d = this.doc;
    const n = d.nodes[id];
    if (!n) return emptyBounds();
    if (n.type === 'group' || n.type === 'layer') {
      let b = emptyBounds();
      for (const c of n.children) {
        const cn = d.nodes[c];
        if (cn && cn.visible && !cn.mask) {
          const cb = this.nodeBounds(c);
          if (boundsValid(cb)) b = unionBounds(b, cb);
        }
      }
      return b;
    }
    const g = this.geo.of(id, 0.5);
    const lb = polysBounds(g.polys);
    if (!boundsValid(lb)) return lb;
    return transformBounds(worldMatrix(d, id), lb);
  }

  selectionBounds(ids = [...this.sel]) {
    let b = emptyBounds();
    for (const id of ids) {
      const nb = this.nodeBounds(id);
      if (boundsValid(nb)) b = unionBounds(b, nb);
    }
    return b;
  }

  // Top-most node under a document point. deep=false returns the object at the scope
  // level (a whole group), deep=true returns the leaf.
  hitTest(x, y, { deep = false, tol = 4 } = {}) {
    const d = this.doc;
    const z = this.view.zoom;
    let found = null;
    const visit = (id, M) => {
      if (found) return;
      const n = d.nodes[id];
      if (!n || !n.visible || n.locked || n.mask) return;
      const Mn = id === d.root ? M : mul(M, fromTransform(n.transform));
      if (n.children && n.type !== 'bool') {
        for (let i = n.children.length - 1; i >= 0 && !found; i--) visit(n.children[i], Mn);
        return;
      }
      const g = this.geo.of(id, 0.5);
      const [lx, ly] = apply(invert(Mn), x, y);
      const scale = Math.sqrt(Math.abs(Mn[0] * Mn[3] - Mn[1] * Mn[2])) || 1;
      const t = tol / z / scale;
      if (n.type === 'image') {
        if (Math.abs(lx) <= n.w / 2 && Math.abs(ly) <= n.h / 2) found = id;
        return;
      }
      if (hitPolys(g.polys, lx, ly, n.fill || n.type === 'gen', (n.stroke?.width || 0) / 2 + t)) found = id;
    };
    visit(d.root, [1, 0, 0, 1, 0, 0]);
    if (!found || deep) return found;
    return this.scopeTarget(found);
  }

  // Climb from a leaf to the object that a plain click should pick.
  scopeTarget(id) {
    const d = this.doc;
    let cur = id;
    for (;;) {
      const n = d.nodes[cur];
      const p = d.nodes[n.parent];
      if (!p || p.type === 'layer' || p.id === d.root || p.id === this.entered) return cur;
      cur = p.id;
    }
  }

  screenToDoc(sx, sy) {
    return [(sx - this.view.x) / this.view.zoom, (sy - this.view.y) / this.view.zoom];
  }
  docToScreen(x, y) {
    return [x * this.view.zoom + this.view.x, y * this.view.zoom + this.view.y];
  }

  // ---------- structural operations ----------

  deleteSelection() {
    const ids = [...this.sel];
    if (!ids.length) return;
    const ops = ids.flatMap((id) => this.store.removeSubtreeOps(id));
    this.store.exec(ops, 'Delete');
    this.select([]);
  }

  duplicate(offset = 20) {
    const ids = this.sortedSelection();
    if (!ids.length) return;
    this.store.begin('Duplicate');
    const out = [];
    for (const id of ids) {
      const n = this.doc.nodes[id];
      const sub = cloneSubtree(this.doc, id, n.parent);
      const r = sub.nodes[sub.rootId];
      r.transform.x += offset;
      r.transform.y += offset;
      r.name = n.name;
      const p = this.doc.nodes[n.parent];
      this.store.exec(this.store.insertSubtree(sub, n.parent, p.children.indexOf(id) + 1));
      out.push(sub.rootId);
    }
    this.store.commit();
    this.select(out);
  }

  // Selection in drawing order (bottom first).
  sortedSelection() {
    const order = [];
    walk(this.doc, this.doc.root, (n) => {
      if (this.sel.has(n.id)) order.push(n.id);
    });
    return order;
  }

  copy() {
    const ids = this.sortedSelection();
    if (!ids.length) return;
    this.clipboard = ids.map((id) => ({ rootId: id, nodes: subtreeNodes(this.doc, id) }));
    try {
      navigator.clipboard?.writeText(JSON.stringify({ format: 'shapelab.clip', items: this.clipboard }));
    } catch {}
    toast(`Copied ${ids.length} item${ids.length > 1 ? 's' : ''}`);
  }

  cut() {
    this.copy();
    this.deleteSelection();
  }

  paste(items = this.clipboard) {
    if (!items?.length) return;
    const parent = this.activeParent();
    this.store.begin('Paste');
    const out = [];
    for (const it of items) {
      const sub = reidSubtree(it, parent);
      sub.nodes[sub.rootId].transform.x += 16;
      sub.nodes[sub.rootId].transform.y += 16;
      this.store.exec(this.store.insertSubtree(sub, parent));
      out.push(sub.rootId);
    }
    this.store.commit();
    this.select(out);
  }

  // Wrap selected nodes in a new container of a type ('group' or 'bool').
  wrap(type = 'group', props = {}) {
    const ids = this.sortedSelection();
    if (!ids.length) return null;
    const d = this.doc;
    const first = d.nodes[ids[0]];
    const parent = first.parent;
    const siblings = d.nodes[parent].children;
    const index = Math.max(...ids.filter((id) => d.nodes[id].parent === parent).map((id) => siblings.indexOf(id))) - ids.filter((id) => d.nodes[id].parent === parent).length + 1;
    const g = baseNode(type, { name: type === 'bool' ? 'Combined' : 'Group', children: [], ...props });
    // the new container sits at the middle of its contents, so its X/Y mean something
    const PW = worldMatrix(d, parent);
    const b = this.selectionBounds(ids);
    if (boundsValid(b)) {
      const [cx, cy] = apply(invert(PW), (b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2);
      g.transform.x = cx;
      g.transform.y = cy;
    }
    const GW = mul(PW, fromTransform(g.transform));
    this.store.begin(type === 'bool' ? 'Combine' : 'Group');
    this.store.exec({ op: 'insert', node: g, parent, index: Math.max(0, index) });
    ids.forEach((id, i) => {
      const n = d.nodes[id];
      const W = worldMatrix(d, id);
      const local = mul(invert(GW), W);
      this.store.exec({ op: 'move', id, parent: g.id, index: i });
      this.store.exec({ op: 'set', id, path: 'transform', value: decompose(local, n.transform) });
    });
    this.store.commit();
    this.select(g.id);
    return g.id;
  }

  group() {
    return this.wrap('group');
  }

  ungroup() {
    const d = this.doc;
    const groups = this.selectedNodes().filter((n) => n.type === 'group' || n.type === 'bool');
    if (!groups.length) return;
    this.store.begin('Ungroup');
    const out = [];
    for (const g of groups) {
      const parent = g.parent;
      const idx = d.nodes[parent].children.indexOf(g.id);
      const GW = fromTransform(g.transform);
      g.children.slice().forEach((cid, i) => {
        const c = d.nodes[cid];
        const local = mul(GW, fromTransform(c.transform));
        this.store.exec({ op: 'move', id: cid, parent, index: idx + i });
        this.store.exec({ op: 'set', id: cid, path: 'transform', value: decompose(local, c.transform) });
        out.push(cid);
      });
      this.store.exec({ op: 'remove', id: g.id });
    }
    this.store.commit();
    this.select(out);
  }

  combine(op) {
    const nodes = this.selectedNodes();
    if (nodes.length === 1 && nodes[0].type === 'bool') {
      this.setProps([nodes[0].id], 'op', op, false, 'Change combine');
      return;
    }
    if (nodes.length < 2) return toast('Select two or more shapes to combine');
    const first = this.doc.nodes[this.sortedSelection()[0]];
    const fill = first.fill ? JSON.parse(JSON.stringify(first.fill)) : solid(this.nextColor());
    const stroke = first.stroke ? JSON.parse(JSON.stringify(first.stroke)) : null;
    this.wrap('bool', { op, fill, stroke });
  }

  newLayer() {
    const d = this.doc;
    const n = d.nodes[d.root].children.length + 1;
    const layer = baseNode('layer', { name: 'Layer ' + n, children: [] });
    this.store.exec({ op: 'insert', node: layer, parent: d.root }, 'New layer');
    this.activeLayer = layer.id;
    this.select(layer.id);
  }

  reorder(dir) {
    const ids = this.sortedSelection();
    if (!ids.length) return;
    const d = this.doc;
    const list = dir > 0 ? ids.slice().reverse() : ids;
    const ops = [];
    for (const id of list) {
      const n = d.nodes[id];
      const sib = d.nodes[n.parent].children;
      const i = sib.indexOf(id);
      let j = dir === 2 ? sib.length - 1 : dir === -2 ? 0 : i + dir;
      j = Math.max(0, Math.min(sib.length - 1, j));
      if (j !== i) ops.push({ op: 'move', id, parent: n.parent, index: j });
    }
    this.store.exec(ops, 'Reorder');
  }

  // Turn primitives, combined shapes, graph output and outline effects into plain editable paths.
  convertToPath() {
    const d = this.doc;
    const nodes = this.selectedNodes().filter((n) => ['shape', 'bool', 'gen'].includes(n.type));
    if (!nodes.length) return;
    this.store.begin('Convert to path');
    const out = [];
    for (const n of nodes) {
      if (n.type === 'shape') {
        const path = n.effects.some((e) => e.on && EFFECTS[e.type].stage === 'geom')
          ? pathFromPolys(this.geo.of(n.id, 0.2).polys, 0.3)
          : n.geom.kind === 'path' ? clonePath(n.geom.path) : primPath(n.geom);
        this.store.exec([
          { op: 'set', id: n.id, path: 'geom', value: { kind: 'path', path } },
          { op: 'set', id: n.id, path: 'effects', value: n.effects.filter((e) => EFFECTS[e.type].stage !== 'geom') },
        ]);
        out.push(n.id);
      } else if (n.type === 'bool') {
        const polys = this.geo.of(n.id, 0.2).polys;
        const shape = makeShape('path', { path: pathFromPolys(polys, 0.3), name: n.name, fill: n.fill, stroke: n.stroke, transform: { ...n.transform }, effects: n.effects.filter((e) => EFFECTS[e.type].stage !== 'geom'), opacity: n.opacity, blend: n.blend });
        const idx = d.nodes[n.parent].children.indexOf(n.id);
        const parent = n.parent;
        this.store.exec(this.store.removeSubtreeOps(n.id));
        this.store.exec({ op: 'insert', node: shape, parent, index: idx });
        out.push(shape.id);
      } else if (n.type === 'gen') {
        out.push(this.bakeGenerator(n));
      }
    }
    this.store.commit();
    this.select(out);
  }

  // Graph output -> a group of separate paths (each keeps its colour).
  bakeGenerator(n) {
    const d = this.doc;
    const g = this.geo.of(n.id, 0.2);
    const grp = baseNode('group', { name: n.name + ' (baked)', children: [], transform: { ...n.transform }, opacity: n.opacity, blend: n.blend, effects: n.effects.filter((e) => EFFECTS[e.type].stage !== 'geom') });
    const idx = d.nodes[n.parent].children.indexOf(n.id);
    const parent = n.parent;
    this.store.exec(this.store.removeSubtreeOps(n.id));
    this.store.exec({ op: 'insert', node: grp, parent, index: idx });
    (g.items || []).forEach((it, i) => {
      const b = polysBounds(it.polys);
      const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
      const path = pathFromPolys(transformPolys(it.polys, [1, 0, 0, 1, -cx, -cy]), 0.25);
      const fill = it.attrs?.color ? solid({ ...it.attrs.color }) : n.fill ? JSON.parse(JSON.stringify(n.fill)) : null;
      const s = makeShape('path', { path, name: 'Item ' + (i + 1), fill, stroke: n.stroke ? JSON.parse(JSON.stringify(n.stroke)) : null });
      s.transform.x = cx;
      s.transform.y = cy;
      s.opacity = it.attrs?.opacity ?? 1;
      this.store.exec({ op: 'insert', node: s, parent: grp.id });
    });
    return grp.id;
  }

  // Mark the top selected node as a mask for its siblings.
  makeMask(mode = 'alpha') {
    const ids = this.sortedSelection();
    if (!ids.length) return;
    const d = this.doc;
    if (ids.length > 1) {
      // group them, then the top-most one becomes the mask
      const top = ids[ids.length - 1];
      this.wrap('group');
      this.setProps([top], 'mask', mode, false, 'Make mask');
      return;
    }
    const n = d.nodes[ids[0]];
    this.setProps([n.id], 'mask', n.mask ? null : mode, false, n.mask ? 'Release mask' : 'Make mask');
    if (d.nodes[n.parent].type === 'layer' || d.nodes[n.parent].id === d.root) toast('The mask now cuts everything else in "' + d.nodes[n.parent].name + '"');
  }

  flip(axis) {
    const ids = [...this.sel];
    this.setProps(ids, axis === 'h' ? 'transform.sx' : 'transform.sy', (n) => -(n.transform[axis === 'h' ? 'sx' : 'sy'] ?? 1), false, 'Flip');
  }

  // ---------- view ----------

  fit(w, h, pad = 60) {
    const ab = this.doc.artboard;
    const z = Math.min((w - pad * 2) / ab.w, (h - pad * 2) / ab.h);
    this.view.zoom = Math.max(0.02, z);
    this.view.x = (w - ab.w * this.view.zoom) / 2;
    this.view.y = (h - ab.h * this.view.zoom) / 2;
    this.emit('view');
    this.requestRender();
  }

  zoomAt(factor, sx, sy) {
    const z0 = this.view.zoom;
    const z = Math.min(64, Math.max(0.02, z0 * factor));
    this.view.x = sx - ((sx - this.view.x) * z) / z0;
    this.view.y = sy - ((sy - this.view.y) * z) / z0;
    this.view.zoom = z;
    this.emit('view');
    this.requestRender();
  }

  setTool(t) {
    this.tool = t;
    this.emit('tool', t);
    this.requestRender();
  }

  // ---------- commands ----------

  command(id, spec) {
    this.commands[id] = { id, ...spec };
  }
  run(id, ...args) {
    const c = this.commands[id];
    if (!c) return;
    if (c.enabled && !c.enabled()) return;
    c.run(...args);
  }

  // ---------- documents ----------

  loadDoc(doc) {
    validateDoc(doc);
    this.store.load(doc);
    this.emit('fit');
  }

  scheduleAutosave() {
    clearTimeout(this._as);
    this._as = setTimeout(() => this.emit('autosave'), 800);
  }

  // Intermediate output of a graph node, for previewing on the canvas.
  previewData() {
    const p = this.graphPreview;
    if (!p) return null;
    const n = this.doc.nodes[p.gen];
    if (!n || n.type !== 'gen' || !n.graph.nodes[p.gid]) return null;
    const r = evalGraph(n.graph);
    return { node: n, value: r.memo.get(p.gid), M: worldMatrix(this.doc, n.id) };
  }
}

// Winding / distance hit test on local polys.
import { pointInPolys, distToPolys } from '../core/path.js';
function hitPolys(polys, x, y, filled, strokeTol) {
  if (filled && pointInPolys(polys, x, y)) return true;
  return distToPolys(polys, x, y) <= strokeTol;
}

// Matrix -> transform fields, keeping skew at zero where possible.
export function decompose(m, prev = {}) {
  // m = T · R(rot) · K(skew) · S(sx, sy); take sx and rot from the first column,
  // then rotate the second column back: it reads (tan(skew)·sy, sy).
  const sx = Math.hypot(m[0], m[1]) || 1e-9;
  const rot = Math.atan2(m[1], m[0]);
  const c = Math.cos(-rot), s = Math.sin(-rot);
  const x2 = c * m[2] - s * m[3], y2 = s * m[2] + c * m[3];
  const sy = Math.abs(y2) < 1e-12 ? prev.sy ?? 1 : y2;
  const skew = (Math.atan(x2 / sy) * 180) / Math.PI;
  return { x: m[4], y: m[5], rot: (rot * 180) / Math.PI, sx, sy, skew: Math.abs(skew) < 1e-6 ? 0 : skew };
}

export { uid, solid, makeShape, baseNode, worldMatrix, parentMatrix, isContainer, addPoint };
