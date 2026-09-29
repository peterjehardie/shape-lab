// Swatches: bake a selection into a reusable asset (a PNG plus the recipe it came from),
// keep them in the document and in a library that outlives documents, and use them as
// placed images or as a fill.

import { h, menu, popover, closePopover, numberField, select, textField, toggle, toast } from './widgets.js';
import { icon } from './icons.js';
import { makeCanvas } from '../render/paint.js';
import { baseNode, subtreeNodes, reidSubtree, uid } from '../core/doc.js';
import { boundsValid } from '../core/math.js';
import { effectPad } from '../core/effects.js';
import { libAll, libPut, libDelete, download, pickFile, readText, readDataURL, safeName } from './storage.js';

export class Swatches {
  constructor(app, host) {
    this.app = app;
    this.host = host;
    this.library = [];
    app.on('doc', () => this.schedule());
    this.loadLibrary();
    this.render();
  }

  async loadLibrary() {
    this.library = ((await libAll()) || []).sort((a, b) => (b.created || 0) - (a.created || 0));
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

  render() {
    const app = this.app;
    const docSw = Object.values(app.doc.assets).filter((a) => a.kind === 'swatch');
    const docIds = new Set(docSw.map((a) => a.id));
    const lib = this.library.filter((a) => !docIds.has(a.id));
    this.host.replaceChildren(
      h('div', { class: 'sw-bar' },
        h('button', { class: 'btn small primary', title: 'Render the selection into a swatch', onclick: (e) => this.bakeDialog(e.currentTarget) }, icon('bake'), 'Bake selection'),
        h('button', { class: 'btn small', title: 'Import a swatch file or an image', onclick: () => this.importFile() }, icon('upload'), 'Import')),
      h('div', { class: 'sw-head' }, 'In this document'),
      docSw.length ? h('div', { class: 'sw-grid' }, docSw.map((a) => this.thumb(a, true))) : h('div', { class: 'muted small pad' }, 'Select shapes and bake them into a swatch: a picture of the result that remembers the shapes and effects it was made from.'),
      h('div', { class: 'sw-head' }, 'Library', h('span', { class: 'muted small' }, ' · kept in this browser across documents')),
      lib.length ? h('div', { class: 'sw-grid' }, lib.map((a) => this.thumb(a, false))) : h('div', { class: 'muted small pad' }, 'Empty. Swatches baked with "Add to library" appear here.'),
    );
  }

  thumb(a, inDoc) {
    const el = h('button', { class: 'sw-thumb', title: `${a.name}\n${a.w} × ${a.h}px${a.recipe ? '\nHas an editable recipe' : ''}` },
      h('span', { class: 'sw-img', style: { backgroundImage: `url(${a.data})` } }),
      h('span', { class: 'sw-name' }, a.name));
    el.addEventListener('click', () => this.thumbMenu(el, a, inDoc));
    el.draggable = true;
    el.addEventListener('dragstart', (e) => e.dataTransfer.setData('application/x-shapelab-swatch', a.id));
    return el;
  }

  ensureInDoc(a) {
    if (!this.app.doc.assets[a.id]) this.app.store.exec({ op: 'asset', id: a.id, value: a }, 'Add swatch to document');
  }

  thumbMenu(anchor, a, inDoc) {
    const app = this.app;
    const fillable = app.selectedNodes().filter((n) => ['shape', 'bool', 'gen'].includes(n.type));
    menu(anchor, [
      { label: 'Place on the page', icon: 'place', run: () => this.place(a) },
      { label: `Use as fill${fillable.length ? '' : ' (select a shape first)'}`, icon: 'swatch', disabled: !fillable.length, run: () => {
        this.ensureInDoc(a);
        app.setProps(fillable.map((n) => n.id), 'fill', { type: 'swatch', asset: a.id, scale: 1, angle: 0 }, false, 'Swatch fill');
      } },
      { label: 'Place editable recipe', icon: 'convert', disabled: !a.recipe, run: () => this.placeRecipe(a) },
      { sep: true },
      { label: 'Download PNG', icon: 'download', run: () => fetch(a.data).then((r) => r.blob()).then((b) => download(safeName(a.name) + '.png', b)) },
      { label: 'Save swatch file', icon: 'save', run: () => download(safeName(a.name) + '.swatch.json', JSON.stringify({ format: 'shapelab.swatch', version: 1, asset: a })) },
      inDoc ? { label: 'Add to library', icon: 'plus', run: async () => { await libPut(a); toast('Saved to library'); this.loadLibrary(); } } : { label: 'Remove from library', icon: 'trash', run: async () => { await libDelete(a.id); this.loadLibrary(); } },
      inDoc ? { label: 'Remove from document', icon: 'trash', run: () => this.removeFromDoc(a) } : null,
    ].filter(Boolean));
  }

  removeFromDoc(a) {
    const app = this.app;
    const users = Object.values(app.doc.nodes).filter((n) => n.asset === a.id || n.fill?.asset === a.id || n.stroke?.paint?.asset === a.id);
    if (users.length) return toast(`Used by ${users.length} object(s); remove those first`);
    app.store.exec({ op: 'asset', id: a.id, value: null }, 'Remove swatch');
  }

  place(a, at) {
    const app = this.app;
    this.ensureInDoc(a);
    const ab = app.doc.artboard;
    const u = a.unit || 1;
    const n = baseNode('image', { name: a.name, asset: a.id, w: a.w * u, h: a.h * u });
    n.transform.x = at ? at[0] : ab.w / 2;
    n.transform.y = at ? at[1] : ab.h / 2;
    app.addNode(n, app.activeParent(), null, 'Place swatch');
  }

  placeRecipe(a) {
    const app = this.app;
    if (!a.recipe) return;
    this.ensureInDoc(a);
    app.store.begin('Place recipe');
    const out = [];
    const parent = app.activeParent();
    for (const rid of a.recipe.roots) {
      const sub = reidSubtree({ rootId: rid, nodes: a.recipe.nodes }, parent);
      app.store.exec(app.store.insertSubtree(sub, parent));
      out.push(sub.rootId);
    }
    app.store.commit();
    app.select(out);
  }

  // ---- baking ----

  bakeDialog(anchor) {
    const app = this.app;
    const ids = app.sortedSelection().filter((id) => app.doc.nodes[id]?.type !== 'layer' || true);
    if (!ids.length) return toast('Select what to bake first');
    const opts = { name: app.selectedNodes()[0].name + ' swatch', scale: 2, pad: 8, library: true };
    const prev = h('div', { class: 'bake-prev' });
    const update = () => {
      const r = this.bake(ids, { ...opts, scale: 1 });
      prev.replaceChildren(r ? h('img', { src: r.data }) : h('div', { class: 'muted' }, 'Nothing visible to bake'));
      info.textContent = r ? `${Math.round(r.w * opts.scale)} × ${Math.round(r.h * opts.scale)} px at ${opts.scale}×` : '';
    };
    const info = h('div', { class: 'muted small' });
    const body = h('div', { class: 'bake' },
      h('div', { class: 'pop-title' }, 'Bake swatch'),
      prev, info,
      textField({ label: 'Name', value: opts.name, onChange: (v) => (opts.name = v) }),
      select({ label: 'Resolution', value: String(opts.scale), options: [['1', '1× (page size)'], ['2', '2× (sharp)'], ['4', '4× (print)']], onChange: (v) => { opts.scale = +v; update(); } }),
      numberField({ label: 'Margin', value: opts.pad, min: 0, max: 400, step: 1, onChange: (v) => { opts.pad = v; }, onCommit: update }),
      toggle({ label: 'Add to library too', value: opts.library, onChange: (v) => (opts.library = v) }),
      h('div', { class: 'muted small' }, 'The swatch keeps a copy of the selected shapes and effects as its recipe, so it can be placed back as editable shapes later.'),
      h('div', { class: 'btn-row end' },
        h('button', { class: 'btn small', onclick: () => closePopover() }, 'Cancel'),
        h('button', { class: 'btn small primary', onclick: () => {
          const a = this.bake(ids, opts);
          closePopover();
          if (!a) return toast('Nothing visible to bake');
          app.store.exec({ op: 'asset', id: a.id, value: a }, 'Bake swatch');
          if (opts.library) libPut(a).then(() => this.loadLibrary());
          app.emit('show-tab', 'swatches');
          toast(`Baked "${a.name}"`);
        } }, icon('bake'), 'Bake')));
    popover(anchor, body, { cls: 'pop-bake' });
    update();
  }

  // Render nodes to a trimmed PNG asset. Returns the asset or null.
  bake(ids, { name = 'Swatch', scale = 2, pad = 8 } = {}) {
    const app = this.app;
    const b = app.selectionBounds(ids);
    if (!boundsValid(b)) return null;
    let fx = 0;
    for (const id of ids) fx = Math.max(fx, effectPad(app.doc.nodes[id].effects));
    const m = pad + fx + 4;
    const x0 = b.x0 - m, y0 = b.y0 - m;
    const W = Math.ceil((b.x1 - b.x0 + 2 * m) * scale), H = Math.ceil((b.y1 - b.y0 + 2 * m) * scale);
    if (W < 1 || H < 1 || W * H > 36e6) return null;
    const c = makeCanvas(W, H);
    const g = c.getContext('2d');
    app.renderer.renderNodes(g, ids, [scale, 0, 0, scale, -x0 * scale, -y0 * scale], { clip: { x0: 0, y0: 0, x1: W, y1: H } });
    // trim empty margins down to the requested padding
    const img = g.getImageData(0, 0, W, H).data;
    let tx0 = W, ty0 = H, tx1 = -1, ty1 = -1;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++)
        if (img[(y * W + x) * 4 + 3] > 2) {
          if (x < tx0) tx0 = x;
          if (x > tx1) tx1 = x;
          if (y < ty0) ty0 = y;
          if (y > ty1) ty1 = y;
        }
    if (tx1 < 0) return null;
    const P = Math.round(pad * scale);
    tx0 = Math.max(0, tx0 - P);
    ty0 = Math.max(0, ty0 - P);
    tx1 = Math.min(W - 1, tx1 + P);
    ty1 = Math.min(H - 1, ty1 + P);
    const out = makeCanvas(tx1 - tx0 + 1, ty1 - ty0 + 1);
    out.getContext('2d').drawImage(c, -tx0, -ty0);
    const data = toDataURL(out);
    const nodes = {};
    for (const id of ids) Object.assign(nodes, subtreeNodes(app.doc, id));
    return {
      id: uid('a'), kind: 'swatch', name, w: out.width, h: out.height, unit: 1 / scale, data, created: Date.now(),
      recipe: { roots: ids, nodes },
    };
  }

