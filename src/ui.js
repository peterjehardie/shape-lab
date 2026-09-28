// Layer stack and inspector panels, built from the parameter specs.
import { h } from './util.js';
import { BANDS, LAYER_SECTIONS, GLOBAL_SECTIONS, kindParams, bandById, valueGroupIndex, resolveRole } from './scene.js';
import { rampOf, lchHex } from './palette.js';
import { KINDS } from './structures.js';
import { labCss, hexToLab } from './color.js';

const openSecs = new Set(['layer', 'structure', 'scene', 'sun', 'valuegroups', 'value']);

// Looks from Chroma Mat: edge, fade, mask and grain settings in one click.
export const LOOKS = [
  ['Crisp cut', { blur: 0, mask: 'none', texture: 0, opacity: 1, opGrade: 0 }],
  ['Torn paper', { mask: 'torn', maskClip: 0.5, maskSharp: 0.9, maskDepth: 1.6, maskReach: 6, maskScale: 2, texture: 0.25, textureHue: 0, edgeStyle: 'rough', shapeNoise: 0.3 }],
  ['Washed away', { blur: 3, opGrade: 0.85, opAngle: 0 }],
  ['Ghost fade', { blur: 1.5, opGrade: 1, opAngle: 90, opacity: 0.85 }],
  ['Dissolving', { mask: 'dissolve', maskClip: 0.5, maskSharp: 0.8, maskScale: 1.5 }],
  ['Film speckle', { texture: 0.9, textureHue: 0.2, textureScale: 0.4, textureBlend: 'overlay' }],
  ['Chalky', { texture: 0.7, textureScale: 0.25, textureHue: 0, mask: 'torn', maskClip: 0.5, maskSharp: 0.55, maskDepth: 1, maskReach: 3, maskScale: 3 }],
  ['Watercolour bloom', { blur: 1.2, texture: 0.6, textureHue: 0.35, textureScale: 1.6, mask: 'torn', maskClip: 0.45, maskSharp: 0.35, maskDepth: 1.1, maskReach: 12, maskScale: 1.2 }],
  ['Veiny marble', { texture: 0.8, textureHue: 0.1, textureScale: 1.5, textureBlend: 'soft-light' }],
  ['Holes', { mask: 'dissolve', maskClip: 0.38, maskSharp: 1, maskScale: 1.4 }],
];

const fmt = (v, step) => {
  if (typeof v !== 'number') return v;
  const d = step >= 1 ? 0 : step >= 0.1 ? 1 : step >= 0.01 ? 2 : 3;
  return v.toFixed(d);
};

function section(id, title, body, note, dice) {
  const summary = h('summary', {}, h('span', {}, title),
    dice ? h('button', { class: 'small ghost sec-dice', title: 'Random values for this section (Undo reverts)', onclick: (e) => { e.preventDefault(); e.stopPropagation(); dice(); } }, '\u2684') : null);
  const d = h('details', { class: 'sec' }, summary, h('div', { class: 'sec-body' }, note ? h('p', { class: 'note' }, note) : null, ...body));
  d.open = openSecs.has(id);
  d.addEventListener('toggle', () => (d.open ? openSecs.add(id) : openSecs.delete(id)));
  return d;
}

