// App state, history, render loop, canvas tools and wiring.
import { deepClone, lerp } from './util.js';
import { defaultScene, ensureParams, makeLayer, sortLayers, aspectSize, bandById, defaultGlobals, LAYER_SECTIONS } from './scene.js';
import { defaultGraph, compileGraph } from './graph.js';
import { buildGeometry, graphHash, dropCache } from './pipeline.js';
import { renderScene, pick, layerOffset } from './render.js';
import { renderLayerPanel, renderInspector } from './ui.js';
import { renderLibrary, download } from './library.js';
import { createGraphEditor } from './graph-editor.js';
import { KINDS } from './structures.js';
import { thin } from './geom.js';
import { renderPaletteTab } from './palette-ui.js';
import { measure, renderMeasure } from './measure.js';
import { M, frameScene, tick, renderMotion } from './motion.js';
import { ROLES, lchHex, lchToLab } from './palette.js';
import { labCss } from './color.js';

const $ = (s) => document.querySelector(s);
const AUTOSAVE = 'shapelab.current.v3';

function normalize(scene) {
  scene.globals = { ...defaultGlobals(), ...(scene.globals || {}) };
  scene.graph ||= defaultGraph();
  scene.layers = (scene.layers || []).map(ensureParams);
  sortLayers(scene);
  return scene;
}
function loadAutosave() {
  try {
    const s = JSON.parse(localStorage.getItem(AUTOSAVE));
    return s && s.layers ? normalize(s) : null;
  } catch {
    return null;
  }
}

const state = {
  scene: loadAutosave() || normalize(defaultScene()),
  selected: 'scene',
  view: 'color',
  structure: false,
  tab: 'inspect',
  tool: 'select',
  selObj: null,
  drawPts: null,
  clip: null,
  frame: null,
  showBalance: false,
  metrics: null,
};
state.selected = state.scene.layers.find((l) => l.kind === 'trees' && l.band === 'close')?.id || 'scene';

// ---- history ----
const history = { stack: [JSON.stringify(state.scene)], index: 0 };
function commit(rebuildPanels = false) {
  if (!M.playing) state.frame = null;
  const snap = JSON.stringify(state.scene);
  if (snap !== history.stack[history.index]) {
    history.stack.length = history.index + 1;
    history.stack.push(snap);
    if (history.stack.length > 150) history.stack.shift();
    history.index = history.stack.length - 1;
    try { localStorage.setItem(AUTOSAVE, snap); } catch { /* storage unavailable */ }
  }
  if (rebuildPanels) refreshPanels();
  else renderLayerPanel($('#layerPanel'), state, act);
}
function restore(i) {
  history.index = i;
  state.scene = normalize(JSON.parse(history.stack[i]));
  if (state.selected !== 'scene' && !state.scene.layers.some((l) => l.id === state.selected)) state.selected = 'scene';
  state.selObj = null;
  try { localStorage.setItem(AUTOSAVE, history.stack[i]); } catch { /* storage unavailable */ }
  refreshPanels();
  graphEditor.refresh();
  requestRender();
}
const undo = () => history.index > 0 && restore(history.index - 1);
const redo = () => history.index < history.stack.length - 1 && restore(history.index + 1);

// ---- rendering ----
const canvas = $('#view');
const ctx = canvas.getContext('2d');
const mk = () => document.createElement('canvas');
const buffers = { cloneA: mk(), cloneB: mk(), rimCanvas: mk(), landMask: mk(), layerCanvas: mk(), rayA: mk(), rayB: mk(), behind: mk(), smallBlur: mk(), texCanvas: mk(), maskCanvas: mk() };
let geos = new Map();
let pending = false;
let graphFn = null, gKey = null;
let status = '';

