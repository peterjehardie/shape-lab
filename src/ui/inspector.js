// Right-hand panel: properties of the selection, or of the document when nothing is selected.

import { h, numberField, select, toggle, textField, segmented, section, colorButton, menu, row, grid2, toast } from './widgets.js';
import { paramField, paintEditor } from './fields.js';
import { icon } from './icons.js';
import { PRIMS, primDefaults, primHasSize } from '../core/prims.js';
import { EFFECTS, EFFECT_GROUPS, makeEffect } from '../core/effects.js';
import { BLENDS, solid, makeStroke, makePaint } from '../core/doc.js';
import { polysBounds, flattenPath, clonePath, smoothAnchors } from '../core/path.js';
import { boundsValid, fromTransform } from '../core/math.js';
import { starterGraph } from '../core/graph.js';
import { oklch, toCss } from '../core/color.js';

const TYPE_LABEL = { shape: 'Shape', group: 'Group', layer: 'Layer', bool: 'Combined shape', gen: 'Generator', image: 'Swatch image' };
const TYPE_ICON = { shape: 'shape', group: 'group', layer: 'layer', bool: 'bool', gen: 'gen', image: 'image' };

export class Inspector {
  constructor(app, host) {
    this.app = app;
    this.host = host;
    this.binds = [];
    this.lastSig = null;
    this.openFx = new Set();
    app.on('selection', () => this.refresh());
    app.on('doc', () => this.refresh());
    this.refresh();
  }

  palette() {
    const app = this.app;
    return {
      colors: () => app.doc.palette,
      add: (c) => {
        app.store.exec({ op: 'set', id: null, path: 'palette', value: [...app.doc.palette, c] }, 'Add to palette');
        toast('Added to the document palette');
      },
    };
  }

  // A string describing what the panel's layout depends on; values are not part of it.
  signature() {
    const app = this.app;
    const nodes = app.selectedNodes();
    if (!nodes.length) {
      const d = app.doc;
      return 'doc|' + (d.artboard.bg?.type || 'none') + '|' + d.nodes[d.root].effects.map((e) => e.id + e.type).join(',') + '|' + d.palette.length + '|' + Object.keys(d.assets).length + '|' + this.paintSig(d.artboard.bg);
    }
    return nodes.map((n) => [
      n.id, n.type, n.geom?.kind, n.mask, n.fill?.type, this.paintSig(n.fill), n.stroke ? 's' + (n.stroke.paint?.type) + this.paintSig(n.stroke.paint) + n.stroke.profile : '',
      n.effects.map((e) => e.id + e.type + (this.openFx.has(e.id) ? 'o' : '')).join(','), n.op, n.children?.length, Object.keys(app.doc.assets).length,
    ].join(':')).join('|');
  }
  paintSig(p) {
    return p ? p.type + (p.stops ? p.stops.length : '') : '';
  }

  refresh() {
    const sig = this.signature();
    if (sig !== this.lastSig) {
      this.lastSig = sig;
      this.render();
    } else this.sync();
  }

  bind(el, get) {
    this.binds.push([el, get]);
    return el;
  }

  sync() {
    for (const [el, get] of this.binds) {
      try {
        el.update?.(get());
      } catch {}
    }
  }

  render() {
    const scroll = this.host.scrollTop;
    this.binds = [];
    this.host.replaceChildren();
    const nodes = this.app.selectedNodes();
    if (!nodes.length) this.renderDoc();
    else if (nodes.length === 1) this.renderNode(nodes[0]);
    else this.renderMulti(nodes);
    this.host.scrollTop = scroll;
  }

  // ---------------------------------------------------------------- helpers

  setter(ids, path, label) {
    return (v, live, commitOnly) => {
      if (commitOnly || v === undefined) return this.app.commitLive();
      this.app.setProps(ids, path, v, live, label);
    };
  }

  num(ids, path, label, opts, get) {
    const n0 = this.app.doc.nodes[ids[0]];
    const read = get || (() => path.split('.').reduce((o, k) => o?.[k], this.app.doc.nodes[ids[0]]));
    const f = numberField({ label, value: read(), ...opts, onChange: (v, live) => this.app.setProps(ids, path, v, live, 'Change ' + label), onCommit: () => this.app.commitLive() });
    return this.bind(f, read);
  }

  // ---------------------------------------------------------------- document

