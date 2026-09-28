// Structures are the scaffolding of each layer. Each one lays down big masses (ridges,
// ground) and "slots" (places, sizes, angles) that the layer's shape vocabulary fills.
import { clamp, lerp, deg, lerpAngleRad, TAU } from './util.js';
import { chaikin, pointInPoly, ribbon } from './geom.js';

const R = (key, label, min, max, step, def, extra = {}) => ({ key, label, type: 'range', min, max, step, def, geo: true, ...extra });
const S = (key, label, options, def, extra = {}) => ({ key, label, type: 'select', options, def, geo: true, ...extra });
const B = (key, label, def, extra = {}) => ({ key, label, type: 'bool', def, geo: true, ...extra });

const GROUND_N = [0, -0.95, 0.3];

// Ground under a band: a gently waving flat plane that faces the sky. It darkens a little
// toward the viewer and can carry small texture marks that shrink with distance.
function ground(c, y, wave = 0.01) {
  const { W, H, noise, p } = c;
  const pts = [];
  const N = 60;
  for (let i = 0; i <= N; i++) {
    const x = lerp(-0.03 * W, 1.03 * W, i / N);
    pts.push([x, y + noise.fbm((x / W) * 3, 9.1, 3) * wave * H]);
  }
  pts.push([1.03 * W, H + 30], [-0.03 * W, H + 30]);
  c.mass(pts, { ob: c.newOb(), cl: c.newCl(), n3: GROUND_N, ground: true, grad: { y0: y, y1: H, from: 0.04, to: -0.07 } });
  groundMarks(c, y);
  return pts;
}

function groundMarks(c, y) {
  const { W, H, p } = c;
  const ob = c.newOb();
  const marks = Math.round(p.groundDetail || 0);
  if (marks > 0) {
    c.scope(ob, (r) => {
      for (let i = 0; i < marks; i++) {
        const t = Math.pow(r.next(), 0.7);
        const my = lerp(y + 4 * c.u, H, t);
        const sz = lerp(2, 9, t) * c.u * (p.groundMarkSize ?? 1);
        c.shape(r.range(0, W), my, sz, { ob, cl: ob, type: 'ellipse', aspect: r.range(3, 6), fixed: true, noWobble: true, detail: true, lOff: r.signed() * 0.05 });
      }
    });
  }
}

// Anchor list: generated places plus places the user clicked in ("extras").
// Ids stay fixed, so edits keyed on them survive changes elsewhere.
function withExtras(c, list) {
  return [...list.map((a, i) => ({ ...a, id: i + 1 })), ...c.extras];
}

// Top edge of a set of points at x (for placing things on a surface).
function surfaceAt(pts, x) {
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    if (x >= a[0] && x <= b[0]) return lerp(a[1], b[1], (x - a[0]) / (b[0] - a[0] || 1));
  }
  return pts[0][1];
}

// Walk along a ridge and keep only turns bigger than thr: peaks and valleys.
function zigzag(pts, thr) {
  const hgt = (i) => -pts[i][1];
  const ext = [0];
  let dir = 0, cand = 0, candH = hgt(0);
  const baseH = hgt(0);
  for (let i = 1; i < pts.length; i++) {
    const hi = hgt(i);
    if (dir === 0) {
      if (hi - baseH > thr) { dir = 1; cand = i; candH = hi; }
      else if (baseH - hi > thr) { dir = -1; cand = i; candH = hi; }
    } else if (dir === 1) {
      if (hi > candH) { cand = i; candH = hi; }
      else if (candH - hi > thr) { ext.push(cand); dir = -1; cand = i; candH = hi; }
    } else {
      if (hi < candH) { cand = i; candH = hi; }
      else if (hi - candH > thr) { ext.push(cand); dir = 1; cand = i; candH = hi; }
    }
  }
  if (cand > ext[ext.length - 1] && cand < pts.length - 1) ext.push(cand);
  ext.push(pts.length - 1);
  return ext;
}

function norm3(x, y, z) {
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
}

// ---------------------------------------------------------------------------------
const GD = [R('groundDetail', 'Ground marks', 0, 600, 1, 0), R('groundMarkSize', 'Ground mark size', 0.2, 4, 0.05, 1)];

