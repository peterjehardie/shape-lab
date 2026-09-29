// Node graph editor for generator shapes. Lives in the bottom dock.

import { h, menu, toast } from './widgets.js';
import { paramField } from './fields.js';
import { icon } from './icons.js';
import { GNODES, GNODE_CATS, makeGNode, canConnect, paramsOf, evalGraph, attrNames, starterGraph } from '../core/graph.js';
import { baseNode } from '../core/doc.js';

const TYPE_COLOR = { points: '#f0b429', shapes: '#5b9bff', field: '#c678dd', list: '#4fd1a5' };
const TYPE_NAME = { points: 'points', shapes: 'shapes', field: 'field (a value everywhere)', list: 'points or shapes' };

export class GraphEditor {
  constructor(app, host) {
    this.app = app;
    this.host = host;
    this.views = new Map();
    this.sel = null;
    this.genId = null;
    this.lastSig = '';
    this.fields = [];
    this.title = h('div', { class: 'dock-title' });
    this.addBtn = h('button', { class: 'btn small', onclick: () => this.addMenu(this.addBtn) }, icon('plus'), 'Add node');
    this.toolbar = h('div', { class: 'dock-bar' }, icon('graph'), this.title, h('span', { class: 'grow' }),
      this.addBtn,
      h('button', { class: 'icon-btn', title: 'Frame all nodes', onclick: () => this.frameAll() }, icon('fit')),
      h('button', { class: 'icon-btn', title: 'Close graph panel (G)', onclick: () => app.run('toggle-graph', false) }, icon('close')));
    this.area = h('div', { class: 'graph-area', tabindex: '0' });
    this.world = h('div', { class: 'graph-world' });
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('class', 'graph-wires');
    this.world.append(this.svg);
    this.area.append(this.world);
    this.datalist = h('datalist', { id: 'attr-names' });
    this.empty = h('div', { class: 'graph-empty' });
    host.append(this.toolbar, this.area, this.datalist, this.empty);
    this.bindArea();
    app.on('selection', () => this.follow());
    app.on('doc', () => this.refresh());
    app.on('open-graph', (id) => {
      app.run('toggle-graph', true);
      this.genId = id;
      this.lastSig = '';
      this.refresh();
    });
    this.follow();
  }

  get gen() {
    const n = this.app.doc.nodes[this.genId];
    return n && n.type === 'gen' ? n : null;
  }
  get view() {
    let v = this.views.get(this.genId);
    if (!v) this.views.set(this.genId, (v = { x: 20, y: 20, z: 0.85 }));
    return v;
  }

  follow() {
    const s = this.app.selectedNodes();
    if (s.length === 1 && s[0].type === 'gen' && s[0].id !== this.genId) {
      this.genId = s[0].id;
      this.sel = null;
      this.lastSig = '';
    }
    this.refresh();
  }

  signature() {
    const g = this.gen?.graph;
    if (!g) return 'none';
    return this.genId + '|' + Object.values(g.nodes).map((n) => n.id + n.type + paramsOf(n).map((p) => p.key).join(',') + '@' + Math.round(n.x) + ',' + Math.round(n.y)).join(';') + '|' + g.links.map((l) => l.from + '>' + l.to + '.' + l.port).join(';') + '|' + g.out;
  }

  refresh() {
    const gen = this.gen;
    this.empty.style.display = gen ? 'none' : '';
    this.area.style.display = gen ? '' : 'none';
    this.addBtn.disabled = !gen;
    if (!gen) {
      this.title.textContent = 'Graph';
      this.empty.replaceChildren(
        h('div', { class: 'muted' }, 'A generator makes many shapes from a small graph of ideas: points, shapes, noise fields and per-item values wired together.'),
        h('button', { class: 'btn primary small', onclick: () => this.newGenerator() }, icon('gen'), 'New generator'),
      );
      return;
    }
    this.title.textContent = 'Graph · ' + gen.name;
    const sig = this.signature();
    if (sig !== this.lastSig) {
      this.lastSig = sig;
      this.build();
    } else this.sync();
  }

  newGenerator() {
    const app = this.app;
    const ab = app.doc.artboard;
    const n = baseNode('gen', { name: 'Generator', graph: starterGraph(), fill: { type: 'solid', color: app.nextColor() }, stroke: null });
    n.transform.x = ab.w / 2;
    n.transform.y = ab.h / 2;
    app.addNode(n, app.activeParent(), null, 'New generator');
    this.genId = n.id;
    this.lastSig = '';
    this.refresh();
    this.frameAll();
  }

