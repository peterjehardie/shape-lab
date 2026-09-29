// Shape Lab gen2: assembles the interface.
import { App } from './ui/app.js';
import { Viewport } from './ui/viewport.js';
import { Inspector } from './ui/inspector.js';
import { LayersPanel } from './ui/layers.js';
import { GraphEditor } from './ui/graph-editor.js';
import { Swatches } from './ui/swatches.js';
import { THROWS, throwIn } from './ui/throwin.js';
import { h, menu, toast, popover, closePopover } from './ui/widgets.js';
import { icon } from './ui/icons.js';
import { kvGet, kvSet, download, pickFile, readText, safeName } from './ui/storage.js';
import { newDoc, baseNode, validateDoc } from './core/doc.js';
import { makeCanvas } from './render/paint.js';

const app = new App();
window.shapelab = app; // handy for poking at the document from the console

const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
const MOD = isMac ? '⌘' : 'Ctrl+';

// ------------------------------------------------------------------ layout
const root = document.getElementById('app');
const topbar = h('header', { class: 'topbar' });
const tools = h('nav', { class: 'toolstrip' });
const left = h('aside', { class: 'panel left' });
const center = h('main', { class: 'center' });
const stage = h('div', { class: 'stage' });
const dock = h('section', { class: 'dock' });
const right = h('aside', { class: 'panel right' });
const status = h('footer', { class: 'status' });
center.append(stage, h('div', { class: 'dock-resize', title: 'Drag to resize' }), dock);
root.append(topbar, tools, left, center, right, status);

const viewport = new Viewport(app, stage);
app.viewport = viewport;

// left: tabs
const layersHost = h('div', { class: 'tab-body' });
const swHost = h('div', { class: 'tab-body' });
const tabs = h('div', { class: 'tabs' });
const tabDefs = [['layers', 'Layers', layersHost], ['swatches', 'Swatches', swHost]];
let curTab = 'layers';
function showTab(t) {
  curTab = t;
  tabs.replaceChildren(...tabDefs.map(([k, l]) => h('button', { class: 'tab' + (k === t ? ' on' : ''), onclick: () => showTab(k) }, l)),
    h('span', { class: 'grow' }),
    ...(t === 'layers' ? [h('button', { class: 'icon-btn', title: `New layer (${MOD}Shift+N)`, onclick: () => app.run('new-layer') }, icon('plus'))] : []));
  for (const [k, , host] of tabDefs) host.style.display = k === t ? '' : 'none';
}
left.append(tabs, layersHost, swHost);
new LayersPanel(app, layersHost);
const swatches = new Swatches(app, swHost);
showTab('layers');
app.on('show-tab', showTab);

// right: inspector
const inspHost = h('div', { class: 'inspector' });
right.append(inspHost);
new Inspector(app, inspHost);

// dock: graph editor
const graph = new GraphEditor(app, dock);
let dockOpen = false;
function setDock(open) {
  dockOpen = open ?? !dockOpen;
  document.body.classList.toggle('dock-open', dockOpen);
  renderTools();
  requestAnimationFrame(() => {
    viewport.resize();
    if (dockOpen) graph.frameAll();
  });
}
{
  const handle = center.querySelector('.dock-resize');
  handle.addEventListener('pointerdown', (e) => {
    if (!dockOpen) return;
    handle.setPointerCapture(e.pointerId);
    const y0 = e.clientY, h0 = dock.getBoundingClientRect().height;
    const mv = (ev) => {
      const hh = Math.max(160, Math.min(innerHeight * 0.7, h0 - (ev.clientY - y0)));
      document.documentElement.style.setProperty('--dock-h', hh + 'px');
      viewport.resize();
    };
    const up = () => {
      handle.removeEventListener('pointermove', mv);
      handle.removeEventListener('pointerup', up);
      graph.drawWires();
    };
    handle.addEventListener('pointermove', mv);
    handle.addEventListener('pointerup', up);
  });
}