function requestRender() {
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => { pending = false; render(); });
}
function buildAll(scene, W, H, time = 0) {
  const gh = graphHash(scene.graph);
  if (gh !== gKey) { graphFn = compileGraph(scene.graph); gKey = gh; }
  const out = new Map();
  for (const layer of scene.layers) {
    if (layer.kind === 'sky' || layer.kind === 'water' || !layer.visible) continue;
    out.set(layer.id, buildGeometry(layer, scene, graphFn ? { fn: graphFn, time } : null, gh, W, H));
  }
  return out;
}
const motionTime = () => M.time * M.flow.graph;
function render() {
  const sc = state.frame || state.scene;
  const [W, H] = aspectSize(sc.globals.aspect);
  if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
  fitCanvas();
  const t0 = performance.now();
  geos = buildAll(sc, W, H, motionTime());
  const t1 = performance.now();
  const info = renderScene(ctx, sc, geos, {
    W, H, u: Math.min(W, H) / 900, view: state.view, structure: state.structure,
    selectedId: state.selected, selObj: state.selObj, scene: sc, time: M.time, drift: M.playing ? M.flow.drift : 0, ...buffers,
  });
  drawStrip(sc);
  if (state.showBalance && state.metrics && state.metrics.com) {
    const [x, y] = state.metrics.com, r = 16 * Math.min(W, H) / 900;
    ctx.save();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#fff';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#d97757';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath(); ctx.moveTo(W / 2, H / 2); ctx.lineTo(x, y); ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.moveTo(x - r * 1.6, y); ctx.lineTo(x + r * 1.6, y); ctx.moveTo(x, y - r * 1.6); ctx.lineTo(x, y + r * 1.6); ctx.stroke();
    ctx.restore();
  }
  if (state.tab === 'measure' && !M.playing) scheduleMeasure();
  if (state.drawPts && state.drawPts.length > 1) {
    ctx.save();
    ctx.strokeStyle = '#ffd24a';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 6]);
    ctx.beginPath();
    state.drawPts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
  const t2 = performance.now();
  $('#status').textContent = `${info.shapes.toLocaleString()} shapes · geometry ${Math.round(t1 - t0)} ms · paint ${Math.round(t2 - t1)} ms · ${status || TOOL_HINTS[state.tool]}`;
}

// Small render of the scene, for the seed gallery.
function renderThumb(target, scene) {
  const [W0, H0] = aspectSize(scene.globals.aspect);
  const W = target.width, H = Math.round((W * H0) / W0);
  target.height = H;
  const g = buildAll(scene, W, H);
  renderScene(target.getContext('2d'), scene, g, { W, H, u: Math.min(W, H) / 900, view: 'color', scene, ...buffers });
}

