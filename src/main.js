// App state, history, render loop, canvas tools and wiring.
import { deepClone, lerp } from './util.js';
import { defaultScene, ensureParams, makeLayer, sortLayers, aspectSize, bandById, defaultGlobals, LAYER_SECTIONS } from './scene.js';
import { defaultGraph, compileGraph } from './graph.js';
import { buildGeometry, graphHash, dropCache } from './pipeline.js';
import { renderScene, pick } from './render.js';
import { renderLayerPanel, renderInspector } from './ui.js';
import { renderLibrary, download } from './library.js';
import { createGraphEditor } from './graph-editor.js';
import { KINDS } from './structures.js';
import { thin } from './geom.js';

const $ = (s) => document.querySelector(s);
const AUTOSAVE = 'shapelab.current.v2';

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
};
state.selected = state.scene.layers.find((l) => l.kind === 'trees' && l.band === 'close')?.id || 'scene';

// ---- history ----
const history = { stack: [JSON.stringify(state.scene)], index: 0 };
function commit(rebuildPanels = false) {
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
const buffers = { cloneA: mk(), cloneB: mk(), rimCanvas: mk(), landMask: mk(), layerCanvas: mk(), rayA: mk(), rayB: mk(), behind: mk(), smallBlur: mk() };
let geos = new Map();
let pending = false;
let graphFn = null, gKey = null;
let status = '';

function requestRender() {
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => { pending = false; render(); });
}
function buildAll(scene, W, H) {
  const gh = graphHash(scene.graph);
  if (gh !== gKey) { graphFn = compileGraph(scene.graph); gKey = gh; }
  const out = new Map();
  for (const layer of scene.layers) {
    if (layer.kind === 'sky' || layer.kind === 'water' || !layer.visible) continue;
    out.set(layer.id, buildGeometry(layer, scene, graphFn ? { fn: graphFn } : null, gh, W, H));
  }
  return out;
}
function render() {
  const [W, H] = aspectSize(state.scene.globals.aspect);
  if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
  const t0 = performance.now();
  geos = buildAll(state.scene, W, H);
  const t1 = performance.now();
  const info = renderScene(ctx, state.scene, geos, {
    W, H, u: Math.min(W, H) / 900, view: state.view, structure: state.structure,
    selectedId: state.selected, selObj: state.selObj, scene: state.scene, ...buffers,
  });
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
    showTab('inspect');
    refreshPanels();
    requestRender();
  },
  setParam(obj, spec, v) {
    obj[spec.key] = v;
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

// ---- panels ----
function refreshPanels() {
  renderLayerPanel($('#layerPanel'), state, act);
  renderInspector($('#inspector'), state, act);
  if (state.tab === 'library') renderLibrary($('#library'), state, act);
}
function showTab(tab) {
  state.tab = tab;
  document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
  $('#inspector').hidden = tab !== 'inspect';
  $('#library').hidden = tab !== 'library';
  if (tab === 'library') renderLibrary($('#library'), state, act);
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
$('#btnPng').addEventListener('click', () => canvas.toBlob((b) => download('shape-lab.png', b)));
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

setTool('select');
refreshPanels();
render();

// Handy for poking at the app from the console.
window.shapeLab = { state, act, render };
