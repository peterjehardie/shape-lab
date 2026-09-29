// Controls built from parameter descriptions (the same descriptions the core uses),
// and the paint editor.

import { h, numberField, select, toggle, textField, colorButton, segmented, row, grid2 } from './widgets.js';
import { PAINT_TYPES, PATTERNS, makePaint } from '../core/doc.js';
import { toCss, mix } from '../core/color.js';
import { icon } from './icons.js';

// One control for one described parameter. onChange(value, live).
export function paramField(p, value, onChange, { palette, attrList, compact } = {}) {
  switch (p.type) {
    case 'number':
      return numberField({ label: p.label, value: value ?? p.default, min: p.min, max: p.max, step: p.step, unit: p.unit, seed: p.seed, compact, onChange: (v, live) => onChange(v, live), onCommit: () => onChange(undefined, false, true) });
    case 'select':
      return select({ label: p.label, value: value ?? p.default, options: p.options, onChange: (v) => onChange(v, false) });
    case 'bool':
      return toggle({ label: p.label, value: value ?? p.default, onChange: (v) => onChange(v, false) });
    case 'color': {
      const b = colorButton({ value: value ?? p.default, palette, onChange: (c, live) => onChange(c, live) });
      const el = h('label', { class: 'field' }, h('span', { class: 'field-label' }, p.label), b);
      el.update = (v) => b.update(v);
      return el;
    }
    case 'attr':
      return textField({ label: p.label, value: value ?? p.default, list: attrList, onChange: (v) => onChange(v.trim() || 'none', false) });
    case 'text':
      return textField({ label: p.label, value: value ?? p.default, onChange: (v) => onChange(v, false) });
  }
  return h('div', {}, p.label);
}

// A gradient/ramp bar with its stops listed underneath.
function stopsEditor(stops, onChange, palette) {
  const bar = h('div', { class: 'ramp-bar' });
  const paintBar = (st) => {
    const s = [...st].sort((a, b) => a.t - b.t);
    const parts = [];
    for (let i = 0; i < 24; i++) {
      const t = i / 23;
      let c;
      if (t <= s[0].t) c = s[0].color;
      else if (t >= s[s.length - 1].t) c = s[s.length - 1].color;
      else {
        let k = 0;
        while (k < s.length - 2 && t > s[k + 1].t) k++;
        c = mix(s[k].color, s[k + 1].color, (t - s[k].t) / (s[k + 1].t - s[k].t || 1));
      }
      parts.push(`${toCss(c)} ${(t * 100).toFixed(1)}%`);
    }
    bar.style.background = `linear-gradient(90deg, ${parts.join(',')}), repeating-conic-gradient(#999 0 25%, #ccc 0 50%) 0 0/10px 10px`;
  };
  paintBar(stops);
  const list = h('div', { class: 'stops' });
  let cur = stops.map((s) => ({ ...s, color: { ...s.color } }));
  const emit = (live) => {
    paintBar(cur);
    onChange(cur.map((s) => ({ t: s.t, color: { ...s.color } })), live);
  };
  const build = () => {
    list.replaceChildren(
      ...cur.map((s, i) =>
        h('div', { class: 'stop' },
          colorButton({ value: s.color, palette, onChange: (c, live) => { cur[i].color = c; emit(live); } }),
          numberField({ label: 'At', value: s.t * 100, min: 0, max: 100, step: 1, unit: '%', compact: true, onChange: (v, live) => { cur[i].t = v / 100; emit(live); }, onCommit: () => emit(false) }),
          h('button', { class: 'icon-btn', title: 'Remove stop', disabled: cur.length <= 2, onclick: () => { cur.splice(i, 1); build(); emit(false); } }, icon('minus')),
        ),
      ),
      h('button', { class: 'btn ghost small', onclick: () => {
        const a = cur[cur.length - 2] || cur[0], b = cur[cur.length - 1];
        cur.push({ t: Math.min(1, (a.t + b.t) / 2 + 0.001), color: mix(a.color, b.color, 0.5) });
        cur.sort((x, y) => x.t - y.t);
        build();
        emit(false);
      } }, icon('plus'), 'Stop'),
    );
  };
  build();
  return h('div', { class: 'stops-editor' }, bar, list);
}

