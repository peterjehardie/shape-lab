// Layers panel: the document tree. Drag rows to reorder or move into groups.

import { h, menu } from './widgets.js';
import { icon } from './icons.js';
import { isDescendant } from '../core/doc.js';
import { PRIMS } from '../core/prims.js';

const TYPE_ICON = { shape: 'shape', group: 'group', layer: 'layer', bool: 'bool', gen: 'gen', image: 'image' };

export class LayersPanel {
  constructor(app, host) {
    this.app = app;
    this.host = host;
    this.collapsed = new Set();
    this.list = h('div', { class: 'tree', tabindex: '0' });
    this.host.append(this.list);
    app.on('doc', () => this.schedule());
    app.on('selection', () => this.schedule());
    this.render();
  }

  schedule() {
    if (this.pending) return;
    this.pending = true;
    requestAnimationFrame(() => {
      this.pending = false;
      this.render();
    });
  }

  iconFor(n) {
    if (n.type === 'shape') return n.geom.kind === 'path' ? 'pen' : PRIMS[n.geom.kind]?.icon || 'shape';
    return TYPE_ICON[n.type] || 'shape';
  }

  render() {
    const app = this.app;
    const d = app.doc;
    const rows = [];
    const visit = (id, depth, hiddenAbove) => {
      const n = d.nodes[id];
      if (!n) return;
      rows.push(this.row(n, depth, hiddenAbove));
      if (n.children && !this.collapsed.has(id)) for (let i = n.children.length - 1; i >= 0; i--) visit(n.children[i], depth + 1, hiddenAbove || !n.visible);
    };
    const layers = d.nodes[d.root].children;
    for (let i = layers.length - 1; i >= 0; i--) visit(layers[i], 0, false);
    this.list.replaceChildren(...rows);
    if (!rows.length) this.list.append(h('div', { class: 'muted pad' }, 'No layers'));
  }

  row(n, depth, dim) {
    const app = this.app;
    const selected = app.sel.has(n.id);
    const isCont = !!n.children;
    const caret = isCont
      ? h('button', { class: 'tree-caret' + (this.collapsed.has(n.id) ? '' : ' open'), onclick: (e) => {
        e.stopPropagation();
        this.collapsed.has(n.id) ? this.collapsed.delete(n.id) : this.collapsed.add(n.id);
        this.render();
      } }, icon('chevron'))
      : h('span', { class: 'tree-caret' });
    const name = h('span', { class: 'tree-name' }, n.name);
    const badges = [];
    if (n.mask) badges.push(h('span', { class: 'badge mask', title: 'Mask' }, icon('mask')));
    if (n.effects?.length) badges.push(h('span', { class: 'badge', title: n.effects.length + ' effect(s)' }, icon('fx')));
    const eye = h('button', { class: 'tree-btn' + (n.visible ? '' : ' on'), title: n.visible ? 'Hide' : 'Show', onclick: (e) => {
      e.stopPropagation();
      app.setProps([n.id], 'visible', !n.visible, false, n.visible ? 'Hide' : 'Show');
    } }, icon(n.visible ? 'eye' : 'eyeOff'));
    const lock = h('button', { class: 'tree-btn' + (n.locked ? ' on' : ''), title: n.locked ? 'Unlock' : 'Lock', onclick: (e) => {
      e.stopPropagation();
      app.setProps([n.id], 'locked', !n.locked, false, n.locked ? 'Unlock' : 'Lock');
    } }, icon(n.locked ? 'lock' : 'unlock'));
    const el = h('div', {
      class: 'tree-row' + (selected ? ' sel' : '') + (n.type === 'layer' ? ' layer' : '') + (dim || !n.visible ? ' dim' : ''),
      style: { paddingLeft: 6 + depth * 14 + 'px' },
      draggable: 'true',
    }, caret, icon(this.iconFor(n), 'tree-ic'), name, ...badges, h('span', { class: 'grow' }), lock, eye);
    el.addEventListener('click', (e) => {
      if (n.type === 'layer') app.activeLayer = n.id;
      app.select(n.id, e.shiftKey || e.metaKey || e.ctrlKey ? 'toggle' : 'replace');
    });
    el.addEventListener('dblclick', () => this.rename(n, name));
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (!app.sel.has(n.id)) app.select(n.id);
      app.emit('contextmenu', e);
    });
    // drag and drop
    el.addEventListener('dragstart', (e) => {
      if (!app.sel.has(n.id)) app.select(n.id);
      this.dragIds = [...app.sel];
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', n.id);
    });
    el.addEventListener('dragover', (e) => {
      if (!this.dragIds) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const y = (e.clientY - r.top) / r.height;
      const zone = isCont && y > 0.28 && y < 0.72 ? 'in' : y < 0.5 ? 'above' : 'below';
      el.dataset.drop = zone;
    });
    el.addEventListener('dragleave', () => delete el.dataset.drop);
    el.addEventListener('drop', (e) => {
      e.preventDefault();
      const zone = el.dataset.drop;
      delete el.dataset.drop;
      this.drop(n, zone);
      this.dragIds = null;
    });
    el.addEventListener('dragend', () => (this.dragIds = null));
    return el;
  }

  drop(target, zone) {
    const app = this.app;
    const d = app.doc;
    const ids = (this.dragIds || []).filter((id) => id !== target.id && !isDescendant(d, target.id, id));
    if (!ids.length) return;
    let parent, index;
    if (zone === 'in') {
      parent = target.id;
      index = target.children.length;
    } else {
      parent = target.parent;
      const sib = d.nodes[parent].children.filter((c) => !ids.includes(c));
      const ti = sib.indexOf(target.id);
      // rows run top = front, so "above" means later in the children list
      index = zone === 'above' ? ti + 1 : ti;
    }
    if (d.nodes[parent].id === d.root && ids.some((id) => d.nodes[id].type !== 'layer')) {
      // only layers live at the top; drop into the nearest layer instead
      parent = target.type === 'layer' ? target.id : target.parent;
      index = d.nodes[parent].children.length;
    }
    const ops = [];
    // apply in order so indices stay right
    const ordered = ids.slice().sort((a, b) => d.nodes[d.nodes[a].parent].children.indexOf(a) - d.nodes[d.nodes[b].parent].children.indexOf(b));
    ordered.forEach((id, k) => ops.push({ op: 'move', id, parent, index: index + k }));
    app.store.exec(ops, 'Move in layers');
  }

  rename(n, span) {
    const input = h('input', { class: 'tree-rename', value: n.name });
    span.replaceWith(input);
    input.focus();
    input.select();
    const done = (ok) => {
      if (ok && input.value.trim() && input.value !== n.name) this.app.setProps([n.id], 'name', input.value.trim(), false, 'Rename');
      else this.render();
    };
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') done(true);
      if (e.key === 'Escape') done(false);
    });
    input.addEventListener('blur', () => done(true));
  }
}