export const KINDS = {
  sky: {
    label: 'Sky gradient',
    params: [
      { key: 'skyDrop', label: 'Top darkening', type: 'range', min: 0, max: 0.4, step: 0.01, def: 0.14 },
      { key: 'glow', label: 'Sun glow', type: 'range', min: 0, max: 1, step: 0.01, def: 0.6 },
      { key: 'glowSize', label: 'Glow size', type: 'range', min: 0.1, max: 1.5, step: 0.01, def: 0.5 },
      { key: 'sunDisc', label: 'Sun disc', type: 'range', min: 0, max: 1, step: 0.01, def: 0 },
    ],
    generate() {},
  },

  clouds: {
    label: 'Clouds',
    canAdd: true,
    params: [
      S('cloudType', 'Type', [['cumulus', 'Cumulus (heaped)'], ['stratus', 'Stratus (long bands)'], ['cirrus', 'Cirrus (wisps)']], 'cumulus'),
      R('count', 'Clouds', 0, 30, 1, 6),
      R('yTop', 'Band top', 0, 1, 0.01, 0.06),
      R('yBottom', 'Band bottom', 0, 1, 0.01, 0.38),
      R('cloudSize', 'Cloud size', 10, 300, 1, 80),
      R('stretch', 'Stretch', 0.5, 6, 0.05, 2.2),
      R('puffs', 'Puffs per cloud', 2, 60, 1, 12),
      R('puffSize', 'Puff size', 0.2, 1.5, 0.01, 0.55),
      R('flatBottom', 'Flat bottom', 0, 1, 0.01, 0.6),
      R('perspective', 'Shrink toward horizon', 0, 0.9, 0.01, 0.55),
    ],
    generate(c) {
      const { p, W, H, u } = c;
      const list = [];
      for (let i = 0; i < p.count; i++) list.push({ x: c.rng.range(-0.1, 1.1) * W, y: lerp(p.yTop, p.yBottom, c.rng.next()) * H });
      const clouds = withExtras(c, list).sort((a, b) => b.y - a.y);
      for (const cl of clouds) {
        c.scope(cl.id, (rng) => {
          const t = clamp((cl.y / H - p.yTop) / Math.max(0.01, p.yBottom - p.yTop));
          const size = p.cloudSize * u * lerp(1, 1 - p.perspective, t) * rng.range(0.6, 1.4);
          const ob = cl.id;
          if (p.cloudType === 'cirrus') {
            // Wisps: thin curved strokes swept sideways.
            const n = Math.max(2, Math.round(p.puffs / 2));
            for (let k = 0; k < n; k++) {
              const len = size * p.stretch * rng.range(0.6, 1.4);
              const x0 = cl.x + rng.gauss() * size, y0 = cl.y + rng.gauss() * size * 0.3;
              const pts = [], ws = [];
              for (let j = 0; j <= 12; j++) {
                const tt = j / 12;
                pts.push([x0 + len * tt, y0 - Math.sin(tt * Math.PI) * size * 0.25 * rng.range(0.5, 1) + tt * tt * size * 0.2]);
                ws.push(size * 0.12 * Math.sin(Math.PI * tt) + 0.5);
              }
              c.branch(pts, ws, { ob, cl: ob });
            }
            return;
          }
          const halfW = size * p.stretch * (p.cloudType === 'stratus' ? 1.8 : 1);
          const base = cl.y + size * 0.15;
          const flat = p.cloudType === 'stratus' ? Math.max(0.85, p.flatBottom) : p.flatBottom;
          if (flat > 0) {
            const ry = size * 0.28 * (1 - flat * 0.5);
            c.shape(cl.x, base - ry * 0.6, halfW * 0.85, { ob, cl: ob, type: 'ellipse', aspect: (halfW * 0.85) / ry, fixed: true });
          }
          const puffs = [];
          const hMul = p.cloudType === 'stratus' ? 0.35 : 1;
          for (let k = 0; k < p.puffs; k++) {
            const dx = clamp(rng.gauss() * 0.42, -1, 1) * halfW;
            const edge = 1 - Math.abs(dx) / halfW;
            const r = size * p.puffSize * (0.4 + 0.6 * edge) * rng.range(0.7, 1.2) * (p.cloudType === 'stratus' ? 0.6 : 1);
            let y = cl.y - Math.abs(rng.gauss()) * size * 0.4 * edge * hMul - size * 0.05;
            y = Math.min(y, base - r * flat);
            puffs.push([cl.x + dx, y, r]);
          }
          puffs.sort((a, b) => b[1] - a[1]);
          for (const [x, y, r] of puffs) {
            c.shape(x, y, r, { ob, cl: ob });
            c.debug.points.push([x, y, r]);
          }
          c.debug.lines.push([[cl.x - halfW, base], [cl.x + halfW, base]]);
        });
      }
    },
  },

  ridge: {
    label: 'Mountain ridge',
    params: [
      R('baseY', 'Base line', 0.2, 1, 0.005, 0.56),
      R('height', 'Height', 0, 0.6, 0.005, 0.22),
      R('frequency', 'Peaks across', 0.5, 12, 0.1, 3),
      R('roughness', 'Roughness', 0.2, 0.8, 0.01, 0.5),
      R('sharp', 'Sharp crests', 0, 1, 0.01, 0.6),
      R('mesa', 'Flat tops (mesa)', 0, 1, 0.01, 0),
      B('facets', 'Split into lit/shadow planes', true),
      R('facetDetail', 'Plane detail', 0, 1, 0.01, 0.45),
      R('facetFade', 'Planes fade toward base', 0, 1, 0.01, 0.7),
      R('spurLean', 'Spur lean', -1, 1, 0.01, 0.2),
      R('snow', 'Snow caps', 0, 1, 0.01, 0),
      R('scatter', 'Scatter shapes', 0, 400, 1, 0),
      R('scatterSize', 'Scatter size', 1, 40, 0.5, 5),
      R('scatterDepth', 'Scatter depth', 0.01, 0.3, 0.005, 0.08),
      R('scatterValue', 'Scatter value shift', -0.4, 0.4, 0.01, -0.08),
    ],
    generate(c) {
      const { p, W, H, rng, noise } = c;
      const N = 200;
      const pts = [];
      for (let i = 0; i <= N; i++) {
        const x = lerp(-0.03 * W, 1.03 * W, i / N);
        const nx = (x / W) * p.frequency;
        const soft = noise.fbm(nx, 3.7, 5, 2, p.roughness) * 0.5 + 0.5;
        const hard = noise.ridged(nx + 11.3, 1.9, 5, 2, p.roughness);
        let f = clamp((lerp(soft, hard, p.sharp) - 0.2) / 0.65);
        if (p.mesa > 0) { const cap = 1 - p.mesa * 0.55; f = f > cap ? cap + (f - cap) * 0.08 : f; f /= cap + (1 - cap) * 0.08; }
        pts.push([x, p.baseY * H - p.height * H * f]);
      }
      const bottom = H + 30;
      const sil = [...pts, [1.03 * W, bottom], [-0.03 * W, bottom]];
      let facets = null;
      if (p.facets) {
        const thr = p.height * H * lerp(0.35, 0.03, p.facetDetail) + 1;
        const ext = zigzag(pts, thr);
        const spurs = ext.map((e, k) => {
          const [x, y] = pts[e];
          const gap = k > 0 ? pts[e][0] - pts[ext[k - 1]][0] : W * 0.2;
          const lean = (p.spurLean + rng.signed() * 0.3) * gap * 0.35;
          const midY = lerp(y, p.baseY * H, 0.55);
          return [[x, y], [x + lean * 0.5 + rng.signed() * gap * 0.05, midY], [x + lean, p.baseY * H + (bottom - p.baseY * H) * 0.3], [x + lean, bottom]];
        });
        facets = [];
        for (let k = 0; k < ext.length - 1; k++) {
          const a = ext[k], b = ext[k + 1];
          const poly = pts.slice(a, b + 1).map((q) => [q[0], q[1]]);
          for (const q of spurs[k + 1].slice(1)) poly.push([q[0], q[1]]);
          for (const q of spurs[k].slice(1).reverse()) poly.push([q[0], q[1]]);
          const s = (pts[b][1] - pts[a][1]) / (pts[b][0] - pts[a][0] || 1);
          facets.push({ poly, n3: norm3(s * 1.4 + rng.signed() * 0.15, -1, 0.9) });
          c.debug.lines.push(spurs[k].slice(0, 2));
        }
      }
      const top = Math.min(...pts.map((q) => q[1]));
      const fade = p.facets && p.facetFade > 0 ? { y0: lerp(p.baseY * H, top, p.facetFade), y1: p.baseY * H } : null;
      c.mass(sil, { ob: c.newOb(), cl: c.newCl(), facets, fade });
      c.debug.lines.push(pts);
      if (p.snow > 0) {
        // Snow: the part of each peak above a snow line, with a ragged lower edge.
        const line = lerp(p.baseY * H, top, 1 - p.snow * 0.6);
        let run = [];
        const flush = () => {
          if (run.length > 2) {
            const lower = run.map(([x]) => [x, line + noise.fbm(x / W * 30, 4.4, 2) * p.height * H * 0.12]).reverse();
            c.mass([...run, ...lower], { ob: c.newOb(), cl: c.newCl(), n3: norm3(0, -0.6, 1), lOff: 0.3, col: 'snow', round: 0 });
          }
          run = [];
        };
        for (const q of pts) (q[1] < line ? run.push([q[0], q[1]]) : flush());
        flush();
      }
      for (let i = 0; i < p.scatter; i++) {
        const x = rng.range(0, W);
        const y = surfaceAt(pts, x) + rng.range(0.004, p.scatterDepth) * H;
        if (y > H) continue;
        c.shape(x, y, p.scatterSize * c.u * rng.range(0.6, 1.4), { ob: c.newOb(), cl: c.newCl(), lOff: p.scatterValue });
      }
    },
  },

  hills: {
    label: 'Rolling hills',
    params: [
      R('baseY', 'Base line', 0.2, 1.1, 0.005, 0.64),
      R('height', 'Height', 0, 0.4, 0.005, 0.09),
      R('bumps', 'Bumps', 1, 16, 1, 4),
      R('bumpVar', 'Height variety', 0, 1, 0.01, 0.5),
      R('overlap', 'Width', 0.2, 2, 0.01, 0.8),
      R('lumpy', 'Lumpiness', 0, 1, 0.01, 0.3),
      B('ground', 'Ground plane', true),
      ...GD,
      R('scatter', 'Scatter shapes', 0, 600, 1, 0),
      R('scatterSize', 'Scatter size', 1, 40, 0.5, 7),
      R('scatterDepth', 'Scatter depth', 0.005, 0.3, 0.005, 0.06),
      R('scatterCluster', 'Scatter per clump', 1, 10, 1, 3),
      R('scatterValue', 'Scatter value shift', -0.4, 0.4, 0.01, -0.1),
    ],
    generate(c) {
      const { p, W, H, rng, noise } = c;
      const baseY = p.baseY * H;
      const surface = [];
      const gpts = p.ground ? ground(c, baseY, 0.006) : null;
      const k = Math.max(1, Math.round(p.bumps));
      const bumps = [];
      for (let i = 0; i < k; i++) {
        const cx = lerp(-0.1, 1.1, (i + 0.5 + rng.signed() * 0.35) / k) * W;
        const halfw = ((W * 1.2) / k) * p.overlap * rng.range(0.8, 1.25);
        const peak = p.height * H * rng.range(1 - p.bumpVar, 1);
        bumps.push({ cx, halfw, peak });
      }
      bumps.sort((a, b) => b.peak - a.peak);
      for (const bmp of bumps) {
        const pts = [];
        const n = 48;
        for (let i = 0; i <= n; i++) {
          const x = bmp.cx - bmp.halfw + (2 * bmp.halfw * i) / n;
          const t = (x - bmp.cx) / bmp.halfw;
          const prof = Math.pow(Math.cos((t * Math.PI) / 2), 2);
          const lump = noise.fbm((x / W) * 6, bmp.cx * 0.01, 3) * p.lumpy * 0.35;
          pts.push([x, baseY - bmp.peak * prof * (1 + lump)]);
        }
        surface.push(pts);
        const bottom = p.ground ? baseY + 0.01 * H : H + 30;
        const poly = [...pts, [bmp.cx + bmp.halfw, bottom], [bmp.cx - bmp.halfw, bottom]];
        const fade = p.ground ? { y0: baseY - bmp.peak * 0.35, y1: baseY, n3: GROUND_N } : null;
        c.mass(poly, { ob: c.newOb(), cl: c.newCl(), vol: { cx: bmp.cx, cy: baseY - bmp.peak * 0.4, r: Math.max(bmp.halfw * 0.7, bmp.peak) }, round: 1, fade });
        c.debug.lines.push(pts);
      }
      const topAt = (x) => {
        let y = gpts ? surfaceAt(gpts, x) : baseY;
        for (const s of surface) if (x >= s[0][0] && x <= s[s.length - 1][0]) y = Math.min(y, surfaceAt(s, x));
        return y;
      };
      const per = Math.max(1, Math.round(p.scatterCluster));
      for (let i = 0; i < p.scatter; i += per) {
        const x = rng.range(0, W);
        const y = topAt(x) + rng.range(0.004, p.scatterDepth) * H;
        const cl = c.newCl();
        const ob = c.newOb();
        const sz = p.scatterSize * c.u * lerp(0.7, 1.3, clamp((y - baseY + p.height * H) / (p.height * H + 1)));
        for (let j = 0; j < per; j++) c.shape(x + rng.gauss() * sz * 0.9, y + rng.gauss() * sz * 0.3, sz * rng.range(0.6, 1.2), { ob, cl, lOff: p.scatterValue });
      }
    },
  },

  trees: {
    label: 'Trees (point extrusion)',
    canAdd: true,
    params: [
      S('form', 'Form', [['broadleaf', 'Broadleaf'], ['conifer', 'Conifer'], ['poplar', 'Poplar'], ['willow', 'Willow (weeping)'], ['palm', 'Palm'], ['shrub', 'Shrub'], ['bare', 'Bare branches'], ['lsystem', 'Rule-grown (L-system)']], 'broadleaf', { rebuild: true }),
      S('lsRule', 'Growth rule', [['plant', 'Plant'], ['bush', 'Bush'], ['sparse', 'Sparse tree'], ['weed', 'Weed'], ['custom', 'Custom']], 'sparse', { show: (l) => l.p.form === 'lsystem', rebuild: true }),
      { key: 'lsCustom', label: 'Custom rule', type: 'text', def: 'X=F[+X][-X]FX;F=FF', geo: true, show: (l) => l.p.form === 'lsystem' && l.p.lsRule === 'custom', help: 'F draws, + and - turn, [ ] branch off. Rules as A=replacement separated by ;' },
      R('count', 'Trees', 0, 60, 1, 3),
      R('x0', 'From x', 0, 1, 0.01, 0.05),
      R('x1', 'To x', 0, 1, 0.01, 0.95),
      R('baseY', 'Base line', 0.2, 1.1, 0.005, 0.9),
      R('baseJitter', 'Base scatter', 0, 0.2, 0.002, 0.03),
      R('height', 'Height', 0.02, 1, 0.005, 0.38),
      R('heightJitter', 'Height variety', 0, 0.8, 0.01, 0.25),
      R('trunk', 'Trunk width', 0.5, 60, 0.5, 12),
      R('lean', 'Lean', -1, 1, 0.01, 0),
      R('levels', 'Branch levels', 1, 7, 1, 4),
      R('children', 'Branches per node', 1, 4, 1, 2),
      R('branchAngle', 'Branch angle', 0, 90, 1, 28),
      R('decay', 'Length decay', 0.4, 0.95, 0.01, 0.72),
      R('upward', 'Reach upward', 0, 1, 0.01, 0.35),
      R('wander', 'Wander', 0, 40, 0.5, 10),
      R('foliage', 'Foliage clump size', 2, 150, 0.5, 34),
      R('density', 'Shapes per clump', 0, 40, 1, 6),
      R('foliageSpread', 'Clump spread', 0.2, 2.5, 0.01, 1),
      R('midFoliage', 'Foliage on inner nodes', 0, 1, 0.01, 0.35),
      B('ground', 'Ground plane', true),
      ...GD,
    ],
    generate(c) {
      const { p, W, H } = c;
      if (p.ground) ground(c, (p.baseY - p.baseJitter - 0.01) * H, 0.008);
      const n = Math.round(p.count);
      const list = [];
      for (let i = 0; i < n; i++) {
        const t = n === 1 ? 0.5 : i / (n - 1);
        const span = (p.x1 - p.x0) / Math.max(1, n);
        list.push({ x: (lerp(p.x0, p.x1, t) + c.rng.signed() * span * 0.35) * W, y: p.baseY * H + c.rng.signed() * p.baseJitter * H });
      }
      const trees = withExtras(c, list).sort((a, b) => a.y - b.y);
      for (const tr of trees) {
        c.scope(tr.id, (rng) => {
          const sc = Math.pow(tr.y / (p.baseY * H), 3);
          const ht = p.height * H * sc * (1 + p.heightJitter * rng.signed());
          growTree(c, rng, tr.x, tr.y, ht, sc, tr.id);
        });
      }
    },
  },

  clusters: {
    label: 'Clusters (bushes, rocks)',
    canAdd: true,
    params: [
      R('count', 'Clusters', 0, 80, 1, 10),
      R('x0', 'From x', 0, 1, 0.01, 0),
      R('x1', 'To x', 0, 1, 0.01, 1),
      R('yTop', 'Band top', 0, 1.1, 0.005, 0.74),
      R('yBottom', 'Band bottom', 0, 1.1, 0.005, 0.82),
      R('clusterSize', 'Cluster size', 3, 200, 0.5, 34),
      R('perCluster', 'Shapes per cluster', 1, 40, 1, 6),
      R('spread', 'Spread', 0.2, 2.5, 0.01, 1),
      R('flat', 'Flatness', 0, 1, 0.01, 0.4),
      R('perspective', 'Shrink with distance', 0, 0.95, 0.01, 0.5),
      B('ground', 'Ground plane', true),
      ...GD,
    ],
    generate(c) {
      const { p, W, H, u } = c;
      if (p.ground) ground(c, (p.yTop - 0.015) * H, 0.006);
      const list = [];
      for (let i = 0; i < p.count; i++) list.push({ x: c.rng.range(p.x0, p.x1) * W, y: lerp(p.yTop, p.yBottom, c.rng.next()) * H });
      const centers = withExtras(c, list).sort((a, b) => a.y - b.y);
      for (const cc of centers) {
        c.scope(cc.id, (rng) => {
          const t = clamp((cc.y / H - p.yTop) / Math.max(0.01, p.yBottom - p.yTop));
          const Rr = p.clusterSize * u * lerp(1 - p.perspective, 1, t);
          const ob = cc.id;
          const shapes = [];
          for (let k = 0; k < p.perCluster; k++) {
            const dx = rng.gauss() * Rr * 0.55 * p.spread;
            const edge = clamp(1 - Math.abs(dx) / (Rr * 1.6 * p.spread));
            const size = Rr * rng.range(0.35, 0.7) * (0.55 + 0.45 * edge);
            const dy = -Math.abs(rng.gauss()) * Rr * 0.45 * (1 - p.flat) * edge;
            shapes.push([cc.x + dx, Math.min(cc.y + dy, cc.y + size * 0.1), size]);
          }
          shapes.sort((a, b) => a[1] - b[1]);
          for (const [x, y, s] of shapes) c.shape(x, y - s * 0.4, s, { ob, cl: ob });
          c.debug.points.push([cc.x, cc.y, Rr]);
        });
      }
    },
  },

  grass: {
    label: 'Grass tufts',
    canAdd: true,
    params: [
      R('count', 'Tufts', 0, 300, 1, 40),
      R('x0', 'From x', 0, 1, 0.01, 0),
      R('x1', 'To x', 0, 1, 0.01, 1),
      R('yTop', 'Band top', 0, 1.2, 0.005, 0.9),
      R('yBottom', 'Band bottom', 0, 1.2, 0.005, 1.03),
      R('bladeHeight', 'Blade height', 5, 400, 1, 70),
      R('blades', 'Blades per tuft', 1, 30, 1, 7),
      R('bladeWidth', 'Blade width', 1, 40, 0.5, 6),
      R('spreadAngle', 'Fan angle', 0, 80, 1, 24),
      R('lean', 'Wind lean', -1, 1, 0.01, 0.15),
      R('curl', 'Curl', 0, 1.5, 0.01, 0.45),
      R('flowers', 'Flowers', 0, 1, 0.01, 0),
      R('flowerSize', 'Flower size', 1, 40, 0.5, 6),
      B('ground', 'Ground plane', true),
      ...GD,
    ],
    generate(c) {
      const { p, W, H, u } = c;
      if (p.ground) ground(c, (p.yTop - 0.01) * H, 0.004);
      const list = [];
      for (let i = 0; i < p.count; i++) list.push({ x: c.rng.range(p.x0, p.x1) * W, y: lerp(p.yTop, p.yBottom, c.rng.next()) * H });
      const tufts = withExtras(c, list).sort((a, b) => a.y - b.y);
      for (const tf of tufts) {
        c.scope(tf.id, (rng) => {
          const t = clamp((tf.y / H - p.yTop) / Math.max(0.01, p.yBottom - p.yTop));
          const sc = lerp(0.55, 1.1, t);
          const ob = tf.id;
          for (let b = 0; b < p.blades; b++) {
            const ang = p.lean * 0.9 + deg(rng.signed() * p.spreadAngle);
            const hgt = p.bladeHeight * u * sc * rng.range(0.5, 1.1);
            const x = tf.x + rng.signed() * p.bladeWidth * u * 1.5;
            const bend = p.curl * (ang >= 0 ? 1 : -1) * rng.range(0.4, 1);
            const tip = blade(c, rng, x, tf.y, hgt, p.bladeWidth * u * sc * rng.range(0.7, 1.2), ang, bend, ob);
            if (p.flowers > 0 && rng.chance(p.flowers * 0.35)) c.shape(tip[0], tip[1], p.flowerSize * u * sc, { ob, cl: ob, col: 'accent' });
          }
        });
      }
    },
  },

  branch: {
    label: 'Framing branch',
    params: [
      S('side', 'Enters from', [['right', 'Right edge'], ['left', 'Left edge'], ['top', 'Top edge']], 'right'),
      R('anchor', 'Entry point', 0, 1, 0.01, 0.12),
      R('reach', 'Reach', 0.05, 1.2, 0.01, 0.5),
      R('thickness', 'Thickness', 2, 120, 0.5, 30),
      R('levels', 'Branch levels', 1, 5, 1, 3),
      R('twigs', 'Twigs per node', 1, 5, 1, 3),
      R('branchAngle', 'Twig angle', 5, 80, 1, 38),
      R('droop', 'Droop', 0, 1, 0.01, 0.25),
      R('wander', 'Wander', 0, 40, 0.5, 8),
      R('leafSize', 'Leaf size', 2, 120, 0.5, 18),
      R('leafDensity', 'Leaves per twig', 0, 40, 1, 9),
      R('leafAlong', 'Leaves along twigs', 0, 1, 0.01, 0.7),
    ],
    generate(c) {
      const { p, W, H, u, rng } = c;
      let x, y, a;
      if (p.side === 'right') { x = W + 30; y = p.anchor * H; a = Math.PI - 0.12; }
      else if (p.side === 'left') { x = -30; y = p.anchor * H; a = 0.12; }
      else { x = p.anchor * W; y = -30; a = Math.PI / 2 + (p.anchor > 0.5 ? 0.5 : -0.5); }
      const ob = 1;
      const leaves = [];
      const down = Math.PI / 2;
      const addLeaves = (x, y, a, count, cl) => {
        for (let k = 0; k < count; k++) {
          const la = a + rng.signed() * 1.2;
          const s = p.leafSize * u * rng.range(0.6, 1.2);
          leaves.push([x + Math.cos(la) * s * 0.9, y + Math.sin(la) * s * 0.9, s, la, cl]);
        }
      };
      const grow = (x, y, a, len, w, level, cl) => {
        const steps = 6;
        const pts = [[x, y]], ws = [w];
        let px = x, py = y;
        for (let s = 0; s < steps; s++) {
          a += deg(rng.signed() * p.wander);
          a = lerpAngleRad(a, down, p.droop * 0.08 * level);
          px += (Math.cos(a) * len) / steps;
          py += (Math.sin(a) * len) / steps;
          pts.push([px, py]);
          ws.push(w * (1 - (0.6 * (s + 1)) / steps));
          if (level > 1 && rng.chance(p.leafAlong * 0.6)) addLeaves(px, py, a, Math.max(1, Math.round(p.leafDensity * 0.35)), cl);
        }
        c.branch(pts, ws, { ob, cl, col: 'trunk' });
        c.debug.lines.push(pts);
        if (level >= p.levels) { addLeaves(px, py, a, p.leafDensity, cl); return; }
        const n = Math.round(p.twigs);
        for (let k = 0; k < n; k++) {
          const side = k % 2 ? 1 : -1;
          const at = rng.range(0.3, 1);
          const i = Math.min(steps, Math.round(at * steps));
          grow(pts[i][0], pts[i][1], a + side * deg(p.branchAngle * rng.range(0.6, 1.2)), len * rng.range(0.45, 0.65), ws[i] * 0.7 + 0.8, level + 1, c.newCl());
        }
      };
      grow(x, y, a, p.reach * W * 0.6, p.thickness * u, 1, c.newCl());
      for (const [lx, ly, s, la, cl] of leaves) c.shape(lx, ly, s, { ob, cl, angle: la });
    },
  },

  rows: {
    label: 'Fields, hedges & fences',
    params: [
      R('rows', 'Rows', 1, 30, 1, 7),
      R('yTop', 'Far edge', 0, 1.1, 0.005, 0.7),
      R('yBottom', 'Near edge', 0, 1.2, 0.005, 0.95),
      R('perspective', 'Rows widen toward you', 1, 2.5, 0.01, 1.35),
      R('tilt', 'Tilt', -0.3, 0.3, 0.005, 0.03),
      R('wave', 'Wavy edges', 0, 0.05, 0.001, 0.01),
      B('fields', 'Field strips', true),
      R('fieldContrast', 'Strip contrast', 0, 0.3, 0.005, 0.06),
      B('hedges', 'Hedges along edges', true),
      R('hedgeSize', 'Hedge shape size', 1, 60, 0.5, 10),
      R('hedgeGaps', 'Hedge gaps', 0, 1, 0.01, 0.25),
      B('fence', 'Fence on the near edge', false),
      R('postGap', 'Fence post gap', 10, 200, 1, 60),
      ...GD,
    ],
    generate(c) {
      const { p, W, H, u, noise } = c;
      const n = Math.max(1, Math.round(p.rows));
      const r = p.perspective;
      const T = (k) => (r === 1 ? k / n : (Math.pow(r, k) - 1) / (Math.pow(r, n) - 1));
      const edge = (k) => {
        const yb = lerp(p.yTop, p.yBottom, T(k)) * H;
        const pts = [];
        for (let i = 0; i <= 40; i++) {
          const x = lerp(-0.03, 1.03, i / 40) * W;
          pts.push([x, yb + (x / W - 0.5) * p.tilt * H * (1 - T(k) * 0.5) + noise.fbm((x / W) * 4, k * 3.1, 2) * p.wave * H]);
        }
        return pts;
      };
      const edges = [];
      for (let k = 0; k <= n; k++) edges.push(edge(k));
      if (p.fields) {
        for (let k = 0; k < n; k++) {
          c.scope(k + 1, (rng) => {
            const poly = [...edges[k], ...(k === n - 1 ? [[1.03 * W, H + 30], [-0.03 * W, H + 30]] : [...edges[k + 1]].reverse())];
            c.mass(poly, { ob: k + 1, cl: k + 1, n3: GROUND_N, lOff: (k % 2 ? 1 : -1) * p.fieldContrast * rng.range(0.4, 1), ground: k === n - 1 });
          });
        }
      }
      if (p.hedges) {
        for (let k = 1; k <= n; k++) {
          c.scope(500 + k, (rng) => {
            const e = edges[k];
            const sz = p.hedgeSize * u * lerp(0.35, 1.2, T(k));
            let x = -10;
            while (x < W + 10) {
              const y = surfaceAt(e, x);
              if (!rng.chance(p.hedgeGaps)) c.shape(x, y - sz * 0.5, sz * rng.range(0.7, 1.2), { ob: 500 + k, cl: 500 + k });
              x += sz * rng.range(0.7, 1.3);
            }
          });
        }
      }
      if (p.fence) {
        c.scope(900, (rng) => {
          const e = edges[n].map((q) => [q[0], q[1] - 0.01 * H]);
          const ph = 38 * u, pw = 4 * u;
          for (const off of [0.35, 0.75]) c.branch(e.map((q) => [q[0], q[1] - ph * off]), e.map(() => 2.5 * u), { ob: 900, cl: 900, col: 'trunk' });
          for (let x = rng.range(0, p.postGap) * u; x < W; x += p.postGap * u * rng.range(0.9, 1.1)) {
            const y = surfaceAt(e, x);
            c.branch([[x, y + 4 * u], [x + rng.signed() * 2 * u, y - ph]], [pw, pw * 0.8], { ob: 900, cl: 900, col: 'trunk' });
          }
        });
      }
      groundMarks(c, edges[0][20][1]);
      for (const e of edges) c.debug.lines.push(e);
    },
  },

  path: {
    label: 'River or road',
    params: [
      S('style', 'Style', [['river', 'River'], ['road', 'Road / path']], 'river'),
      R('startX', 'Far end x', 0, 1, 0.005, 0.55),
      R('startY', 'Far end y', 0, 1.1, 0.005, 0.66),
      R('endX', 'Near end x', -0.2, 1.2, 0.005, 0.7),
      R('endY', 'Near end y', 0.5, 1.2, 0.005, 1.05),
      R('startWidth', 'Far width', 0, 0.2, 0.001, 0.01),
      R('endWidth', 'Near width', 0.01, 1, 0.005, 0.35),
      R('meander', 'Meander', 0, 0.5, 0.005, 0.12),
      R('meanderFreq', 'Bends', 0.2, 6, 0.05, 1.6),
      R('streaks', 'Surface streaks', 0, 200, 1, 40),
      R('banks', 'Shapes along banks', 0, 300, 1, 40),
      R('bankSize', 'Bank shape size', 1, 60, 0.5, 12),
    ],
    generate(c) {
      const { p, W, H, u, noise } = c;
      const N = 60;
      const centre = [], widths = [];
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        const tp = Math.pow(t, 1.6);
        const y = lerp(p.startY, p.endY, tp) * H;
        const x = lerp(p.startX, p.endX, tp) * W + noise.fbm(t * p.meanderFreq * 2, 5.5, 2) * p.meander * W * Math.pow(t, 0.8);
        centre.push([x, y]);
        widths.push(Math.max(1, lerp(p.startWidth, p.endWidth, Math.pow(t, 1.8)) * W));
      }
      // Lying on the ground, so the width runs straight across the picture.
      const poly = [...centre.map((q, i) => [q[0] - widths[i] / 2, q[1]]), ...centre.map((q, i) => [q[0] + widths[i] / 2, q[1]]).reverse()];
      const river = p.style === 'river';
      c.mass(poly, { ob: 1, cl: 1, n3: river ? norm3(0, -1, 0.2) : GROUND_N, lOff: river ? 0.06 : 0.03, ground: true, grad: { y0: p.startY * H, y1: p.endY * H, from: 0.05, to: -0.05 } });
      c.debug.lines.push(centre);
      c.scope(2, (rng) => {
        for (let i = 0; i < p.streaks; i++) {
          const t = Math.pow(rng.next(), 0.8);
          const k = Math.min(N, Math.round(t * N));
          const w = widths[k];
          const x = centre[k][0] + rng.signed() * w * 0.35, y = centre[k][1];
          c.shape(x, y, Math.max(1, w * rng.range(0.05, 0.18)), { ob: 2, cl: 2, type: 'ellipse', aspect: rng.range(5, 10), fixed: true, noWobble: true, detail: true, lOff: river ? 0.1 : -0.04 });
        }
      });
      c.scope(3, (rng) => {
        for (let i = 0; i < p.banks; i++) {
          const t = Math.pow(rng.next(), 0.7);
          const k = Math.min(N, Math.round(t * N));
          const side = rng.chance(0.5) ? 1 : -1;
          const x = centre[k][0] + side * widths[k] * rng.range(0.45, 0.6), y = centre[k][1];
          const sz = p.bankSize * u * lerp(0.25, 1.3, t);
          c.shape(x, y - sz * 0.3, sz * rng.range(0.6, 1.2), { ob: 3, cl: 300 + k, col: 'accent' });
        }
      });
    },
  },

  water: {
    label: 'Water (reflection)',
    params: [
      { key: 'waterY', label: 'Water line', type: 'range', min: 0.2, max: 1, step: 0.002, def: 0.7 },
      { key: 'reflect', label: 'Reflection strength', type: 'range', min: 0, max: 1, step: 0.01, def: 0.65 },
      { key: 'ripple', label: 'Ripple', type: 'range', min: 0, max: 40, step: 0.5, def: 6 },
      { key: 'rippleScale', label: 'Ripple scale', type: 'range', min: 0.2, max: 6, step: 0.05, def: 1.5 },
      { key: 'streakCount', label: 'Wind streaks', type: 'range', min: 0, max: 60, step: 1, def: 14 },
      { key: 'glints', label: 'Glints', type: 'range', min: 0, max: 300, step: 1, def: 50 },
    ],
    generate() {},
  },

  drawn: {
    label: 'Drawn shapes',
    params: [
      S('fill', 'Fill with', [['both', 'Mass plus shapes'], ['mass', 'Solid mass'], ['shapes', 'Shapes only']], 'both'),
      R('smooth', 'Smooth outline', 0, 4, 1, 2),
      R('fillDensity', 'Shape density', 0, 3, 0.01, 1),
      R('fillSize', 'Shape size', 2, 120, 0.5, 18),
      R('fringe', 'Shapes along the edge', 0, 3, 0.01, 1),
      R('massRound', 'Mass roundness', 0, 1, 0.01, 1),
    ],
    generate(c) {
      const { p, W, H, u } = c;
      (p.drawn || []).forEach((raw, i) => {
        const id = i + 1;
        c.scope(id, (rng) => {
          const poly = chaikin(raw.map(([x, y]) => [x * W, y * H]), Math.round(p.smooth));
          if (poly.length < 3) return;
          const b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
          for (const [x, y] of poly) { b.x0 = Math.min(b.x0, x); b.y0 = Math.min(b.y0, y); b.x1 = Math.max(b.x1, x); b.y1 = Math.max(b.y1, y); }
          if (p.fill !== 'shapes') {
            const r = Math.max(b.x1 - b.x0, b.y1 - b.y0) / 2;
            c.mass(poly, { ob: id, cl: id, round: p.massRound, vol: { cx: (b.x0 + b.x1) / 2, cy: (b.y0 + b.y1) / 2, r } });
          }
          if (p.fill === 'mass') return;
          const sz = p.fillSize * u;
          const area = (b.x1 - b.x0) * (b.y1 - b.y0);
          const n = Math.min(900, Math.round((area / (sz * sz)) * 0.6 * p.fillDensity));
          const pts = [];
          for (let k = 0, tries = 0; k < n && tries < n * 6; tries++) {
            const x = rng.range(b.x0, b.x1), y = rng.range(b.y0, b.y1);
            if (pointInPoly(x, y, poly)) { pts.push([x, y]); k++; }
          }
          // Fringe: shapes riding the outline so the edge breaks up.
          const edgePts = [];
          let acc = 0;
          for (let k = 0; k < poly.length && p.fringe > 0; k++) {
            const a = poly[k], q = poly[(k + 1) % poly.length];
            acc += Math.hypot(q[0] - a[0], q[1] - a[1]);
            if (acc > sz / p.fringe) { acc = 0; edgePts.push([a[0], a[1]]); }
          }
          pts.sort((a, b2) => a[1] - b2[1]);
          for (const [x, y] of [...pts, ...edgePts]) c.shape(x, y, sz * rng.range(0.6, 1.1), { ob: id, cl: id });
          c.debug.lines.push([...poly, poly[0]]);
        });
      });
    },
  },
};

