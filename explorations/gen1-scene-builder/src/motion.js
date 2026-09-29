// Motion: whole-scene keyframes blended over time, plus continuous "flow" (graph time,
// light orbit, hue drift, drifting sky layers, camera sway).
import { h, clamp, lerp, deepClone, lerpAngleDeg } from './util.js';
import { hexToLab, labToRgb } from './color.js';

export const M = {
  keys: [], pos: 0, playing: false, mode: 'pingpong', ease: 'smooth', seg: 2.5, dir: 1, time: 0, t0: 0,
  flow: { graph: 1, light: 0, hue: 0, drift: 0, sway: 0 },
};

const ANGLE_KEYS = new Set(['sunAngle', 'sunHue', 'shadowHue', 'angle', 'opAngle', 'hatchAngle']);
const isHex = (v) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
function mixHex(a, b, t) {
  const A = hexToLab(a), B = hexToLab(b);
  return '#' + labToRgb(lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t)).map((v) => v.toString(16).padStart(2, '0')).join('');
}
function mix(a, b, t, key) {
  if (typeof a === 'number' && typeof b === 'number') return ANGLE_KEYS.has(key) ? lerpAngleDeg(a, b, t) : lerp(a, b, t);
  if (isHex(a) && isHex(b)) return mixHex(a, b, t);
  if (Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x) => typeof x === 'number')) {
    // palette colours are [L, C, H]: the hue wraps round
    return a.map((x, i) => (a.length === 3 && i === 2 && key !== 'extras' ? lerpAngleDeg(x, b[i], t) : lerp(x, b[i], t)));
  }
  if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a)) {
    const o = {};
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) o[k] = k in a && k in b ? mix(a[k], b[k], t, k) : deepClone(t < 0.5 ? a[k] ?? b[k] : b[k] ?? a[k]);
    return o;
  }
  return deepClone(t < 0.5 ? a : b);
}
// Blend two scenes. Layers and graph nodes are matched by id; anything else switches halfway.
export function lerpScene(A, B, t) {
  const out = { ...deepClone(t < 0.5 ? A : B) };
  out.globals = mix(A.globals, B.globals, t, 'globals');
  const bl = new Map(B.layers.map((l) => [l.id, l]));
  const base = t < 0.5 ? A.layers : B.layers;
  out.layers = base.map((l) => {
    const a = A.layers.find((q) => q.id === l.id), b = bl.get(l.id);
    if (a && b) return { ...deepClone(t < 0.5 ? a : b), p: mix(a.p, b.p, t, 'p') };
    return deepClone(l);
  });
  const bn = new Map(B.graph.nodes.map((n) => [n.id, n]));
  out.graph = deepClone(t < 0.5 ? A.graph : B.graph);
  out.graph.nodes = out.graph.nodes.map((n) => {
    const a = A.graph.nodes.find((q) => q.id === n.id), b = bn.get(n.id);
    return a && b ? { ...n, params: mix(a.params, b.params, t, 'params') } : n;
  });
  return out;
}

const ease = (t) => (M.ease === 'smooth' ? t * t * (3 - 2 * t) : t);
export function frameScene(scene) {
  const n = M.keys.length;
  let sc;
  if (n >= 2) {
    const i = clamp(Math.floor(M.pos), 0, n - 2), f = clamp(M.pos - i, 0, 1);
    sc = lerpScene(M.keys[i].scene, M.keys[i + 1].scene, ease(f));
  } else sc = { ...scene, globals: { ...scene.globals, palette: scene.globals.palette && deepClone(scene.globals.palette) } };
  const g = sc.globals, fl = M.flow, t = M.time;
  if (fl.light) g.sunAngle = (g.sunAngle + t * fl.light * 20) % 360;
  if (fl.hue && g.palette) for (const r of Object.keys(g.palette.roles)) g.palette.roles[r][2] = (g.palette.roles[r][2] + t * fl.hue * 10) % 360;
  if (fl.hue) g.sunHue = (g.sunHue + t * fl.hue * 10) % 360;
  if (fl.sway) g.camX = (g.camX || 0) + Math.sin(t * 0.6) * fl.sway * 0.05;
  return sc;
}

export function tick(dt) {
  M.time += dt;
  const n = M.keys.length;
  if (n >= 2) {
    M.pos += (dt / M.seg) * M.dir;
    const end = n - 1;
    if (M.mode === 'loop') { if (M.pos > end) M.pos = 0; }
    else if (M.mode === 'pingpong') { if (M.pos > end) { M.pos = end; M.dir = -1; } if (M.pos < 0) { M.pos = 0; M.dir = 1; } }
    else if (M.pos > end) { M.pos = end; return false; }
  }
  return true;
}

