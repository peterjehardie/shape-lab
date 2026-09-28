// Palette tab: colour source, six roles, ramps, generator, checks, library, export.
import { h } from './util.js';
import { ROLES, RNAME, PALETTES, rampOf, lchHex, lchCss, hexToLch, lchClipped, generatePalette, paletteChecks, paletteFromImage, exportPalette, clonePal, GEN_OPTS } from './palette.js';

const ui = { edit: 'dominant', q: '', cat: 'All', gen: { hue: 30, scheme: 'analogous', key: 'mid', chroma: 'natural', temp: 'warm' }, exportText: '' };
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
};

function box(title, sub, ...kids) {
  return h('section', { class: 'box' }, h('h2', {}, title, sub ? h('span', { class: 'sub' }, sub) : null), ...kids);
}
function seg(opts, cur, onPick) {
  return h('div', { class: 'seg seg-wide' }, ...opts.map(([v, t]) => h('button', { class: String(cur) === String(v) ? 'on' : '', onclick: () => onPick(v) }, t)));
}
function slider(label, min, max, step, val, fmt, onInput, onChange) {
  const out = h('span', { class: 'num mono' }, fmt(val));
  const r = h('input', { type: 'range', min, max, step, value: val });
  r.addEventListener('input', () => { out.textContent = fmt(+r.value); onInput(+r.value); });
  r.addEventListener('change', () => onChange && onChange());
  return h('div', { class: 'row' }, h('label', {}, label), r, out);
}
const bar = (p) => h('div', { class: 'pbar' }, ...ROLES.map((r) => h('i', { style: { flex: String(Math.max(0.02, p.props[r] || 0)), background: lchHex(p.roles[r]) } })));