// ------------------------------------------------------------------ tools
const TOOLS = [
  ['select', 'Select and transform', 'V', 'select'],
  ['direct', 'Edit points', 'A', 'direct'],
  null,
  ['rect', 'Rectangle', 'R', 'rect'],
  ['ellipse', 'Ellipse', 'E', 'ellipse'],
  ['polygon', 'Polygon', 'Y', 'polygon'],
  ['star', 'Star', 'S', 'star'],
  ['blob', 'Blob', 'O', 'blob'],
  ['more', 'More shapes', '', 'more'],
  null,
  ['pen', 'Pen: click for corners, drag for curves', 'P', 'pen'],
  ['pencil', 'Pencil: draw freehand', 'B', 'pencil'],
  null,
  ['hand', 'Hand: pan (or hold Space)', 'H', 'hand'],
];
const MORE = [['squircle', 'Squircle', 'squircle'], ['crescent', 'Crescent', 'crescent'], ['line', 'Line', 'line', 'L'], ['wave', 'Wave line', 'wave'], ['spiral', 'Spiral', 'spiral']];
function renderTools() {
  const t = app.tool;
  tools.replaceChildren(...TOOLS.map((d) => {
    if (!d) return h('div', { class: 'tool-sep' });
    const [id, label, key, ic] = d;
    if (id === 'more') {
      const inMore = MORE.find((m) => m[0] === t);
      const b = h('button', { class: 'tool' + (inMore ? ' on' : ''), title: 'More shapes' }, icon(inMore ? inMore[2] : 'squircle'), h('span', { class: 'tool-more' }));
      b.addEventListener('click', () => menu(b, MORE.map(([mid, ml, mic, mk]) => ({ label: ml, icon: mic, key: mk, run: () => app.setTool(mid) }))));
      return b;
    }
    return h('button', { class: 'tool' + (t === id ? ' on' : ''), title: `${label}${key ? ` (${key})` : ''}`, onclick: () => app.setTool(id) }, icon(ic));
  }), h('div', { class: 'grow' }),
  h('button', { class: 'tool' + (dockOpen ? ' on' : ''), title: 'Graph panel (G)', onclick: () => setDock() }, icon('graph')));
}
app.on('tool', renderTools);
renderTools();

// ------------------------------------------------------------------ commands
const cmd = (id, label, key, run, extra = {}) => app.command(id, { label, key, run, ...extra });
const hasSel = () => app.sel.size > 0;