  renderDoc() {
    const app = this.app;
    const d = app.doc;
    const ab = d.artboard;
    const host = this.host;
    host.append(h('div', { class: 'insp-head' }, icon('outline'), h('div', {}, h('div', { class: 'insp-title' }, 'Document'), h('div', { class: 'insp-sub' }, 'Nothing selected: these settings cover the whole picture'))));

    const nameF = this.bind(textField({ label: 'Name', value: d.name, onChange: (v) => app.store.exec({ op: 'set', id: null, path: 'name', value: v }, 'Rename document') }), () => app.doc.name);
    const docNum = (label, path, min, max) => {
      const read = () => path.split('.').reduce((o, k) => o?.[k], app.doc);
      return this.bind(numberField({ label, value: read(), min, max, step: 1, onChange: (v, live) => {
        if (live) app.store.begin('Artboard size', 'artboard:' + path);
        app.store.exec({ op: 'set', id: null, path, value: v });
      }, onCommit: () => app.commitLive() }), read);
    };
    const presets = [['', 'Size presets…'], ['1600x1000', 'Wide 16:10 (1600 × 1000)'], ['1920x1080', 'Screen 16:9 (1920 × 1080)'], ['1200x1200', 'Square (1200 × 1200)'], ['1000x1414', 'Page, portrait (A-ratio)'], ['1414x1000', 'Page, landscape (A-ratio)'], ['600x600', 'Swatch tile (600 × 600)']];
    host.append(section('Artboard', {},
      nameF,
      grid2(docNum('W', 'artboard.w', 16, 12000), docNum('H', 'artboard.h', 16, 12000)),
      select({ value: '', options: presets, onChange: (v) => {
        if (!v) return;
        const [w, hh] = v.split('x').map(Number);
        app.store.exec([{ op: 'set', id: null, path: 'artboard.w', value: w }, { op: 'set', id: null, path: 'artboard.h', value: hh }], 'Artboard size');
        app.emit('fit');
      } }),
    ));

    const bgOn = !!ab.bg;
    host.append(section('Background', {
      actions: [h('button', { class: 'icon-btn', title: bgOn ? 'Transparent background' : 'Add background', onclick: () => app.store.exec({ op: 'set', id: null, path: 'artboard.bg', value: bgOn ? null : solid(oklch(0.955, 0.012, 85)) }, 'Background') }, icon(bgOn ? 'minus' : 'plus'))],
    }, bgOn ? paintEditor(ab.bg, (p, live, commitOnly) => {
      if (commitOnly || !p) return app.commitLive();
      if (live) app.store.begin('Background', 'bg');
      app.store.exec({ op: 'set', id: null, path: 'artboard.bg', value: p });
      if (!live) app.commitLive();
    }, { palette: this.palette(), assets: d.assets }) : h('div', { class: 'muted' }, 'Transparent (exports keep the alpha).')));

    host.append(this.effectsSection(d.root, 'Whole-picture effects', 'These act on everything: outline effects bend every shape, pixel effects run over the finished picture.'));
    host.append(this.paletteSection());
  }