// A grass blade: a curved, tapering strip from base to tip.
function blade(c, rng, x, y, h, w, ang, bend, ob) {
  const n = 10;
  const p0 = [x, y];
  const p1 = [x + Math.sin(ang) * h * 0.5, y - Math.cos(ang) * h * 0.5];
  const p2 = [x + Math.sin(ang + bend) * h, y - Math.cos(ang + bend) * h];
  const left = [], right = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, mt = 1 - t;
    const bx = mt * mt * p0[0] + 2 * mt * t * p1[0] + t * t * p2[0];
    const by = mt * mt * p0[1] + 2 * mt * t * p1[1] + t * t * p2[1];
    const tx = 2 * mt * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0]);
    const ty = 2 * mt * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1]);
    const l = Math.hypot(tx, ty) || 1;
    const nx = -ty / l, ny = tx / l;
    const wt = (w / 2) * Math.pow(1 - t, 0.8);
    left.push([bx + nx * wt, by + ny * wt]);
    right.push([bx - nx * wt, by - ny * wt]);
  }
  const poly = [...left, ...right.reverse()];
  const tilt = Math.sin(ang + bend * 0.5);
  c.mass(poly, { ob, cl: ob, n3: norm3(tilt * 0.9 + rng.signed() * 0.3, -0.35, 1), blade: true });
  return p2;
}

