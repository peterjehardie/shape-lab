// Measure: read the rendered picture back and report value structure, warm/cool balance,
// the colour-mass centre and (in palette mode) how much of the frame each role covers.
import { h } from './util.js';
import { rgbToLab, labToRgb, rgbCss } from './color.js';
import { ROLES, RNAME, rampOf, lchToLab, lchHex } from './palette.js';

const probe = document.createElement('canvas');

export function measure(canvas, scene) {
  const g = scene.globals;
  const k = 260 / Math.max(canvas.width, canvas.height);
  const W = Math.round(canvas.width * k), H = Math.round(canvas.height * k);
  probe.width = W;
  probe.height = H;
  const pc = probe.getContext('2d', { willReadFrequently: true });
  pc.drawImage(canvas, 0, 0, W, H);
  const d = pc.getImageData(0, 0, W, H).data;
  const pal = g.colorMode !== 'free' && g.palette ? g.palette : null;
  const refs = pal ? ROLES.flatMap((r) => rampOf(pal, r).map((c) => [r, lchToLab(c)])) : [];
  const ground = pal ? lchToLab(pal.roles.ground) : rgbToLab(...[0, 0, 0].map((_, i) => parseInt((g.skyTop || '#888888').slice(1 + i * 2, 3 + i * 2), 16)));
  const lut = new Map();
  const hist = new Array(10).fill(0);
  const area = Object.fromEntries(ROLES.map((r) => [r, 0]));
  let warm = 0, cool = 0, mass = 0, mx = 0, my = 0, Lmin = 1, Lmax = 0;
  const N = W * H;
  for (let i = 0; i < N; i++) {
    const r = d[i * 4], gg = d[i * 4 + 1], b = d[i * 4 + 2], key = (r << 16) | (gg << 8) | b;
    let e = lut.get(key);
    if (!e) {
      const lab = rgbToLab(r, gg, b);
      let role = null;
      if (refs.length) {
        let bd = 1e9;
        for (const [rr, q] of refs) { const dd = (lab[0] - q[0]) ** 2 + (lab[1] - q[1]) ** 2 + (lab[2] - q[2]) ** 2; if (dd < bd) { bd = dd; role = rr; } }
      }
      e = { lab, role };
      lut.set(key, e);
    }
    const [L, a, bb] = e.lab;
    hist[Math.min(9, Math.max(0, Math.floor(L * 10)))]++;
    Lmin = Math.min(Lmin, L);
    Lmax = Math.max(Lmax, L);
    const C = Math.hypot(a, bb), hue = ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360;
    if (C > 0.02) { if (hue < 110 || hue >= 330) warm += C; else if (hue >= 150 && hue < 300) cool += C; }
    if (e.role) area[e.role]++;
    const de = Math.hypot(L - ground[0], a - ground[1], bb - ground[2]);
    mass += de;
    mx += de * (i % W);
    my += de * ((i / W) | 0);
  }
  for (const r of ROLES) area[r] /= N;
  return {
    hist: hist.map((v) => v / N), warm, cool, Lmin, Lmax, area: pal ? area : null,
    com: mass ? [mx / mass / k, my / mass / k] : null, comOff: mass ? [(mx / mass / W - 0.5), (my / mass / H - 0.5)] : [0, 0],
  };
}