cmd('new', 'New document', `${MOD}Alt+N`, () => {
  if (!confirm('Start a new, empty document? (The current one stays in the browser only until replaced.)')) return;
  app.loadDoc(newDoc());
});
cmd('open', 'Open…', `${MOD}O`, async () => {
  const f = await pickFile('.json,application/json');
  if (!f) return;
  try {
    app.loadDoc(validateDoc(JSON.parse(await readText(f))));
    toast('Opened ' + f.name);
  } catch (e) {
    toast('Could not open: ' + e.message);
  }
});
cmd('save', 'Save as file', `${MOD}S`, () => download(safeName(app.doc.name) + '.shapelab.json', JSON.stringify(app.doc)));
cmd('export-png', 'Export PNG', `${MOD}Shift+E`, () => exportPNG(2));
cmd('export-png1', 'Export PNG (1×)', '', () => exportPNG(1));
cmd('undo', 'Undo', `${MOD}Z`, () => {
  const l = app.store.undo();
  if (l) toast('Undo: ' + l, 1200);
});
cmd('redo', 'Redo', `${MOD}Shift+Z`, () => {
  const l = app.store.redo();
  if (l) toast('Redo: ' + l, 1200);
});
cmd('duplicate', 'Duplicate', `${MOD}D`, () => app.duplicate(), { enabled: hasSel });
cmd('delete', 'Delete', 'Del', () => (app.tool === 'direct' && viewport.deleteAnchors()) || app.deleteSelection(), { enabled: hasSel });
cmd('copy', 'Copy', `${MOD}C`, () => app.copy(), { enabled: hasSel });
cmd('cut', 'Cut', `${MOD}X`, () => app.cut(), { enabled: hasSel });
cmd('paste', 'Paste', `${MOD}V`, () => app.paste());
cmd('select-all', 'Select all', `${MOD}A`, () => {
  const layer = app.doc.nodes[app.activeParent()];
  const L = layer?.children ? layer : app.doc.nodes[app.doc.nodes[app.doc.root].children.at(-1)];
  app.select(L.children.filter((c) => !app.doc.nodes[c].locked));
});
cmd('deselect', 'Deselect', 'Esc', () => {
  app.select([]);
  app.entered = null;
});
cmd('group', 'Group', `${MOD}G`, () => app.group(), { enabled: hasSel });
cmd('ungroup', 'Ungroup', `${MOD}Shift+G`, () => app.ungroup(), { enabled: hasSel });
cmd('new-layer', 'New layer', `${MOD}Shift+N`, () => app.newLayer());
cmd('forward', 'Bring forward', `${MOD}]`, () => app.reorder(1), { enabled: hasSel });
cmd('backward', 'Send backward', `${MOD}[`, () => app.reorder(-1), { enabled: hasSel });
cmd('front', 'Bring to front', `${MOD}Shift+]`, () => app.reorder(2), { enabled: hasSel });
cmd('back', 'Send to back', `${MOD}Shift+[`, () => app.reorder(-2), { enabled: hasSel });
cmd('union', 'Combine: union', `${MOD}Alt+U`, () => app.combine('union'), { enabled: hasSel });
cmd('subtract', 'Combine: subtract', `${MOD}Alt+S`, () => app.combine('subtract'), { enabled: hasSel });
cmd('intersect', 'Combine: intersect', `${MOD}Alt+I`, () => app.combine('intersect'), { enabled: hasSel });
cmd('exclude', 'Combine: exclude', `${MOD}Alt+X`, () => app.combine('exclude'), { enabled: hasSel });
cmd('convert', 'Convert to path / bake generator', `${MOD}Shift+O`, () => app.convertToPath(), { enabled: hasSel });
cmd('mask', 'Make / release mask', `${MOD}7`, () => app.makeMask(), { enabled: hasSel });
cmd('flip-h', 'Flip horizontally', 'Shift+H', () => app.flip('h'), { enabled: hasSel });
cmd('flip-v', 'Flip vertically', 'Shift+V', () => app.flip('v'), { enabled: hasSel });
cmd('bake', 'Bake selection to swatch', `${MOD}B`, () => {
  showTab('swatches');
  swatches.bakeDialog(document.querySelector('.sw-bar .btn') || stage);
}, { enabled: hasSel });
cmd('new-gen', 'New generator', '', () => graph.newGenerator());
cmd('toggle-graph', 'Graph panel', 'G', (v) => setDock(v));
cmd('outline', 'Outline view', `${MOD}Y`, () => {
  app.outline = !app.outline;
  app.renderer.clearCaches();
  app.requestRender();
  toast(app.outline ? 'Outline view' : 'Full view', 900);
});
cmd('zoom-in', 'Zoom in', `${MOD}=`, () => app.zoomAt(1.25, viewport.w / 2, viewport.h / 2));
cmd('zoom-out', 'Zoom out', `${MOD}-`, () => app.zoomAt(0.8, viewport.w / 2, viewport.h / 2));
cmd('zoom-fit', 'Fit artboard', `${MOD}0`, () => viewport.fit());
cmd('zoom-100', 'Actual size', `${MOD}1`, () => app.zoomAt(1 / app.view.zoom, viewport.w / 2, viewport.h / 2));
cmd('zoom-sel', 'Zoom to selection', `${MOD}2`, () => {
  const b = app.selectionBounds();
  if (!(b.x1 > b.x0)) return;
  const z = Math.min(8, Math.min((viewport.w - 120) / (b.x1 - b.x0), (viewport.h - 120) / (b.y1 - b.y0)));
  app.view.zoom = z;
  app.view.x = viewport.w / 2 - ((b.x0 + b.x1) / 2) * z;
  app.view.y = viewport.h / 2 - ((b.y0 + b.y1) / 2) * z;
  app.emit('view');
  app.requestRender();
});
cmd('palette', 'Command palette', `${MOD}K`, () => commandPalette());
cmd('help', 'Keyboard shortcuts', '?', () => helpCard());
for (const [k, d] of Object.entries(THROWS)) cmd('throw-' + k, 'Throw in: ' + d.label, '', () => throwIn(app, k));
cmd('throw-surprise', 'Throw in: surprise me', `${MOD}Shift+R`, () => throwIn(app, 'surprise'));

async function exportPNG(scale) {
  const ab = app.doc.artboard;
  const W = Math.round(ab.w * scale), H = Math.round(ab.h * scale);
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');
  app.renderer.clearCaches();
  app.renderer.renderDoc(g, [scale, 0, 0, scale, 0, 0], { clip: { x0: 0, y0: 0, x1: W, y1: H } });
  app.renderer.clearCaches();
  const blob = c.convertToBlob ? await c.convertToBlob({ type: 'image/png' }) : await new Promise((r) => c.toBlob(r, 'image/png'));
  download(safeName(app.doc.name) + '.png', blob);
  app.requestRender();
}