const LS_RULES = {
  plant: { axiom: 'X', rules: { X: 'F+[[X]-X]-F[-FX]+X', F: 'FF' }, angle: 25 },
  bush: { axiom: 'F', rules: { F: 'FF+[+F-F-F]-[-F+F+F]' }, angle: 22 },
  sparse: { axiom: 'X', rules: { X: 'F[+X][-X]FX', F: 'FF' }, angle: 26 },
  weed: { axiom: 'F', rules: { F: 'F[+F]F[-F]F' }, angle: 26 },
};
function parseRules(text) {
  const rules = {};
  for (const part of String(text || '').split(';')) {
    const [a, b] = part.split('=');
    if (a && b !== undefined && a.trim().length === 1) rules[a.trim()] = b.trim();
  }
  return rules;
}

// Rule-grown tree: rewrite a string of drawing commands a few times, then walk it with a
// turtle. Each [ ... ] becomes a separate branch shape; branch ends carry foliage.
function lsystemTree(c, rng, x, y, ht, sc, ob, addClump, branches) {
  const { p } = c;
  const def = p.lsRule === 'custom' ? { axiom: 'X', rules: parseRules(p.lsCustom), angle: p.branchAngle } : LS_RULES[p.lsRule] || LS_RULES.sparse;
  let str = def.axiom;
  const iters = Math.max(1, Math.min(6, Math.round(p.levels)));
  for (let k = 0; k < iters && str.length < 30000; k++) {
    let out = '';
    for (const ch of str) out += def.rules[ch] ?? ch;
    str = out;
  }
  const ang = deg(p.lsRule === 'custom' ? p.branchAngle : def.angle);
  // First pass at unit length to find the height, second pass scaled to fit.
  const walk = (len, emit) => {
    let st = { x: 0, y: 0, a: -Math.PI / 2 + p.lean * 0.3, d: 0 };
    const stack = [];
    let line = [[0, 0]], lineD = 0;
    for (const ch of str) {
      if (ch === 'F') {
        st.a += deg(rng.signed() * p.wander * 0.3);
        st.a = lerpAngleRad(st.a, -Math.PI / 2, p.upward * 0.03);
        st.x += Math.cos(st.a) * len; st.y += Math.sin(st.a) * len;
        line.push([st.x, st.y]);
      } else if (ch === '+') st.a += ang * rng.range(0.8, 1.2);
      else if (ch === '-') st.a -= ang * rng.range(0.8, 1.2);
      else if (ch === '[') { stack.push({ ...st, line, lineD }); st = { ...st, d: st.d + 1 }; line = [[st.x, st.y]]; lineD = st.d; }
      else if (ch === ']') { emit(line, lineD, true); const s = stack.pop(); if (!s) break; ({ line, lineD } = s); st = { x: s.x, y: s.y, a: s.a, d: s.d }; }
    }
    emit(line, lineD, true);
  };
  let minY = 0;
  const save = rng.s;
  walk(1, (line) => { for (const q of line) minY = Math.min(minY, q[1]); });
  rng.s = save;
  const len = ht / Math.max(1, -minY);
  const trunkW = p.trunk * c.u * sc;
  let clumps = 0;
  walk(len, (line, d, tip) => {
    if (line.length < 2) return;
    const pts = line.map((q) => [x + q[0], y + q[1]]);
    const w0 = Math.max(0.6, trunkW * Math.pow(p.decay, d));
    branches.push([pts, pts.map((_, i) => w0 * (1 - (0.4 * i) / pts.length))]);
    if (tip && clumps < 400) { const e = pts[pts.length - 1]; addClump(e[0], e[1], p.foliage * c.u * sc * 0.6); clumps++; }
  });
}