// Paint editor. onChange(paint, live). assets: doc assets for swatch paints.
export function paintEditor(paint, onChange, { palette, assets = {}, allowNone = false } = {}) {
  const el = h('div', { class: 'paint' });
  const types = PAINT_TYPES.filter(([t]) => t !== 'swatch' || Object.values(assets).some((a) => a.kind === 'swatch'));
  const typeSel = segmented({
    value: paint?.type || 'solid',
    options: types.map(([t, l]) => [t, l]),
    onChange: (t) => onChange(makePaint(t, paint), false),
  });
  el.append(typeSel);
  if (!paint) return el;
  const set = (k) => (v, live, commitOnly) => {
    if (commitOnly) return onChange(null, false, true);
    onChange({ ...paint, [k]: v }, live);
  };
  const n = (label, k, min, max, step, unit, extra = {}) => numberField({ label, value: paint[k], min, max, step, unit, ...extra, onChange: set(k), onCommit: () => onChange(null, false, true) });
  switch (paint.type) {
    case 'solid':
      el.append(colorButton({ value: paint.color, palette, onChange: (c, live) => onChange({ ...paint, color: c }, live) }));
      break;
    case 'linear':
      el.append(n('Angle', 'angle', -360, 360, 1, '°'), stopsEditor(paint.stops, (s, live) => onChange({ ...paint, stops: s }, live), palette));
      break;
    case 'radial':
      el.append(grid2(n('Centre X', 'cx', -1, 2, 0.01), n('Centre Y', 'cy', -1, 2, 0.01)), n('Radius', 'r', 0.01, 3, 0.01), stopsEditor(paint.stops, (s, live) => onChange({ ...paint, stops: s }, live), palette));
      break;
    case 'noise':
      el.append(
        select({ label: 'Kind', value: paint.kind, options: [['fbm', 'Cloudy'], ['ridged', 'Ridged'], ['billow', 'Billow'], ['cells', 'Cells'], ['simple', 'Smooth']], onChange: (v) => onChange({ ...paint, kind: v }, false) }),
        grid2(n('Size', 'scale', 1, 3000, 1), n('Detail', 'octaves', 1, 7, 1)),
        grid2(n('Stretch', 'stretch', 0.05, 40, 0.05), n('Angle', 'angle', -360, 360, 1, '°')),
        grid2(n('Contrast', 'contrast', 0, 8, 0.05), n('Seed', 'seed', 0, 999999, 1, '', { seed: true })),
        stopsEditor(paint.stops, (s, live) => onChange({ ...paint, stops: s }, live), palette),
      );
      break;
    case 'pattern':
      el.append(
        select({ label: 'Pattern', value: paint.pattern, options: PATTERNS, onChange: (v) => onChange({ ...paint, pattern: v }, false) }),
        grid2(n('Spacing', 'size', 1, 500, 0.5), n('Weight', 'weight', 0.02, 1, 0.01)),
        n('Angle', 'angle', -360, 360, 1, '°'),
        grid2(
          h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Ink'), colorButton({ value: paint.fg, palette, onChange: (c, live) => onChange({ ...paint, fg: c }, live) })),
          h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Ground'), colorButton({ value: paint.bg, palette, onChange: (c, live) => onChange({ ...paint, bg: c }, live) })),
        ),
      );
      break;
    case 'swatch': {
      const sw = Object.entries(assets).filter(([, a]) => a.kind === 'swatch');
      el.append(
        select({ label: 'Swatch', value: paint.asset || '', options: [['', '— choose —'], ...sw.map(([id, a]) => [id, a.name])], onChange: (v) => onChange({ ...paint, asset: v || null }, false) }),
        grid2(n('Scale', 'scale', 0.02, 20, 0.01), n('Angle', 'angle', -360, 360, 1, '°')),
      );
      break;
    }
  }
  return el;
}

export { row, grid2 };
