// Browser persistence: IndexedDB for the autosaved document and the swatch library.
// Every call is wrapped so the app still works where storage is blocked.

const DB = 'shapelab-gen2';
let dbp = null;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
        if (!db.objectStoreNames.contains('swatches')) db.createObjectStore('swatches', { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbp;
}

async function tx(store, mode, fn) {
  const db = await open();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const t = db.transaction(store, mode);
      const r = fn(t.objectStore(store));
      t.oncomplete = () => resolve(r?.result ?? true);
      t.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export const kvGet = (k) => tx('kv', 'readonly', (s) => s.get(k));
export const kvSet = (k, v) => tx('kv', 'readwrite', (s) => s.put(v, k));
export const libAll = () => tx('swatches', 'readonly', (s) => s.getAll());
export const libPut = (asset) => tx('swatches', 'readwrite', (s) => s.put(asset));
export const libDelete = (id) => tx('swatches', 'readwrite', (s) => s.delete(id));

export function download(name, blobOrText, type = 'application/json') {
  if (globalThis.SHAPELAB_HOSTED) {
    // the hosted page's frame blocks downloads; say so instead of failing silently
    import('./widgets.js').then((w) => w.toast('Downloads are blocked in the hosted page. Run Shape Lab locally to save files; your work autosaves in this browser.', 5000));
    return;
  }
  const blob = blobOrText instanceof Blob ? blobOrText : new Blob([blobOrText], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 1000);
}

export function pickFile(accept) {
  return new Promise((resolve) => {
    const i = document.createElement('input');
    i.type = 'file';
    i.accept = accept;
    i.onchange = () => resolve(i.files[0] || null);
    i.click();
  });
}

export const readText = (f) => new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsText(f); });
export const readDataURL = (f) => new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(f); });
export const safeName = (s) => (s || 'untitled').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'untitled';
