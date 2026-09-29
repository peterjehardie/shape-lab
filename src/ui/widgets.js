// Small DOM toolkit: element builder, scrubbable number fields, selects, toggles,
// sections, popovers and the OKLCH colour picker.

import { toCss, toHex, fromHex, labToRgb, lchToLab } from '../core/color.js';
import { clamp } from '../core/math.js';
import { newSeed } from '../core/rng.js';
import { icon } from './icons.js';

export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const k in attrs) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const c of kids.flat(Infinity)) if (c != null && c !== false) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return el;
}

const decimals = (step) => (step >= 1 ? 0 : Math.min(4, Math.ceil(-Math.log10(step))));

// Number field. Drag the label sideways to scrub (Shift = coarse, Alt = fine),
// type a value, or use arrow keys. onChange(value, live): live=true while dragging.
export function numberField({ label, value, min = -Infinity, max = Infinity, step = 1, unit = '', onChange, onCommit, seed = false, title, compact = false }) {
  const d = decimals(step);
  const fmt = (v) => (Number.isFinite(v) ? (+v).toFixed(d) : '');
  const input = h('input', { class: 'nf-input', type: 'text', value: fmt(value), spellcheck: 'false' });
  const lab = h('span', { class: 'nf-label', title: title || (label ? `${label} — drag to adjust` : '') }, label || '');
  const el = h('div', { class: 'nf' + (compact ? ' compact' : '') }, lab, input, unit ? h('span', { class: 'nf-unit' }, unit) : null);
  let cur = value;
  const set = (v, live) => {
    v = clamp(Math.round(v / step) * step, min, max);
    if (!Number.isFinite(v)) return;
    cur = v;
    input.value = fmt(v);
    onChange?.(v, live);
  };
  lab.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    lab.setPointerCapture(e.pointerId);
    const x0 = e.clientX, v0 = cur;
    const range = Number.isFinite(max - min) ? max - min : 200;
    const per = Math.max(step, range / 400);
    let moved = false;
    const mv = (ev) => {
      const k = ev.shiftKey ? 10 : ev.altKey ? 0.1 : 1;
      if (Math.abs(ev.clientX - x0) > 1) moved = true;
      if (moved) set(v0 + (ev.clientX - x0) * per * k, true);
    };
    const up = () => {
      lab.removeEventListener('pointermove', mv);
      lab.removeEventListener('pointerup', up);
      if (moved) onCommit?.(cur);
      else input.select();
    };
    lab.addEventListener('pointermove', mv);
    lab.addEventListener('pointerup', up);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      input.blur();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const k = (e.shiftKey ? 10 : e.altKey ? 0.1 : 1) * step * (e.key === 'ArrowUp' ? 1 : -1);
      set(cur + k, false);
      onCommit?.(cur);
    } else if (e.key === 'Escape') {
      input.value = fmt(cur);
      input.blur();
    }
    e.stopPropagation();
  });
  input.addEventListener('change', () => {
    let txt = input.value.trim();
    let v;
    try {
      // allow simple arithmetic like "120*2" or "+=10"
      if (/^[-+*/]=/.test(txt)) txt = cur + txt[0] + txt.slice(2);
      if (/^[-+*/().\d\s]+$/.test(txt)) v = Function('"use strict";return (' + txt + ')')();
    } catch {
      v = NaN;
    }
    if (Number.isFinite(v)) {
      set(v, false);
      onCommit?.(cur);
    } else input.value = fmt(cur);
  });
  input.addEventListener('focus', () => setTimeout(() => input.select(), 0));
  if (seed) {
    el.append(
      h('button', { class: 'icon-btn tiny', title: 'New random seed', onclick: () => { set(newSeed(), false); onCommit?.(cur); } }, icon('dice')),
    );
  }
  el.update = (v) => {
    if (document.activeElement === input) return;
    cur = v;
    input.value = fmt(v);
  };
  return el;
}

export function select({ label, value, options, onChange }) {
  const sel = h('select', { class: 'sel' }, options.map(([v, t]) => h('option', { value: v, selected: v === value }, t)));
  sel.addEventListener('change', () => onChange(sel.value));
  sel.addEventListener('keydown', (e) => e.stopPropagation());
  const el = label ? h('label', { class: 'field' }, h('span', { class: 'field-label' }, label), sel) : sel;
  el.update = (v) => (sel.value = v);
  return el;
}