// ------------------------------------------------------------------ top bar
function menuButton(label, items) {
  const b = h('button', { class: 'menu-btn' }, label);
  b.addEventListener('click', () => menu(b, items().map((it) => (it.sep || it.header ? it : { ...it, key: it.key ?? app.commands[it.cmd]?.key, label: it.label ?? app.commands[it.cmd]?.label, disabled: app.commands[it.cmd]?.enabled && !app.commands[it.cmd].enabled(), run: it.run || (() => app.run(it.cmd)) }))));
  return b;
}
const undoBtn = h('button', { class: 'icon-btn', title: `Undo (${MOD}Z)`, onclick: () => app.run('undo') }, icon('undo'));
const redoBtn = h('button', { class: 'icon-btn', title: `Redo (${MOD}Shift+Z)`, onclick: () => app.run('redo') }, icon('redo'));
const throwBtn = h('button', { class: 'btn small accent', title: 'Add random, editable starting material' }, icon('sparkle'), 'Throw in');
throwBtn.addEventListener('click', () => menu(throwBtn, [
  ...Object.entries(THROWS).map(([k, d]) => ({ label: d.label, hint: d.hint, run: () => throwIn(app, k) })),
  { sep: true },
  { label: 'Surprise me', icon: 'dice', key: app.commands['throw-surprise'].key, run: () => throwIn(app, 'surprise') },
]));
const zoomLabel = h('button', { class: 'zoom-label', title: 'Zoom', onclick: (e) => menu(e.currentTarget, [{ cmd: 'zoom-fit' }, { cmd: 'zoom-100' }, { cmd: 'zoom-sel' }, { cmd: 'zoom-in' }, { cmd: 'zoom-out' }].map((it) => ({ ...app.commands[it.cmd], run: () => app.run(it.cmd) })), { align: 'right' }) });
topbar.append(
  h('div', { class: 'brand' }, h('span', { class: 'logo' }), h('span', {}, 'Shape Lab'), h('span', { class: 'gen' }, 'gen 2')),
  menuButton('File', () => [{ cmd: 'new' }, { cmd: 'open' }, { cmd: 'save' }, { sep: true }, { cmd: 'export-png' }, { cmd: 'export-png1' }]),
  menuButton('Edit', () => [{ cmd: 'undo' }, { cmd: 'redo' }, { sep: true }, { cmd: 'cut' }, { cmd: 'copy' }, { cmd: 'paste' }, { cmd: 'duplicate' }, { cmd: 'delete' }, { sep: true }, { cmd: 'select-all' }, { cmd: 'deselect' }]),
  menuButton('Object', () => [{ cmd: 'group' }, { cmd: 'ungroup' }, { sep: true }, { cmd: 'union' }, { cmd: 'subtract' }, { cmd: 'intersect' }, { cmd: 'exclude' }, { sep: true }, { cmd: 'convert' }, { cmd: 'mask' }, { cmd: 'bake' }, { sep: true }, { cmd: 'flip-h' }, { cmd: 'flip-v' }, { cmd: 'forward' }, { cmd: 'backward' }, { cmd: 'front' }, { cmd: 'back' }, { sep: true }, { cmd: 'new-layer' }, { cmd: 'new-gen' }]),
  menuButton('View', () => [{ cmd: 'zoom-fit' }, { cmd: 'zoom-100' }, { cmd: 'zoom-sel' }, { sep: true }, { cmd: 'outline' }, { cmd: 'toggle-graph' }, { sep: true }, { cmd: 'palette' }, { cmd: 'help' }]),
  h('span', { class: 'sep' }), undoBtn, redoBtn, h('span', { class: 'sep' }), throwBtn,
  h('span', { class: 'grow' }),
  h('button', { class: 'icon-btn', title: `Command palette (${MOD}K)`, onclick: () => commandPalette() }, icon('command')),
  h('button', { class: 'icon-btn', title: 'Keyboard shortcuts (?)', onclick: () => helpCard() }, icon('help')),
  zoomLabel,
);
function syncTop() {
  undoBtn.disabled = !app.store.canUndo;
  redoBtn.disabled = !app.store.canRedo;
  zoomLabel.textContent = Math.round(app.view.zoom * 100) + '%';
}
app.on('doc', syncTop);
app.on('view', syncTop);
syncTop();