  applyView() {
    const v = this.view;
    this.world.style.transform = `translate(${v.x}px, ${v.y}px) scale(${v.z})`;
    this.area.style.backgroundPosition = `${v.x}px ${v.y}px`;
    this.area.style.backgroundSize = `${20 * v.z}px ${20 * v.z}px`;
  }

  // ---- build ----

  build() {
    const g = this.gen.graph;
    this.fields = [];
    let evald;
    try {
      evald = evalGraph(g);
    } catch {
      evald = { memo: new Map() };
    }
    this.datalist.replaceChildren(...attrNames(g, evald.memo).map((a) => h('option', { value: a })));
    for (const el of [...this.world.querySelectorAll('.gnode')]) el.remove();
    this.nodeEls = {};
    for (const gn of Object.values(g.nodes)) {
      const el = this.nodeEl(gn, evald.memo.get(gn.id));
      this.world.append(el);
      this.nodeEls[gn.id] = el;
    }
    this.applyView();
    requestAnimationFrame(() => this.drawWires());
  }

  sync() {
    for (const [el, get] of this.fields) el.update?.(get());
  }

  nodeEl(gn, value) {
    const app = this.app;
    const d = GNODES[gn.type];
    const isOut = gn.id === this.gen.graph.out;
    const count = Array.isArray(value) ? value.length : null;
    const previewing = app.graphPreview?.gid === gn.id;
    const head = h('div', { class: 'gnode-head', style: { borderTopColor: TYPE_COLOR[d.out] || '#888' } },
      h('span', { class: 'gnode-title' }, d.label),
      count != null ? h('span', { class: 'gnode-count', title: 'Items coming out' }, count) : null,
      !isOut ? h('button', { class: 'icon-btn tiny eye' + (previewing ? ' on' : ''), title: 'Show this node\'s output on the canvas', onpointerdown: (e) => {
        // act on press: the header is a drag handle, so a click may not reach small buttons
        e.stopPropagation();
        const on = app.graphPreview?.gid === gn.id;
        app.graphPreview = on ? null : { gen: this.genId, gid: gn.id };
        this.world.querySelectorAll('.eye.on').forEach((b) => b.classList.remove('on'));
        if (!on) e.currentTarget.classList.add('on');
        app.requestRender();
      } }, icon('eye')) : null,
      !isOut ? h('button', { class: 'icon-btn tiny', title: 'Delete node', onpointerdown: (e) => {
        e.stopPropagation();
        this.removeNode(gn.id);
      } }, icon('close')) : null,
    );
    const outPort = d.out ? h('span', { class: 'gport out', title: 'Output: ' + TYPE_NAME[d.out], style: { background: TYPE_COLOR[d.out] } }) : null;
    if (outPort) {
      outPort.dataset.node = gn.id;
      outPort.dataset.type = d.out;
      head.append(outPort);
    }
    const ins = d.inputs.map((inp) => {
      const connected = this.gen.graph.links.some((l) => l.to === gn.id && l.port === inp.key);
      const port = h('span', { class: 'gport in' + (connected ? ' on' : ''), title: 'Input: ' + TYPE_NAME[inp.type], style: { borderColor: TYPE_COLOR[inp.type], background: connected ? TYPE_COLOR[inp.type] : 'transparent' } });
      port.dataset.node = gn.id;
      port.dataset.port = inp.key;
      port.dataset.type = inp.type;
      return h('div', { class: 'gnode-in' }, port, h('span', {}, inp.label));
    });
    const body = h('div', { class: 'gnode-body' });
    for (const p of paramsOf(gn)) {
      const f = paramField(p, gn.params[p.key], (v, live, commitOnly) => this.setParam(gn.id, p.key, v, live, commitOnly), { palette: this.paletteApi(), attrList: 'attr-names', compact: true });
      this.fields.push([f, () => this.gen?.graph.nodes[gn.id]?.params[p.key]]);
      body.append(f);
    }
    const el = h('div', { class: 'gnode' + (this.sel === gn.id ? ' sel' : '') + (isOut ? ' output' : ''), style: { left: gn.x + 'px', top: gn.y + 'px' } }, head, ...ins, body);
    el.dataset.id = gn.id;
    head.addEventListener('pointerdown', (e) => this.dragNode(e, gn, el));
    el.addEventListener('pointerdown', () => {
      if (this.sel !== gn.id) {
        this.sel = gn.id;
        this.world.querySelectorAll('.gnode.sel').forEach((x) => x.classList.remove('sel'));
        el.classList.add('sel');
      }
    });
    return el;
  }

