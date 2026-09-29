// The store owns the document. Every change is a small operation (plain JSON):
//   { op: 'set',    id, path, value }          id null = a document-level field (e.g. 'artboard.w')
//   { op: 'insert', node, parent, index }      node is a full node; children must be inserted separately (parents first)
//   { op: 'remove', id }                       removes one node (the caller removes descendants first)
//   { op: 'move',   id, parent, index }
//   { op: 'asset',  id, value }                value null removes the asset
// Applying an op returns its inverse, so undo is just applying inverses backwards.
// A transaction groups ops into one undo step; live edits (dragging, scrubbing) keep
// updating the open transaction until it is committed.
//
// `rev` counts changes per node and bubbles up to ancestors, so renderers can cache by it.

const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

function getPath(obj, path) {
  if (!path) return obj;
  let o = obj;
  for (const k of path.split('.')) {
    if (o == null) return undefined;
    o = o[k];
  }
  return o;
}
function setPath(obj, path, value) {
  const keys = path.split('.');
  let o = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    if (o[k] == null || typeof o[k] !== 'object') o[k] = /^\d+$/.test(keys[i + 1]) ? [] : {};
    o = o[k];
  }
  const last = keys[keys.length - 1];
  if (value === undefined) delete o[last];
  else o[last] = value;
}

export class Store {
  constructor(doc) {
    this.listeners = new Set();
    this.load(doc);
  }