// ------------------------------------------------------------------ status bar
const stTool = h('span', {});
const stPos = h('span', { class: 'mono' });
const stSel = h('span', {});
const stRender = h('span', { class: 'mono muted' });
status.append(stTool, h('span', { class: 'grow' }), stSel, stPos, stRender);
const TOOL_HINT = {
  select: 'Click to select · drag to move · Shift adds · Alt-drag copies · double-click enters a group · handles resize and rotate',
  direct: 'Drag points and handles · Alt breaks a curve · double-click a point to smooth/sharpen it · double-click the outline to add a point',
  pen: 'Click for corners, drag for curves · click the first point to close · Enter or Esc to finish',
  pencil: 'Drag to draw · end near the start to make a closed shape',
  hand: 'Drag to pan · Ctrl/⌘ + scroll zooms',
};
function syncStatus() {
  const t = app.tool;
  stTool.textContent = TOOL_HINT[t] || 'Drag to draw · Shift keeps proportions · Alt draws from the centre · click for a default size';
  const n = app.sel.size;
  stSel.textContent = n ? `${n} selected` : '';
}
app.on('tool', syncStatus);
app.on('selection', syncStatus);
app.on('cursor', (d) => (stPos.textContent = `${Math.round(d[0])}, ${Math.round(d[1])}`));
app.on('rendered', (s) => (stRender.textContent = `${s.ms.toFixed(0)} ms${s.bitmaps ? ` · ${s.bitmaps} rebuilt` : ''}`));
syncStatus();

// ------------------------------------------------------------------ empty state
const empty = h('div', { class: 'empty-card' });
stage.append(empty);
function syncEmpty() {
  const d = app.doc;
  const count = d.nodes[d.root].children.reduce((a, l) => a + (d.nodes[l].children?.length || 0), 0);
  const drawing = app.tool !== 'select';
  empty.style.display = count || drawing ? 'none' : '';
  if (count || drawing) return;
  empty.replaceChildren(
    h('div', { class: 'empty-title' }, 'An empty artboard'),
    h('div', { class: 'muted' }, 'Draw with the tools on the left (R, E, P, B…), or throw in some raw material to push around:'),
    h('div', { class: 'empty-grid' }, ...Object.entries(THROWS).map(([k, t]) => h('button', { class: 'empty-btn', title: t.hint, onclick: () => throwIn(app, k) }, h('span', { class: 'eb-title' }, t.label), h('span', { class: 'eb-hint' }, t.hint)))),
    h('div', { class: 'btn-row centered' }, h('button', { class: 'btn accent', onclick: () => throwIn(app, 'surprise') }, icon('dice'), 'Surprise me')),
  );
}
app.on('doc', syncEmpty);
app.on('tool', syncEmpty);
syncEmpty();