// Point extrusion: start at a root point, push a segment out, split, repeat.
// Tips (and some inner nodes) become slots for foliage shapes.
function growTree(c, rng, x, y, ht, sc, ob) {
  const { p, u } = c;
  const branches = [];
  const clumps = [];
  const form = p.form;
  let angle = p.branchAngle, upward = p.upward, levels = Math.round(p.levels), mid = p.midFoliage;
  if (form === 'poplar') { angle *= 0.35; upward = Math.max(upward, 0.85); mid = Math.max(mid, 0.8); }
  const density = form === 'bare' ? 0 : p.density;
  const up = -Math.PI / 2;
  const trunkW = p.trunk * u * sc;
  const addClump = (x, y, s, droop = 0) => clumps.push([x, y, s, c.newCl(), droop]);

  if (form === 'lsystem') {
    lsystemTree(c, rng, x, y, ht, sc, ob, addClump, branches);
  } else if (form === 'conifer') {
    const trunk = [], tw = [];
    for (let i = 0; i <= 6; i++) { trunk.push([x + p.lean * ht * 0.15 * (i / 6) ** 2 + rng.signed() * trunkW * 0.05, y - (ht * i) / 6]); tw.push(trunkW * (1 - i / 7) + 0.8); }
    branches.push([trunk, tw]);
    const whorls = 5 + levels * 2;
    for (let i = 0; i < whorls; i++) {
      const t = 0.12 + (0.86 * i) / whorls;
      const wy = y - ht * t, wx = x + p.lean * ht * 0.15 * t * t;
      const len = ht * 0.36 * Math.pow(1 - t, 0.9) * rng.range(0.8, 1.15) + 3 * u;
      for (const side of [-1, 1]) {
        const a = side > 0 ? deg(10 + angle * 0.4) : Math.PI - deg(10 + angle * 0.4);
        const ex = wx + Math.cos(a) * len, ey = wy + Math.sin(a) * len;
        branches.push([[[wx, wy], [lerp(wx, ex, 0.8), lerp(wy, ey, 0.8)]], [trunkW * 0.14 * (1 - t) + 0.6, 0.5]]);
        // Tiers of foliage hide the branch: clumps from near the trunk out to the tip.
        for (let s = 0; s <= 4; s++) addClump(lerp(wx, ex, 0.1 + (0.9 * s) / 4), lerp(wy, ey, 0.1 + (0.9 * s) / 4) - 2 * u, p.foliage * u * sc * (0.45 + 0.55 * (1 - t)) * (1 - s * 0.08));
      }
    }
    addClump(x + p.lean * ht * 0.15, y - ht, p.foliage * u * sc * 0.3);
  } else if (form === 'palm') {
    const trunk = [], tw = [];
    const bend = (p.lean || 0.3) * ht * 0.35;
    for (let i = 0; i <= 10; i++) { const t = i / 10; trunk.push([x + bend * t * t, y - ht * t]); tw.push(trunkW * (1 - t * 0.45)); }
    branches.push([trunk, tw]);
    const top = trunk[10];
    const fronds = 7 + Math.round(p.children * 2);
    for (let k = 0; k < fronds; k++) {
      const a = up + ((k / (fronds - 1)) - 0.5) * Math.PI * 1.5 + rng.signed() * 0.15;
      const len = ht * 0.4 * rng.range(0.8, 1.1);
      const pts = [], ws = [];
      for (let s = 0; s <= 8; s++) {
        const t = s / 8;
        pts.push([top[0] + Math.cos(a) * len * t, top[1] + Math.sin(a) * len * t + t * t * len * 0.55]);
        ws.push(trunkW * 0.25 * (1 - t) + 0.6);
        if (s > 1) addClump(pts[s][0], pts[s][1], p.foliage * u * sc * 0.35 * (1 - t * 0.5));
      }
      branches.push([pts, ws]);
    }
  } else {
    const L0 = (ht / (1 + p.decay + p.decay * p.decay)) * 0.95;
    const weep = form === 'willow';
    const seg = (x, y, a, len, w, level) => {
      const steps = 4;
      const pts = [[x, y]], ws = [w];
      let px = x, py = y;
      for (let s = 0; s < steps; s++) {
        a += deg(rng.signed() * p.wander);
        a = lerpAngleRad(a, up, upward * 0.12);
        if (level === 1) a += p.lean * 0.05;
        px += (Math.cos(a) * len) / steps;
        py += (Math.sin(a) * len) / steps;
        pts.push([px, py]);
        ws.push(w * (1 - ((1 - p.decay) * (s + 1)) / steps));
      }
      branches.push([pts, ws]);
      c.debug.lines.push(pts);
      const pw = ws[ws.length - 1];
      const clumpR = p.foliage * u * sc * (form === 'shrub' ? 0.8 : 1);
      if (level >= levels) {
        if (weep) {
          // Weeping: long hanging strands of foliage from each tip.
          const drop = ht * rng.range(0.25, 0.45);
          for (let s = 0; s <= 7; s++) addClump(px + rng.signed() * clumpR * 0.25, py + (drop * s) / 7, clumpR * 0.6 * (1 - s * 0.06), 1);
        } else addClump(px, py, clumpR);
        return;
      }
      if (level >= levels - 1 && rng.chance(mid)) addClump(px, py, clumpR * 0.8);
      const n = Math.round(p.children) + (rng.chance(0.3) ? 1 : 0);
      for (let k = 0; k < n; k++) {
        const off = n === 1 ? 0 : (k / (n - 1) - 0.5) * 2 * angle;
        seg(px, py, a + deg(off + rng.signed() * p.wander), len * p.decay * rng.range(0.85, 1.12), pw * 0.85, level + 1);
      }
    };
    if (form === 'shrub') {
      const stems = 3 + Math.round(p.children);
      for (let k = 0; k < stems; k++) {
        const off = (k / (stems - 1) - 0.5) * 2 * angle * 1.6;
        seg(x + rng.signed() * trunkW, y, up + deg(off), L0 * 0.8, trunkW * 0.45, Math.min(levels, 2));
      }
    } else {
      seg(x, y, up + rng.signed() * 0.05, L0, trunkW, 1);
    }
  }
  for (const [pts, ws] of branches) c.branch(pts, ws, { ob, cl: ob, col: 'trunk' });
  if (density > 0) {
    for (const [cx, cy, s, cl, droop] of clumps) {
      const cnt = Math.max(1, Math.round(density * rng.range(0.7, 1.3) * (droop ? 0.8 : 1)));
      for (let k = 0; k < cnt; k++) {
        const a = rng.range(0, TAU);
        const d = Math.sqrt(rng.next()) * s * p.foliageSpread;
        c.shape(cx + Math.cos(a) * d * (droop ? 0.5 : 1), cy + Math.sin(a) * d * 0.8 - s * 0.2, s * rng.range(0.45, 0.8), { ob, cl, angle: droop ? Math.PI / 2 : 0 });
      }
      c.debug.points.push([cx, cy, s]);
    }
  }
}