  load(doc) {
    this.doc = doc;
    this.rev = {};
    this.docRev = 0;
    this.undoStack = [];
    this.redoStack = [];
    this.open = null;
    this.emit({ type: 'load' });
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  emit(e) {
    for (const fn of this.listeners) fn(e);
  }

  bump(id) {
    this.docRev++;
    let n = this.doc.nodes[id];
    while (n) {
      this.rev[n.id] = (this.rev[n.id] || 0) + 1;
      n = n.parent ? this.doc.nodes[n.parent] : null;
    }
  }
  revOf(id) {
    return this.rev[id] || 0;
  }

  // Apply one op to the document; returns the inverse op.
  apply(op) {
    const d = this.doc;
    switch (op.op) {
      case 'set': {
        const target = op.id ? d.nodes[op.id] : d;
        if (!target) return null;
        const prev = clone(getPath(target, op.path));
        setPath(target, op.path, clone(op.value));
        // layout-only changes (node-graph positions) are undoable but leave caches alone
        if (op.id && !op.layout) this.bump(op.id);
        else {
          this.docRev++;
          if (op.path.startsWith('artboard') || op.path.startsWith('assets')) for (const id in d.nodes) this.rev[id] = (this.rev[id] || 0) + 1;
        }
        return { op: 'set', id: op.id, path: op.path, value: prev, layout: op.layout };
      }
      case 'insert': {
        const n = clone(op.node);
        n.parent = op.parent;
        if (n.children) n.children = n.children.filter((c) => d.nodes[c]);
        d.nodes[n.id] = n;
        const p = d.nodes[op.parent];
        const idx = op.index == null ? p.children.length : Math.min(op.index, p.children.length);
        p.children.splice(idx, 0, n.id);
        this.bump(n.id);
        return { op: 'remove', id: n.id };
      }
      case 'remove': {
        const n = d.nodes[op.id];
        if (!n) return null;
        const p = d.nodes[n.parent];
        const index = p.children.indexOf(op.id);
        this.bump(p.id);
        p.children.splice(index, 1);
        const node = clone(n);
        delete d.nodes[op.id];
        return { op: 'insert', node, parent: p.id, index };
      }
      case 'move': {
        const n = d.nodes[op.id];
        const from = d.nodes[n.parent];
        const fromIndex = from.children.indexOf(op.id);
        this.bump(from.id);
        from.children.splice(fromIndex, 1);
        const to = d.nodes[op.parent];
        const idx = op.index == null ? to.children.length : Math.min(op.index, to.children.length);
        to.children.splice(idx, 0, op.id);
        n.parent = to.id;
        this.bump(op.id);
        return { op: 'move', id: op.id, parent: from.id, index: fromIndex };
      }
      case 'asset': {
        const prev = clone(d.assets[op.id]) ?? null;
        if (op.value == null) delete d.assets[op.id];
        else d.assets[op.id] = clone(op.value);
        this.docRev++;
        for (const id in d.nodes) this.rev[id] = (this.rev[id] || 0) + 1;
        return { op: 'asset', id: op.id, value: prev };
      }
    }
    return null;
  }

  // ---- transactions ----

  begin(label, key = null) {
    if (this.open && key && this.open.key === key) return this.open;
    if (this.open) this.commit();
    this.open = { label, key, ops: [], inverse: [] };
    return this.open;
  }

  // Record ops in the open transaction (opens a one-shot one if none).
  exec(ops, label = 'Edit') {
    const oneShot = !this.open;
    if (oneShot) this.begin(label);
    for (const op of Array.isArray(ops) ? ops : [ops]) {
      const inv = this.apply(op);
      if (inv) {
        this.open.ops.push(op);
        this.open.inverse.push(inv);
      }
    }
    this.emit({ type: 'change', live: !oneShot });
    if (oneShot) this.commit();
  }

  commit() {
    const t = this.open;
    this.open = null;
    if (!t || !t.ops.length) return;
    // Merge consecutive sets of the same path into the first inverse (keeps undo compact).
    this.undoStack.push(t);
    if (this.undoStack.length > 300) this.undoStack.shift();
    this.redoStack = [];
    this.emit({ type: 'commit', label: t.label });
  }

  cancel() {
    const t = this.open;
    this.open = null;
    if (!t) return;
    for (let i = t.inverse.length - 1; i >= 0; i--) this.apply(t.inverse[i]);
    this.emit({ type: 'change' });
  }

  undo() {
    if (this.open) this.commit();
    const t = this.undoStack.pop();
    if (!t) return null;
    const redoInv = [];
    for (let i = t.inverse.length - 1; i >= 0; i--) redoInv.push(this.apply(t.inverse[i]));
    this.redoStack.push({ label: t.label, ops: t.inverse.slice().reverse(), inverse: redoInv.reverse() });
    this.emit({ type: 'change', undo: true });
    return t.label;
  }

  redo() {
    const t = this.redoStack.pop();
    if (!t) return null;
    const inv = [];
    for (let i = t.inverse.length - 1; i >= 0; i--) inv.push(this.apply(t.inverse[i]));
    this.undoStack.push({ label: t.label, ops: t.inverse.slice().reverse(), inverse: inv.reverse() });
    this.emit({ type: 'change', redo: true });
    return t.label;
  }

  // ---- convenience builders ----

  set(id, path, value, label) {
    this.exec({ op: 'set', id, path, value }, label || 'Change ' + path.split('.')[0]);
  }

  // Insert a subtree { rootId, nodes } under parent at index (parents inserted before children).
  insertSubtree(sub, parent, index = null) {
    const ops = [];
    const add = (id, p, idx) => {
      const n = sub.nodes[id];
      ops.push({ op: 'insert', node: { ...n, children: n.children ? [] : undefined }, parent: p, index: idx });
      if (n.children) n.children.forEach((c, i) => add(c, id, i));
    };
    add(sub.rootId, parent, index);
    for (const op of ops) if (op.node.children === undefined) delete op.node.children;
    return ops;
  }

  // Ops that remove a node and its descendants (children first).
  removeSubtreeOps(id) {
    const ops = [];
    const rec = (nid) => {
      const n = this.doc.nodes[nid];
      if (!n) return;
      if (n.children) for (const c of [...n.children].reverse()) rec(c);
      ops.push({ op: 'remove', id: nid });
    };
    rec(id);
    return ops;
  }

  get canUndo() {
    return this.undoStack.length > 0 || !!(this.open && this.open.ops.length);
  }
  get canRedo() {
    return this.redoStack.length > 0;
  }
}