// One control row for a param spec. api.set(spec, value) applies live, api.commit(spec) records it.
export function control(spec, obj, api, options) {
  const val = obj[spec.key];
  const label = h('label', { title: spec.help || '' }, spec.label);
  if (spec.type === 'range') {
    const r = h('input', { type: 'range', min: spec.min, max: spec.max, step: spec.step, value: val });
    const n = h('input', { type: 'number', class: 'num', step: spec.step, value: fmt(val, spec.step) });
    r.addEventListener('input', () => {
      n.value = fmt(+r.value, spec.step);
      api.set(spec, +r.value);
    });
    r.addEventListener('change', () => api.commit(spec));
    n.addEventListener('change', () => {
      const v = +n.value;
      if (Number.isNaN(v)) return;
      r.value = v;
      api.set(spec, v);
      api.commit(spec);
    });
    return h('div', { class: 'row' }, label, r, n);
  }
  if (spec.type === 'select') {
    const opts = options || spec.options;
    const s = h('select', {}, ...opts.map(([v, t]) => h('option', { value: v }, t)));
    s.value = String(val);
    s.addEventListener('change', () => {
      const raw = s.value;
      const v = typeof spec.def === 'number' ? +raw : raw;
      api.set(spec, v);
      api.commit(spec);
    });
    return h('div', { class: 'row wide' }, label, s);
  }
  if (spec.type === 'bool') {
    const c = h('input', { type: 'checkbox', checked: !!val });
    c.addEventListener('change', () => {
      api.set(spec, c.checked);
      api.commit(spec);
    });
    return h('div', { class: 'row wide' }, label, h('div', {}, c));
  }
  if (spec.type === 'text') {
    const t = h('input', { type: 'text', value: val ?? '', style: { width: '100%' } });
    t.addEventListener('change', () => { api.set(spec, t.value); api.commit(spec); });
    return h('div', { class: 'row wide' }, label, t);
  }
  if (spec.type === 'color') {
    const c = h('input', { type: 'color', value: val });
    c.addEventListener('input', () => api.set(spec, c.value));
    c.addEventListener('change', () => api.commit(spec));
    return h('div', { class: 'row wide' }, label, h('div', {}, c));
  }
  return h('div');
}

function swatchOf(scene, l) {
  const g = scene.globals;
  if (g.colorMode !== 'free' && g.palette) {
    const [r, st] = resolveRole(l);
    return lchHex(rampOf(g.palette, r)[Math.max(0, Math.min(4, Math.round(2 + st)))]);
  }
  return l.kind === 'sky' ? g.skyTop : l.p.color;
}

// ---------------------------------------------------------------------------------
export function renderLayerPanel(el, state, act) {
  const scroll = el.scrollTop;
  el.innerHTML = '';
  el.append(h('div', { class: `layer-row scene-row${state.selected === 'scene' ? ' sel' : ''}`, onclick: () => act.select('scene') }, 'Scene, sun & values'));
  for (const band of BANDS) {
    const layers = state.scene.layers.filter((l) => l.band === band.id);
    const sec = h('div', { class: 'band' },
      h('div', { class: 'band-head' }, h('span', {}, band.label), h('button', { class: 'small ghost', title: 'Add a layer to this band', onclick: () => act.addLayer(band.id) }, '+ add')));
    layers.forEach((l, i) => {
      const stop = (fn) => (e) => { e.stopPropagation(); fn(); };
      sec.append(
        h('div', { class: `layer-row${state.selected === l.id ? ' sel' : ''}${l.visible ? '' : ' hidden'}`, onclick: () => act.select(l.id) },
          h('button', { class: 'small ghost eye', title: l.visible ? 'Hide' : 'Show', onclick: stop(() => act.toggleVisible(l.id)) }, l.visible ? '◉' : '○'),
          h('span', { class: 'swatch', style: { background: swatchOf(state.scene, l) } }),
          h('span', { class: 'name', title: `${l.name} (${KINDS[l.kind].label})` }, l.name),
          l.locked ? h('span', { class: 'kind', title: 'Seed locked: Reseed all skips this layer' }, '\u{1F512}\uFE0E') : null,
          h('span', { class: 'acts' },
            h('button', { class: 'small ghost', title: l.locked ? 'Unlock seed' : 'Lock seed (Reseed all skips it)', onclick: stop(() => act.toggleLock(l.id)) }, l.locked ? '\u25a3' : '\u25a1'),
            h('button', { class: 'small ghost', title: 'Move back', disabled: i === 0, onclick: stop(() => act.move(l.id, -1)) }, '↑'),
            h('button', { class: 'small ghost', title: 'Move forward', disabled: i === layers.length - 1, onclick: stop(() => act.move(l.id, 1)) }, '↓'),
            h('button', { class: 'small ghost', title: 'Duplicate', onclick: stop(() => act.duplicate(l.id)) }, '⧉'),
            h('button', { class: 'small ghost', title: 'New random seed', onclick: stop(() => act.reseed(l.id)) }, '⚄'),
            h('button', { class: 'small ghost', title: 'Delete', onclick: stop(() => act.remove(l.id)) }, '✕'))));
    });
    el.append(sec);
  }
  el.scrollTop = scroll;
}