  paletteApi() {
    const app = this.app;
    return { colors: () => app.doc.palette, add: (c) => app.store.exec({ op: 'set', id: null, path: 'palette', value: [...app.doc.palette, c] }, 'Add to palette') };
  }

  setParam(gid, key, v, live, commitOnly) {
    const app = this.app;
    if (commitOnly || v === undefined) return app.commitLive();
    const gn = this.gen.graph.nodes[gid];
    const d = GNODES[gn.type];
    if (d.dynamicParams && d.params.some((p) => p.key === key)) {
      // switching kind/effect: fill in the new parameters' defaults
      const np = { ...gn.params, [key]: v };
      for (const q of d.dynamicParams(np)) if (!(q.key in np) || key === 'kind' || key === 'fx') np[q.key] = gn.params[q.key] ?? (typeof q.default === 'object' ? { ...q.default } : q.default);
      app.setProps([this.genId], `graph.nodes.${gid}.params`, np, false, 'Change ' + d.label);
      return;
    }
    app.setProps([this.genId], `graph.nodes.${gid}.params.${key}`, v, live, 'Change ' + d.label);
  }

  editGraph(fn, label) {
    const g = JSON.parse(JSON.stringify(this.gen.graph));
    try {
      fn(g);
    } catch {
      this.drawWires();
      return;
    }
    this.app.setProps([this.genId], 'graph', g, false, label);
  }

  removeNode(gid) {
    if (gid === this.gen.graph.out) return;
    if (this.app.graphPreview?.gid === gid) this.app.graphPreview = null;
    this.editGraph((g) => {
      delete g.nodes[gid];
      g.links = g.links.filter((l) => l.from !== gid && l.to !== gid);
    }, 'Delete node');
    this.sel = null;
  }

  addMenu(anchor, at) {
    const items = [];
    for (const c of GNODE_CATS) {
      if (c === 'Output') continue;
      items.push({ header: c });
      for (const [k, d] of Object.entries(GNODES)) if (d.cat === c) items.push({ label: d.label, run: () => this.addNode(k, at) });
    }
    menu(anchor, items, { cls: 'fx-menu' });
  }

  addNode(type, at) {
    const v = this.view;
    const r = this.area.getBoundingClientRect();
    const pos = at || [(r.width / 2 - v.x) / v.z - 90, (r.height / 2 - v.y) / v.z - 40];
    const gn = makeGNode(type, Math.round(pos[0]), Math.round(pos[1]));
    this.editGraph((g) => {
      g.nodes[gn.id] = gn;
      // wire it in after the selected node when the types fit
      const s = this.sel && g.nodes[this.sel];
      const d = GNODES[type];
      if (s && GNODES[s.type].out && d.inputs.length) {
        const inp = d.inputs.find((i) => canConnect(GNODES[s.type].out, i.type));
        if (inp) g.links.push({ from: s.id, to: gn.id, port: inp.key });
      }
    }, 'Add ' + GNODES[type].label);
    this.sel = gn.id;
  }

  // ---- wires ----

  portPos(el) {
    const r = el.getBoundingClientRect();
    const a = this.area.getBoundingClientRect();
    const v = this.view;
    return [(r.left + r.width / 2 - a.left - v.x) / v.z, (r.top + r.height / 2 - a.top - v.y) / v.z];
  }

  wirePath(a, b) {
    const dx = Math.max(40, Math.abs(b[0] - a[0]) * 0.5);
    return `M${a[0]},${a[1]} C${a[0] + dx},${a[1]} ${b[0] - dx},${b[1]} ${b[0]},${b[1]}`;
  }