// ------------------------------------------------------------------ keyboard
const KEYTOOLS = { v: 'select', a: 'direct', r: 'rect', e: 'ellipse', y: 'polygon', s: 'star', o: 'blob', l: 'line', p: 'pen', b: 'pencil', h: 'hand' };
function typing(e) {
  const t = e.target;
  return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
}
window.addEventListener('keydown', (e) => {
  if (typing(e)) return;
  const mod = e.metaKey || e.ctrlKey;
  const k = e.key.toLowerCase();
  if (e.key === ' ' && !viewport.spaceDown) {
    viewport.spaceDown = true;
    viewport.updateCursor();
    e.preventDefault();
    return;
  }
  const run = (id) => {
    e.preventDefault();
    app.run(id);
  };
  if (mod) {
    if (k === 'z') return run(e.shiftKey ? 'redo' : 'undo');
    if (k === 'y' && !isMac) return e.shiftKey ? null : run('redo');
    if (k === 'y') return run('outline');
    if (k === 'd') return run('duplicate');
    if (k === 'c') return run('copy');
    if (k === 'x' && !e.altKey) return run('cut');
    if (k === 'v') return run('paste');
    if (k === 'a') return run('select-all');
    if (k === 'g') return run(e.shiftKey ? 'ungroup' : 'group');
    if (k === 's') return run(e.altKey ? 'subtract' : 'save');
    if (k === 'o') return run(e.shiftKey ? 'convert' : 'open');
    if (k === 'b') return run('bake');
    if (k === 'k') return run('palette');
    if (k === 'e' && e.shiftKey) return run('export-png');
    if (k === 'r' && e.shiftKey) return run('throw-surprise');
    if (k === 'n' && e.shiftKey) return run('new-layer');
    if (k === 'u' && e.altKey) return run('union');
    if (k === 'i' && e.altKey) return run('intersect');
    if (k === 'x' && e.altKey) return run('exclude');
    if (k === '7') return run('mask');
    if (k === ']') return run(e.shiftKey ? 'front' : 'forward');
    if (k === '[') return run(e.shiftKey ? 'back' : 'backward');
    if (k === '=' || k === '+') return run('zoom-in');
    if (k === '-') return run('zoom-out');
    if (k === '0') return run('zoom-fit');
    if (k === '1') return run('zoom-100');
    if (k === '2') return run('zoom-sel');
    return;
  }
  if (e.key === 'Escape') {
    if (viewport.pen) return viewport.finishPen();
    if (app.tool !== 'select') return app.setTool('select');
    return run('deselect');
  }
  if (e.key === 'Enter') {
    if (viewport.pen) return viewport.finishPen();
    const s = app.selectedNodes()[0];
    if (s?.type === 'shape') return app.setTool('direct');
    if (s?.type === 'gen') return setDock(true);
    return;
  }
  if (e.key === 'Delete' || e.key === 'Backspace') return run('delete');
  if (e.key.startsWith('Arrow') && app.sel.size) {
    e.preventDefault();
    const step = e.shiftKey ? 10 : 1;
    const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
    const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
    const ids = [...app.sel];
    app.store.begin('Nudge', 'nudge');
    app.store.exec(ids.flatMap((id) => {
      const n = app.doc.nodes[id];
      return [{ op: 'set', id, path: 'transform.x', value: n.transform.x + dx }, { op: 'set', id, path: 'transform.y', value: n.transform.y + dy }];
    }));
    clearTimeout(window._nudge);
    window._nudge = setTimeout(() => app.commitLive(), 500);
    return;
  }
  if (e.shiftKey && k === 'h') return run('flip-h');
  if (e.shiftKey && k === 'v') return run('flip-v');
  if (k === 'g' && !e.shiftKey) return setDock();
  if (e.key === '?') return helpCard();
  if (KEYTOOLS[k] && !e.shiftKey && !e.altKey) {
    e.preventDefault();
    app.setTool(KEYTOOLS[k]);
  }
});
window.addEventListener('keyup', (e) => {
  if (e.key === ' ') {
    viewport.spaceDown = false;
    viewport.updateCursor();
  }
});

// ------------------------------------------------------------------ context menu
app.on('contextmenu', (e) => {
  const anchor = h('div', { style: { position: 'fixed', left: e.clientX + 'px', top: e.clientY + 'px', width: '1px', height: '1px' } });
  document.body.append(anchor);
  if (e.target === viewport.ovC) {
    const d = app.screenToDoc(...viewport.pos(e));
    const hit = app.hitTest(...d);
    if (hit && !app.sel.has(hit)) app.select(hit);
  }
  const items = app.sel.size
    ? ['duplicate', 'copy', 'cut', 'delete', null, 'group', 'ungroup', null, 'union', 'subtract', 'intersect', 'exclude', null, 'convert', 'mask', 'bake', null, 'front', 'forward', 'backward', 'back']
    : ['paste', 'select-all', null, 'new-layer', 'new-gen', null, 'throw-surprise'];
  menu(anchor, items.map((c) => (c ? { label: app.commands[c].label, key: app.commands[c].key, run: () => app.run(c) } : { sep: true })));
  setTimeout(() => anchor.remove(), 0);
});

// drop swatches from the panel onto the canvas
stage.addEventListener('dragover', (e) => {
  if (e.dataTransfer.types.includes('application/x-shapelab-swatch')) e.preventDefault();
});
stage.addEventListener('drop', (e) => {
  const id = e.dataTransfer.getData('application/x-shapelab-swatch');
  if (!id) return;
  e.preventDefault();
  const a = app.doc.assets[id] || swatches.library.find((x) => x.id === id);
  if (!a) return;
  const r = stage.getBoundingClientRect();
  const d = app.screenToDoc(e.clientX - r.left, e.clientY - r.top);
  const hit = app.hitTest(...d);
  const n = hit && app.doc.nodes[hit];
  if (n && ['shape', 'bool', 'gen'].includes(n.type) && e.altKey) {
    swatches.ensureInDoc(a);
    app.setProps([hit], 'fill', { type: 'swatch', asset: a.id, scale: 1, angle: 0 }, false, 'Swatch fill');
  } else swatches.place(a, d);
});
app.on('place-recipe', (id) => {
  const a = app.doc.assets[id];
  if (a) swatches.placeRecipe(a);
});

