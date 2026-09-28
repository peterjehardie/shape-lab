// Layer stack and inspector panels, built from the parameter specs.
import { h } from './util.js';
import { BANDS, LAYER_SECTIONS, GLOBAL_SECTIONS, kindParams, bandById, valueGroupIndex } from './scene.js';
import { KINDS } from './structures.js';
import { labCss, hexToLab } from './color.js';

const openSecs = new Set(['layer', 'structure', 'scene', 'sun', 'valuegroups']);

const fmt = (v, step) => {
  if (typeof v !== 'number') return v;
  const d = step >= 1 ? 0 : step >= 0.1 ? 1 : step >= 0.01 ? 2 : 3;
  return v.toFixed(d);
};

function section(id, title, body, note) {
  const d = h('details', { class: 'sec' }, h('summary', {}, title), h('div', { class: 'sec-body' }, note ? h('p', { class: 'note' }, note) : null, ...body));
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
  if (spec.type === 'color') {
    const c = h('input', { type: 'color', value: val });
    c.addEventListener('input', () => api.set(spec, c.value));
    c.addEventListener('change', () => api.commit(spec));
    return h('div', { class: 'row wide' }, label, h('div', {}, c));
  }
  return h('div');
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
          h('span', { class: 'swatch', style: { background: l.kind === 'sky' ? state.scene.globals.skyTop : l.p.color } }),
          h('span', { class: 'name', title: `${l.name} (${KINDS[l.kind].label})` }, l.name),
          h('span', { class: 'acts' },
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
    h('div', { class: 'row wide' }, h('label', {}, 'Seed'), h('div', { style: { display: 'flex', gap: '6px' } }, seed, h('button', { class: 'small', onclick: () => act.reseed(layer.id) }, 'New seed'))),
  ]));
  const kp = kindParams(layer.kind).filter((s) => !s.show || s.show(layer));
  el.append(section('structure', `Structure · ${KINDS[layer.kind].label}`, kp.map((s) => control(s, layer.p, api))));
  for (const sec of LAYER_SECTIONS) {
    if (sec.hide && sec.hide(layer)) continue;
    const rows = sec.params.filter((s) => !s.show || s.show(layer)).map((s) => {
      if (s.dynamic === 'valueGroups') {
        const auto = scene.globals.valueGroups[valueGroupIndex(scene, { ...layer, p: { ...layer.p, valueGroup: 'auto' } })];
        const opts = [['auto', `Auto by band (${auto ? auto.name : '?'})`], ...scene.globals.valueGroups.map((g, i) => [String(i), `${i + 1}. ${g.name}`])];
        return control(s, layer.p, api, opts);
      }
      return control(s, layer.p, api);
    });
    el.append(section(sec.id, sec.title, rows, sec.note));
  }
}

function renderGlobals(el, state, act) {
  const g = state.scene.globals;
  const api = { set: (spec, v) => act.setParam(g, spec, v), commit: (spec) => act.commit(spec.rebuild) };
  for (const sec of GLOBAL_SECTIONS) {
    const rows = sec.params.map((s) => control(s, g, api));
    if (sec.id === 'scene') rows.push(h('div', { class: 'btnrow' }, h('button', { onclick: act.reseedAll }, 'Reseed every layer'), h('button', { onclick: act.resetGraph }, 'Reset node graph')));
    el.append(section(sec.id, sec.title, rows, sec.note));
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