export function renderMeasure(el, m, scene, act) {
  el.innerHTML = '';
  if (!m) { el.append(h('p', { class: 'note pad' }, 'Measuring…')); return; }
  const g = scene.globals;
  const pal = g.colorMode !== 'free' ? g.palette : null;
  const box = (t, sub, ...k) => h('section', { class: 'box' }, h('h2', {}, t, sub ? h('span', { class: 'sub' }, sub) : null), ...k);
  if (pal && m.area) {
    el.append(box('Role areas', 'actual vs target',
      h('div', { class: 'bars' }, ...ROLES.map((r) => {
        const a = m.area[r], t = pal.props[r] || 0;
        return h('div', { class: 'mbar' }, h('span', {}, RNAME[r]),
          h('div', { class: 'mtrack' }, h('i', { style: { width: `${(a * 100).toFixed(1)}%`, background: lchHex(pal.roles[r]) } }), h('u', { style: { left: `${(t * 100).toFixed(1)}%` } })),
          h('span', { class: 'mono' }, `${Math.round(a * 100)}% / ${Math.round(t * 100)}%`));
      })),
      h('p', { class: 'note' }, 'Each pixel of the rendered picture counts toward the role whose ramp colour it is closest to. The bar is the actual share, the tick the target.'),
      h('div', { class: 'btnrow' }, h('button', { class: 'small', onclick: act.recolour }, 'Recolour to target shares'))));
  }
  const mxh = Math.max(...m.hist, 1e-6);
  const dark = m.hist.slice(0, 3).reduce((a, b) => a + b, 0), mid = m.hist.slice(3, 7).reduce((a, b) => a + b, 0), lt = m.hist.slice(7).reduce((a, b) => a + b, 0);
  el.append(box('Value structure', 'measured',
    h('div', { class: 'hist' }, ...m.hist.map((v, i) => h('i', { style: { height: `${((v / mxh) * 100).toFixed(1)}%`, background: rgbCss(labToRgb(i / 10 + 0.05, 0, 0)) }, title: `L ${(i / 10).toFixed(1)}–${((i + 1) / 10).toFixed(1)}: ${(v * 100).toFixed(1)}%` }))),
    h('p', { class: 'note' }, `Lightness from dark to light. Dark ${Math.round(dark * 100)}% · mid ${Math.round(mid * 100)}% · light ${Math.round(lt * 100)}%. Range ${m.Lmin.toFixed(2)}–${m.Lmax.toFixed(2)}.`)));
  if (pal) {
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '-110 -110 220 220');
    svg.setAttribute('class', 'wheel');
    let w = '<circle r="100" fill="none" stroke="currentColor" stroke-opacity=".2"/><circle r="50" fill="none" stroke="currentColor" stroke-opacity=".12"/>';
    for (let hh = 0; hh < 360; hh += 30) { const a = (hh * Math.PI) / 180; w += `<circle cx="${Math.cos(a) * 104}" cy="${Math.sin(a) * 104}" r="3" fill="${lchHex([0.7, 0.12, hh])}"/>`; }
    for (const r of ROLES) {
      const [, C, H] = pal.roles[r], a = (H * Math.PI) / 180, rad = Math.min(1, C / 0.25) * 95, sz = 4 + Math.sqrt(m.area ? m.area[r] : 0.1) * 28;
      w += `<circle cx="${(Math.cos(a) * rad).toFixed(1)}" cy="${(Math.sin(a) * rad).toFixed(1)}" r="${sz.toFixed(1)}" fill="${lchHex(pal.roles[r])}" stroke="currentColor" stroke-opacity=".5"><title>${RNAME[r]}</title></circle>`;
    }
    svg.innerHTML = w;
    el.append(box('Hue and chroma', 'palette roles', svg, h('p', { class: 'note' }, 'Each dot is a role: angle is hue, distance from the centre is chroma, size is its area in the picture.')));
  }
  const ws = m.warm + m.cool;
  const off = Math.hypot(...m.comOff);
  el.append(box('Balance', null,
    h('div', { class: 'mbar' }, h('span', {}, 'Warm | cool'), h('div', { class: 'mtrack' }, h('i', { style: { width: `${ws ? (m.warm / ws) * 100 : 50}%`, background: '#d98a57' } })), h('span', { class: 'mono' }, ws ? `${Math.round((m.warm / ws) * 100)} | ${Math.round((m.cool / ws) * 100)}` : 'neutral')),
    h('div', { class: 'mbar' }, h('span', {}, 'Colour mass'), h('div', { class: 'mtrack' }, h('i', { style: { width: `${Math.min(100, off * 200)}%`, background: 'var(--text)' } })), h('span', { class: 'mono' }, `${(off * 100).toFixed(1)}% off`)),
    h('label', { class: 'chk' }, (() => { const c = h('input', { type: 'checkbox', checked: act.showBalance() }); c.addEventListener('change', () => act.setShowBalance(c.checked)); return c; })(), ' Show the colour-mass centre on the picture'),
    h('p', { class: 'note' }, 'Warm counts chroma-weighted area with hues from red through yellow; cool, from green-blue through violet. Colour mass weights each pixel by how far its colour is from the ground (sky) colour; its centre is the crosshair.')));
}