  paletteSection() {
    const app = this.app;
    const pal = app.doc.palette;
    const setPal = (p, label = 'Palette') => app.store.exec({ op: 'set', id: null, path: 'palette', value: p }, label);
    const chips = h('div', { class: 'pal-grid' }, pal.map((c, i) => {
      const b = colorButton({ value: c, palette: null, onChange: (nc, live) => {
        if (live) app.store.begin('Edit palette colour', 'pal' + i);
        app.store.exec({ op: 'set', id: null, path: 'palette.' + i, value: nc });
        if (!live) app.commitLive();
      } });
      b.classList.add('pal-chip');
      b.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        setPal(pal.filter((_, k) => k !== i), 'Remove palette colour');
      });
      return b;
    }));
    const harmony = (kind) => {
      const base = pal[Math.floor(pal.length / 2)] || oklch(0.6, 0.12, 40);
      const hues = { analogous: [-30, -15, 0, 15, 30], complementary: [0, 0, 180, 180, 20], triad: [0, 120, 240, 0, 120], earth: [40, 55, 70, 30, 200] }[kind];
      const Ls = [0.94, 0.8, 0.64, 0.48, 0.32, 0.2];
      const out = [];
      Ls.forEach((L, i) => {
        const hh = (base.h + hues[i % hues.length] + 360) % 360;
        const C = kind === 'earth' ? 0.04 + 0.05 * Math.sin((i / 5) * Math.PI) : 0.03 + 0.13 * Math.sin((i / 5) * Math.PI);
        out.push(oklch(L, C, hh));
      });
      out.push(oklch(0.55, 0.16, (base.h + 180) % 360), oklch(0.97, 0.01, base.h));
      setPal(out, 'Generate palette');
    };
    return section('Palette', {
      actions: [h('button', { class: 'icon-btn', title: 'Generate a palette', onclick: (e) => menu(e.currentTarget, [
        { header: 'Built around the middle colour' },
        { label: 'Analogous (neighbouring hues)', run: () => harmony('analogous') },
        { label: 'Complementary (opposite hues)', run: () => harmony('complementary') },
        { label: 'Triad (three hues)', run: () => harmony('triad') },
        { label: 'Earth (low colourfulness)', run: () => harmony('earth') },
      ], { align: 'right' }) }, icon('palette'))],
    }, chips, h('div', { class: 'muted small' }, 'Click a colour to edit it; right-click removes it. Colour pickers everywhere offer these colours.'));
  }

  // ---------------------------------------------------------------- one node

  renderNode(n) {
    const app = this.app;
    const ids = [n.id];
    const host = this.host;
    const nameIn = textField({ value: n.name, onChange: (v) => app.setProps(ids, 'name', v || n.name, false, 'Rename') });
    nameIn.classList.add('insp-name');
    this.bind(nameIn, () => app.doc.nodes[n.id]?.name);
    host.append(h('div', { class: 'insp-head' }, icon(TYPE_ICON[n.type] || 'shape'), h('div', { class: 'grow' }, nameIn, h('div', { class: 'insp-sub' }, n.type === 'shape' ? (n.geom.kind === 'path' ? 'Free path' : PRIMS[n.geom.kind].label) : TYPE_LABEL[n.type]))));

    if (n.type !== 'layer') host.append(this.transformSection(n));
    if (n.type === 'shape') host.append(this.shapeSection(n));
    if (n.type === 'bool') host.append(this.boolSection(n));
    if (n.type === 'gen') host.append(this.genSection(n));
    if (n.type === 'image') host.append(this.imageSection(n));
    host.append(this.appearanceSection(n));
    if (['shape', 'bool', 'gen'].includes(n.type)) {
      host.append(this.fillSection([n.id]));
      host.append(this.strokeSection(n));
    }
    const fxHint = n.type === 'layer' || n.type === 'group'
      ? 'Outline effects here bend every shape inside; pixel effects act on the combined picture.'
      : n.type === 'gen' ? 'Outline effects act on every generated shape; pixel effects on the whole result.' : null;
    host.append(this.effectsSection(n.id, 'Effects', fxHint));
    host.append(this.actionsSection([n]));
  }

  transformSection(n) {
    const app = this.app;
    const ids = [n.id];
    const vp = app.viewport;
    const localBounds = () => {
      const nn = app.doc.nodes[n.id];
      if (nn.type === 'image') return { x0: -nn.w / 2, y0: -nn.h / 2, x1: nn.w / 2, y1: nn.h / 2 };
      if (nn.children && nn.type !== 'bool') {
        const b = app.nodeBounds(nn.id);
        return b;
      }
      return polysBounds(app.geo.of(nn.id, 0.5).polys);
    };
    const sizeOf = (axis) => {
      const nn = app.doc.nodes[n.id];
      if (!nn) return 0;
      if (nn.type === 'shape' && nn.geom.kind !== 'path') return axis === 'w' ? nn.geom.w : primHasSize(nn.geom.kind) ? nn.geom.h : 0;
      if (nn.type === 'image') return axis === 'w' ? nn.w : nn.h;
      const b = localBounds();
      if (!boundsValid(b)) return 0;
      const s = nn.children && nn.type !== 'bool' ? 1 : Math.abs(axis === 'w' ? nn.transform.sx : nn.transform.sy);
      return (axis === 'w' ? b.x1 - b.x0 : b.y1 - b.y0) * s;
    };
    let snap = null;
    const sizeField = (axis) => this.bind(numberField({
      label: axis.toUpperCase(), value: sizeOf(axis), min: 0.1, max: 100000, step: 1,
      onChange: (v, live) => {
        const nn = app.doc.nodes[n.id];
        if (!snap || !live) snap = { node: JSON.parse(JSON.stringify(nn)), size: sizeOf(axis) };
        if (nn.children && nn.type !== 'bool') return toast('Resize groups with the handles on the canvas');
        const f = v / (snap.size || 1);
        const b = nn.type === 'shape' && nn.geom.kind !== 'path' ? { x0: 0, x1: 0, y0: 0, y1: 0 } : localBounds();
        const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
        const key = 'size:' + n.id;
        if (live) app.store.begin('Resize', key);
        app.store.exec(vp.resizeOps({ node: snap.node }, axis === 'w' ? f : 1, axis === 'h' ? f : 1, cx, cy));
        if (!live) {
          app.commitLive();
          snap = null;
        }
      },
      onCommit: () => {
        snap = null;
        app.commitLive();
      },
    }), () => sizeOf(axis));
    const lockBtn = h('button', { class: 'icon-btn', title: 'Flip horizontally', onclick: () => app.flip('h') }, icon('flipH'));
    const flipV = h('button', { class: 'icon-btn', title: 'Flip vertically', onclick: () => app.flip('v') }, icon('flipV'));
    return section('Transform', { id: 'transform' },
      grid2(this.num(ids, 'transform.x', 'X', { step: 1, title: 'Position of the centre' }), this.num(ids, 'transform.y', 'Y', { step: 1 })),
      grid2(sizeField('w'), sizeField('h')),
      h('div', { class: 'grid3' },
        this.num(ids, 'transform.rot', 'Rot', { step: 0.5, min: -360, max: 360, unit: '°' }),
        this.num(ids, 'transform.skew', 'Skew', { step: 0.5, min: -80, max: 80, unit: '°' }),
        h('div', { class: 'btn-row' }, lockBtn, flipV)),
      grid2(this.num(ids, 'transform.sx', 'Scale X', { step: 0.01, min: -50, max: 50 }), this.num(ids, 'transform.sy', 'Scale Y', { step: 0.01, min: -50, max: 50 })),
    );
  }

  shapeSection(n) {
    const app = this.app;
    const ids = [n.id];
    if (n.geom.kind === 'path') {
      const path = n.geom.path;
      const count = path.subpaths.reduce((a, s) => a + s.pts.length, 0);
      const edit = (fn, label) => {
        const p = clonePath(app.doc.nodes[n.id].geom.path);
        fn(p);
        app.setProps(ids, 'geom', { kind: 'path', path: p }, false, label);
      };
      const closed = path.subpaths.every((s) => s.closed);
      return section('Path', {},
        h('div', { class: 'muted small' }, `${count} points in ${path.subpaths.length} part${path.subpaths.length > 1 ? 's' : ''}. Press A (direct select) to move points; double-click the outline to add one.`),
        h('div', { class: 'btn-row wrap' },
          h('button', { class: 'btn small', onclick: () => edit((p) => p.subpaths.forEach((s) => (s.closed = !closed)), closed ? 'Open path' : 'Close path') }, closed ? 'Open' : 'Close'),
          h('button', { class: 'btn small', onclick: () => edit((p) => p.subpaths.forEach((s) => (s.pts = smoothAnchors(s.pts.map((q) => [q.x, q.y]), s.closed))), 'Smooth all points') }, 'Smooth all'),
          h('button', { class: 'btn small', onclick: () => edit((p) => p.subpaths.forEach((s) => s.pts.forEach((q) => { q.in = q.out = null; q.mode = 'corner'; })), 'Sharpen all points') }, 'Corners'),
          h('button', { class: 'btn small', onclick: () => app.setTool('direct') }, 'Edit points'),
        ));
    }
    const kinds = Object.entries(PRIMS).map(([k, d]) => [k, d.label]);
    const kindSel = select({ label: 'Kind', value: n.geom.kind, options: kinds, onChange: (k) => {
      const g = app.doc.nodes[n.id].geom;
      const ng = { ...primDefaults(k), w: g.w, ...(primHasSize(k) && g.h ? { h: g.h } : {}) };
      app.setProps(ids, 'geom', ng, false, 'Change shape kind');
    } });
    const fields = PRIMS[n.geom.kind].params.filter((p) => p.key !== 'w' && p.key !== 'h').map((p) =>
      this.bind(paramField(p, n.geom[p.key], this.setter(ids, 'geom.' + p.key, 'Change ' + p.label)), () => app.doc.nodes[n.id]?.geom[p.key]));
    return section('Shape', {}, kindSel, ...fields,
      h('button', { class: 'btn small ghost', title: 'Turn this into a free path so every point can be moved', onclick: () => app.run('convert') }, icon('convert'), 'Convert to path'));
  }

  boolSection(n) {
    const app = this.app;
    const seg = segmented({ value: n.op, options: [['union', 'Union', 'union'], ['subtract', 'Subtract', 'subtract'], ['intersect', 'Intersect', 'intersect'], ['exclude', 'Exclude', 'exclude']], onChange: (v) => app.setProps([n.id], 'op', v, false, 'Combine mode') });
    this.bind(seg, () => app.doc.nodes[n.id]?.op);
    return section('Combine', {}, seg, h('div', { class: 'muted small' }, `Combines ${n.children.length} shapes. They stay editable in the layers panel; the bottom one is what the others cut or join.`),
      h('button', { class: 'btn small ghost', onclick: () => app.run('convert') }, icon('convert'), 'Flatten to one path'));
  }

  genSection(n) {
    const app = this.app;
    const info = h('div', { class: 'muted small' });
    info.update = () => {
      const nn = app.doc.nodes[n.id];
      if (!nn) return;
      const g = app.geo.of(n.id, 0.5);
      info.textContent = `${g.items?.length || 0} shapes from ${Object.keys(nn.graph.nodes).length} nodes.` + (g.error ? ' ⚠ ' + g.error : '');
    };
    info.update();
    this.bind(info, () => null);
    return section('Generator', {},
      info,
      h('div', { class: 'btn-row wrap' },
        h('button', { class: 'btn small primary', onclick: () => app.emit('open-graph', n.id) }, icon('graph'), 'Edit graph'),
        h('button', { class: 'btn small', title: 'Replace the generator with separate editable shapes', onclick: () => app.run('convert') }, icon('bake'), 'Bake to shapes'),
        h('button', { class: 'btn small ghost', onclick: () => app.setProps([n.id], 'graph', starterGraph(), false, 'Reset graph') }, 'Reset'),
      ));
  }

  imageSection(n) {
    const app = this.app;
    const a = app.doc.assets[n.asset];
    return section('Swatch image', {},
      h('div', { class: 'muted small' }, a ? `${a.name} · ${a.w} × ${a.h}px` : 'Missing asset'),
      a?.recipe ? h('button', { class: 'btn small', title: 'Put the editable shapes this swatch was baked from back on the page', onclick: () => app.emit('place-recipe', n.asset) }, icon('convert'), 'Place editable recipe') : null,
      h('button', { class: 'btn small ghost', onclick: () => {
        if (!a) return;
        const u = a.unit || 1;
        app.store.exec([{ op: 'set', id: n.id, path: 'w', value: a.w * u }, { op: 'set', id: n.id, path: 'h', value: a.h * u }], 'Original size');
      } }, 'Original size'));
  }

  appearanceSection(n) {
    const app = this.app;
    const ids = [n.id];
    const blend = select({ label: 'Blend', value: n.blend || 'normal', options: BLENDS.map((b) => [b, b.replace('-', ' ')]), onChange: (v) => app.setProps(ids, 'blend', v, false, 'Blend mode') });
    this.bind(blend, () => app.doc.nodes[n.id]?.blend || 'normal');
    const parts = [
      grid2(this.num(ids, 'opacity', 'Opacity', { min: 0, max: 100, step: 1, unit: '%' }, () => (app.doc.nodes[n.id]?.opacity ?? 1) * 100), blend),
    ];
    // opacity field stores 0..1
    const of = parts[0].firstChild;
    of.remove();
    parts[0].prepend(this.bind(numberField({ label: 'Opacity', value: n.opacity * 100, min: 0, max: 100, step: 1, unit: '%', onChange: (v, live) => app.setProps(ids, 'opacity', v / 100, live, 'Opacity'), onCommit: () => app.commitLive() }), () => (app.doc.nodes[n.id]?.opacity ?? 1) * 100));
    if (n.type !== 'layer') {
      const m = select({ label: 'Mask', value: n.mask || '', options: [['', 'Not a mask'], ['alpha', 'Mask: shows inside'], ['invert', 'Mask: cuts a hole'], ['luma', 'Mask: by lightness']], onChange: (v) => app.setProps(ids, 'mask', v || null, false, 'Mask') });
      parts.push(m);
      if (n.mask) parts.push(h('div', { class: 'muted small' }, 'This shape is not drawn; it masks everything else in its group or layer. Effects on it (dry edge, noise) make textured masks.'));
    }
    return section('Appearance', {}, ...parts);
  }

  fillSection(ids) {
    const app = this.app;
    const n = app.doc.nodes[ids[0]];
    const has = !!n.fill;
    const toggleFill = () => app.setProps(ids, 'fill', has ? null : solid(app.nextColor()), false, has ? 'Remove fill' : 'Add fill');
    const body = has ? paintEditor(n.fill, (p, live, commitOnly) => {
      if (commitOnly || !p) return app.commitLive();
      app.setProps(ids, 'fill', p, live, 'Fill');
    }, { palette: this.palette(), assets: app.doc.assets }) : h('div', { class: 'muted small' }, 'No fill.');
    if (has && n.fill.type === 'solid') {
      const cb = body.querySelector('.color-btn');
      if (cb) this.bind(cb, () => app.doc.nodes[ids[0]]?.fill?.color);
    }
    return section('Fill', { actions: [h('button', { class: 'icon-btn', title: has ? 'Remove fill' : 'Add fill', onclick: toggleFill }, icon(has ? 'minus' : 'plus'))] }, body);
  }

  strokeSection(n) {
    const app = this.app;
    const ids = [n.id];
    const s = n.stroke;
    const toggleStroke = () => app.setProps(ids, 'stroke', s ? null : makeStroke(oklch(0.22, 0.02, 270), 3), false, s ? 'Remove stroke' : 'Add stroke');
    if (!s) return section('Stroke', { actions: [h('button', { class: 'icon-btn', title: 'Add stroke', onclick: toggleStroke }, icon('plus'))] }, h('div', { class: 'muted small' }, 'No stroke.'));
    const sp = (k) => this.setter(ids, 'stroke.' + k, 'Stroke ' + k);
    const profile = select({ label: 'Line quality', value: s.profile || 'uniform', options: [['uniform', 'Even'], ['taper', 'Tapered both ends'], ['taperStart', 'Tapered start'], ['taperEnd', 'Tapered end'], ['swell', 'Swelling']], onChange: (v) => app.setProps(ids, 'stroke.profile', v, false, 'Line quality') });
    const fields = [
      paintEditor(s.paint, (p, live, commitOnly) => {
        if (commitOnly || !p) return app.commitLive();
        app.setProps(ids, 'stroke.paint', p, live, 'Stroke paint');
      }, { palette: this.palette(), assets: app.doc.assets }),
      grid2(this.num(ids, 'stroke.width', 'Width', { min: 0, max: 2000, step: 0.25 }), profile),
    ];
    if (s.profile && s.profile !== 'uniform') fields.push(grid2(this.num(ids, 'stroke.taper', 'Taper', { min: 0.01, max: 1, step: 0.01 }), this.num(ids, 'stroke.jitter', 'Brush wobble', { min: 0, max: 2, step: 0.01 })), this.num(ids, 'stroke.seed', 'Seed', { min: 0, max: 999999, step: 1, seed: true }));
    else fields.push(grid2(
      select({ label: 'Corners', value: s.join, options: [['round', 'Round'], ['miter', 'Sharp'], ['bevel', 'Bevel']], onChange: (v) => app.setProps(ids, 'stroke.join', v, false, 'Stroke corners') }),
      select({ label: 'Ends', value: s.cap, options: [['round', 'Round'], ['butt', 'Flat'], ['square', 'Square']], onChange: (v) => app.setProps(ids, 'stroke.cap', v, false, 'Stroke ends') }),
    ), h('div', { class: 'muted small' }, 'Pick a line quality other than Even for tapered or brushy lines; they become shapes that effects can roughen.'));
    return section('Stroke', { actions: [h('button', { class: 'icon-btn', title: 'Remove stroke', onclick: toggleStroke }, icon('minus'))] }, ...fields);
  }

  effectsSection(id, title, hint) {
    const app = this.app;
    const n = app.doc.nodes[id];
    const addBtn = h('button', { class: 'icon-btn', title: 'Add effect' }, icon('plus'));
    addBtn.addEventListener('click', () => {
      const items = [];
      for (const g of EFFECT_GROUPS) {
        items.push({ header: g });
        for (const [k, d] of Object.entries(EFFECTS)) if (d.group === g) items.push({ label: d.label, hint: d.hint, icon: d.stage === 'geom' ? 'shape' : 'fx', run: () => this.addEffect(id, k) });
      }
      menu(addBtn, items, { align: 'right', cls: 'fx-menu' });
    });
    const list = h('div', { class: 'fx-list' });
    n.effects.forEach((e, i) => list.append(this.effectCard(id, e, i, n.effects.length)));
    const body = [list];
    if (!n.effects.length) body.push(h('div', { class: 'muted small' }, 'No effects. Outline effects (torn edge, warp, wave…) move the edge; pixel effects (noise, dry edge, light, shadow…) work on the colour.'));
    else if (hint) body.push(h('div', { class: 'muted small' }, hint));
    return section(title, { id: 'fx' + (id === app.doc.root ? 'doc' : ''), actions: [addBtn] }, ...body);
  }

  addEffect(id, type) {
    const e = makeEffect(type);
    this.openFx.add(e.id);
    const n = this.app.doc.nodes[id];
    this.app.setProps([id], 'effects', [...n.effects, e], false, 'Add ' + EFFECTS[type].label);
  }

  effectCard(id, e, i, count) {
    const app = this.app;
    const d = EFFECTS[e.type];
    const setList = (fn, label) => {
      const list = JSON.parse(JSON.stringify(app.doc.nodes[id].effects));
      fn(list);
      app.setProps([id], 'effects', list, false, label);
    };
    const open = this.openFx.has(e.id);
    const onBox = h('input', { type: 'checkbox', checked: e.on, title: 'On / off' });
    onBox.addEventListener('change', () => app.setProps([id], `effects.${i}.on`, onBox.checked, false, 'Toggle effect'));
    this.bind(onBox, () => ({}));
    onBox.update = () => (onBox.checked = !!app.doc.nodes[id]?.effects[i]?.on);
    const head = h('div', { class: 'fx-head' },
      onBox,
      h('button', { class: 'fx-title', onclick: () => {
        open ? this.openFx.delete(e.id) : this.openFx.add(e.id);
        this.lastSig = null;
        this.refresh();
      } }, icon('chevron', open ? 'rot90' : ''), h('span', {}, d.label), h('span', { class: 'tag ' + d.stage }, d.stage === 'geom' ? 'outline' : 'pixels')),
      h('div', { class: 'fx-actions' },
        h('button', { class: 'icon-btn tiny', title: 'Move up (runs earlier)', disabled: i === 0, onclick: () => setList((l) => l.splice(i - 1, 0, l.splice(i, 1)[0]), 'Reorder effects') }, icon('up')),
        h('button', { class: 'icon-btn tiny', title: 'Move down (runs later)', disabled: i === count - 1, onclick: () => setList((l) => l.splice(i + 1, 0, l.splice(i, 1)[0]), 'Reorder effects') }, icon('down')),
        h('button', { class: 'icon-btn tiny', title: 'Duplicate', onclick: () => setList((l) => l.splice(i + 1, 0, { ...JSON.parse(JSON.stringify(l[i])), id: makeEffect(e.type).id }), 'Duplicate effect') }, icon('copy')),
        h('button', { class: 'icon-btn tiny', title: 'Remove', onclick: () => setList((l) => l.splice(i, 1), 'Remove effect') }, icon('trash')),
      ));
    const card = h('div', { class: 'fx-card' + (e.on ? '' : ' off') + (open ? ' open' : '') }, head);
    if (open) {
      const body = h('div', { class: 'fx-body' });
      if (d.hint) body.append(h('div', { class: 'muted small' }, d.hint));
      for (const p of d.params) {
        const path = `effects.${i}.params.${p.key}`;
        body.append(this.bind(paramField(p, e.params[p.key], this.setter([id], path, d.label), { palette: this.palette() }), () => app.doc.nodes[id]?.effects[i]?.params[p.key]));
      }
      card.append(body);
    }
    return card;
  }

  actionsSection(nodes) {
    const app = this.app;
    const b = (label, ic, cmd, title) => h('button', { class: 'btn small', title, onclick: () => app.run(cmd) }, icon(ic), label);
    return section('Actions', { id: 'actions' },
      h('div', { class: 'btn-row wrap' },
        b('Bake swatch', 'bake', 'bake', 'Render the selection into a reusable swatch (image + recipe)'),
        b('Duplicate', 'copy', 'duplicate'),
        b('Group', 'group', 'group'),
        nodes.some((n) => n.type === 'group' || n.type === 'bool') ? b('Ungroup', 'group', 'ungroup') : null,
        b('Delete', 'trash', 'delete'),
      ));
  }

  // ---------------------------------------------------------------- several nodes

  renderMulti(nodes) {
    const app = this.app;
    const ids = nodes.map((n) => n.id);
    this.host.append(h('div', { class: 'insp-head' }, icon('group'), h('div', {}, h('div', { class: 'insp-title' }, `${nodes.length} objects`), h('div', { class: 'insp-sub' }, 'Changes apply to all of them'))));
    const al = (label, ic, fn) => h('button', { class: 'icon-btn', title: label, onclick: fn }, h('span', { class: 'al-ic ' + ic }));
    const align = (mode) => {
      const all = app.selectionBounds(ids);
      const ops = [];
      for (const id of ids) {
        const b = app.nodeBounds(id);
        let dx = 0, dy = 0;
        if (mode === 'l') dx = all.x0 - b.x0;
        if (mode === 'c') dx = (all.x0 + all.x1) / 2 - (b.x0 + b.x1) / 2;
        if (mode === 'r') dx = all.x1 - b.x1;
        if (mode === 't') dy = all.y0 - b.y0;
        if (mode === 'm') dy = (all.y0 + all.y1) / 2 - (b.y0 + b.y1) / 2;
        if (mode === 'b') dy = all.y1 - b.y1;
        const n = app.doc.nodes[id];
        ops.push({ op: 'set', id, path: 'transform.x', value: n.transform.x + dx }, { op: 'set', id, path: 'transform.y', value: n.transform.y + dy });
      }
      app.store.exec(ops, 'Align');
    };
    const distribute = (axis) => {
      const bs = ids.map((id) => ({ id, b: app.nodeBounds(id) })).sort((a, c) => (axis === 'x' ? a.b.x0 - c.b.x0 : a.b.y0 - c.b.y0));
      if (bs.length < 3) return;
      const k0 = axis === 'x' ? 'x0' : 'y0', k1 = axis === 'x' ? 'x1' : 'y1';
      const total = bs.reduce((s, q) => s + (q.b[k1] - q.b[k0]), 0);
      const gap = (bs[bs.length - 1].b[k1] - bs[0].b[k0] - total) / (bs.length - 1);
      let cur = bs[0].b[k0];
      const ops = [];
      for (const q of bs) {
        const d = cur - q.b[k0];
        const n = app.doc.nodes[q.id];
        ops.push({ op: 'set', id: q.id, path: 'transform.' + axis, value: n.transform[axis] + d });
        cur += q.b[k1] - q.b[k0] + gap;
      }
      app.store.exec(ops, 'Distribute');
    };
    this.host.append(section('Align', {},
      h('div', { class: 'btn-row' },
        al('Align left edges', 'al-l', () => align('l')), al('Align centres', 'al-c', () => align('c')), al('Align right edges', 'al-r', () => align('r')),
        h('span', { class: 'sp' }),
        al('Align tops', 'al-t', () => align('t')), al('Align middles', 'al-m', () => align('m')), al('Align bottoms', 'al-b', () => align('b'))),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn small', onclick: () => distribute('x') }, 'Space evenly ↔'),
        h('button', { class: 'btn small', onclick: () => distribute('y') }, 'Space evenly ↕')),
    ));
    this.host.append(section('Combine', {},
      h('div', { class: 'btn-row' },
        ...[['union', 'Union'], ['subtract', 'Subtract'], ['intersect', 'Intersect'], ['exclude', 'Exclude']].map(([op, l]) => h('button', { class: 'icon-btn big', title: l + ' (keeps the parts editable)', onclick: () => app.combine(op) }, icon(op)))),
      h('div', { class: 'muted small' }, 'Combining keeps the shapes live inside a combined shape; the bottom one is what the others cut.'),
    ));
    const blend = select({ label: 'Blend', value: nodes[0].blend, options: BLENDS.map((b) => [b, b]), onChange: (v) => app.setProps(ids, 'blend', v, false, 'Blend') });
    this.host.append(section('Appearance', {}, grid2(numberField({ label: 'Opacity', value: nodes[0].opacity * 100, min: 0, max: 100, step: 1, unit: '%', onChange: (v, live) => app.setProps(ids, 'opacity', v / 100, live, 'Opacity'), onCommit: () => app.commitLive() }), blend)));
    const fillable = nodes.filter((n) => ['shape', 'bool', 'gen'].includes(n.type));
    if (fillable.length) this.host.append(this.fillSection(fillable.map((n) => n.id)));
    this.host.append(this.actionsSection(nodes));
  }
}