export function renderMotion(el, state, act) {
  el.innerHTML = '';
  const box = (t, sub, ...k) => h('section', { class: 'box' }, h('h2', {}, t, sub ? h('span', { class: 'sub' }, sub) : null), ...k);
  const rng = (label, min, max, step, get, set, fmt = (v) => (+v).toFixed(2)) => {
    const out = h('span', { class: 'num mono' }, fmt(get()));
    const r = h('input', { type: 'range', min, max, step, value: get() });
    r.addEventListener('input', () => { set(+r.value); out.textContent = fmt(+r.value); act.motionChanged(); });
    return h('div', { class: 'row' }, h('label', {}, label), r, out);
  };
  const segb = (opts, get, set) => h('div', { class: 'seg seg-wide' }, ...opts.map(([v, t]) => h('button', { class: get() === v ? 'on' : '', onclick: () => { set(v); renderMotion(el, state, act); } }, t)));
  const g = state.scene.globals;

  el.append(box('Play', `${M.time.toFixed(1)} s`,
    h('div', { class: 'btnrow' },
      h('button', { class: 'primary', onclick: () => act.togglePlay() }, M.playing ? 'Pause' : 'Play'),
      h('button', { onclick: () => act.stopPlay(true) }, 'Back to start')),
    h('p', { class: 'note' }, 'Play blends between keyframes and runs the flows below. Space plays and pauses while this tab is open. Playback is a preview; the scene itself changes only when you edit it.')));

  const scrub = h('input', { type: 'range', min: 0, max: Math.max(0, M.keys.length - 1), step: 0.001, value: M.pos, disabled: M.keys.length < 2 });
  scrub.addEventListener('input', () => { M.pos = +scrub.value; act.motionChanged(true); });
  el.append(box('Keyframes', 'whole-scene snapshots',
    h('p', { class: 'note' }, 'Each keyframe stores the whole scene: layers, palette, light, camera and graph. Numbers and colours blend between keyframes; layers are matched by identity.'),
    h('div', { class: 'btnrow' }, h('button', { class: 'primary', onclick: act.addKey }, 'Add keyframe'), h('button', { onclick: () => { M.keys = []; M.pos = 0; renderMotion(el, state, act); } }, 'Clear keyframes')),
    ...M.keys.map((k, i) => h('div', { class: 'kcard' }, h('img', { src: k.thumb, alt: '' }), h('span', { class: 'mono' }, `K${i + 1}`),
      h('button', { class: 'small', onclick: () => act.goKey(i) }, 'Go'),
      h('button', { class: 'small', title: 'Replace with the current scene', onclick: () => act.setKey(i) }, 'Set'),
      h('button', { class: 'small ghost', onclick: () => { M.keys.splice(i, 1); M.pos = Math.min(M.pos, Math.max(0, M.keys.length - 1)); renderMotion(el, state, act); } }, '✕'))),
    h('div', { class: 'row' }, h('label', {}, 'Scrub'), scrub, h('span', { class: 'num mono' }, M.keys.length < 2 ? '–' : M.pos.toFixed(2))),
    h('div', {}, h('div', { class: 'lbl' }, 'Playback'), segb([['pingpong', 'Ping-pong'], ['loop', 'Loop'], ['once', 'Once']], () => M.mode, (v) => { M.mode = v; })),
    h('div', {}, h('div', { class: 'lbl' }, 'Easing'), segb([['smooth', 'Smooth'], ['linear', 'Linear']], () => M.ease, (v) => { M.ease = v; })),
    rng('Seconds per keyframe', 0.3, 10, 0.1, () => M.seg, (v) => { M.seg = v; }, (v) => `${(+v).toFixed(1)} s`)));

  el.append(box('Camera', 'parallax by depth',
    h('p', { class: 'note' }, 'Moving the camera shifts near layers more than far ones. Each layer’s depth sets how much it moves; its "Camera parallax" setting scales that.'),
    rng('Pan sideways', -0.3, 0.3, 0.001, () => g.camX || 0, (v) => { g.camX = v; }),
    rng('Pan up/down', -0.3, 0.3, 0.001, () => g.camY || 0, (v) => { g.camY = v; }),
    h('div', { class: 'btnrow' }, h('button', { class: 'small', onclick: () => { g.camX = 0; g.camY = 0; act.motionChanged(); act.commit(); renderMotion(el, state, act); } }, 'Centre camera'))));

  el.append(box('Flow', 'continuous change while playing',
    rng('Graph time speed', 0, 3, 0.01, () => M.flow.graph, (v) => { M.flow.graph = v; }),
    rng('Light orbit', -3, 3, 0.01, () => M.flow.light, (v) => { M.flow.light = v; }),
    rng('Hue drift', -3, 3, 0.01, () => M.flow.hue, (v) => { M.flow.hue = v; }),
    rng('Sky layers drift', -3, 3, 0.01, () => M.flow.drift, (v) => { M.flow.drift = v; }),
    rng('Camera sway', 0, 2, 0.01, () => M.flow.sway, (v) => { M.flow.sway = v; }),
    h('p', { class: 'note' }, 'Graph time feeds the graph’s Time node (try the graph presets "Wind gusts" and "Heat shimmer"). Flows also run with zero or one keyframe.')));
}
