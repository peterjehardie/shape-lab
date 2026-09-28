// App state, history, render loop and wiring.
import { deepClone } from './util.js';
import { defaultScene, ensureParams, makeLayer, sortLayers, aspectSize, bandById, defaultGlobals } from './scene.js';
import { defaultGraph, compileGraph } from './graph.js';
import { buildGeometry, graphHash, dropCache } from './pipeline.js';
import { renderScene, pickLayer } from './render.js';
import { renderLayerPanel, renderInspector } from './ui.js';
import { renderLibrary, download } from './library.js';
import { createGraphEditor } from './graph-editor.js';

const $ = (s) => document.querySelector(s);
const AUTOSAVE = 'shapelab.current';

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
};
state.selected = state.scene.layers.find((l) => l.name === 'Trees')?.id || 'scene';

// ---- history ----
const history = { stack: [JSON.stringify(state.scene)], index: 0 };
function commit(rebuildPanels = false) {
  const snap = JSON.stringify(state.scene);
  if (snap !== history.stack[history.index]) {
    history.stack.length = history.index + 1;
    history.stack.push(snap);
    if (history.stack.length > 120) history.stack.shift();
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
const cloneA = document.createElement('canvas');
const cloneB = document.createElement('canvas');
const rimCanvas = document.createElement('canvas');
const landMask = document.createElement('canvas');
let geos = new Map();
let pending = false;
let graphFn = null, gKey = null;

function requestRender() {
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => {
    pending = false;
    render();
  });
}
function render() {
  const [W, H] = aspectSize(state.scene.globals.aspect);
  if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
  const t0 = performance.now();
  const gh = graphHash(state.scene.graph);
  if (gh !== gKey) { graphFn = compileGraph(state.scene.graph); gKey = gh; }
  geos = new Map();
  for (const layer of state.scene.layers) {
    if (layer.kind === 'sky' || !layer.visible) continue;
    geos.set(layer.id, buildGeometry(layer, state.scene, graphFn, gh, W, H));
  }
  const t1 = performance.now();
  const info = renderScene(ctx, state.scene, geos, {
    W, H, u: Math.min(W, H) / 900, view: state.view, structure: state.structure,
    selectedId: state.selected, cloneA, cloneB, rimCanvas, landMask, scene: state.scene,
  });
  const t2 = performance.now();
  $('#status').textContent = `${info.shapes.toLocaleString()} shapes · geometry ${Math.round(t1 - t0)} ms · paint ${Math.round(t2 - t1)} ms · click the picture to select a layer`;
}

// ---- actions used by the panels ----
const findLayer = (id) => state.scene.layers.find((l) => l.id === id);
const act = {
  select(id) {
    state.selected = id;
    showTab('inspect');
    refreshPanels();
    if (state.structure) requestRender();
  },
  setParam(obj, spec, v) {
    obj[spec.key] = v;
    requestRender();
  },
  commit(rebuild) {
    commit(rebuild);
    requestRender();
  },
  addLayer(bandId) {
    const band = bandById(bandId);
    const l = makeLayer(bandId, band.kind, `${band.label.split(' ')[0]} ${state.scene.layers.filter((q) => q.band === bandId).length + 1}`);
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
  reseed(id) {
    findLayer(id).seed = Math.floor(Math.random() * 99999);
    commit(true);
    requestRender();
  },
  setSeed(id, seed) {
    findLayer(id).seed = seed | 0;
    commit();
    requestRender();
  },
  reseedAll() {
    for (const l of state.scene.layers) l.seed = Math.floor(Math.random() * 99999);
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
    commit(true);
    graphEditor.refresh();
    requestRender();
  },
  apply(fn) {
    fn(state.scene);
    commit(true);
    requestRender();
  },
  setView(v) {
    setView(v);
  },
};

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
  if (e.target.matches('input[type=text], input[type=number], textarea')) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    e.shiftKey ? redo() : undo();
  }
});
canvas.addEventListener('click', (e) => {
  const r = canvas.getBoundingClientRect();
  const x = ((e.clientX - r.left) / r.width) * canvas.width;
  const y = ((e.clientY - r.top) / r.height) * canvas.height;
  const id = pickLayer(ctx, state.scene, geos, x, y);
  if (id) act.select(id);
});

const graphEditor = createGraphEditor($('#graphEditor'), {
  getGraph: () => state.scene.graph,
  onLive: requestRender,
  onCommit: () => commit(),
});

refreshPanels();
render();

// Handy for poking at the app from the console.
window.shapeLab = { state, act, render };