// ---------------------------------------------------------------------------------
export function renderInspector(el, state, act) {
  const scroll = el.scrollTop;
  el.innerHTML = '';
  const layer = state.scene.layers.find((l) => l.id === state.selected);
  if (!layer) renderGlobals(el, state, act);
  else renderLayer(el, state, act, layer);
  el.scrollTop = scroll;
}

function renderLayer(el, state, act, layer) {
  const scene = state.scene;
  const api = {
    set: (spec, v) => act.setParam(layer.p, spec, v),
    commit: (spec) => act.commit(spec.rebuild),
  };
  const nameIn = h('input', { type: 'text', value: layer.name });
  nameIn.addEventListener('change', () => act.renameLayer(layer.id, nameIn.value));
  const band = h('select', {}, ...BANDS.map((b) => h('option', { value: b.id }, b.label)));
  band.value = layer.band;
  band.addEventListener('change', () => act.setBand(layer.id, band.value));
  const kind = h('select', {}, ...Object.entries(KINDS).map(([k, v]) => h('option', { value: k }, v.label)));
  kind.value = layer.kind;
  kind.addEventListener('change', () => act.setKind(layer.id, kind.value));
  const seed = h('input', { type: 'number', class: 'num', value: layer.seed, style: { width: '80px' } });
  seed.addEventListener('change', () => act.setSeed(layer.id, +seed.value));
  el.append(section('layer', 'Layer', [
    h('div', { class: 'row wide' }, h('label', {}, 'Name'), nameIn),
    h('div', { class: 'row wide' }, h('label', {}, 'Depth band'), band),
    h('div', { class: 'row wide' }, h('label', {}, 'Structure'), kind),
    h('div', { class: 'row wide' }, h('label', {}, 'Seed'), h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } }, seed,
      h('button', { class: 'small', onclick: () => act.reseed(layer.id) }, 'New seed'),
      h('button', { class: 'small', onclick: () => act.seedGallery(layer.id) }, 'Pick from 8'))),
    h('div', { class: 'btnrow' },
      h('button', { class: 'small', onclick: () => act.copyLook(layer.id) }, 'Copy look'),
      h('button', { class: 'small', disabled: !act.hasClip(), onclick: () => act.pasteLook(layer.id) }, 'Paste look'),
      h('button', { class: 'small', onclick: () => act.toggleLock(layer.id) }, layer.locked ? 'Unlock seed' : 'Lock seed')),
  ]));
  const kp = kindParams(layer.kind).filter((s) => !s.show || s.show(layer, scene));
  el.append(section('structure', `Structure · ${KINDS[layer.kind].label}`, kp.map((s) => control(s, layer.p, api)), null, () => act.randomize(layer.p, kindParams(layer.kind))));
  for (const sec of LAYER_SECTIONS) {
    if (sec.hide && sec.hide(layer)) continue;
    const rows = sec.params.filter((s) => !s.show || s.show(layer, scene)).map((s) => {
      if (s.dynamic === 'valueGroups') {
        const auto = scene.globals.valueGroups[valueGroupIndex(scene, { ...layer, p: { ...layer.p, valueGroup: 'auto' } })];
        const opts = [['auto', `Auto by band (${auto ? auto.name : '?'})`], ...scene.globals.valueGroups.map((g, i) => [String(i), `${i + 1}. ${g.name}`])];
        return control(s, layer.p, api, opts);
      }
      return control(s, layer.p, api);
    });
    if (sec.id === 'edits') {
      const p = layer.p;
      const nEd = Object.keys(p.edits || {}).length, nEx = (p.extras || []).length, nDr = (p.drawn || []).length;
      rows.push(h('p', { class: 'note' }, `${nEd} object edit${nEd === 1 ? '' : 's'} \u00b7 ${nEx} added \u00b7 ${nDr} drawn`),
        h('div', { class: 'btnrow' },
          h('button', { class: 'small', disabled: !nEd, onclick: () => act.resetEdits(layer.id, 'edits') }, 'Reset object edits'),
          h('button', { class: 'small', disabled: !nEx, onclick: () => act.resetEdits(layer.id, 'extras') }, 'Remove added'),
          h('button', { class: 'small', disabled: !nDr, onclick: () => act.resetEdits(layer.id, 'drawn') }, 'Clear drawn'),
          h('button', { class: 'small', onclick: () => act.resetEdits(layer.id, 'offset') }, 'Reset shift')));
    }
    if (sec.id === 'look') {
      rows.unshift(h('div', { class: 'chips' }, ...LOOKS.map(([n, look]) => h('button', { class: 'chip', onclick: () => act.apply(() => Object.assign(layer.p, look)) }, n))),
        h('p', { class: 'note' }, 'Torn edges and holes work best on big shapes; on trees made of small leaves they eat the foliage.'));
    }
    const dice = ['value', 'edits'].includes(sec.id) ? null : () => act.randomize(layer.p, sec.params);
    el.append(section(sec.id, sec.title, rows, sec.note, dice));
  }
}