export function toggle({ label, value, onChange, title }) {
  const box = h('input', { type: 'checkbox', checked: !!value });
  box.addEventListener('change', () => onChange(box.checked));
  const el = h('label', { class: 'toggle', title }, box, h('span', { class: 'toggle-ui' }), h('span', {}, label));
  el.update = (v) => (box.checked = !!v);
  return el;
}

export function textField({ label, value, onChange, placeholder, list }) {
  const input = h('input', { class: 'txt', type: 'text', value: value ?? '', placeholder, list });
  input.addEventListener('change', () => onChange(input.value));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') input.blur();
    e.stopPropagation();
  });
  const el = label ? h('label', { class: 'field' }, h('span', { class: 'field-label' }, label), input) : input;
  el.update = (v) => document.activeElement !== input && (input.value = v ?? '');
  return el;
}

export function segmented({ value, options, onChange }) {
  const el = h('div', { class: 'seg' });
  const btns = options.map(([v, label, ic]) => {
    const b = h('button', { class: 'seg-btn' + (v === value ? ' on' : ''), title: label, onclick: () => onChange(v) }, ic ? icon(ic) : label);
    b.dataset.v = v;
    return b;
  });
  el.append(...btns);
  el.update = (v) => btns.forEach((b) => b.classList.toggle('on', b.dataset.v === v));
  return el;
}

export function section(title, { open = true, actions = [], id } = {}, ...content) {
  const key = 'sl.sec.' + (id || title);
  let isOpen = open;
  try {
    const s = localStorage.getItem(key);
    if (s != null) isOpen = s === '1';
  } catch {}
  const body = h('div', { class: 'sec-body' }, ...content);
  const head = h('div', { class: 'sec-head' },
    h('button', { class: 'sec-toggle', onclick: () => tog() }, icon('chevron'), h('span', {}, title)),
    h('div', { class: 'sec-actions' }, ...actions));
  const el = h('section', { class: 'sec' + (isOpen ? ' open' : '') }, head, body);
  function tog() {
    isOpen = !isOpen;
    el.classList.toggle('open', isOpen);
    try {
      localStorage.setItem(key, isOpen ? '1' : '0');
    } catch {}
  }
  el.body = body;
  return el;
}

export const row = (...kids) => h('div', { class: 'row' }, ...kids);
export const grid2 = (...kids) => h('div', { class: 'grid2' }, ...kids);

// ---------- popovers & menus ----------

let openPop = null;
export function closePopover() {
  if (openPop) {
    openPop.el.remove();
    openPop.onClose?.();
    openPop = null;
  }
}
document.addEventListener('pointerdown', (e) => {
  if (openPop && !openPop.el.contains(e.target) && !openPop.anchor?.contains(e.target)) closePopover();
}, true);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && openPop) {
    closePopover();
    e.stopPropagation();
  }
}, true);

export function popover(anchor, content, { onClose, align = 'left', cls = '' } = {}) {
  closePopover();
  const el = h('div', { class: 'popover ' + cls }, content);
  document.body.append(el);
  const r = anchor.getBoundingClientRect();
  const pw = el.offsetWidth, ph = el.offsetHeight;
  let x = align === 'right' ? r.right - pw : r.left;
  let y = r.bottom + 4;
  if (y + ph > innerHeight - 8) y = Math.max(8, r.top - ph - 4);
  x = clamp(x, 8, innerWidth - pw - 8);
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  openPop = { el, anchor, onClose };
  return el;
}

// items: [{ label, icon, key, run, disabled, sep, sub: [...] , header }]
export function menu(anchor, items, opts) {
  const list = h('div', { class: 'menu' });
  for (const it of items) {
    if (it.sep) {
      list.append(h('div', { class: 'menu-sep' }));
      continue;
    }
    if (it.header) {
      list.append(h('div', { class: 'menu-header' }, it.header));
      continue;
    }
    list.append(
      h('button', {
        class: 'menu-item', disabled: it.disabled, title: it.hint || '',
        onclick: () => {
          closePopover();
          it.run?.();
        },
      }, it.icon ? icon(it.icon) : h('span', { class: 'menu-ic' }), h('span', { class: 'menu-label' }, it.label), it.key ? h('kbd', {}, it.key) : null),
    );
  }
  return popover(anchor, list, opts);
}

