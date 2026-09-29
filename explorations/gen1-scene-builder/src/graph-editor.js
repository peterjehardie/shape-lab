// Node graph editor: drag nodes, wire outputs (right dots) to inputs (left dots).
import { h } from './util.js';
import { NODE_TYPES, makeNode, createsCycle, compileGraph, GRAPH_PRESETS } from './graph.js';

const SVGNS = 'http://www.w3.org/2000/svg';
const svg = (tag, attrs = {}) => {
  const el = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
};
const INT_PARAMS = new Set(['octaves', 'seed', 'clamp']);

export function createGraphEditor(root, { getGraph, setGraph, onLive, onCommit }) {
  root.innerHTML = '';
  let pan = { x: 20, y: 16 };
  let selected = null;
  let menu = null;
  let exaggerate = 4;
  let previewDepth = 0.5;

  const cats = {};
  for (const [k, T] of Object.entries(NODE_TYPES)) if (T.cat !== 'Output') (cats[T.cat] ||= []).push([k, T.label]);
  const addSel = h('select', {}, h('option', { value: '' }, 'Add node…'),
    ...Object.entries(cats).map(([c, list]) => h('optgroup', { label: c }, ...list.map(([k, l]) => h('option', { value: k }, l)))));
  addSel.addEventListener('change', () => {
    if (!addSel.value) return;
    const r = canvasEl.getBoundingClientRect();
    const k = getGraph().nodes.length;
    addNode(addSel.value, r.width * 0.62 - pan.x + (k % 4) * 24, 20 - pan.y + (k % 4) * 24);
    addSel.value = '';
  });

  const presetSel = h('select', {}, h('option', { value: '' }, 'Load a graph\u2026'), ...Object.entries(GRAPH_PRESETS).map(([k, v]) => h('option', { value: k }, v.label)));
  presetSel.addEventListener('change', () => {
    const pr = GRAPH_PRESETS[presetSel.value];
    presetSel.value = '';
    if (!pr) return;
    setGraph(pr.make());
    rebuild();
    onLive();
    onCommit();
  });
  const canvasEl = h('div', { class: 'ge-canvas' });
  const world = h('div', { class: 'ge-world' });
  const links = svg('svg', { class: 'ge-links', width: 6000, height: 4000 });
  world.append(links);
  canvasEl.append(world);

  const prev = h('canvas', { width: 480, height: 270 });
  const exIn = h('input', { type: 'range', min: 1, max: 12, step: 0.5, value: exaggerate });
  exIn.addEventListener('input', () => { exaggerate = +exIn.value; drawPreview(); });
  const dIn = h('input', { type: 'range', min: 0, max: 1, step: 0.01, value: previewDepth });
  dIn.addEventListener('input', () => { previewDepth = +dIn.value; drawPreview(); });
  const preview = h('div', { class: 'ge-preview' },
    h('div', {}, 'Preview: a grid bent by the graph (movement only). The value, size and density outputs change shapes directly; each layer sets how much it listens.'),
    prev,
    h('label', {}, 'Exaggerate preview'), exIn,
    h('label', {}, 'Preview at layer depth (0 far → 1 near)'), dIn);

  root.append(
    h('div', { class: 'ge-bar' },
      h('strong', {}, 'Scene graph'), presetSel, addSel,
      h('button', { class: 'small', onclick: () => { pan = { x: 20, y: 16 }; applyPan(); } }, 'Recentre'),
      h('span', { class: 'hint' }, 'Drag right-hand dots to left-hand dots to wire. Click a wire to cut it. Right-click the grid to add. Drag a number’s label to scrub it.')),
    h('div', { class: 'ge-main' }, canvasEl, preview));

  const applyPan = () => { world.style.transform = `translate(${pan.x}px, ${pan.y}px)`; };
  applyPan();

  function numField(obj, key, live) {
    const step = INT_PARAMS.has(key) ? 1 : 0.05;
    const inp = h('input', { type: 'number', step, value: obj[key] });
    inp.addEventListener('input', () => {
      const v = +inp.value;
      if (Number.isNaN(v)) return;
      obj[key] = v;
      live();
    });
    inp.addEventListener('change', () => onCommit());
    return inp;
  }
  // Drag a label sideways to scrub the number next to it.
  function scrubLabel(text, obj, key, live) {
    const lbl = h('span', { class: 'lbl', style: { cursor: 'ew-resize' } }, text);
    lbl.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      const x0 = e.clientX, v0 = obj[key];
      const step = INT_PARAMS.has(key) ? 0.1 : Math.max(0.005, Math.abs(v0) * 0.01 || 0.01);
      const move = (ev) => {
        let v = v0 + (ev.clientX - x0) * step;
        if (INT_PARAMS.has(key)) v = Math.round(v);
        else v = Math.round(v * 1000) / 1000;
        obj[key] = v;
        const inp = lbl.parentElement.querySelector('input');
        if (inp) inp.value = v;
        live();
      };
      const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); onCommit(); };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    });
    return lbl;
  }

  const live = () => { onLive(); drawPreview(); };

  function nodeEl(node) {
    const graph = getGraph();
    const T = NODE_TYPES[node.type];
    const el = h('div', { class: `ge-node${selected === node.id ? ' sel' : ''}`, 'data-cat': T.cat, 'data-id': node.id, style: { left: `${node.x}px`, top: `${node.y}px` } });
    el.append(h('div', { class: 'hd' }, T.label, T.cat === 'Output' ? null : h('span', { class: 'x', title: 'Delete node', 'data-del': node.id }, '✕')));
    const body = h('div', { class: 'body' });
    for (const [name, def] of T.inputs) {
      const linked = graph.links.some((l) => l.to === node.id && l.toPort === name);
      const port = h('span', { class: `port in${linked ? ' linked' : ''}`, 'data-node': node.id, 'data-port': name, 'data-dir': 'in' });
      let field = null;
      if (!linked && typeof def === 'number') {
        node.ins ||= {};
        if (node.ins[name] === undefined) node.ins[name] = def;
        body.append(h('div', { class: 'pr' }, port, scrubLabel(name, node.ins, name, live), numField(node.ins, name, live)));
        continue;
      }
      if (!linked) field = h('span', { class: 'lbl', style: { flex: '0 0 auto', fontSize: '10px' } }, `(point ${def})`);
      body.append(h('div', { class: 'pr' }, port, h('span', { class: 'lbl' }, name), field));
    }
    for (const key of Object.keys(node.params)) body.append(h('div', { class: 'pr' }, scrubLabel(key, node.params, key, live), numField(node.params, key, live)));
    for (const out of T.outputs) {
      body.append(h('div', { class: 'pr out' }, h('span', { class: 'lbl' }, out), h('span', { class: 'port out', 'data-node': node.id, 'data-port': out, 'data-dir': 'out' })));
    }
    if (T.help) body.append(h('div', { class: 'help' }, T.help));
    el.append(body);
    return el;
  }

  function rebuild() {
    world.querySelectorAll('.ge-node').forEach((n) => n.remove());
    for (const node of getGraph().nodes) world.append(nodeEl(node));
    requestAnimationFrame(drawLinks);
    drawPreview();
  }

  function portPos(nodeId, port, dir) {
    const el = world.querySelector(`.port[data-node="${nodeId}"][data-port="${port}"][data-dir="${dir}"]`);
    if (!el) return null;
    const r = el.getBoundingClientRect(), w = world.getBoundingClientRect();
    return [r.left + r.width / 2 - w.left, r.top + r.height / 2 - w.top];
  }
  const curve = (a, b) => {
    const dx = Math.max(40, Math.abs(b[0] - a[0]) * 0.5);
    return `M${a[0]},${a[1]} C${a[0] + dx},${a[1]} ${b[0] - dx},${b[1]} ${b[0]},${b[1]}`;
  };

  function drawLinks() {
    links.innerHTML = '';
    getGraph().links.forEach((l, i) => {
      const a = portPos(l.from, l.fromPort, 'out'), b = portPos(l.to, l.toPort, 'in');
      if (!a || !b) return;
      const d = curve(a, b);
      links.append(svg('path', { d, class: 'hit', 'data-link': i }), svg('path', { d }));
    });
  }

  function addNode(type, x, y) {
    const graph = getGraph();
    const n = makeNode(type, Math.round(x), Math.round(y));
    graph.nodes.push(n);
    selected = n.id;
    rebuild();
    onCommit();
  }
  function deleteNode(id) {
    const graph = getGraph();
    const n = graph.nodes.find((q) => q.id === id);
    if (!n || n.type === 'output') return;
    graph.nodes = graph.nodes.filter((q) => q.id !== id);
    graph.links = graph.links.filter((l) => l.from !== id && l.to !== id);
    rebuild();
    onLive();
    onCommit();
  }
  function connect(a, b) {
    // a and b are {node, port, dir}; wire out -> in
    const out = a.dir === 'out' ? a : b, inp = a.dir === 'out' ? b : a;
    if (out.dir !== 'out' || inp.dir !== 'in' || out.node === inp.node) return false;
    const graph = getGraph();
    if (createsCycle(graph, out.node, inp.node)) return false;
    graph.links = graph.links.filter((l) => !(l.to === inp.node && l.toPort === inp.port));
    graph.links.push({ from: out.node, fromPort: out.port, to: inp.node, toPort: inp.port });
    return true;
  }

  function closeMenu() {
    if (menu) menu.remove();
    menu = null;
  }
  function openMenu(cx, cy) {
    closeMenu();
    const r = canvasEl.getBoundingClientRect();
    const x = cx - r.left, y = cy - r.top;
    menu = h('div', { class: 'ge-menu', style: { left: `${x}px`, top: `${y}px` } });
    for (const [c, list] of Object.entries(cats)) {
      menu.append(h('div', { class: 'c' }, c));
      for (const [k, l] of list) menu.append(h('button', { onclick: () => { closeMenu(); addNode(k, x - pan.x, y - pan.y); } }, l));
    }
    canvasEl.append(menu);
  }

  canvasEl.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    openMenu(e.clientX, e.clientY);
  });

  canvasEl.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.ge-menu')) return;
    closeMenu();
    const graph = getGraph();
    const t = e.target;
    if (t.dataset && t.dataset.del) { deleteNode(t.dataset.del); return; }
    if (t.classList && t.classList.contains('hit')) {
      graph.links.splice(+t.dataset.link, 1);
      rebuild();
      onLive();
      onCommit();
      return;
    }
    const port = t.closest && t.closest('.port');
    if (port) {
      e.preventDefault();
      let start = { node: port.dataset.node, port: port.dataset.port, dir: port.dataset.dir };
      // Grabbing a wired input picks the wire up from its source.
      if (start.dir === 'in') {
        const l = graph.links.find((q) => q.to === start.node && q.toPort === start.port);
        if (l) {
          graph.links = graph.links.filter((q) => q !== l);
          start = { node: l.from, port: l.fromPort, dir: 'out' };
          drawLinks();
          onLive();
        }
      }
      const a = portPos(start.node, start.port, start.dir);
      const temp = svg('path', { class: 'temp' });
      links.append(temp);
      const move = (ev) => {
        const w = world.getBoundingClientRect();
        const b = [ev.clientX - w.left, ev.clientY - w.top];
        temp.setAttribute('d', start.dir === 'out' ? curve(a, b) : curve(b, a));
      };
      const up = (ev) => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        temp.remove();
        const tgt = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.port');
        if (tgt) connect(start, { node: tgt.dataset.node, port: tgt.dataset.port, dir: tgt.dataset.dir });
        rebuild();
        onLive();
        onCommit();
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      return;
    }
    const nodeDiv = t.closest && t.closest('.ge-node');
    if (nodeDiv) {
      const id = nodeDiv.dataset.id;
      if (selected !== id) {
        selected = id;
        world.querySelectorAll('.ge-node').forEach((n) => n.classList.toggle('sel', n.dataset.id === id));
      }
      if (!t.closest('.hd')) return;
      e.preventDefault();
      const node = graph.nodes.find((n) => n.id === id);
      const x0 = e.clientX, y0 = e.clientY, nx = node.x, ny = node.y;
      const move = (ev) => {
        node.x = Math.round(nx + ev.clientX - x0);
        node.y = Math.round(ny + ev.clientY - y0);
        nodeDiv.style.left = `${node.x}px`;
        nodeDiv.style.top = `${node.y}px`;
        drawLinks();
      };
      const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); onCommit(); };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      return;
    }
    // Empty grid: pan.
    selected = null;
    world.querySelectorAll('.ge-node.sel').forEach((n) => n.classList.remove('sel'));
    const x0 = e.clientX, y0 = e.clientY, px = pan.x, py = pan.y;
    const move = (ev) => { pan = { x: px + ev.clientX - x0, y: py + ev.clientY - y0 }; applyPan(); };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  });

  window.addEventListener('keydown', (e) => {
    if (!selected || root.closest('[hidden]')) return;
    if (e.target.matches('input, textarea, select')) return;
    if (e.key === 'Delete' || e.key === 'Backspace') deleteNode(selected);
  });

  function drawPreview() {
    const c = prev.getContext('2d');
    const W = prev.width, H = prev.height;
    c.fillStyle = '#0e0e12';
    c.fillRect(0, 0, W, H);
    const fn = compileGraph(getGraph());
    const ctx = { x: 0, y: 0, depth: previewDepth, aspect: 16 / 9 };
    const k = (H / 900) * exaggerate;
    const P = (x, y) => {
      if (!fn) return [x * W, y * H];
      ctx.x = x; ctx.y = y;
      const d = fn(ctx);
      return [x * W + d[0] * k, y * H + d[1] * k];
    };
    c.strokeStyle = '#6fb3d2';
    c.lineWidth = 1;
    const cols = 24, rows = 14, seg = 40;
    for (let i = 0; i <= cols; i++) {
      c.beginPath();
      for (let j = 0; j <= seg; j++) { const q = P(i / cols, j / seg); j ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); }
      c.stroke();
    }
    for (let i = 0; i <= rows; i++) {
      c.beginPath();
      for (let j = 0; j <= seg; j++) { const q = P(j / seg, i / rows); j ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); }
      c.stroke();
    }
    if (!fn) {
      c.fillStyle = '#9a98a3';
      c.font = '16px system-ui';
      c.fillText('Nothing wired into the output', 16, 28);
    }
  }

  rebuild();
  return { refresh: rebuild, relink: () => requestAnimationFrame(drawLinks) };
}