  drawWires() {
    const g = this.gen?.graph;
    if (!g) return;
    const paths = [];
    for (const l of g.links) {
      const from = this.world.querySelector(`.gnode[data-id="${l.from}"] .gport.out`);
      const to = this.world.querySelector(`.gport.in[data-node="${l.to}"][data-port="${l.port}"]`);
      if (!from || !to) continue;
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', this.wirePath(this.portPos(from), this.portPos(to)));
      p.setAttribute('stroke', TYPE_COLOR[from.dataset.type] || '#888');
      paths.push(p);
    }
    if (this.tempWire) {
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', this.wirePath(...this.tempWire));
      p.setAttribute('stroke', '#fff');
      p.setAttribute('stroke-dasharray', '4 3');
      paths.push(p);
    }
    this.svg.replaceChildren(...paths);
  }

  // ---- interaction ----

  bindArea() {
    const area = this.area;
    area.addEventListener('wheel', (e) => {
      e.preventDefault();
      const v = this.view;
      const r = area.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey || !e.shiftKey) {
        const f = Math.exp(-e.deltaY * 0.0018);
        const z = Math.min(2, Math.max(0.25, v.z * f));
        const mx = e.clientX - r.left, my = e.clientY - r.top;
        v.x = mx - ((mx - v.x) * z) / v.z;
        v.y = my - ((my - v.y) * z) / v.z;
        v.z = z;
      } else v.x -= e.deltaY;
      this.applyView();
    }, { passive: false });
    area.addEventListener('pointerdown', (e) => {
      const port = e.target.closest('.gport');
      if (port) return this.dragWire(e, port);
      if (e.target.closest('.gnode')) return;
      area.focus();
      if (e.button === 2) return;
      const v = this.view;
      const x0 = e.clientX, y0 = e.clientY, vx = v.x, vy = v.y;
      area.setPointerCapture(e.pointerId);
      const mv = (ev) => {
        v.x = vx + ev.clientX - x0;
        v.y = vy + ev.clientY - y0;
        this.applyView();
      };
      const up = () => {
        area.removeEventListener('pointermove', mv);
        area.removeEventListener('pointerup', up);
      };
      area.addEventListener('pointermove', mv);
      area.addEventListener('pointerup', up);
    });
    const addAt = (e) => {
      if (e.target.closest('.gnode') || !this.gen) return;
      e.preventDefault();
      const r = area.getBoundingClientRect();
      const v = this.view;
      const anchor = h('div', { style: { position: 'fixed', left: e.clientX + 'px', top: e.clientY + 'px', width: '1px', height: '1px' } });
      document.body.append(anchor);
      this.addMenu(anchor, [(e.clientX - r.left - v.x) / v.z, (e.clientY - r.top - v.y) / v.z]);
      setTimeout(() => anchor.remove(), 0);
    };
    area.addEventListener('contextmenu', addAt);
    area.addEventListener('dblclick', addAt);
    area.addEventListener('keydown', (e) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && this.sel && document.activeElement === area) {
        e.stopPropagation();
        e.preventDefault();
        this.removeNode(this.sel);
      }
    });
  }

  dragNode(e, gn, el) {
    if (e.target.closest('button') || e.target.closest('.gport')) return;
    e.preventDefault();
    const v = this.view;
    const x0 = e.clientX, y0 = e.clientY, nx = gn.x, ny = gn.y;
    const head = e.currentTarget;
    head.setPointerCapture(e.pointerId);
    let moved = false;
    const mv = (ev) => {
      moved = true;
      el.style.left = nx + (ev.clientX - x0) / v.z + 'px';
      el.style.top = ny + (ev.clientY - y0) / v.z + 'px';
      this.drawWires();
    };
    const up = (ev) => {
      head.removeEventListener('pointermove', mv);
      head.removeEventListener('pointerup', up);
      if (!moved) return;
      const x = Math.round(nx + (ev.clientX - x0) / v.z), y = Math.round(ny + (ev.clientY - y0) / v.z);
      // positions are layout only: undoable, but they don't make the shapes recompute
      this.app.store.exec([
        { op: 'set', id: this.genId, path: `graph.nodes.${gn.id}.x`, value: x, layout: true },
        { op: 'set', id: this.genId, path: `graph.nodes.${gn.id}.y`, value: y, layout: true },
      ], 'Move node');
    };
    head.addEventListener('pointermove', mv);
    head.addEventListener('pointerup', up);
  }

  dragWire(e, port) {
    e.preventDefault();
    e.stopPropagation();
    const g = this.gen.graph;
    let fromEl = null;
    let detached = null;
    if (port.classList.contains('out')) fromEl = port;
    else {
      // pick up an existing wire from an input
      const l = g.links.find((q) => q.to === port.dataset.node && q.port === port.dataset.port);
      if (!l) return;
      detached = l;
      fromEl = this.world.querySelector(`.gnode[data-id="${l.from}"] .gport.out`);
    }
    const a = this.portPos(fromEl);
    const outType = fromEl.dataset.type;
    const area = this.area;
    area.setPointerCapture(e.pointerId);
    const toWorld = (ev) => {
      const r = area.getBoundingClientRect();
      const v = this.view;
      return [(ev.clientX - r.left - v.x) / v.z, (ev.clientY - r.top - v.y) / v.z];
    };
    this.world.querySelectorAll('.gport.in').forEach((p) => p.classList.toggle('ok', canConnect(outType, p.dataset.type) && p.dataset.node !== fromEl.dataset.node));
    if (detached) {
      const t = this.world.querySelector(`.gport.in[data-node="${detached.to}"][data-port="${detached.port}"]`);
      t.style.background = 'transparent';
    }
    const mv = (ev) => {
      this.tempWire = [a, toWorld(ev)];
      if (detached) this.drawWiresExcept(detached);
      else this.drawWires();
    };
    mv(e);
    const up = (ev) => {
      area.removeEventListener('pointermove', mv);
      area.removeEventListener('pointerup', up);
      this.tempWire = null;
      this.world.querySelectorAll('.gport.ok').forEach((p) => p.classList.remove('ok'));
      const target = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.gport.in');
      const from = fromEl.dataset.node;
      if (target && canConnect(outType, target.dataset.type) && target.dataset.node !== from) {
        this.editGraph((gg) => {
          gg.links = gg.links.filter((l) => !(l.to === target.dataset.node && l.port === target.dataset.port) && !(detached && l.to === detached.to && l.port === detached.port));
          gg.links.push({ from, to: target.dataset.node, port: target.dataset.port });
          if (this.createsLoop(gg)) {
            toast('That link would make a loop');
            throw new Error('loop');
          }
        }, 'Connect');
      } else if (detached) {
        this.editGraph((gg) => (gg.links = gg.links.filter((l) => !(l.to === detached.to && l.port === detached.port))), 'Disconnect');
      } else if (target) {
        toast(`Can't connect ${TYPE_NAME[outType]} to ${TYPE_NAME[target.dataset.type]}`);
        this.drawWires();
      } else this.drawWires();
    };
    area.addEventListener('pointermove', mv);
    area.addEventListener('pointerup', up);
  }

  drawWiresExcept(l) {
    const g = this.gen.graph;
    const saved = g.links;
    g.links = saved.filter((q) => q !== l);
    this.drawWires();
    g.links = saved;
  }

  createsLoop(g) {
    const adj = {};
    for (const l of g.links) (adj[l.from] ||= []).push(l.to);
    const seen = new Set(), stack = new Set();
    const dfs = (n) => {
      if (stack.has(n)) return true;
      if (seen.has(n)) return false;
      seen.add(n);
      stack.add(n);
      for (const m of adj[n] || []) if (dfs(m)) return true;
      stack.delete(n);
      return false;
    };
    return Object.keys(g.nodes).some((n) => dfs(n));
  }

  frameAll() {
    const g = this.gen?.graph;
    if (!g) return;
    const ns = Object.values(g.nodes);
    if (!ns.length) return;
    const r = this.area.getBoundingClientRect();
    const x0 = Math.min(...ns.map((n) => n.x)), y0 = Math.min(...ns.map((n) => n.y));
    const x1 = Math.max(...ns.map((n) => n.x + 200)), y1 = Math.max(...ns.map((n) => n.y + 220));
    // stay readable: past a point, scroll instead of shrinking further
    const z = Math.min(1, Math.max(0.85, Math.min((r.width - 40) / (x1 - x0), (r.height - 30) / (y1 - y0))));
    const v = this.view;
    v.z = z;
    v.x = Math.max(16 - x0 * z, (r.width - (x1 - x0) * z) / 2 - x0 * z);
    v.y = 16 - y0 * z;
    this.applyView();
    requestAnimationFrame(() => this.drawWires());
  }
}
