// "Throw in": quick random starting material. Each one adds ordinary, fully editable
// nodes (shapes, effects, generators) to the page. Nothing here is a finished picture.

import { Rng, newSeed } from '../core/rng.js';
import { makeShape, baseNode, solid, makeStroke, makePaint } from '../core/doc.js';
import { makeEffect } from '../core/effects.js';
import { makeGNode, starterGraph } from '../core/graph.js';
import { PRIMS } from '../core/prims.js';
import { oklch } from '../core/color.js';

const KINDS = ['blob', 'ellipse', 'rect', 'polygon', 'star', 'squircle', 'crescent'];

function palettePick(app, rng, lo = 0.25, hi = 0.92) {
  const pal = app.doc.palette.filter((c) => c.l >= lo && c.l <= hi);
  const c = pal.length ? rng.pick(pal) : oklch(rng.range(0.4, 0.8), rng.range(0.04, 0.16), rng.range(0, 360));
  return { ...c };
}

function center(app, rng, spread = 0.25) {
  const ab = app.doc.artboard;
  return [ab.w * (0.5 + rng.signed() * spread), ab.h * (0.5 + rng.signed() * spread)];
}

function fx(type, p) {
  return makeEffect(type, p);
}

export const THROWS = {
  shape: {
    label: 'Random shape', hint: 'One shape with a random outline effect',
    make(app, rng) {
      const kind = rng.pick(KINDS);
      const s = makeShape(kind);
      const ab = app.doc.artboard;
      const size = Math.min(ab.w, ab.h) * rng.range(0.18, 0.45);
      s.geom.w = size * rng.range(0.7, 1.4);
      if ('h' in s.geom) s.geom.h = size * rng.range(0.7, 1.3);
      if (kind === 'blob') s.geom.seed = newSeed();
      if (kind === 'star') (s.geom.points = rng.int(3, 11)), (s.geom.inner = rng.range(0.25, 0.8));
      if (kind === 'polygon') s.geom.sides = rng.int(3, 9);
      [s.transform.x, s.transform.y] = center(app, rng);
      s.transform.rot = rng.range(-30, 30);
      s.fill = solid(palettePick(app, rng));
      const choice = rng.int(0, 3);
      if (choice === 0) s.effects.push(fx('roughen', { amount: size * rng.range(0.01, 0.05), detail: rng.range(0.6, 2) }));
      if (choice === 1) s.effects.push(fx('warp', { amount: size * rng.range(0.05, 0.2), scale: size * rng.range(0.4, 1) }));
      if (choice === 2) s.effects.push(fx('wave', { amount: size * 0.03, wavelength: size * rng.range(0.1, 0.3), angle: rng.range(0, 180) }));
      s.effects.push(fx('noiseTexture', { amount: rng.range(0.15, 0.35), scale: size * rng.range(0.05, 0.2) }));
      s.name = PRIMS[kind].label;
      return s;
    },
  },

  blobField: {
    label: 'Scattered field', hint: 'A generator: shapes scattered, sized by a noise field',
    make(app, rng) {
      const ab = app.doc.artboard;
      const g = starterGraph();
      const byType = (t) => Object.values(g.nodes).find((n) => n.type === t);
      Object.assign(byType('scatter').params, { count: rng.int(30, 140), w: ab.w * 0.85, h: ab.h * 0.8, spacing: rng.range(0, 30), seed: newSeed() });
      Object.assign(byType('noiseField').params, { scale: rng.range(200, 600), seed: newSeed(), kind: rng.pick(['fbm', 'ridged', 'billow']) });
      Object.assign(byType('shape').params, { kind: rng.pick(['blob', 'ellipse', 'star', 'squircle', 'crescent', 'polygon']), seed: newSeed() });
      byType('instance').params.scale = rng.range(0.25, 0.8);
      const cr = byType('colorRamp').params;
      const pal = [...app.doc.palette].sort((a, b) => a.l - b.l);
      cr.c0 = { ...pal[1 + rng.int(0, 1)] };
      cr.c1 = { ...pal[Math.floor(pal.length / 2) + rng.int(-1, 1)] };
      cr.c2 = { ...pal[pal.length - 2 - rng.int(0, 1)] };
      const n = baseNode('gen', { name: 'Scattered field', graph: g, fill: solid(palettePick(app, rng)), stroke: null });
      n.transform.x = ab.w / 2;
      n.transform.y = ab.h / 2;
      if (rng.chance(0.5)) n.effects.push(fx('roughen', { amount: rng.range(1, 4), detail: 1.5 }));
      return n;
    },
  },

  paintStroke: {
    label: 'Paint stroke', hint: 'A brushy swatch: torn edge, streaky noise, dry edge, fading tail',
    make(app, rng) {
      const ab = app.doc.artboard;
      const s = makeShape('rect');
      const L = ab.w * rng.range(0.35, 0.6);
      s.geom.w = L;
      s.geom.h = L * rng.range(0.14, 0.26);
      s.geom.r = s.geom.h * 0.45;
      [s.transform.x, s.transform.y] = center(app, rng, 0.18);
      s.transform.rot = rng.range(-18, 18);
      const col = palettePick(app, rng, 0.3, 0.75);
      s.fill = solid(col);
      s.name = 'Paint stroke';
      s.effects = [
        fx('bend', { amount: rng.range(-0.25, 0.25) }),
        fx('roughen', { amount: s.geom.h * 0.06, detail: 1.4, jag: 0.4 }),
        fx('noiseTexture', { mode: 'value', amount: 0.45, scale: s.geom.h * 0.5, stretch: 14, octaves: 5, contrast: 1.6, angle: 0 }),
        fx('dissolve', { amount: 0.5, edge: 0.9, edgeWidth: s.geom.h * 0.35, scale: s.geom.h * 0.12, stretch: 9, octaves: 4, softness: 0.03 }),
        fx('fade', { angle: rng.chance(0.5) ? 0 : 180, start: 0.6, end: 1.05, amount: 0.9 }),
        fx('edgePool', { amount: 0.25, width: s.geom.h * 0.06 }),
      ];
      return s;
    },
  },

  noiseWash: {
    label: 'Noise wash', hint: 'A full-page noise layer, multiplied over what is below',
    make(app, rng) {
      const ab = app.doc.artboard;
      const s = makeShape('rect');
      s.geom.w = ab.w;
      s.geom.h = ab.h;
      s.transform.x = ab.w / 2;
      s.transform.y = ab.h / 2;
      const c = palettePick(app, rng, 0.35, 0.85);
      s.fill = { ...makePaint('noise', { color: c }), kind: rng.pick(['fbm', 'fbm', 'billow']), scale: rng.range(160, 520), stretch: rng.pick([1, 1, 2.5, 5]), angle: rng.range(-20, 20), contrast: rng.range(1.1, 1.8),
        stops: [{ t: 0.25, color: { ...c, a: 0 } }, { t: 1, color: { ...c, a: 0.85 } }] };
      s.blend = rng.pick(['multiply', 'multiply', 'soft-light']);
      s.opacity = rng.range(0.3, 0.6);
      s.name = 'Noise wash';
      s.effects = [fx('grain', { amount: 0.08 })];
      return s;
    },
  },

  marks: {
    label: 'Grid of marks', hint: 'A generator: short marks on a grid, turned and sized by noise',
    make(app, rng) {
      const ab = app.doc.artboard;
      const grid = makeGNode('grid', 40, 40, { cols: rng.int(10, 26), rows: rng.int(6, 16), w: ab.w * 0.8, h: ab.h * 0.75, stagger: rng.pick([0, 1]) });
      const nf = makeGNode('noiseField', 40, 300, { scale: rng.range(250, 700), contrast: 1.8 });
      const af = makeGNode('attrField', 300, 120, { name: 'f' });
      const shape = makeGNode('shape', 300, 360, { kind: rng.pick(['rect', 'ellipse', 'star', 'crescent']), w: 60, h: rng.range(8, 30), points: 4, inner: 0.3, r: 4 });
      const inst = makeGNode('instance', 560, 140, { scale: rng.range(0.4, 0.9), scaleBy: 'f', scaleAmt: 0.8, rotBy: 'f', rotAmt: rng.pick([180, 360, 90]) });
      const edge = makeGNode('edgeFx', 820, 140, { fx: 'roughen', amount: 1.5, detail: 1, jag: 0.5, bias: 0, by: 'none', vary: true });
      const cr = makeGNode('colorRamp', 1080, 140, { by: 'f' });
      const pal = [...app.doc.palette].sort((a, b) => a.l - b.l);
      cr.params.c0 = { ...pal[1] };
      cr.params.c1 = { ...pal[Math.floor(pal.length / 2)] };
      cr.params.c2 = { ...pal[pal.length - 3] };
      const out = makeGNode('output', 1340, 160);
      const g = {
        nodes: Object.fromEntries([grid, nf, af, shape, inst, edge, cr, out].map((q) => [q.id, q])),
        links: [
          { from: grid.id, to: af.id, port: 'list' }, { from: nf.id, to: af.id, port: 'field' },
          { from: af.id, to: inst.id, port: 'points' }, { from: shape.id, to: inst.id, port: 'shapes' },
          { from: inst.id, to: edge.id, port: 'shapes' }, { from: edge.id, to: cr.id, port: 'list' }, { from: cr.id, to: out.id, port: 'shapes' },
        ],
        out: out.id,
      };
      const n = baseNode('gen', { name: 'Grid of marks', graph: g, fill: solid(palettePick(app, rng)), stroke: null });
      n.transform.x = ab.w / 2;
      n.transform.y = ab.h / 2;
      return n;
    },
  },

  ring: {
    label: 'Ring of strokes', hint: 'A generator: tapered strokes around a ring, following its direction',
    make(app, rng) {
      const ab = app.doc.artboard;
      const R = Math.min(ab.w, ab.h) * rng.range(0.18, 0.32);
      const ring = makeGNode('ring', 40, 40, { count: rng.int(18, 60), radius: R, ry: rng.range(0.7, 1) });
      const jit = makeGNode('jitter', 300, 40, { amount: R * 0.06 });
      const shape = makeGNode('shape', 40, 280, { kind: 'crescent', w: R * 0.25, h: R * 0.9, thick: rng.range(0.15, 0.4) });
      const rnd = makeGNode('attrRandom', 560, 40, { name: 'r', min: 0.3, max: 1 });
      const inst = makeGNode('instance', 820, 60, { scale: 1, scaleBy: 'r', scaleAmt: 0.7, rotBy: 'r', rotAmt: rng.range(-30, 30), align: true });
      const cr = makeGNode('colorRamp', 1080, 60, { by: 't' });
      const pal = [...app.doc.palette].sort((a, b) => a.l - b.l);
      cr.params.c0 = { ...pal[2] };
      cr.params.c1 = { ...pal[Math.floor(pal.length / 2) + 1] };
      cr.params.c2 = { ...pal[3] };
      const out = makeGNode('output', 1340, 80);
      const g = {
        nodes: Object.fromEntries([ring, jit, shape, rnd, inst, cr, out].map((q) => [q.id, q])),
        links: [
          { from: ring.id, to: jit.id, port: 'list' }, { from: jit.id, to: rnd.id, port: 'list' }, { from: rnd.id, to: inst.id, port: 'points' },
          { from: shape.id, to: inst.id, port: 'shapes' }, { from: inst.id, to: cr.id, port: 'list' }, { from: cr.id, to: out.id, port: 'shapes' },
        ],
        out: out.id,
      };
      const n = baseNode('gen', { name: 'Ring of strokes', graph: g, fill: solid(palettePick(app, rng)), stroke: null });
      [n.transform.x, n.transform.y] = center(app, rng, 0.12);
      n.effects = [fx('roughen', { amount: 2, detail: 2 }), fx('noiseTexture', { amount: 0.3, scale: 20, stretch: 6 })];
      return n;
    },
  },

  tornPaper: {
    label: 'Torn paper', hint: 'Two torn sheets with a soft cast shadow',
    make(app, rng) {
      const ab = app.doc.artboard;
      const grp = baseNode('group', { name: 'Torn paper', children: [] });
      grp.transform.x = ab.w / 2;
      grp.transform.y = ab.h / 2;
      const nodes = { [grp.id]: grp };
      for (let i = 0; i < 2; i++) {
        const s = makeShape('rect');
        s.geom.w = ab.w * rng.range(0.4, 0.7);
        s.geom.h = ab.h * rng.range(0.25, 0.45);
        s.transform.x = rng.signed() * ab.w * 0.08;
        s.transform.y = (i - 0.5) * ab.h * 0.22;
        s.transform.rot = rng.range(-8, 8);
        s.fill = solid(palettePick(app, rng, 0.55, 0.97));
        s.name = 'Sheet ' + (i + 1);
        s.effects = [
          fx('roughen', { amount: rng.range(4, 9), detail: rng.range(1.2, 2.5), jag: 0.8 }),
          fx('noiseTexture', { amount: 0.12, scale: 6, octaves: 3 }),
          fx('edgeLight', { angle: -120, width: 3, softness: 1, amount: 0.5, color: oklch(0.99, 0.01, 90) }),
          fx('shadow', { dx: 6, dy: 10, blur: 12, opacity: 0.35 }),
        ];
        s.parent = grp.id;
        grp.children.push(s.id);
        nodes[s.id] = s;
      }
      return { rootId: grp.id, nodes };
    },
  },

  cutShapes: {
    label: 'Cut shapes', hint: 'A combined shape: one form with others cut out of it',
    make(app, rng) {
      const ab = app.doc.artboard;
      const b = baseNode('bool', { name: 'Cut shapes', op: 'subtract', children: [], fill: solid(palettePick(app, rng, 0.3, 0.7)), stroke: null });
      b.transform.x = ab.w / 2 + rng.signed() * ab.w * 0.1;
      b.transform.y = ab.h / 2;
      const nodes = { [b.id]: b };
      const size = Math.min(ab.w, ab.h) * 0.45;
      const base = makeShape(rng.pick(['blob', 'squircle', 'ellipse']));
      base.geom.w = size * 1.3;
      base.geom.h = size;
      if (base.geom.kind === 'blob') base.geom.seed = newSeed();
      base.parent = b.id;
      nodes[base.id] = base;
      b.children.push(base.id);
      const n = rng.int(2, 6);
      for (let i = 0; i < n; i++) {
        const c = makeShape(rng.pick(['ellipse', 'rect', 'star', 'crescent', 'blob']));
        c.geom.w = size * rng.range(0.12, 0.4);
        if ('h' in c.geom) c.geom.h = c.geom.w * rng.range(0.6, 1.5);
        if (c.geom.kind === 'blob') c.geom.seed = newSeed();
        c.transform.x = rng.signed() * size * 0.5;
        c.transform.y = rng.signed() * size * 0.35;
        c.transform.rot = rng.range(0, 180);
        c.parent = b.id;
        nodes[c.id] = c;
        b.children.push(c.id);
      }
      b.effects = [fx('roughen', { amount: 2.5, detail: 2 }), fx('edgeLight', { angle: -135, width: 14, softness: 8, amount: 0.35 }), fx('innerShadow', { angle: 45, width: 30, softness: 20, amount: 0.35 })];
      return { rootId: b.id, nodes };
    },
  },
};

export function throwIn(app, kind) {
  const rng = new Rng(newSeed());
  const keys = Object.keys(THROWS);
  const list = kind === 'surprise' ? Array.from({ length: rng.int(3, 5) }, () => rng.pick(keys)) : [kind];
  app.store.begin(kind === 'surprise' ? 'Surprise me' : 'Throw in ' + THROWS[kind].label);
  const ids = [];
  for (const k of list) {
    const made = THROWS[k].make(app, rng);
    const parent = app.activeParent();
    if (made.rootId) {
      app.store.exec(app.store.insertSubtree(made, parent));
      ids.push(made.rootId);
    } else {
      app.store.exec({ op: 'insert', node: made, parent });
      ids.push(made.id);
    }
  }
  app.store.commit();
  app.select(ids);
}