export function renderPaletteTab(el, state, act) {
  const scroll = el.scrollTop;
  el.innerHTML = '';
  const g = state.scene.globals;
  const P = g.palette;
  const locks = (g.paletteLocks ||= {});
  const rerender = () => renderPaletteTab(el, state, act);
  const live = () => act.paletteChanged(false);
  const commit = () => { act.paletteChanged(true); rerender(); };

  // colour source
  el.append(box('Colour source', null,
    seg([['palette', 'Palette roles'], ['free', 'Free colour + value groups']], g.colorMode || 'palette', (v) => { g.colorMode = v; act.paletteChanged(true); act.refresh(); rerender(); }),
    h('p', { class: 'note' }, g.colorMode === 'free'
      ? 'Each layer picks its own hue; lightness comes from its value group (Scene settings).'
      : 'Every colour in the picture comes from six palette roles and their shadow-to-light ramps. Each layer takes a role and a ramp step (Inspector → Colour).'),
    g.colorMode === 'free' ? null : h('div', { class: 'btnrow' },
      h('button', { class: 'small', onclick: act.rolesByDepth, title: 'Every layer back to its automatic role by depth band' }, 'Roles by depth'),
      h('button', { class: 'small', onclick: act.recolour, title: 'Reassign roles so each role covers close to its target share' }, 'Recolour to target shares'))));

  // roles
  const rows = ROLES.map((r, i) => {
    const c = P.roles[r];
    return h('div', { class: `role${ui.edit === r ? ' on' : ''}`, onclick: () => { ui.edit = r; rerender(); } },
      h('div', { class: 'sw', style: { background: lchHex(c) } }),
      h('div', {}, h('b', {}, `${i + 1} · ${RNAME[r]}`, lchClipped(c) ? h('span', { class: 'clip' }, ' clipped') : null),
        h('small', { class: 'mono' }, `${lchHex(c)} · L ${c[0].toFixed(2)} C ${c[1].toFixed(3)} H ${Math.round(c[2])}`)),
      h('span', { class: 'pct mono' }, `${Math.round((P.props[r] || 0) * 100)}%`),
      h('button', { class: 'small ghost', title: locks[r] ? 'Unlock: New palette may change it' : 'Lock: New palette keeps it', onclick: (e) => { e.stopPropagation(); locks[r] = !locks[r]; rerender(); } }, locks[r] ? '●' : '○'));
  });
  const name = h('input', { type: 'text', value: P.name });
  name.addEventListener('change', () => { P.name = name.value; commit(); });
  el.append(box('Palette', P.cat || '', name, P.note ? h('p', { class: 'note' }, P.note) : null, h('div', { class: 'roles' }, ...rows),
    h('p', { class: 'note' }, 'Ground is the paper behind everything (in a landscape, usually the sky). Percentages are target shares of the picture, used by Recolour and by layers that mix roles.')));

  // editor
  const r = ui.edit, c = P.roles[r];
  const hex = h('input', { type: 'text', value: lchHex(c), class: 'mono' });
  hex.addEventListener('change', () => { const v = hexToLch(hex.value); if (!/^#?[0-9a-f]{6}$/i.test(hex.value.trim())) return; P.roles[r] = v; commit(); });
  const setC = (i) => (v) => { P.roles[r][i] = v; live(); };
  el.append(box('Edit', RNAME[r],
    slider('Lightness L', 0.05, 0.99, 0.005, c[0], (v) => v.toFixed(3), setC(0), commit),
    slider('Chroma C', 0, 0.3, 0.002, c[1], (v) => v.toFixed(3), setC(1), commit),
    slider('Hue H', 0, 360, 1, c[2], (v) => `${Math.round(v)}°`, setC(2), commit),
    slider('Target share', 0, 0.7, 0.01, P.props[r] || 0, (v) => `${Math.round(v * 100)}%`, (v) => {
      P.props[r] = v;
      if (r !== 'ground') P.props.ground = Math.max(0, 1 - ROLES.filter((x) => x !== 'ground').reduce((a, x) => a + (P.props[x] || 0), 0));
      live();
    }, commit),
    h('div', { class: 'row wide' }, h('label', {}, 'Hex'), hex),
    h('p', { class: 'note' }, 'OKLCH: L is perceived lightness (0 black, 1 white), C is colourfulness, H is hue angle. Colours a screen cannot show lose chroma, never lightness.')));

  // ramps
  el.append(box('Rendering ramps', 'shadow → base → light',
    h('div', { class: 'ramps' }, ...ROLES.map((rr) => h('div', { class: 'ramp' }, h('span', {}, RNAME[rr]),
      ...rampOf(P, rr).map((cc, i) => h('i', { class: i === 2 ? 'base' : '', style: { background: lchHex(cc) }, title: `step ${i - 2} · ${lchHex(cc)}` }))))),
    slider('Light hue', 0, 360, 1, P.light.h, (v) => `${Math.round(v)}°`, (v) => { P.light.h = v; live(); }, commit),
    slider('Light tint', 0, 1, 0.01, P.light.amt, (v) => v.toFixed(2), (v) => { P.light.amt = v; live(); }, commit),
    slider('Shadow hue', 0, 360, 1, P.shadow.h, (v) => `${Math.round(v)}°`, (v) => { P.shadow.h = v; live(); }, commit),
    slider('Shadow tint', 0, 1, 0.01, P.shadow.amt, (v) => v.toFixed(2), (v) => { P.shadow.amt = v; live(); }, commit),
    h('div', { class: 'row wide' }, h('label', {}, 'Haze toward'), (() => {
      const s = h('select', {}, ...ROLES.map((x) => h('option', { value: x }, RNAME[x])));
      s.value = g.hazeRole || 'light';
      s.addEventListener('change', () => { g.hazeRole = s.value; commit(); });
      return s;
    })()),
    h('p', { class: 'note' }, 'Steps into shadow drift toward the shadow hue, steps into light toward the light hue. Warm light and cool shadow is a rule of thumb for a warm sun under a blue sky; it reverses under cool north light.')));

  // generator
  const G = ui.gen;
  el.append(box('Generate a palette', null,
    slider('Base hue', 0, 360, 1, G.hue, (v) => `${Math.round(v)}°`, (v) => { G.hue = v; }),
    ...Object.entries(GEN_OPTS).map(([k, opts]) => h('div', {}, h('div', { class: 'lbl' }, { scheme: 'Hue scheme', key: 'Value key', chroma: 'Chroma', temp: 'Light temperature' }[k]), seg(opts, G[k], (v) => { G[k] = v; rerender(); }))),
    h('div', { class: 'btnrow' },
      h('button', { class: 'primary', onclick: () => { g.palette = generatePalette(G, P, locks); commit(); } }, 'Generate (keep locked)'),
      h('button', { onclick: () => {
        G.hue = Math.floor(Math.random() * 360);
        for (const [k, opts] of Object.entries(GEN_OPTS)) G[k] = opts[Math.floor(Math.random() * opts.length)][0];
        g.palette = generatePalette(G, P, locks);
        commit();
      } }, 'Random settings')),
    h('p', { class: 'note' }, 'Hue schemes come from colour-wheel tradition. They describe arrangements; there is little evidence that any one is reliably preferred.')));

  el.append(box('Palette checks', 'rules of thumb',
    h('ul', { class: 'checks' }, ...paletteChecks(P).map((ck) => h('li', { class: ck.k }, h('span', {}, ck.k === 'ok' ? '✓' : ck.k === 'warn' ? '!' : '·'), ck.t)))));

  // library
  const cats = [...new Set(PALETTES.map((p) => p.cat))];
  const q = h('input', { type: 'text', placeholder: 'Search: night, forest, pink…', value: ui.q });
  q.addEventListener('input', () => { ui.q = q.value.trim().toLowerCase(); drawLib(); });
  const libBox = h('div', {});
  const visible = () => PALETTES.filter((p) => (ui.cat === 'All' || p.cat === ui.cat) && (!ui.q || `${p.name} ${p.note} ${p.cat}`.toLowerCase().includes(ui.q)));
  const load = (p) => { const keep = { ...P.roles }; g.palette = clonePal(p); for (const rr of ROLES) if (locks[rr]) g.palette.roles[rr] = keep[rr]; commit(); };
  function drawLib() {
    libBox.innerHTML = '';
    const vis = visible();
    for (const cat of cats) {
      const list = vis.filter((p) => p.cat === cat);
      if (!list.length) continue;
      libBox.append(h('h3', { class: 'libh' }, cat), ...list.map((p) => h('button', { class: `pcard${P.name === p.name ? ' on' : ''}`, onclick: () => load(p) }, bar(p), h('b', {}, p.name), h('small', {}, p.note))));
    }
  }
  drawLib();
  el.append(box('Palette library', `${PALETTES.length} palettes`,
    h('p', { class: 'note' }, 'Hand-built readings of lighting situations and animation looks, carried over from Chroma Mat. None is sampled from a photograph or a particular film.'),
    q,
    h('div', { class: 'chips' }, ...['All', ...cats].map((ct) => h('button', { class: `chip${ui.cat === ct ? ' on' : ''}`, onclick: () => { ui.cat = ct; rerender(); } }, ct))),
    h('div', { class: 'btnrow' }, h('button', { class: 'small', onclick: () => { const v = visible(); if (v.length) load(v[Math.floor(Math.random() * v.length)]); } }, 'Random from this view')),
    libBox));

  const mine = store.get('shapelab.palettes', []);
  const file = h('input', { type: 'file', accept: 'image/*' });
  file.addEventListener('change', () => {
    const f = file.files[0];
    if (!f) return;
    const img = new Image();
    img.onload = () => { g.palette = paletteFromImage(img, f.name); commit(); };
    img.src = URL.createObjectURL(f);
  });
  el.append(box('My palettes', 'this browser only',
    h('div', { class: 'btnrow' }, h('button', { class: 'small', onclick: () => { mine.unshift(clonePal(P)); store.set('shapelab.palettes', mine.slice(0, 40)); rerender(); } }, 'Save current palette')),
    ...mine.map((p, i) => h('div', { class: 'pcard' }, bar(p), h('b', {}, p.name),
      h('div', { class: 'btnrow' }, h('button', { class: 'small', onclick: () => load(p) }, 'Load'), h('button', { class: 'small ghost', onclick: () => { mine.splice(i, 1); store.set('shapelab.palettes', mine); rerender(); } }, '✕')))),
    h('div', { class: 'lbl' }, 'Palette from a picture: six colour clusters mapped to roles by area, lightness and chroma'), file));

  const ta = h('textarea', { readonly: true, rows: 6 }, ui.exportText);
  const exp = (k) => {
    ui.exportText = exportPalette(k, P, g.sunAngle);
    ta.value = ui.exportText;
    navigator.clipboard?.writeText(ui.exportText).catch(() => ta.select());
  };
  el.append(box('Palette out', null,
    h('div', { class: 'btnrow' }, ...[['json', 'JSON (roles + ramps)'], ['css', 'CSS variables'], ['blender', 'Blender Python'], ['three', 'three.js']].map(([k, t]) => h('button', { class: 'small', onclick: () => exp(k) }, t))),
    ta, h('p', { class: 'note' }, 'Blender and three.js get scene-linear RGB, which shader colour inputs expect; hex and CSS are sRGB. Clicking copies the text.')));

  el.scrollTop = scroll;
}
