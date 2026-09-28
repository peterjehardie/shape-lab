// Structures are the scaffolding of each layer. Each one lays down big masses (ridges,
// ground) and "slots" (places, sizes, angles) that the layer's shape vocabulary fills.
import { clamp, lerp, deg, lerpAngleRad, TAU } from './util.js';

const R = (key, label, min, max, step, def, extra = {}) => ({ key, label, type: 'range', min, max, step, def, geo: true, ...extra });
const S = (key, label, options, def, extra = {}) => ({ key, label, type: 'select', options, def, geo: true, ...extra });
const B = (key, label, def, extra = {}) => ({ key, label, type: 'bool', def, geo: true, ...extra });

const GROUND_N = [0, -0.95, 0.3];

// Ground under a band: a gently waving flat plane that faces the sky.
function ground(c, y, wave = 0.01) {
  const { W, H, noise } = c;
  const pts = [];
  const N = 60;
  for (let i = 0; i <= N; i++) {
    const x = lerp(-0.03 * W, 1.03 * W, i / N);
    pts.push([x, y + noise.fbm((x / W) * 3, 9.1, 3) * wave * H]);
  }
  pts.push([1.03 * W, H + 30], [-0.03 * W, H + 30]);
  c.mass(pts, { ob: c.newOb(), cl: c.newCl(), n3: GROUND_N, ground: true });
  return pts;
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
export const KINDS = {
  sky: {
    label: 'Sky gradient',
    params: [
      { key: 'skyDrop', label: 'Top darkening', type: 'range', min: 0, max: 0.4, step: 0.01, def: 0.14 },
      { key: 'glow', label: 'Sun glow', type: 'range', min: 0, max: 1, step: 0.01, def: 0.6 },
      { key: 'glowSize', label: 'Glow size', type: 'range', min: 0.1, max: 1.5, step: 0.01, def: 0.5 },
    ],
    generate() {},
  },

  clouds: {
    label: 'Clouds',
    params: [
      R('count', 'Clouds', 1, 30, 1, 6),
      R('yTop', 'Band top', 0, 1, 0.01, 0.06),
      R('yBottom', 'Band bottom', 0, 1, 0.01, 0.38),
      R('cloudSize', 'Cloud size', 10, 300, 1, 80),
      R('stretch', 'Stretch', 0.5, 5, 0.05, 2.2),
      R('puffs', 'Puffs per cloud', 2, 40, 1, 12),
      R('puffSize', 'Puff size', 0.2, 1.5, 0.01, 0.55),
      R('flatBottom', 'Flat bottom', 0, 1, 0.01, 0.6),
      R('perspective', 'Shrink toward horizon', 0, 0.9, 0.01, 0.55),
    ],
    generate(c) {
      const { p, W, H, u, rng } = c;
      const clouds = [];
      for (let i = 0; i < p.count; i++) clouds.push({ x: rng.range(-0.1, 1.1) * W, y: lerp(p.yTop, p.yBottom, rng.next()) * H });
      clouds.sort((a, b) => b.y - a.y);
      for (const cl of clouds) {
        const t = clamp((cl.y / H - p.yTop) / Math.max(0.01, p.yBottom - p.yTop));
        const size = p.cloudSize * u * lerp(1, 1 - p.perspective, t) * rng.range(0.6, 1.4);
        const halfW = size * p.stretch;
        const ob = c.newOb();
        const base = cl.y + size * 0.15;
        if (p.flatBottom > 0) {
          const ry = size * 0.28 * (1 - p.flatBottom * 0.5);
          c.shape(cl.x, base - ry * 0.6, halfW * 0.85, { ob, cl: ob, type: 'ellipse', aspect: (halfW * 0.85) / ry, fixed: true });
        }
        const puffs = [];
        for (let k = 0; k < p.puffs; k++) {
          const dx = clamp(rng.gauss() * 0.42, -1, 1) * halfW;
          const edge = 1 - Math.abs(dx) / halfW;
          const r = size * p.puffSize * (0.4 + 0.6 * edge) * rng.range(0.7, 1.2);
          let y = cl.y - Math.abs(rng.gauss()) * size * 0.4 * edge - size * 0.05;
          y = Math.min(y, base - r * p.flatBottom);
          puffs.push([cl.x + dx, y, r]);
        }
        puffs.sort((a, b) => b[1] - a[1]);
        for (const [x, y, r] of puffs) {
          c.shape(x, y, r, { ob, cl: ob });
          c.debug.points.push([x, y, r]);
        }
        c.debug.lines.push([[cl.x - halfW, base], [cl.x + halfW, base]]);
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
      B('facets', 'Split into lit/shadow planes', true),
      R('facetDetail', 'Plane detail', 0, 1, 0.01, 0.45),
      R('facetFade', 'Planes fade toward base', 0, 1, 0.01, 0.7),
      R('spurLean', 'Spur lean', -1, 1, 0.01, 0.2),
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
        const f = clamp((lerp(soft, hard, p.sharp) - 0.2) / 0.65);
        pts.push([x, p.baseY * H - p.height * H * f]);
      }
      const bottom = H + 30;
      const sil = [...pts, [1.03 * W, bottom], [-0.03 * W, bottom]];
      let facets = null;
      if (p.facets) {
        const thr = p.height * H * lerp(0.35, 0.03, p.facetDetail) + 1;
        const ext = zigzag(pts, thr);
        // One spur line runs down from each peak/valley; neighbouring planes share it.
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
          const lump = noise.fbm(x / W * 6, bmp.cx * 0.01, 3) * p.lumpy * 0.35;
          pts.push([x, baseY - bmp.peak * prof * (1 + lump)]);
        }
        surface.push(pts);
        const bottom = p.ground ? baseY + 0.01 * H : H + 30;
        const poly = [...pts, [bmp.cx + bmp.halfw, bottom], [bmp.cx - bmp.halfw, bottom]];
        // With a ground plane, the bump's foot melts into the ground colour so no seam shows.
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
        for (let j = 0; j < per; j++) {
          c.shape(x + rng.gauss() * sz * 0.9, y + rng.gauss() * sz * 0.3, sz * rng.range(0.6, 1.2), { ob, cl, lOff: p.scatterValue });
        }
      }
    },
  },

  trees: {
    label: 'Trees (point extrusion)',
    params: [
      S('form', 'Form', [['broadleaf', 'Broadleaf'], ['conifer', 'Conifer'], ['poplar', 'Poplar'], ['shrub', 'Shrub'], ['bare', 'Bare branches']], 'broadleaf'),
      R('count', 'Trees', 1, 60, 1, 3),
      R('x0', 'From x', 0, 1, 0.01, 0.05),
      R('x1', 'To x', 0, 1, 0.01, 0.95),
      R('baseY', 'Base line', 0.2, 1.1, 0.005, 0.9),
      R('baseJitter', 'Base scatter', 0, 0.2, 0.002, 0.03),
      R('height', 'Height', 0.02, 1, 0.005, 0.38),
      R('heightJitter', 'Height variety', 0, 0.8, 0.01, 0.25),
      R('trunk', 'Trunk width', 0.5, 60, 0.5, 12),
      R('levels', 'Branch levels', 1, 7, 1, 4),
      R('children', 'Branches per node', 1, 4, 1, 2),
      R('branchAngle', 'Branch angle', 0, 90, 1, 28),
      R('decay', 'Length decay', 0.4, 0.95, 0.01, 0.72),
      R('upward', 'Reach upward', 0, 1, 0.01, 0.35),
      R('wander', 'Wander', 0, 40, 0.5, 10),
      R('foliage', 'Foliage clump size', 2, 150, 0.5, 34),
      R('density', 'Shapes per clump', 0, 30, 1, 6),
      R('foliageSpread', 'Clump spread', 0.2, 2.5, 0.01, 1),
      R('midFoliage', 'Foliage on inner nodes', 0, 1, 0.01, 0.35),
      B('ground', 'Ground plane', true),
    ],
    generate(c) {
      const { p, W, H, rng } = c;
      if (p.ground) ground(c, (p.baseY - p.baseJitter - 0.01) * H, 0.008);
      const n = Math.round(p.count);
      const trees = [];
      for (let i = 0; i < n; i++) {
        const t = n === 1 ? 0.5 : i / (n - 1);
        const span = (p.x1 - p.x0) / Math.max(1, n);
        const x = (lerp(p.x0, p.x1, t) + rng.signed() * span * 0.35) * W;
        trees.push({ x, y: p.baseY * H + rng.signed() * p.baseJitter * H });
      }
      trees.sort((a, b) => a.y - b.y);
      for (const tr of trees) {
        const sc = Math.pow(tr.y / (p.baseY * H), 3);
        const ht = p.height * H * sc * (1 + p.heightJitter * rng.signed());
        growTree(c, tr.x, tr.y, ht, sc);
      }
    },
  },

  clusters: {
    label: 'Clusters (bushes, rocks)',
    params: [
      R('count', 'Clusters', 1, 80, 1, 10),
      R('x0', 'From x', 0, 1, 0.01, 0),
      R('x1', 'To x', 0, 1, 0.01, 1),
      R('yTop', 'Band top', 0, 1.1, 0.005, 0.74),
      R('yBottom', 'Band bottom', 0, 1.1, 0.005, 0.82),
      R('clusterSize', 'Cluster size', 3, 200, 0.5, 34),
      R('perCluster', 'Shapes per cluster', 1, 30, 1, 6),
      R('spread', 'Spread', 0.2, 2.5, 0.01, 1),
      R('flat', 'Flatness', 0, 1, 0.01, 0.4),
      R('perspective', 'Shrink with distance', 0, 0.95, 0.01, 0.5),
      B('ground', 'Ground plane', true),
    ],
    generate(c) {
      const { p, W, H, u, rng } = c;
      if (p.ground) ground(c, (p.yTop - 0.015) * H, 0.006);
      const centers = [];
      for (let i = 0; i < p.count; i++) centers.push([rng.range(p.x0, p.x1) * W, lerp(p.yTop, p.yBottom, rng.next()) * H]);
      centers.sort((a, b) => a[1] - b[1]);
      for (const [cx, cy] of centers) {
        const t = clamp((cy / H - p.yTop) / Math.max(0.01, p.yBottom - p.yTop));
        const Rr = p.clusterSize * u * lerp(1 - p.perspective, 1, t);
        const ob = c.newOb();
        const shapes = [];
        for (let k = 0; k < p.perCluster; k++) {
          const dx = rng.gauss() * Rr * 0.55 * p.spread;
          const edge = clamp(1 - Math.abs(dx) / (Rr * 1.6 * p.spread));
          const size = Rr * rng.range(0.35, 0.7) * (0.55 + 0.45 * edge);
          const dy = -Math.abs(rng.gauss()) * Rr * 0.45 * (1 - p.flat) * edge;
          shapes.push([cx + dx, Math.min(cy + dy, cy + size * 0.1), size]);
        }
        shapes.sort((a, b) => a[1] - b[1]);
        for (const [x, y, s] of shapes) c.shape(x, y - s * 0.4, s, { ob, cl: ob });
        c.debug.points.push([cx, cy, Rr]);
      }
    },
  },

  grass: {
    label: 'Grass tufts',
    params: [
      R('count', 'Tufts', 1, 200, 1, 40),
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
    ],
    generate(c) {
      const { p, W, H, u, rng } = c;
      if (p.ground) ground(c, (p.yTop - 0.01) * H, 0.004);
      const tufts = [];
      for (let i = 0; i < p.count; i++) tufts.push([rng.range(p.x0, p.x1) * W, lerp(p.yTop, p.yBottom, rng.next()) * H]);
      tufts.sort((a, b) => a[1] - b[1]);
      for (const [tx, ty] of tufts) {
        const t = clamp((ty / H - p.yTop) / Math.max(0.01, p.yBottom - p.yTop));
        const sc = lerp(0.55, 1.1, t);
        const ob = c.newOb();
        for (let b = 0; b < p.blades; b++) {
          const ang = p.lean * 0.9 + deg(rng.signed() * p.spreadAngle);
          const hgt = p.bladeHeight * u * sc * rng.range(0.5, 1.1);
          const x = tx + rng.signed() * p.bladeWidth * u * 1.5;
          const bend = p.curl * (ang >= 0 ? 1 : -1) * rng.range(0.4, 1);
          const tip = blade(c, x, ty, hgt, p.bladeWidth * u * sc * rng.range(0.7, 1.2), ang, bend, ob);
          if (p.flowers > 0 && rng.chance(p.flowers * 0.35)) {
            c.shape(tip[0], tip[1], p.flowerSize * u * sc, { ob, cl: ob, col: 'accent' });
          }
        }
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
      R('droop', 'Droop', 0, 1, 0.01, 0.35),
      R('wander', 'Wander', 0, 40, 0.5, 12),
      R('leafSize', 'Leaf size', 2, 120, 0.5, 22),
      R('leafDensity', 'Leaves per twig', 0, 30, 1, 6),
      R('leafAlong', 'Leaves along twigs', 0, 1, 0.01, 0.6),
    ],
    generate(c) {
      const { p, W, H, u, rng } = c;
      let x, y, a;
      if (p.side === 'right') { x = W + 30; y = p.anchor * H; a = Math.PI - 0.12; }
      else if (p.side === 'left') { x = -30; y = p.anchor * H; a = 0.12; }
      else { x = p.anchor * W; y = -30; a = Math.PI / 2 + (p.anchor > 0.5 ? 0.5 : -0.5); }
      const ob = c.newOb();
      const limbs = [], leaves = [];
      const down = Math.PI / 2;
      const grow = (x, y, a, len, w, level, cl) => {
        const steps = 4;
        let px = x, py = y, pw = w;
        const line = [[x, y]];
        for (let s = 0; s < steps; s++) {
          a += deg(rng.signed() * p.wander);
          a = lerpAngleRad(a, down, p.droop * 0.1 * level);
          const nx = px + (Math.cos(a) * len) / steps, ny = py + (Math.sin(a) * len) / steps;
          const nw = w * (1 - (0.5 * (s + 1)) / steps);
          limbs.push([px, py, nx, ny, pw, nw, cl]);
          if (level > 1 && rng.chance(p.leafAlong)) addLeaves(nx, ny, a, Math.max(1, Math.round(p.leafDensity * 0.4)), cl);
          px = nx; py = ny; pw = nw;
          line.push([px, py]);
        }
        c.debug.lines.push(line);
        if (level >= p.levels) {
          addLeaves(px, py, a, p.leafDensity, cl);
          return;
        }
        const n = Math.round(p.twigs);
        for (let k = 0; k < n; k++) {
          const side = k % 2 ? 1 : -1;
          const a2 = a + side * deg(p.branchAngle * rng.range(0.6, 1.2));
          const at = rng.range(0.3, 1);
          const bx = lerp(x, px, at), by = lerp(y, py, at);
          grow(bx, by, a2, len * rng.range(0.45, 0.65), pw * 1.2 + 1, level + 1, c.newCl());
        }
      };
      const addLeaves = (x, y, a, count, cl) => {
        for (let k = 0; k < count; k++) {
          const la = a + rng.signed() * 1.2;
          const s = p.leafSize * u * rng.range(0.6, 1.2);
          leaves.push([x + Math.cos(la) * s * 0.9, y + Math.sin(la) * s * 0.9, s, la, cl]);
        }
      };
      grow(x, y, a, p.reach * W * 0.6, p.thickness * u, 1, c.newCl());
      for (const l of limbs) c.limb(l[0], l[1], l[2], l[3], l[4], l[5], { ob, cl: l[6] });
      for (const [lx, ly, s, la, cl] of leaves) c.shape(lx, ly, s, { ob, cl, angle: la });
    },
  },
};

// A grass blade: a curved, tapering strip from base to tip.
function blade(c, x, y, h, w, ang, bend, ob) {
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
  c.mass(poly, { ob, cl: ob, n3: norm3(tilt * 0.9 + c.rng.signed() * 0.3, -0.35, 1), blade: true });
  return p2;
}

// Point extrusion: start at a root point, push a segment out, split, repeat.
// Tips (and some inner nodes) become slots for foliage shapes.
function growTree(c, x, y, ht, sc) {
  const { p, rng, u } = c;
  const ob = c.newOb();
  const limbs = [];
  const clumps = [];
  const form = p.form;
  let angle = p.branchAngle, upward = p.upward, levels = Math.round(p.levels), mid = p.midFoliage;
  if (form === 'poplar') { angle *= 0.35; upward = Math.max(upward, 0.85); mid = Math.max(mid, 0.8); }
  const density = form === 'bare' ? 0 : p.density;
  const up = -Math.PI / 2;
  const trunkW = p.trunk * u * sc;
  const addClump = (x, y, s) => clumps.push([x, y, s, c.newCl()]);

  if (form === 'conifer') {
    const segs = 4;
    for (let i = 0; i < segs; i++) {
      const y0 = y - (ht * i) / segs, y1 = y - (ht * (i + 1)) / segs;
      limbs.push([x, y0, x + rng.signed() * trunkW * 0.1, y1, trunkW * (1 - i / segs) + 1, trunkW * (1 - (i + 1) / segs) + 1]);
    }
    const whorls = 5 + levels * 2;
    for (let i = 0; i < whorls; i++) {
      const t = 0.12 + (0.86 * i) / whorls;
      const wy = y - ht * t;
      const len = ht * 0.36 * Math.pow(1 - t, 0.9) * rng.range(0.8, 1.15) + 3 * u;
      for (const side of [-1, 1]) {
        const a = side > 0 ? deg(10 + angle * 0.4) : Math.PI - deg(10 + angle * 0.4);
        const ex = x + Math.cos(a) * len, ey = wy + Math.sin(a) * len;
        limbs.push([x, wy, ex, ey, trunkW * 0.16 * (1 - t) + 0.6, 0.5]);
        const steps = 3;
        for (let s = 1; s <= steps; s++) addClump(lerp(x, ex, s / steps), lerp(wy, ey, s / steps) - 2 * u, (p.foliage * u * sc * (0.4 + 0.6 * (1 - t))) / 1.15);
      }
    }
    addClump(x, y - ht, p.foliage * u * sc * 0.3);
  } else {
    const L0 = (ht / (1 + p.decay + p.decay * p.decay)) * 0.95;
    const seg = (x, y, a, len, w, level) => {
      const steps = 3;
      let px = x, py = y, pw = w;
      const line = [[x, y]];
      for (let s = 0; s < steps; s++) {
        a += deg(rng.signed() * p.wander);
        a = lerpAngleRad(a, up, upward * 0.12);
        const nx = px + (Math.cos(a) * len) / steps, ny = py + (Math.sin(a) * len) / steps;
        const nw = w * (1 - ((1 - p.decay) * (s + 1)) / steps);
        limbs.push([px, py, nx, ny, pw, nw]);
        px = nx; py = ny; pw = nw;
        line.push([px, py]);
      }
      c.debug.lines.push(line);
      const clumpR = p.foliage * u * sc * (form === 'shrub' ? 0.8 : 1);
      if (level >= levels) {
        addClump(px, py, clumpR);
        return;
      }
      if (level >= levels - 1 && rng.chance(mid)) addClump(px, py, clumpR * 0.8);
      const n = Math.round(p.children) + (rng.chance(0.3) ? 1 : 0);
      for (let k = 0; k < n; k++) {
        const off = n === 1 ? 0 : (k / (n - 1) - 0.5) * 2 * angle;
        seg(px, py, a + deg(off + rng.signed() * p.wander), len * p.decay * rng.range(0.85, 1.12), pw * 0.8, level + 1);
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
  for (const l of limbs) c.limb(l[0], l[1], l[2], l[3], l[4], l[5], { ob, cl: ob, col: 'trunk' });
  if (density > 0) {
    for (const [cx, cy, s, cl] of clumps) {
      const cnt = Math.max(1, Math.round(density * rng.range(0.7, 1.3)));
      for (let k = 0; k < cnt; k++) {
        const a = rng.range(0, TAU);
        const d = Math.sqrt(rng.next()) * s * p.foliageSpread;
        c.shape(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.8 - s * 0.2, s * rng.range(0.45, 0.8), { ob, cl });
      }
      c.debug.points.push([cx, cy, s]);
    }
  }
}