// ---- actions used by the panels ----
const findLayer = (id) => state.scene.layers.find((l) => l.id === id);
const LOOK_SECTIONS = ['value', 'variety', 'form', 'fake', 'lines'];
const act = {
  select(id) {
    if (state.selected !== id) state.selObj = null;
    state.selected = id;
    if (state.tab !== 'palette' && state.tab !== 'measure' && state.tab !== 'motion') showTab('inspect');
    refreshPanels();
    requestRender();
  },
  setParam(obj, spec, v) {
    obj[spec.key] = v;
    if (!M.playing) state.frame = null;
    requestRender();
  },
  commit(rebuild) {
    commit(rebuild);
    requestRender();
  },
  addLayer(bandId, kind) {
    const band = bandById(bandId);
    const k = kind || band.kind;
    const l = makeLayer(bandId, k, `${KINDS[k].label.split(' ')[0]} ${state.scene.layers.filter((q) => q.band === bandId).length + 1}`);
    state.scene.layers.push(l);
    sortLayers(state.scene);
    state.selected = l.id;
    commit(true);
    requestRender();
    return l;
  },
  insertLayer(layer) {
    const l = ensureParams(deepClone(layer));
    l.id = `L${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
    state.scene.layers.push(l);
    sortLayers(state.scene);
    state.selected = l.id;
    commit(true);
    requestRender();
  },
  remove(id) {
    state.scene.layers = state.scene.layers.filter((l) => l.id !== id);
    dropCache(id);
    if (state.selected === id) state.selected = 'scene';
    state.selObj = null;
    commit(true);
    requestRender();
  },
  duplicate(id) {
    const l = findLayer(id);
    const copy = deepClone(l);
    copy.id = `${l.id}c${Date.now().toString(36)}`;
    copy.name = `${l.name} copy`;
    copy.seed = Math.floor(Math.random() * 99999);
    state.scene.layers.splice(state.scene.layers.indexOf(l) + 1, 0, copy);
    state.selected = copy.id;
    commit(true);
    requestRender();
  },
  move(id, dir) {
    const layers = state.scene.layers;
    const i = layers.findIndex((l) => l.id === id);
    let j = i + dir;
    while (j >= 0 && j < layers.length && layers[j].band !== layers[i].band) j += dir;
    if (j < 0 || j >= layers.length) return;
    [layers[i], layers[j]] = [layers[j], layers[i]];
    commit(true);
    requestRender();
  },
  toggleVisible(id) {
    const l = findLayer(id);
    l.visible = !l.visible;
    commit();
    requestRender();
  },
  toggleLock(id) {
    const l = findLayer(id);
    l.locked = !l.locked;
    commit();
  },
  reseed(id) {
    findLayer(id).seed = Math.floor(Math.random() * 99999);
    commit(true);
    requestRender();
  },
  setSeed(id, seed) {
    findLayer(id).seed = seed | 0;
    commit(true);
    requestRender();
  },
  reseedAll() {
    for (const l of state.scene.layers) if (!l.locked) l.seed = Math.floor(Math.random() * 99999);
    commit(true);
    requestRender();
  },
  renameLayer(id, name) {
    findLayer(id).name = name || 'Layer';
    commit();
  },
  setBand(id, band) {
    findLayer(id).band = band;
    sortLayers(state.scene);
    commit(true);
    requestRender();
  },
  setKind(id, kind) {
    const l = findLayer(id);
    l.kind = kind;
    ensureParams(l);
    Object.assign(l.p, KINDS[kind].defaults || {});
    dropCache(id);
    commit(true);
    requestRender();
  },
  resetGraph() {
    state.scene.graph = defaultGraph();
    graphEditor.refresh();
    commit();
    requestRender();
  },
  addValueGroup() {
    const g = state.scene.globals.valueGroups;
    g.push({ name: `Group ${g.length + 1}`, value: 0.2, spread: 0.08 });
    commit(true);
    requestRender();
  },
  removeValueGroup(i) {
    const g = state.scene.globals.valueGroups;
    g.splice(i, 1);
    for (const l of state.scene.layers) {
      const v = l.p.valueGroup;
      if (v === 'auto') continue;
      if (+v === i) l.p.valueGroup = 'auto';
      else if (+v > i) l.p.valueGroup = String(+v - 1);
    }
    commit(true);
    requestRender();
  },
  autoValueGroups() {
    for (const l of state.scene.layers) l.p.valueGroup = 'auto';
    commit(true);
    requestRender();
  },
  spreadValueGroups() {
    const g = state.scene.globals.valueGroups;
    g.forEach((vg, i) => { vg.value = +(0.88 - (0.62 * i) / Math.max(1, g.length - 1)).toFixed(3); });
    commit(true);
    requestRender();
  },
  loadScene(scene) {
    state.scene = normalize(scene);
    state.selected = 'scene';
    state.selObj = null;
    commit(true);
    graphEditor.refresh();
    requestRender();
  },
  apply(fn) {
    fn(state.scene);
    state.scene.layers.forEach(ensureParams);
    commit(true);
    requestRender();
  },
  setView(v) { setView(v); },
  // Dice: random values for one section's sliders, switches and menus.
  randomize(obj, specs) {
    for (const s of specs) {
      if (s.dynamic || s.key === 'lsCustom') continue;
      if (s.type === 'range') {
        const t = 0.1 + Math.random() * 0.8;
        let v = lerp(s.min, s.max, t);
        v = Math.round(v / s.step) * s.step;
        obj[s.key] = +v.toFixed(4);
      } else if (s.type === 'select') {
        obj[s.key] = s.options[Math.floor(Math.random() * s.options.length)][0];
        if (typeof s.def === 'number') obj[s.key] = +obj[s.key];
      } else if (s.type === 'bool') obj[s.key] = Math.random() < 0.5;
    }
    commit(true);
    requestRender();
  },
  copyLook(id) {
    const l = findLayer(id);
    const keys = LAYER_SECTIONS.filter((s) => LOOK_SECTIONS.includes(s.id)).flatMap((s) => s.params.map((q) => q.key));
    state.clip = Object.fromEntries(keys.map((k) => [k, deepClone(l.p[k])]));
    status = `Copied the look of “${l.name}”.`;
    refreshPanels();
    requestRender();
  },
  pasteLook(id) {
    if (!state.clip) return;
    Object.assign(findLayer(id).p, deepClone(state.clip));
    commit(true);
    requestRender();
  },
  resetEdits(id, what) {
    const p = findLayer(id).p;
    if (what === 'edits') p.edits = {};
    if (what === 'extras') p.extras = [];
    if (what === 'drawn') p.drawn = [];
    if (what === 'offset') { p.offX = 0; p.offY = 0; }
    state.selObj = null;
    commit(true);
    requestRender();
  },
  seedGallery(id) { openGallery(id); },
  paletteChanged(commitNow) {
    if (!M.playing) state.frame = null;
    requestRender();
    if (commitNow) commit();
  },
  refresh() { refreshPanels(); },
  rolesByDepth() {
    for (const l of state.scene.layers) { l.p.role = 'auto'; l.p.step = 0; }
    commit(true);
    requestRender();
  },
  recolour() { recolour(); },
  showBalance: () => state.showBalance,
  setShowBalance(v) { state.showBalance = v; requestRender(); },
  togglePlay() { M.playing ? stopPlay(false) : startPlay(); },
  stopPlay(reset) { stopPlay(reset); },
  addKey() {
    const c = document.createElement('canvas');
    c.width = 160;
    renderThumb(c, state.scene);
    M.keys.push({ scene: deepClone(state.scene), thumb: c.toDataURL('image/jpeg', 0.8) });
    M.pos = M.keys.length - 1;
    renderMotion($('#motion'), state, act);
  },
  setKey(i) {
    const c = document.createElement('canvas');
    c.width = 160;
    renderThumb(c, state.scene);
    M.keys[i] = { scene: deepClone(state.scene), thumb: c.toDataURL('image/jpeg', 0.8) };
    renderMotion($('#motion'), state, act);
  },
  goKey(i) {
    if (M.playing) stopPlay(false);
    state.frame = null;
    state.scene = normalize(deepClone(M.keys[i].scene));
    M.pos = i;
    commit(true);
    requestRender();
  },
  motionChanged(scrub) {
    if (scrub && !M.playing && M.keys.length >= 2) state.frame = frameScene(state.scene);
    requestRender();
  },
  hasClip: () => !!state.clip,
  setTool(t) { setTool(t); },
};

// ---- seed gallery ----
function openGallery(id) {
  const layer = findLayer(id);
  if (!layer) return;
  const box = $('#gallery');
  const grid = box.querySelector('.grid');
  box.querySelector('h3').textContent = `Pick a seed for “${layer.name}”`;
  const fill = () => {
    grid.innerHTML = '';
    const orig = layer.seed;
    const seeds = [orig, ...Array.from({ length: 7 }, () => Math.floor(Math.random() * 99999))];
    for (const s of seeds) {
      const c = document.createElement('canvas');
      c.width = 360;
      layer.seed = s;
      renderThumb(c, state.scene);
      const b = document.createElement('button');
      b.className = 'thumb';
      b.title = s === orig ? `Current seed ${s}` : `Seed ${s}`;
      b.append(c, Object.assign(document.createElement('span'), { textContent: s === orig ? `current · ${s}` : `${s}` }));
      b.addEventListener('click', () => { layer.seed = s; box.hidden = true; commit(true); requestRender(); });
      grid.append(b);
    }
    layer.seed = orig;
    requestRender();
  };
  box.querySelector('.more').onclick = fill;
  box.querySelector('.close').onclick = () => { box.hidden = true; };
  box.hidden = false;
  requestAnimationFrame(fill);
}

// ---- canvas tools ----
const TOOL_HINTS = {
  select: 'Select: click a layer or object, drag to move an object, scroll to resize it, Delete hides it, R reseeds it',
  move: 'Move layer: drag to shift the selected layer',
  add: 'Add: click to place a new object in the selected layer (clouds, trees, clusters, grass)',
  draw: 'Draw: drag an outline; it becomes a shape filled with the layer’s shapes',
  erase: 'Erase: click an object to hide it (Undo or “Reset object edits” brings it back)',
};
function setTool(t) {
  state.tool = t;
  status = '';
  document.querySelectorAll('#tools button').forEach((b) => b.classList.toggle('on', b.dataset.tool === t));
  canvas.style.cursor = { select: 'default', move: 'move', add: 'copy', draw: 'crosshair', erase: 'not-allowed' }[t];
  requestRender();
}
const toCanvas = (e) => {
  const r = canvas.getBoundingClientRect();
  return [((e.clientX - r.left) / r.width) * canvas.width, ((e.clientY - r.top) / r.height) * canvas.height];
};
const editsOf = (layer) => (layer.p.edits ||= {});
let drag = null;

canvas.addEventListener('pointerdown', (e) => {
  const [x, y] = toCanvas(e);
  const W = canvas.width, H = canvas.height;
  status = '';
  if (state.tool === 'draw') {
    state.drawPts = [[x, y]];
    drag = { type: 'draw' };
    canvas.setPointerCapture(e.pointerId);
    return;
  }
  const hit = pick(ctx, state.scene, geos, x, y, H);
  if (state.tool === 'select') {
    if (!hit) return;
    if (hit.layerId !== state.selected) act.select(hit.layerId);
    const layer = findLayer(hit.layerId);
    if (hit.ob && !hit.ground) {
      state.selObj = { layerId: layer.id, ob: hit.ob };
      drag = { type: 'obj', layer, ob: hit.ob, x0: x, y0: y, e0: { ...(editsOf(layer)[hit.ob] || {}) }, moved: false };
      canvas.setPointerCapture(e.pointerId);
    } else state.selObj = null;
    requestRender();
  } else if (state.tool === 'move') {
    const layer = findLayer(state.selected) || (hit && findLayer(hit.layerId));
    if (!layer || layer.kind === 'sky' || layer.kind === 'water') { status = 'Select a layer first (not the sky or water).'; requestRender(); return; }
    drag = { type: 'layer', layer, x0: x, y0: y, ox: layer.p.offX || 0, oy: layer.p.offY || 0 };
    canvas.setPointerCapture(e.pointerId);
  } else if (state.tool === 'add') {
    const layer = findLayer(state.selected);
    if (!layer || !KINDS[layer.kind].canAdd) { status = 'Adding works in clouds, trees, clusters and grass layers. Select one first.'; requestRender(); return; }
    layer.p.extras = [...(layer.p.extras || []), [+(x / W).toFixed(4), +(y / H).toFixed(4)]];
    commit(true);
    requestRender();
  } else if (state.tool === 'erase') {
    if (!hit || !hit.ob || hit.ground) return;
    const layer = findLayer(hit.layerId);
    editsOf(layer)[hit.ob] = { ...(editsOf(layer)[hit.ob] || {}), hide: true };
    commit(true);
    requestRender();
  }
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const [x, y] = toCanvas(e);
  const W = canvas.width, H = canvas.height;
  if (drag.type === 'draw') {
    const l = state.drawPts[state.drawPts.length - 1];
    if (Math.hypot(x - l[0], y - l[1]) > 5) state.drawPts.push([x, y]);
  } else if (drag.type === 'obj') {
    const e0 = drag.e0;
    editsOf(drag.layer)[drag.ob] = { ...e0, dx: +((e0.dx || 0) + (x - drag.x0) / W).toFixed(4), dy: +((e0.dy || 0) + (y - drag.y0) / H).toFixed(4) };
    drag.moved = true;
  } else if (drag.type === 'layer') {
    drag.layer.p.offX = +(drag.ox + (x - drag.x0) / W).toFixed(4);
    drag.layer.p.offY = +(drag.oy + (y - drag.y0) / H).toFixed(4);
  }
  requestRender();
});
canvas.addEventListener('pointerup', () => {
  if (!drag) return;
  if (drag.type === 'draw') {
    const pts = state.drawPts ? thin(state.drawPts, 6) : [];
    state.drawPts = null;
    if (pts.length >= 5) {
      const W = canvas.width, H = canvas.height;
      let layer = findLayer(state.selected);
      if (!layer || layer.kind !== 'drawn') {
        const band = layer && layer.band !== 'sky' ? layer.band : 'midfg';
        layer = act.addLayer(band, 'drawn');
        layer.name = `Drawn ${state.scene.layers.filter((q) => q.kind === 'drawn').length}`;
      }
      layer.p.drawn = [...(layer.p.drawn || []), pts.map(([x, y]) => [+(x / W).toFixed(4), +(y / H).toFixed(4)])];
      commit(true);
    }
  } else if (drag.type === 'obj' && drag.moved) commit(true);
  else if (drag.type === 'layer') commit(true);
  drag = null;
  requestRender();
});
let wheelTimer = null;
canvas.addEventListener('wheel', (e) => {
  if (state.tool !== 'select' || !state.selObj) return;
  e.preventDefault();
  const layer = findLayer(state.selObj.layerId);
  const ed = editsOf(layer);
  const cur = ed[state.selObj.ob] || {};
  ed[state.selObj.ob] = { ...cur, s: +((cur.s || 1) * (e.deltaY < 0 ? 1.06 : 1 / 1.06)).toFixed(4) };
  requestRender();
  clearTimeout(wheelTimer);
  wheelTimer = setTimeout(() => commit(), 300);
}, { passive: false });

// ---- recolour: give layers roles so each role covers close to its target share ----
function recolour() {
  const g = state.scene.globals;
  if (g.colorMode === 'free') return;
  const P = g.palette;
  const W = 240, H = Math.round((240 * canvas.height) / canvas.width), k = W / canvas.width;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const cx = c.getContext('2d', { willReadFrequently: true });
  cx.setTransform(k, 0, 0, k, 0, 0);
  const layers = state.scene.layers.filter((l) => l.visible && l.kind !== 'sky' && geos.get(l.id));
  layers.forEach((l, i) => { cx.fillStyle = `rgb(${i + 1},0,0)`; const [ox, oy] = layerOffset(state.scene, l, canvas.width, canvas.height); cx.save(); cx.translate(ox, oy); cx.fill(geos.get(l.id).union); cx.restore(); });
  const d = cx.getImageData(0, 0, W, H).data;
  const area = new Array(layers.length).fill(0);
  for (let i = 0; i < d.length; i += 4) if (d[i]) area[d[i] - 1]++;
  const list = layers.map((l, i) => ({ l, a: area[i] / (W * H) })).filter((o) => o.a > 0).sort((x, y) => y.a - x.a);
  const got = { dominant: 0, secondary: 0, accent: 0, dark: 0, light: 0 };
  const acc = list.length > 2 ? list[list.length - 1] : null;
  if (acc) { acc.l.p.role = 'accent'; acc.l.p.step = 0; got.accent += acc.a; }
  for (const o of list) {
    if (o === acc) continue;
    let best = 'dominant', bv = -1e9;
    for (const r of ['dominant', 'secondary', 'dark', 'light']) {
      const t = P.props[r];
      if (!(t > 0)) continue;
      const v = (t - got[r]) / t + Math.random() * 0.15;
      if (v > bv) { bv = v; best = r; }
    }
    o.l.p.role = best;
    o.l.p.step = 0;
    got[best] += o.a;
  }
  for (const l of state.scene.layers) if (l.kind === 'sky') { l.p.role = 'ground'; l.p.step = 0; }
  commit(true);
  requestRender();
}

// ---- motion playback ----
let lastT = 0;
function startPlay() {
  if (M.playing) return;
  M.playing = true;
  M.base = deepClone(state.scene);
  lastT = performance.now();
  renderMotion($('#motion'), state, act);
  requestAnimationFrame(loop);
}
function loop(now) {
  if (!M.playing) return;
  const dt = Math.min(0.1, (now - lastT) / 1000);
  lastT = now;
  const going = tick(dt);
  state.frame = frameScene(state.scene);
  render();
  const lab = document.querySelector('#motion .box h2 .sub');
  if (lab) lab.textContent = `${M.time.toFixed(1)} s`;
  if (!going) { stopPlay(false); return; }
  requestAnimationFrame(loop);
}
function stopPlay(reset) {
  M.playing = false;
  if (reset) { M.time = 0; M.pos = 0; state.frame = null; }
  renderMotion($('#motion'), state, act);
  requestRender();
}

// ---- measure ----
let mTimer = null;
function scheduleMeasure() {
  clearTimeout(mTimer);
  mTimer = setTimeout(() => {
    state.metrics = measure(canvas, state.frame || state.scene);
    if (state.tab === 'measure') renderMeasure($('#measure'), state.metrics, state.scene, act);
    if (state.showBalance) render();
  }, 250);
}

// ---- mat, strip, skins ----
const matEl = $('#mat');
function matColour(g) {
  if (g.mat === 'dark') return '#29272a';
  if (g.mat === 'tint') {
    if (g.colorMode !== 'free' && g.palette) { const [L, a, b] = lchToLab(g.palette.roles.ground); return labCss(Math.min(0.97, L * 0.6 + 0.4), a * 0.35, b * 0.35); }
    return g.skyHorizon;
  }
  return '#f6f4ee';
}
function fitCanvas() {
  const g = (state.frame || state.scene).globals;
  const wrap = canvas.parentElement.parentElement;
  const W = canvas.width, H = canvas.height;
  const m = g.mat === 'none' ? 0 : (g.matWidth ?? 0.07) * Math.min(W, H);
  const narrow = window.innerWidth <= 900;
  const aw = wrap.clientWidth - 28, ah = narrow ? Infinity : wrap.clientHeight - 28;
  const k = Math.max(0.05, Math.min(aw / (W + 2 * m), ah / (H + 2 * m)));
  canvas.style.width = `${Math.floor(W * k)}px`;
  canvas.style.height = `${Math.floor(H * k)}px`;
  matEl.style.padding = `${Math.round(m * k)}px`;
  matEl.style.background = g.mat === 'none' ? 'transparent' : matColour(g);
}
window.addEventListener('resize', () => requestRender());
function drawStrip(sc) {
  const g = sc.globals;
  const el = $('#strip');
  if (g.colorMode === 'free' || !g.palette) { el.hidden = true; return; }
  el.hidden = false;
  el.innerHTML = ROLES.map((r) => `<i style="flex:${Math.max(0.005, g.palette.props[r] || 0)};background:${lchHex(g.palette.roles[r])}" title="${r}"></i>`).join('');
}
function setSkin(k) {
  if (k === 'auto') delete document.body.dataset.skin;
  else document.body.dataset.skin = k;
  document.querySelectorAll('#skins button').forEach((b) => b.classList.toggle('on', b.dataset.skin === k));
  try { localStorage.setItem('shapelab.skin', k); } catch { /* storage unavailable */ }
}
function syncTopbar() {
  const g = state.scene.globals;
  document.querySelectorAll('#renderModes button').forEach((b) => b.classList.toggle('on', b.dataset.render === (g.renderStyle || 'modelled')));
  document.querySelectorAll('#matModes button').forEach((b) => b.classList.toggle('on', b.dataset.mat === (g.mat || 'white')));
}

// ---- panels ----
const TABS = { inspect: '#inspector', palette: '#palette', library: '#library', measure: '#measure', motion: '#motion' };
function renderTab(tab) {
  if (tab === 'inspect') renderInspector($('#inspector'), state, act);
  if (tab === 'palette') renderPaletteTab($('#palette'), state, act);
  if (tab === 'library') renderLibrary($('#library'), state, act);
  if (tab === 'measure') { renderMeasure($('#measure'), state.metrics, state.scene, act); scheduleMeasure(); }
  if (tab === 'motion') renderMotion($('#motion'), state, act);
}
function refreshPanels() {
  renderLayerPanel($('#layerPanel'), state, act);
  renderTab(state.tab);
  syncTopbar();
}
function showTab(tab) {
  state.tab = tab;
  document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
  for (const [k, sel] of Object.entries(TABS)) $(sel).hidden = k !== tab;
  renderTab(tab);
  try { localStorage.setItem('shapelab.tab', tab); } catch { /* storage unavailable */ }
}
function setView(v) {
  state.view = v;
  document.querySelectorAll('#viewModes button').forEach((b) => b.classList.toggle('on', b.dataset.view === v));
  requestRender();
}

document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));
document.querySelectorAll('#viewModes button').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
document.querySelectorAll('#tools button').forEach((b) => b.addEventListener('click', () => setTool(b.dataset.tool)));
$('#ovStructure').addEventListener('change', (e) => { state.structure = e.target.checked; requestRender(); });
$('#btnUndo').addEventListener('click', undo);
$('#btnRedo').addEventListener('click', redo);
$('#btnReseed').addEventListener('click', act.reseedAll);
$('#btnPng').addEventListener('click', () => {
  const g = state.scene.globals;
  const W = canvas.width, H = canvas.height;
  const m = g.mat === 'none' ? 0 : Math.round((g.matWidth ?? 0.07) * Math.min(W, H));
  const c = document.createElement('canvas');
  c.width = W + 2 * m;
  c.height = H + 2 * m;
  const cc = c.getContext('2d');
  if (m) { cc.fillStyle = matColour(g); cc.fillRect(0, 0, c.width, c.height); }
  cc.drawImage(canvas, m, m);
  if (m) { cc.strokeStyle = 'rgba(0,0,0,0.25)'; cc.lineWidth = 1.5; cc.strokeRect(m - 0.75, m - 0.75, W + 1.5, H + 1.5); }
  c.toBlob((b) => download('shape-lab.png', b));
});
document.querySelectorAll('#renderModes button').forEach((b) => b.addEventListener('click', () => { state.scene.globals.renderStyle = b.dataset.render; commit(true); requestRender(); }));
document.querySelectorAll('#matModes button').forEach((b) => b.addEventListener('click', () => { state.scene.globals.mat = b.dataset.mat; commit(true); requestRender(); }));
document.querySelectorAll('#skins button').forEach((b) => b.addEventListener('click', () => setSkin(b.dataset.skin)));
$('#btnGraph').addEventListener('click', () => {
  const d = $('#graphDrawer');
  d.hidden = !d.hidden;
  $('#btnGraph').classList.toggle('on', !d.hidden);
  if (!d.hidden) graphEditor.refresh();
});
window.addEventListener('keydown', (e) => {
  if (e.target.matches('input, textarea, select')) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    e.shiftKey ? redo() : undo();
    return;
  }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === ' ' && state.tab === 'motion') { e.preventDefault(); act.togglePlay(); return; }
  const toolKeys = { v: 'select', m: 'move', a: 'add', d: 'draw', e: 'erase' };
  const k = e.key.toLowerCase();
  if (toolKeys[k] && $('#graphDrawer').hidden) { setTool(toolKeys[k]); return; }
  const sel = state.selObj;
  if (!sel) return;
  const layer = findLayer(sel.layerId);
  if (!layer) return;
  const ed = editsOf(layer);
  if (e.key === 'Delete' || e.key === 'Backspace') {
    ed[sel.ob] = { ...(ed[sel.ob] || {}), hide: true };
    state.selObj = null;
    commit(true);
    requestRender();
  } else if (k === 'r') {
    ed[sel.ob] = { ...(ed[sel.ob] || {}), seed: ((ed[sel.ob] || {}).seed || 0) + 1 };
    commit(true);
    requestRender();
  } else if (e.key === 'Escape') {
    state.selObj = null;
    requestRender();
  }
});

const graphEditor = createGraphEditor($('#graphEditor'), {
  getGraph: () => state.scene.graph,
  setGraph: (g) => { state.scene.graph = g; },
  onLive: requestRender,
  onCommit: () => commit(),
});

// Hosted copies cannot save files, so the export button is hidden there.
if (window.SHAPELAB_HOSTED) $('#btnPng').hidden = true;

let skin = 'auto', tab0 = 'inspect';
try { skin = localStorage.getItem('shapelab.skin') || 'auto'; tab0 = localStorage.getItem('shapelab.tab') || 'inspect'; } catch { /* storage unavailable */ }
setSkin(skin);
setTool('select');
showTab(TABS[tab0] ? tab0 : 'inspect');
refreshPanels();
render();

// Handy for poking at the app from the console.
window.shapeLab = { state, act, render };