// ------------------------------------------------------------------ command palette & help
function commandPalette() {
  const list = h('div', { class: 'cmdp-list' });
  const input = h('input', { class: 'txt cmdp-in', placeholder: 'Type a command…' });
  const all = Object.values(app.commands).filter((c) => c.id !== 'palette');
  let idx = 0, shown = all;
  const draw = () => {
    const q = input.value.toLowerCase().trim();
    shown = all.filter((c) => !q || c.label.toLowerCase().includes(q) || q.split(' ').every((w) => c.label.toLowerCase().includes(w)));
    idx = Math.min(idx, Math.max(0, shown.length - 1));
    list.replaceChildren(...shown.slice(0, 14).map((c, i) => h('button', { class: 'menu-item' + (i === idx ? ' hot' : ''), disabled: c.enabled && !c.enabled(), onclick: () => go(c) }, h('span', { class: 'menu-label' }, c.label), c.key ? h('kbd', {}, c.key) : null)));
  };
  const go = (c) => {
    closePopover();
    app.run(c.id);
  };
  input.addEventListener('input', () => {
    idx = 0;
    draw();
  });
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'ArrowDown') (idx = Math.min(shown.length - 1, idx + 1)), draw(), e.preventDefault();
    if (e.key === 'ArrowUp') (idx = Math.max(0, idx - 1)), draw(), e.preventDefault();
    if (e.key === 'Enter' && shown[idx]) go(shown[idx]);
    if (e.key === 'Escape') closePopover();
  });
  const anchor = h('div', { style: { position: 'fixed', left: innerWidth / 2 - 210 + 'px', top: '70px', width: '1px', height: '1px' } });
  document.body.append(anchor);
  popover(anchor, h('div', { class: 'cmdp' }, input, list), { cls: 'pop-cmdp' });
  anchor.remove();
  draw();
  input.focus();
}

function helpCard() {
  const rows = [
    ['Tools', 'V select · A points · R rect · E ellipse · Y polygon · S star · O blob · L line · P pen · B pencil · H hand'],
    ['View', 'Space-drag or scroll to pan · Ctrl/⌘+scroll zooms · ⌘0 fit · ⌘1 100% · ⌘2 selection · ⌘Y outline view'],
    ['Edit', '⌘Z / ⌘⇧Z undo/redo · ⌘D duplicate · ⌘G / ⌘⇧G group/ungroup · arrows nudge (⇧ ×10)'],
    ['Shapes', '⌘⌥U/S/I/X combine · ⌘⇧O convert to path · ⌘7 mask · ⇧H / ⇧V flip · ⌘[ ] order'],
    ['Make', '⌘⇧R surprise me · ⌘B bake swatch · G graph panel · ⌘K every command'],
    ['Fields', 'Drag a field\'s label to scrub (⇧ faster, ⌥ finer) · type maths like 120*2 · ↑↓ step'],
  ];
  const anchor = h('div', { style: { position: 'fixed', left: innerWidth / 2 - 280 + 'px', top: '70px', width: '1px', height: '1px' } });
  document.body.append(anchor);
  popover(anchor, h('div', { class: 'help' }, h('div', { class: 'pop-title' }, 'Keyboard and mouse'), ...rows.map(([a, b]) => h('div', { class: 'help-row' }, h('b', {}, a), h('span', {}, b)))), { cls: 'pop-help' });
  anchor.remove();
}

// ------------------------------------------------------------------ autosave
app.on('autosave', () => {
  kvSet('doc', JSON.stringify(app.doc)).then((ok) => {
    if (!ok) return;
  });
});
(async () => {
  try {
    const saved = await kvGet('doc');
    if (saved && !window.SHAPELAB_FRESH) {
      const doc = validateDoc(JSON.parse(saved));
      const count = Object.keys(doc.nodes).length;
      if (count > 2) {
        app.loadDoc(doc);
        toast('Restored your last document');
      }
    }
  } catch {}
})();
window.addEventListener('beforeunload', () => {
  try {
    app.commitLive();
    kvSet('doc', JSON.stringify(app.doc));
  } catch {}
});