// ---------- colour ----------

export function colorButton({ value, onChange, palette, title }) {
  const chip = h('span', { class: 'chip-fill' });
  const hex = h('span', { class: 'chip-hex' });
  const btn = h('button', { class: 'color-btn', title: title || 'Colour' }, h('span', { class: 'chip' }, chip), hex);
  let cur = value;
  const paint = () => {
    chip.style.background = toCss(cur);
    hex.textContent = toHex(cur).toUpperCase() + ((cur.a ?? 1) < 1 ? ` ${Math.round(cur.a * 100)}%` : '');
  };
  paint();
  btn.addEventListener('click', () => {
    popover(btn, colorPicker(cur, (c, live) => {
      cur = c;
      paint();
      onChange(c, live);
    }, palette), { cls: 'pop-color' });
  });
  btn.update = (v) => {
    cur = v;
    paint();
  };
  return btn;
}

// The picker: a lightness × chroma plane for the current hue, a hue strip, alpha,
// numeric L/C/H, hex, and the document palette.
export function colorPicker(start, onChange, palette) {
  let col = { ...start };
  const W = 216, H = 150;
  const plane = h('canvas', { class: 'cp-plane', width: W, height: H });
  const hueC = h('canvas', { class: 'cp-hue', width: W, height: 12 });
  const alphaC = h('canvas', { class: 'cp-alpha', width: W, height: 12 });
  const dot = h('div', { class: 'cp-dot' });
  const hueKnob = h('div', { class: 'cp-knob' });
  const aKnob = h('div', { class: 'cp-knob' });
  const CMAX = 0.33;

  const drawPlane = () => {
    const g = plane.getContext('2d');
    const img = g.createImageData(W, H);
    const hr = (col.h * Math.PI) / 180, ca = Math.cos(hr), sa = Math.sin(hr);
    for (let y = 0; y < H; y++) {
      const L = 1 - y / (H - 1);
      for (let x = 0; x < W; x++) {
        const C = (x / (W - 1)) * CMAX;
        const [r, gg, b] = labToRgb(L, C * ca, C * sa);
        const k = (y * W + x) * 4;
        img.data[k] = r; img.data[k + 1] = gg; img.data[k + 2] = b; img.data[k + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    // mark where colours stop being displayable (chroma gets clipped past this line)
    g.strokeStyle = 'rgba(255,255,255,0.55)';
    g.setLineDash([2, 2]);
    g.beginPath();
    for (let y = 0; y < H; y++) {
      const L = 1 - y / (H - 1);
      let lo = 0, hi = CMAX;
      for (let i = 0; i < 14; i++) {
        const m = (lo + hi) / 2;
        const [r, gg, b] = labToRgb(L, m * ca, m * sa);
        const back = lchFromRgb(r, gg, b);
        if (Math.abs(back.c - m) < 0.004) lo = m;
        else hi = m;
      }
      const x = (lo / CMAX) * (W - 1);
      y ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.stroke();
  };
  const drawHue = () => {
    const g = hueC.getContext('2d');
    for (let x = 0; x < W; x++) {
      const hh = (x / (W - 1)) * 360;
      g.fillStyle = toCss({ l: 0.72, c: 0.14, h: hh, a: 1 });
      g.fillRect(x, 0, 1, 12);
    }
  };
  const drawAlpha = () => {
    const g = alphaC.getContext('2d');
    g.clearRect(0, 0, W, 12);
    for (let x = 0; x < W; x += 6) for (let y = 0; y < 12; y += 6) {
      g.fillStyle = ((x + y) / 6) % 2 ? '#888' : '#ccc';
      g.fillRect(x, y, 6, 6);
    }
    const gr = g.createLinearGradient(0, 0, W, 0);
    gr.addColorStop(0, toCss({ ...col, a: 0 }));
    gr.addColorStop(1, toCss({ ...col, a: 1 }));
    g.fillStyle = gr;
    g.fillRect(0, 0, W, 12);
  };
  const place = () => {
    dot.style.left = (col.c / CMAX) * W + 'px';
    dot.style.top = (1 - col.l) * H + 'px';
    dot.style.background = toCss({ ...col, a: 1 });
    hueKnob.style.left = (col.h / 360) * W + 'px';
    aKnob.style.left = (col.a ?? 1) * W + 'px';
    fields.forEach((f) => f.update(f.get()));
    hexIn.value = toHex(col).toUpperCase();
  };
  const emit = (live) => {
    place();
    onChange({ ...col }, live);
  };
  const drag = (el, fn) => {
    el.addEventListener('pointerdown', (e) => {
      el.setPointerCapture(e.pointerId);
      const r = el.getBoundingClientRect();
      const mv = (ev) => fn(clamp((ev.clientX - r.left) / r.width), clamp((ev.clientY - r.top) / r.height), true);
      mv(e);
      const up = (ev) => {
        el.removeEventListener('pointermove', mv);
        el.removeEventListener('pointerup', up);
        fn(clamp((ev.clientX - r.left) / r.width), clamp((ev.clientY - r.top) / r.height), false);
      };
      el.addEventListener('pointermove', mv);
      el.addEventListener('pointerup', up);
    });
  };
  const planeWrap = h('div', { class: 'cp-plane-wrap' }, plane, dot);
  const hueWrap = h('div', { class: 'cp-strip' }, hueC, hueKnob);
  const aWrap = h('div', { class: 'cp-strip' }, alphaC, aKnob);
  drag(planeWrap, (x, y, live) => {
    col.c = x * CMAX;
    col.l = 1 - y;
    emit(live);
    drawAlpha();
  });
  drag(hueWrap, (x, _, live) => {
    col.h = x * 360;
    drawPlane();
    drawAlpha();
    emit(live);
  });
  drag(aWrap, (x, _, live) => {
    col.a = +x.toFixed(3);
    emit(live);
  });
  const mk = (label, key, min, max, step, mulv = 1) => {
    const f = numberField({ label, value: col[key] * mulv, min, max, step, compact: true, onChange: (v, live) => {
      col[key] = v / mulv;
      if (key === 'h') drawPlane();
      drawAlpha();
      emit(live);
    } });
    f.get = () => col[key] * mulv;
    return f;
  };
  const fields = [mk('L', 'l', 0, 100, 0.5, 100), mk('C', 'c', 0, 0.37, 0.005), mk('H', 'h', 0, 360, 1), mk('A', 'a', 0, 100, 1, 100)];
  const hexIn = h('input', { class: 'txt cp-hex', value: toHex(col).toUpperCase(), spellcheck: 'false' });
  hexIn.addEventListener('keydown', (e) => e.stopPropagation());
  hexIn.addEventListener('change', () => {
    const c = fromHex(hexIn.value, col.a ?? 1);
    if (c) {
      col = c;
      drawPlane();
      drawAlpha();
      emit(false);
    }
  });
  const pal = palette ? h('div', { class: 'cp-palette' }, palette.colors().map((c) => h('button', {
    class: 'cp-sw', style: { background: toCss(c) }, title: toHex(c),
    onclick: () => {
      col = { ...c, a: col.a ?? 1 };
      drawPlane();
      drawAlpha();
      emit(false);
    },
  })), h('button', { class: 'cp-sw add', title: 'Add this colour to the document palette', onclick: () => palette.add({ ...col }) }, '+')) : null;
  const el = h('div', { class: 'cp' }, planeWrap, h('div', { class: 'cp-cap' }, h('span', {}, 'Lightness ↕'), h('span', {}, 'Colourfulness →')), hueWrap, aWrap,
    h('div', { class: 'cp-fields' }, ...fields), h('div', { class: 'cp-row' }, h('span', { class: 'field-label' }, 'Hex'), hexIn), pal);
  requestAnimationFrame(() => {
    drawPlane();
    drawHue();
    drawAlpha();
    place();
  });
  return el;
}

import { rgbToLab, labToLch } from '../core/color.js';
function lchFromRgb(r, g, b) {
  return labToLch(...rgbToLab(r, g, b));
}
export { lchToLab };

export function toast(msg, ms = 2200) {
  let host = document.querySelector('.toasts');
  if (!host) document.body.append((host = h('div', { class: 'toasts' })));
  const t = h('div', { class: 'toast' }, msg);
  host.append(t);
  setTimeout(() => t.classList.add('out'), ms);
  setTimeout(() => t.remove(), ms + 400);
}