  async importFile() {
    const f = await pickFile('.json,.png,.jpg,.jpeg,.webp,image/*,application/json');
    if (!f) return;
    const app = this.app;
    if (f.type.startsWith('image/')) {
      const data = await readDataURL(f);
      const img = new Image();
      img.onload = () => {
        const a = { id: uid('a'), kind: 'swatch', name: f.name.replace(/\.\w+$/, ''), w: img.width, h: img.height, unit: 1, data, created: Date.now(), recipe: null };
        app.store.exec({ op: 'asset', id: a.id, value: a }, 'Import image');
        toast('Imported ' + a.name);
      };
      img.src = data;
      return;
    }
    try {
      const j = JSON.parse(await readText(f));
      if (j.format === 'shapelab.swatch') {
        app.store.exec({ op: 'asset', id: j.asset.id, value: j.asset }, 'Import swatch');
        toast('Imported ' + j.asset.name);
      } else if (j.format === 'shapelab.doc') {
        app.loadDoc(j);
      } else toast('Not a Shape Lab file');
    } catch (e) {
      toast('Could not read file: ' + e.message);
    }
  }
}

function toDataURL(canvas) {
  if (canvas.toDataURL) return canvas.toDataURL('image/png');
  // OffscreenCanvas: copy into a regular canvas
  const c = document.createElement('canvas');
  c.width = canvas.width;
  c.height = canvas.height;
  c.getContext('2d').drawImage(canvas, 0, 0);
  return c.toDataURL('image/png');
}