function renderGlobals(el, state, act) {
  const g = state.scene.globals;
  const api = { set: (spec, v) => act.setParam(g, spec, v), commit: (spec) => act.commit(spec.rebuild) };
  for (const sec of GLOBAL_SECTIONS) {
    const rows = sec.params.filter((s) => !s.show || s.show(g)).map((s) => control(s, g, api));
    if (sec.id === 'scene') rows.push(h('div', { class: 'btnrow' }, h('button', { onclick: act.reseedAll }, 'Reseed every layer'), h('button', { onclick: act.resetGraph }, 'Reset node graph')));
    const dice = ['sun', 'finish', 'sky'].includes(sec.id) ? () => act.randomize(g, sec.params.filter((q) => q.type !== 'color')) : null;
    el.append(section(sec.id, sec.title, rows, sec.note, dice));
    if (sec.id === 'sun') el.append(valueGroupSection(state, act));
  }
}

function valueGroupSection(state, act) {
  const g = state.scene.globals;
  const groups = g.valueGroups;
  const strip = h('div', { class: 'vg-strip' },
    ...groups.map((vg) => h('div', {
      style: {
        background: `linear-gradient(90deg, ${labCss(vg.value - vg.spread, 0, 0)}, ${labCss(vg.value + vg.spread, 0, 0)})`,
        color: vg.value > 0.6 ? '#111' : '#eee',
      },
    }, vg.name)));
  const body = [strip];
  const sorted = groups.map((vg, i) => [vg, i]).sort((a, b) => b[0].value - a[0].value);
  for (let k = 0; k < sorted.length - 1; k++) {
    const [a] = sorted[k], [b] = sorted[k + 1];
    const gap = a.value - a.spread - (b.value + b.spread);
    if (gap < 0.02) body.push(h('p', { class: 'note', style: { color: 'var(--accent)' } }, `\u201c${a.name}\u201d and \u201c${b.name}\u201d overlap: their light and shadow ranges touch, so those layers may merge.`));
  }
  groups.forEach((vg, i) => {
    const name = h('input', { type: 'text', value: vg.name, style: { width: '100%' } });
    name.addEventListener('change', () => { vg.name = name.value; act.commit(true); });
    const obj = vg;
    const api = { set: (spec, v) => act.setParam(obj, spec, v, true), commit: () => act.commit(true) };
    body.push(h('div', { class: 'vg' },
      h('div', { class: 'chip', style: { background: `linear-gradient(${labCss(vg.value + vg.spread, 0, 0)}, ${labCss(vg.value - vg.spread, 0, 0)})` } }),
      h('div', {}, name,
        control({ key: 'value', label: 'Value (lightness)', type: 'range', min: 0, max: 1, step: 0.005 }, obj, api),
        control({ key: 'spread', label: 'Light–shadow range', type: 'range', min: 0, max: 0.4, step: 0.005 }, obj, api)),
      h('button', { class: 'small ghost', title: 'Remove group', disabled: groups.length <= 1, onclick: () => act.removeValueGroup(i) }, '✕')));
  });
  body.push(h('div', { class: 'btnrow' },
    h('button', { onclick: act.addValueGroup }, 'Add group'),
    h('button', { onclick: act.autoValueGroups }, 'Set every layer to auto'),
    h('button', { onclick: act.spreadValueGroups }, 'Even spacing')));
  return section('valuegroups', 'Value groups', body,
    'Each layer takes its lightness from one group. Light and shadow only move a layer inside its group’s range, so the big value pattern stays intact.');
}
