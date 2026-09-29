// Drawing: sky, water, under-effects (halo, clones, contact), lit fills, outlines, hatching,
// rim and glow, dappled patches, light shafts, depth blur, finish and value views.
import { makeStyle, makeRampStyle, hexToLab, hueAB, labCss, labToRgb } from './color.js';
import { valueGroupIndex, layerDepth, resolveRole } from './scene.js';
import { rampOf, lchToLab, ROLES } from './palette.js';
import { groupsFor, groupKey } from './pipeline.js';
import { clamp, lerp, hash01, hashStr, hashInts, smoothstep, deg } from './util.js';
import { noiseFor } from './rng.js';

// Light as a 3D direction toward the sun. x right, y down, z toward the viewer.
// dx/dy is the on-screen direction the light comes from.
export function lightVec(g) {
  const a = (g.sunAngle * Math.PI) / 180;
  const z = g.sunFront;
  const k = Math.sqrt(Math.max(0, 1 - z * z));
  const dx = Math.cos(a), dy = -Math.sin(a);
  return { x: dx * k, y: dy * k, z, k, dx, dy };
}
const dot3 = (n, L) => n[0] * L.x + n[1] * L.y + n[2] * L.z;
const norm3 = (x, y, z) => {
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
};

export function sunPos(g, L, W, H) {
  const hy = g.horizonY * H;
  return [W / 2 + L.dx * W * 0.42, L.dy < 0 ? hy + L.dy * hy * 0.85 : hy - 4];
}

export function layerStyles(scene, layer, grey) {
  const g = scene.globals;
  const p = layer.p;
  const vg = g.valueGroups[valueGroupIndex(scene, layer)] || { value: 0.5, spread: 0.1 };
  const depth = layerDepth(scene, layer);
  const haze = clamp(g.haze * p.haze * Math.pow(1 - depth, g.hazeCurve));
  const hz = hexToLab(g.hazeColor || g.skyHorizon);
  const nt = hexToLab(g.nearTint || '#c98a4a');
  const near = (g.nearTintAmt || 0) * depth * depth;
  const steps = p.lightSteps === 'inherit' || p.lightSteps === undefined ? +g.lightSteps : +p.lightSteps;
  if (g.colorMode !== 'free' && g.palette) {
    // Palette mode: colours come from a role's ramp; shading walks along that ramp.
    const P = g.palette;
    const [role, step] = resolveRole(layer);
    const hz = lchToLab(rampOf(P, g.hazeRole || 'light')[3]);
    const mkR = (r, st, lOff = 0) => makeRampStyle({
      ramp: rampOf(P, r).map(lchToLab), pos: clamp(2 + st, 0, 4), spread: p.spreadMul,
      haze: { lab: hz, t: haze, desat: 0.5 }, lOff: lOff + p.valueNudge,
      steps, bias: p.lightBias, strength: g.lightStrength, grey,
    });
    const base = mkR(role, step);
    const cache = { [role]: base };
    const roleStyle = (r) => cache[r] || (cache[r] = mkR(r, 0));
    return {
      base, trunk: mkR(p.trunkRole || 'dark', 0), accent: mkR('accent', 0), snow: mkR('light', 1),
      roleStyle, vg: { value: base.L, spread: 0.08 }, depth, haze, steps, palette: P, role,
    };
  }
  const mk = (hex, lOff = 0) => {
    const lab = hexToLab(hex);
    let a = lerp(lab[1] * p.chroma, nt[1], near), b = lerp(lab[2] * p.chroma, nt[2], near);
    a = lerp(a, hz[1], haze); b = lerp(b, hz[2], haze);
    return makeStyle({
      L: vg.value + p.valueNudge + lOff,
      spread: vg.spread * p.spreadMul,
      ab: [a, b],
      sunAB: hueAB(g.sunHue, 0.13), sunWarm: g.sunWarm,
      shadowAB: hueAB(g.shadowHue, 0.09), shadowCool: g.shadowCool,
      steps, bias: p.lightBias, strength: g.lightStrength, grey,
    });
  };
  const base = mk(p.color);
  return {
    base, trunk: mk(p.trunkColor, p.trunkValue), accent: mk(p.accentColor, p.accentValue),
    snow: mk('#eef2f8', p.snowValue || 0), roleStyle: () => base, vg, depth, haze, steps,
  };
}

const greyCss = (hex) => labCss(hexToLab(hex)[0], 0, 0);
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

function tracePath(poly) {
  const p = new Path2D();
  p.moveTo(poly[0][0], poly[0][1]);
  for (let i = 1; i < poly.length; i++) p.lineTo(poly[i][0], poly[i][1]);
  p.closePath();
  return p;
}
function ensurePaths(geo) {
  if (geo.pathsReady) return;
  for (const it of geo.items) {
    it.p2d = tracePath(it.poly);
    if (it.facets) for (const f of it.facets) f.p2d = tracePath(f.poly);
  }
  geo.union = new Path2D();
  geo.unionNoGround = new Path2D();
  for (const it of geo.items) {
    geo.union.addPath(it.p2d);
    if (!it.ground && !it.detail) geo.unionNoGround.addPath(it.p2d);
  }
  geo.pathsReady = true;
}

// Sphere-like shading squeezed into a linear gradient along the light axis.
// Position s runs +1 (edge facing the light) to -1 (far edge); the surface normal there is
// (s along the light, sqrt(1-s^2) toward the viewer), so front vs back light changes the look.
function sphereGrad(ctx, cx, cy, r, L, sty, tn, steps) {
  const g = ctx.createLinearGradient(cx + L.dx * r, cy + L.dy * r, cx - L.dx * r, cy - L.dy * r);
  const N = steps ? 36 : 10;
  let prev = null;
  for (let i = 0; i <= N; i++) {
    const t = i / N, s = 1 - 2 * t;
    const shade = s * L.k + Math.sqrt(Math.max(0, 1 - s * s)) * L.z;
    const col = sty.css(shade, tn.lo, tn.hr);
    if (steps && prev && col !== prev) g.addColorStop(t, prev);
    g.addColorStop(t, col);
    prev = col;
  }
  return g;
}

// Squarish model: a block with a bevel. Each side plane faces outward from its edge,
// the top plane faces the viewer and slightly up.
const TOP = norm3(0, -0.45, 1);
function drawBevel(ctx, it, sty, tn, L) {
  const P = it.poly;
  let cs = it.corners ? it.corners.map((i) => P[i]).filter(Boolean) : null;
  if (!cs || cs.length < 3) {
    const step = Math.max(1, Math.floor(P.length / 8));
    cs = P.filter((_, i) => i % step === 0);
  }
  const A = [it.c[0], it.c[1] - it.r * 0.12];
  const at = (q, f) => [A[0] + (q[0] - A[0]) * f, A[1] + (q[1] - A[1]) * f];
  const n = cs.length;
  for (let i = 0; i < n; i++) {
    const a = cs[i], b = cs[(i + 1) % n];
    const ex = b[0] - a[0], ey = b[1] - a[1];
    const l = Math.hypot(ex, ey) || 1;
    const n3 = norm3((ey / l) * 1.1, (-ex / l) * 1.1, 1);
    const q = [at(a, 0.45), at(b, 0.45), at(b, 1.3), at(a, 1.3)];
    ctx.beginPath();
    ctx.moveTo(q[0][0], q[0][1]);
    for (let k = 1; k < 4; k++) ctx.lineTo(q[k][0], q[k][1]);
    ctx.closePath();
    ctx.fillStyle = sty.css(dot3(n3, L), tn.lo, tn.hr);
    ctx.fill();
  }
  ctx.beginPath();
  cs.forEach((q, i) => { const r = at(q, 0.45); i ? ctx.lineTo(r[0], r[1]) : ctx.moveTo(r[0], r[1]); });
  ctx.closePath();
  ctx.fillStyle = sty.css(dot3(TOP, L), tn.lo, tn.hr);
  ctx.fill();
}

// Branches: one shape, shaded as a cylinder split into a lit side and a shadow side.
function fillBranch(ctx, it, sty, tn, L, lod) {
  ctx.fillStyle = sty.css(-0.15, tn.lo, tn.hr);
  ctx.fill(it.p2d);
  const sp = it.spine;
  if (!sp || sp.length < 2 || sp[0][2] < lod * 0.7) return;
  const bins = new Map();
  for (let i = 0; i < sp.length - 1; i++) {
    const a = sp[i], b = sp[i + 1];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l, ny = dx / l;
    for (const sd of [1, -1]) {
      const mx = nx * sd, my = ny * sd;
      const col = sty.css(dot3(norm3(mx * 0.9, my * 0.9, 0.55), L), tn.lo, tn.hr);
      let path = bins.get(col);
      if (!path) bins.set(col, (path = new Path2D()));
      path.moveTo(a[0], a[1]);
      path.lineTo(b[0], b[1]);
      path.lineTo(b[0] + (mx * b[2]) / 2, b[1] + (my * b[2]) / 2);
      path.lineTo(a[0] + (mx * a[2]) / 2, a[1] + (my * a[2]) / 2);
      path.closePath();
    }
  }
  ctx.save();
  ctx.clip(it.p2d);
  for (const [col, path] of bins) { ctx.fillStyle = col; ctx.fill(path); }
  ctx.restore();
}

function styleFor(st, it) {
  if (st.roleMap && !it.ground && !it.detail) {
    const r = st.roleMap.get(it.ob);
    if (r) return st.roleStyle(r);
  }
  return it.col === 'trunk' ? st.trunk : it.col === 'accent' ? st.accent : it.col === 'snow' ? st.snow : st.base;
}

// Chroma Mat's role assignment: the smallest object or two become the accent, the rest go to
// whichever role is furthest below its target share of the frame.
function rolesByArea(geo, layer, P, W, H) {
  const key = JSON.stringify([P.props, layer.seed]);
  if (geo.roleCache && geo.roleCache.key === key) return geo.roleCache.map;
  const obs = new Map();
  for (const it of geo.items) {
    if (it.ground || it.detail) continue;
    const b = it.bb;
    const a = Math.max(0, Math.min(W, b.x1) - Math.max(0, b.x0)) * Math.max(0, Math.min(H, b.y1) - Math.max(0, b.y0)) * 0.7;
    obs.set(it.ob, (obs.get(it.ob) || 0) + a / (W * H));
  }
  const list = [...obs].map(([ob, a]) => ({ ob, a })).sort((x, y) => y.a - x.a);
  const got = { dominant: 0, secondary: 0, accent: 0, dark: 0, light: 0 };
  const map = new Map();
  const accN = P.props.accent > 0 ? (P.props.accent > 0.06 ? 2 : 1) : 0;
  const inWin = list.filter((o) => o.a > 0.0005);
  for (let i = 0; i < accN && inWin.length > 1; i++) { const o = inWin.pop(); map.set(o.ob, 'accent'); got.accent += o.a; }
  for (const o of list) {
    if (map.has(o.ob)) continue;
    let best = 'dominant', bv = -1e9;
    for (const r of ['dominant', 'secondary', 'dark', 'light']) {
      const t = P.props[r];
      if (!(t > 0)) continue;
      const v = (t - got[r]) / t + hash01(layer.seed, o.ob, r) * 0.15;
      if (v > bv) { bv = v; best = r; }
    }
    map.set(o.ob, best);
    got[best] += o.a;
  }
  geo.roleCache = { key, map };
  return map;
}
function groupColor(key) {
  return `hsl(${hashStr(String(key)) % 360} 60% 58%)`;
}

// Per-item tone: value offset from the structure, the graph, and random variety.
function toneFor(it, i, layer) {
  const p = layer.p;
  let lo = (it.lOff || 0) + (it.gv || 0), hr = 0;
  if ((p.valueJitter || p.hueJitter) && !it.ground) {
    const k = groupKey(it, i, p.jitterBy || 'cluster');
    lo += (hash01(layer.seed, k, 'v') * 2 - 1) * (p.valueJitter || 0);
    hr = (hash01(layer.seed, k, 'h') * 2 - 1) * (p.hueJitter || 0);
  }
  return { lo, hr };
}

function fillItem(ctx, it, idx, st, L, lg, layer, view, lod) {
  const p = layer.p;
  if (view === 'groups') {
    ctx.fillStyle = it.ground ? '#444' : groupColor(lg.keys[idx] + layer.seed);
    ctx.fill(it.p2d);
    return;
  }
  const sty = styleFor(st, it);
  const tn = toneFor(it, idx, layer);
  // Tiny shapes: one flat colour, read off the group's volume at the shape's centre.
  if ((it.r < lod || it.detail) && !it.facets && !it.ground) {
    let shade = st.renderStyle === 'flat' || st.renderStyle === 'paper' ? 0 : it.n3 ? dot3(it.n3, L) : 0.15;
    const grp = lg.map.get(lg.keys[idx]);
    if (p.volume > 0 && grp && (grp.n > 1 || p.lightGroup === 'layer')) {
      const sx = clamp(((it.c[0] - grp.cx) * L.dx + (it.c[1] - grp.cy) * L.dy) / grp.r, -1, 1);
      shade = lerp(shade, sx * L.k + Math.sqrt(1 - sx * sx) * L.z, p.volume);
    }
    ctx.fillStyle = sty.css(shade, tn.lo, tn.hr);
    ctx.fill(it.p2d);
    return;
  }
  const rs = st.renderStyle;
  if (rs === 'flat' || rs === 'paper') {
    ctx.fillStyle = sty.css(0, tn.lo, tn.hr);
    ctx.fill(it.p2d);
    return;
  }
  if (rs === 'form' && !it.facets && !it.ground) {
    // Form light: three ramp steps across the shape, light side to shadow side.
    const v = it.vol || { cx: it.c[0], cy: it.c[1], r: it.r };
    const g = ctx.createLinearGradient(v.cx + L.dx * v.r, v.cy + L.dy * v.r, v.cx - L.dx * v.r, v.cy - L.dy * v.r);
    g.addColorStop(0, sty.css(1, tn.lo, tn.hr));
    g.addColorStop(0.5, sty.css(0, tn.lo, tn.hr));
    g.addColorStop(1, sty.css(-1, tn.lo, tn.hr));
    ctx.fillStyle = g;
    ctx.fill(it.p2d);
    return;
  }
  if (it.kind === 'branch') {
    fillBranch(ctx, it, sty, tn, L, lod);
  } else if (it.n3) {
    const shade = dot3(it.n3, L);
    if (it.grad) {
      const g = ctx.createLinearGradient(0, it.grad.y0, 0, it.grad.y1);
      g.addColorStop(0, sty.css(shade, tn.lo + it.grad.from, tn.hr));
      g.addColorStop(1, sty.css(shade, tn.lo + it.grad.to, tn.hr));
      ctx.fillStyle = g;
    } else ctx.fillStyle = sty.css(shade, tn.lo, tn.hr);
    ctx.fill(it.p2d);
  } else if (it.facets) {
    ctx.fillStyle = sty.css(0, tn.lo, tn.hr);
    ctx.fill(it.p2d);
    ctx.save();
    ctx.clip(it.p2d);
    for (const f of it.facets) {
      ctx.fillStyle = sty.css(dot3(f.n3, L), tn.lo, tn.hr);
      ctx.fill(f.p2d);
    }
    ctx.restore();
  } else {
    let r = it.fixedRound ? it.round : p.roundAuto ? it.round : p.roundness;
    // Blends near either end look the same as the pure model and cost twice as much.
    if (r > 0.88) r = 1;
    else if (r < 0.12) r = 0;
    if (r < 1) {
      ctx.fillStyle = sty.css(0, tn.lo, tn.hr);
      ctx.fill(it.p2d);
      ctx.save();
      ctx.clip(it.p2d);
      drawBevel(ctx, it, sty, tn, L);
      ctx.restore();
    }
    if (r > 0) {
      const v = it.vol || { cx: it.c[0], cy: it.c[1], r: it.r };
      ctx.globalAlpha = r;
      ctx.fillStyle = sphereGrad(ctx, v.cx, v.cy, v.r, L, sty, tn, st.steps);
      ctx.fill(it.p2d);
      ctx.globalAlpha = 1;
    }
  }
  // Fade toward a flat colour lower down: mountain planes melt into one mass,
  // hill bumps melt into the ground plane.
  if (it.fade) {
    const c = sty.rgb(it.fade.n3 ? dot3(it.fade.n3, L) : 0, tn.lo, tn.hr);
    const g = ctx.createLinearGradient(0, it.fade.y0, 0, it.fade.y1);
    g.addColorStop(0, rgba(c, 0));
    g.addColorStop(1, rgba(c, 1));
    ctx.fillStyle = g;
    ctx.fill(it.p2d);
  }
  if (p.volume > 0 && !it.ground && it.kind !== 'mass') {
    const grp = lg.map.get(lg.keys[idx]);
    if (grp && (grp.n > 1 || p.lightGroup === 'layer')) {
      ctx.globalAlpha = p.volume;
      ctx.fillStyle = sphereGrad(ctx, grp.cx, grp.cy, grp.r, L, sty, tn, st.steps);
      ctx.fill(it.p2d);
      ctx.globalAlpha = 1;
    }
  }
}

// Outline: stroke every edge, then the fills cover the inner half and any inner edges
// of a group, leaving one line around the union. Each edge knows which way it faces,
// so its width can follow the light, and (lost & found) fade where the value behind
// it is close to the layer's own.
function strokeRun(ctx, items, a, b, p, L, u, color, behind) {
  const lw = p.lineWidth * u * 2;
  const thr = 1 - 2 * p.lineBreak;
  const nz = noiseFor(777);
  const passes = Math.max(1, Math.round(p.linePasses));
  const wob = p.lineWobble * 6 * u;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let pass = 0; pass < passes; pass++) {
    const bins = new Map();
    const jit = (q) => (wob ? [q[0] + nz.n2(q[0] * 0.02 + pass * 7.1, q[1] * 0.02) * wob, q[1] + nz.n2(q[0] * 0.02, q[1] * 0.02 + pass * 3.3 + 50) * wob] : q);
    for (let i = a; i < b; i++) {
      const it = items[i];
      if (it.detail) continue;
      const P = it.poly, n = P.length;
      for (let k = 0; k < n; k++) {
        const q0 = P[k], q1 = P[(k + 1) % n];
        const ex = q1[0] - q0[0], ey = q1[1] - q0[1];
        const len = Math.hypot(ex, ey);
        if (len < 1e-6) continue;
        const ox = ey / len, oy = -ex / len;
        const d = ox * L.dx + oy * L.dy;
        let f = p.lineBreak > 0 ? 1 - smoothstep(thr - 0.3, thr, d) : 1;
        if (behind) {
          const contrast = Math.abs(behind.at((q0[0] + q1[0]) / 2 + ox * 5 * u, (q0[1] + q1[1]) / 2 + oy * 5 * u) - behind.L);
          f *= lerp(1, clamp(contrast / (0.25 * p.lineLost + 1e-3)), p.lineLost);
        }
        const w = lw * clamp(1 - p.lineWeight * d, 0.1, 2.5) * f;
        if (w < 0.3) continue;
        const key = Math.max(0.5, Math.round(w * 2) / 2);
        let path = bins.get(key);
        if (!path) bins.set(key, (path = new Path2D()));
        const A = jit(q0), B = jit(q1);
        path.moveTo(A[0], A[1]);
        path.lineTo(B[0], B[1]);
      }
    }
    ctx.globalAlpha = passes > 1 ? 0.7 : 1;
    for (const [w, path] of bins) { ctx.lineWidth = w; ctx.stroke(path); }
  }
  ctx.globalAlpha = 1;
}

function lineColor(p, st, g, grey) {
  switch (p.lineTone) {
    case 'ink': return grey ? greyCss(g.ink) : g.ink;
    case 'custom': return grey ? greyCss(p.lineColor) : p.lineColor;
    case 'lighter': return st.base.css(1, 0.2);
    default: return st.base.css(-1, -0.2);
  }
}

// Luminance of what is already painted, sampled at quarter size.
function behindSampler(o) {
  const w = Math.ceil(o.W / 4), h = Math.ceil(o.H / 4);
  const c = o.behind;
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  const bc = c.getContext('2d', { willReadFrequently: true });
  bc.drawImage(o.mainCanvas, 0, 0, w, h);
  const d = bc.getImageData(0, 0, w, h).data;
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return (x, y) => {
    const i = (clamp(Math.floor(y / 4), 0, h - 1) * w + clamp(Math.floor(x / 4), 0, w - 1)) * 4;
    return Math.cbrt(0.2126 * lin(d[i]) + 0.7152 * lin(d[i + 1]) + 0.0722 * lin(d[i + 2]));
  };
}

// Silhouette minus a copy shifted away from the light leaves a crescent on the lit outline.
// Used for rim light (thin, crisp) and backlit glow (wide, soft, warm).
function drawCrescent(ctx, geo, o, L, w, color, blur, alpha, comp) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const it of geo.items) {
    if (it.ground || it.detail) continue;
    x0 = Math.min(x0, it.bb.x0); y0 = Math.min(y0, it.bb.y0);
    x1 = Math.max(x1, it.bb.x1); y1 = Math.max(y1, it.bb.y1);
  }
  const pad = blur * 2 + 2;
  const bx = Math.max(0, Math.floor(x0 - pad)), by = Math.max(0, Math.floor(y0 - pad));
  const bw = Math.min(o.W, Math.ceil(x1 + pad)) - bx, bh = Math.min(o.H, Math.ceil(y1 + pad)) - by;
  if (bw <= 0 || bh <= 0) return;
  const R = o.rimCanvas;
  if (R.width !== o.W || R.height !== o.H) { R.width = o.W; R.height = o.H; }
  const rc = R.getContext('2d');
  rc.setTransform(1, 0, 0, 1, 0, 0);
  rc.globalCompositeOperation = 'source-over';
  rc.clearRect(bx, by, bw, bh);
  rc.fillStyle = color;
  rc.fill(geo.unionNoGround);
  rc.globalCompositeOperation = 'destination-out';
  rc.translate(-L.dx * w, -L.dy * w);
  rc.fill(geo.unionNoGround);
  rc.setTransform(1, 0, 0, 1, 0, 0);
  rc.globalCompositeOperation = 'source-over';
  ctx.save();
  if (blur > 0) { ctx.filter = `blur(${blur}px)`; }
  ctx.globalAlpha = alpha;
  if (comp) ctx.globalCompositeOperation = comp;
  ctx.drawImage(R, bx, by, bw, bh, bx, by, bw, bh);
  ctx.restore();
}

// Hatching: parallel strokes inside each group, only on the side away from the light.
function drawHatch(ctx, geo, p, st, L, o, lg) {
  const gap = p.hatchGap * o.u;
  const a = deg(p.hatchAngle);
  const dir = [Math.cos(a), Math.sin(a)], nrm = [-Math.sin(a), Math.cos(a)];
  const dL = dir[0] * L.dx + dir[1] * L.dy, nL = nrm[0] * L.dx + nrm[1] * L.dy;
  const groundKeys = new Set(geo.items.map((it, i) => (it.ground || it.detail ? lg.keys[i] : null)));
  const path = new Path2D();
  for (const [key, grp] of lg.map) {
    if (groundKeys.has(key)) continue;
    const { cx, cy, r } = grp;
    for (let t = -r + (hash01(key) * gap); t <= r; t += gap) {
      const half = Math.sqrt(Math.max(0, r * r - t * t));
      const A = (t * nL) / r, Bc = dL / r;
      let s0 = -half, s1 = half;
      const lim = -p.hatchCut - A;
      if (Math.abs(Bc) < 1e-6) { if (A >= -p.hatchCut) continue; }
      else if (Bc > 0) s1 = Math.min(s1, lim / Bc);
      else s0 = Math.max(s0, lim / Bc);
      if (s1 <= s0) continue;
      const px = cx + nrm[0] * t, py = cy + nrm[1] * t;
      path.moveTo(px + dir[0] * s0, py + dir[1] * s0);
      path.lineTo(px + dir[0] * s1, py + dir[1] * s1);
    }
  }
  ctx.save();
  ctx.clip(geo.unionNoGround);
  ctx.strokeStyle = st.base.css(-1, -0.3);
  ctx.globalAlpha = p.hatch;
  ctx.lineWidth = 1.1 * o.u;
  ctx.stroke(path);
  ctx.restore();
}

// A soft, half-resolution pass drawn under the layer: offset or cast shadow clones,
// contact shadows, and the separation halo all go through here.
function softPass(ctx, o, draw, { color, blur, alpha, comp, maskLand }) {
  const k = 0.5;
  const A = o.cloneA, B = o.cloneB;
  const cw = Math.ceil(o.W * k), ch = Math.ceil(o.H * k);
  for (const c of [A, B]) if (c.width !== cw || c.height !== ch) { c.width = cw; c.height = ch; }
  const ac = A.getContext('2d');
  ac.setTransform(1, 0, 0, 1, 0, 0);
  ac.globalCompositeOperation = 'source-over';
  ac.clearRect(0, 0, cw, ch);
  ac.setTransform(k, 0, 0, k, 0, 0);
  ac.fillStyle = '#000';
  const bb = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  draw(ac, bb);
  if (bb.x0 === Infinity) return;
  const pad = blur * 3 + 2;
  const bx = Math.max(0, Math.floor((bb.x0 - pad) * k)), by = Math.max(0, Math.floor((bb.y0 - pad) * k));
  const bw = Math.min(cw, Math.ceil((bb.x1 + pad) * k)) - bx, bh = Math.min(ch, Math.ceil((bb.y1 + pad) * k)) - by;
  if (bw <= 0 || bh <= 0) return;
  ac.setTransform(1, 0, 0, 1, 0, 0);
  ac.globalCompositeOperation = 'source-in';
  ac.fillStyle = color;
  ac.fillRect(bx, by, bw, bh);
  if (maskLand) {
    ac.globalCompositeOperation = 'destination-in';
    ac.drawImage(o.landMask, bx, by, bw, bh, bx, by, bw, bh);
  }
  ac.globalCompositeOperation = 'source-over';
  let src = A;
  if (blur > 0) {
    const bc = B.getContext('2d');
    bc.clearRect(bx, by, bw, bh);
    bc.filter = `blur(${blur * k}px)`;
    bc.drawImage(A, bx, by, bw, bh, bx, by, bw, bh);
    bc.filter = 'none';
    src = B;
  }
  ctx.save();
  ctx.globalCompositeOperation = comp;
  ctx.globalAlpha = alpha;
  ctx.drawImage(src, bx, by, bw, bh, bx / k, by / k, bw / k, bh / k);
  ctx.restore();
}
const growBB = (bb, b, dx = 0, dy = 0) => {
  bb.x0 = Math.min(bb.x0, b.x0 + dx); bb.y0 = Math.min(bb.y0, b.y0 + dy);
  bb.x1 = Math.max(bb.x1, b.x1 + dx); bb.y1 = Math.max(bb.y1, b.y1 + dy);
};

function drawUnder(ctx, layer, geo, st, L, o, grey) {
  const p = layer.p;
  const g = o.scene.globals;
  let sh = grey ? [0, 0] : hueAB(g.shadowHue, 0.06);
  if (st.palette && !grey) { const d = lchToLab(st.palette.roles.dark); sh = [d[1] * 0.7, d[2] * 0.7]; }
  const shadowCol = labCss(0.42, sh[0], sh[1]);
  const solid = geo.items.filter((it) => !it.ground && !it.detail);
  if (g.renderStyle === 'paper' && g.paperShadow > 0) {
    // Cut paper: every layer throws a small soft shadow onto whatever is behind it.
    const dist = Math.min(o.W, o.H) * 0.012 * (1 + g.paperShadow * 2);
    const tx = -L.dx * dist, ty = -L.dy * dist;
    const dk = st.palette && !grey ? lchToLab(rampOf(st.palette, 'dark')[0]) : [0.2, 0, 0];
    softPass(ctx, o, (ac, bb) => {
      ac.translate(tx, ty);
      for (const it of geo.items) { if (it.detail) continue; ac.fill(it.p2d); growBB(bb, it.bb, tx, ty); }
    }, { color: labCss(dk[0], grey ? 0 : dk[1], grey ? 0 : dk[2]), blur: Math.min(o.W, o.H) * 0.006, alpha: 0.25 + 0.45 * g.paperShadow, comp: 'source-over', maskLand: false });
  }
  if (p.halo > 0) {
    const hz = hexToLab(g.hazeColor || g.skyHorizon);
    softPass(ctx, o, (ac, bb) => { for (const it of solid) { ac.fill(it.p2d); growBB(bb, it.bb); } }, {
      color: labCss(Math.min(0.97, st.vg.value + 0.25), grey ? 0 : hz[1], grey ? 0 : hz[2]), blur: p.haloSize * o.u, alpha: p.halo, comp: 'screen', maskLand: false,
    });
  }
  if (p.contact > 0) {
    const obs = groupsFor(geo, 'object');
    softPass(ctx, o, (ac, bb) => {
      const seen = new Set();
      solid.forEach((it) => {
        const k = `o${it.ob}`;
        if (seen.has(k)) return;
        seen.add(k);
        const grp = obs.map.get(k);
        if (!grp) return;
        const w = (grp.x1 - grp.x0) * 0.42, hh = Math.max(3 * o.u, w * 0.12);
        const cx = (grp.x0 + grp.x1) / 2, cy = grp.foot;
        ac.beginPath();
        ac.ellipse(cx, cy, w, hh, 0, 0, Math.PI * 2);
        ac.fill();
        growBB(bb, { x0: cx - w, x1: cx + w, y0: cy - hh, y1: cy + hh });
      });
    }, { color: shadowCol, blur: 6 * o.u, alpha: p.contact, comp: 'multiply', maskLand: true });
  }
  if (p.clone > 0) {
    const pick = (it) => p.cloneFraction >= 1 || hash01(layer.seed, it.ob) <= p.cloneFraction;
    if (p.cloneMode === 'cast') {
      // Cast: flatten each object onto the ground from its foot, pushed away from the sun.
      const obs = groupsFor(geo, 'object');
      const len = p.castLen;
      let fy = -0.35 * L.z;
      if (Math.abs(fy) < 0.08) fy = 0.08 * (fy < 0 ? -1 : 1);
      softPass(ctx, o, (ac, bb) => {
        for (const it of solid) {
          if (!pick(it)) continue;
          const grp = obs.map.get(`o${it.ob}`);
          const base = grp ? grp.foot : it.bb.y1;
          ac.beginPath();
          it.poly.forEach((q, i) => {
            const hgt = Math.max(0, base - q[1]);
            const x = q[0] - L.dx * hgt * len * 0.8, y = base + hgt * len * fy;
            i ? ac.lineTo(x, y) : ac.moveTo(x, y);
            growBB(bb, { x0: x, x1: x, y0: y, y1: y });
          });
          ac.closePath();
          ac.fill();
        }
      }, { color: shadowCol, blur: p.cloneSoft * o.u, alpha: p.clone, comp: 'multiply', maskLand: !p.cloneOnSky });
    } else {
      const tx = -L.dx * p.cloneOffset * o.u, ty = -L.dy * p.cloneOffset * o.u;
      softPass(ctx, o, (ac, bb) => {
        ac.translate(tx, ty);
        for (const it of solid) { if (pick(it)) { ac.fill(it.p2d); growBB(bb, it.bb, tx, ty); } }
      }, { color: shadowCol, blur: p.cloneSoft * o.u, alpha: p.clone, comp: 'multiply', maskLand: !p.cloneOnSky });
    }
  }
}

// Dappled light for far layers: a noise field split into lit and shadowed patches,
// like cloud shadows drifting over distant hills.
const fieldCache = new Map();
function dappleField(layer, W, H, s) {
  return fieldFor(hashInts(layer.seed, 555), layer.p.dappleScale, layer.p.dappleStretch, W, H, s);
}
function fieldFor(seed, scale, stretch, W, H, s) {
  const key = [seed, scale, stretch, W, H, s].join(',');
  let f = fieldCache.get(key);
  if (f) return f;
  const w = Math.ceil(W / s), h = Math.ceil(H / s);
  const data = new Float32Array(w * h);
  const nz = noiseFor(seed);
  const sc = scale * 3;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data[y * w + x] = nz.fbm((((x * s) / H) * sc) / stretch, ((y * s) / H) * sc, 3);
  f = { w, h, data };
  if (fieldCache.size > 30) fieldCache.clear();
  fieldCache.set(key, f);
  return f;
}
const dappleImages = new Map();
function drawDapple(ctx, layer, geo, st, o) {
  const p = layer.p;
  const s = 3;
  const f = dappleField(layer, o.W, o.H, s);
  const lit = st.base.rgb(0.95), dk = st.base.rgb(-0.95);
  const key = [lit, dk, p.dappleCover, f.w, f.h, p.dappleScale, p.dappleStretch, layer.seed].join('|');
  let cached = dappleImages.get(layer.id);
  if (!cached || cached.key !== key) {
    const small = document.createElement('canvas');
    small.width = f.w;
    small.height = f.h;
    const sc = small.getContext('2d');
    const img = sc.createImageData(f.w, f.h);
    const thr = lerp(-0.45, 0.45, p.dappleCover);
    const d = img.data;
    for (let i = 0; i < f.data.length; i++) {
      const t = clamp((f.data[i] - thr) / 0.08 + 0.5);
      d[i * 4] = dk[0] + (lit[0] - dk[0]) * t;
      d[i * 4 + 1] = dk[1] + (lit[1] - dk[1]) * t;
      d[i * 4 + 2] = dk[2] + (lit[2] - dk[2]) * t;
      d[i * 4 + 3] = 255;
    }
    sc.putImageData(img, 0, 0);
    cached = { key, small };
    dappleImages.set(layer.id, cached);
  }
  ctx.save();
  ctx.clip(geo.union);
  ctx.globalAlpha = p.dapple;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(cached.small, 0, 0, f.w, f.h, 0, 0, f.w * s, f.h * s);
  ctx.restore();
}

function drawSky(ctx, layer, st, g, L, o, grey) {
  const { W, H } = o;
  const p = layer.p;
  const top = hexToLab(g.skyTop), hor = hexToLab(g.skyHorizon);
  const v = st.vg.value + p.valueNudge;
  const c = (lab, L0) => labCss(L0, grey ? 0 : lab[1] * p.chroma, grey ? 0 : lab[2] * p.chroma);
  const hy = g.horizonY * H;
  const grad = ctx.createLinearGradient(0, 0, 0, hy);
  const flat = g.renderStyle === 'flat' || g.renderStyle === 'paper';
  if (st.palette) {
    // Palette sky: the role's ramp, a touch darker at the top, lighter at the horizon.
    const k = flat ? 0 : p.skyDrop / 0.14;
    grad.addColorStop(0, st.base.css(-0.9 * k));
    grad.addColorStop(0.55, st.base.css(-0.3 * k));
    grad.addColorStop(1, st.base.css(0.5 * k));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, hy + 1);
    ctx.fillStyle = st.base.css(0.4 * k);
    ctx.fillRect(0, hy, W, H - hy);
  } else {
    grad.addColorStop(0, c(top, v - p.skyDrop));
    grad.addColorStop(0.55, c([0, lerp(top[1], hor[1], 0.45), lerp(top[2], hor[2], 0.45)], v - p.skyDrop * 0.35));
    grad.addColorStop(1, c(hor, v + p.skyDrop * 0.2));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, hy + 1);
    ctx.fillStyle = c(hor, v + p.skyDrop * 0.1);
    ctx.fillRect(0, hy, W, H - hy);
  }
  if ((p.glow > 0 || p.sunDisc > 0) && L.z < 0.35) {
    const strength = clamp((0.35 - L.z) / 1.1);
    const [sx, sy] = sunPos(g, L, W, H);
    let ab = grey ? [0, 0] : hueAB(g.sunHue, 0.11);
    if (st.palette && !grey) { const lt = lchToLab(st.palette.roles.light); ab = [lt[1], lt[2]]; }
    const col = labToRgb(Math.min(1, v + 0.12), ab[0], ab[1]);
    if (p.glow > 0) {
      const r = p.glowSize * Math.max(W, H) * 0.6;
      const rg = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
      rg.addColorStop(0, rgba(col, p.glow * strength));
      rg.addColorStop(0.25, rgba(col, p.glow * strength * 0.45));
      rg.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, W, H);
    }
    if (p.sunDisc > 0) {
      ctx.fillStyle = rgba(labToRgb(Math.min(1, v + 0.2), ab[0] * 0.5, ab[1] * 0.5), p.sunDisc);
      ctx.beginPath();
      ctx.arc(sx, sy, 26 * o.u, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// Water: a flipped copy of what is already painted above the water line, broken into
// thin strips nudged sideways by noise (ripples), over the water's own colour.
function drawWater(ctx, layer, st, o) {
  const { W, H } = o;
  const p = layer.p;
  const y0 = Math.round(p.waterY * H);
  if (y0 >= H) return;
  const tmp = o.rimCanvas;
  if (tmp.width !== W || tmp.height !== H) { tmp.width = W; tmp.height = H; }
  const tc = tmp.getContext('2d');
  tc.setTransform(1, 0, 0, 1, 0, 0);
  tc.clearRect(0, 0, W, H);
  tc.drawImage(o.mainCanvas, 0, 0, W, y0, 0, 0, W, y0);
  const nz = noiseFor(hashInts(layer.seed, 41));
  ctx.save();
  ctx.fillStyle = st.base.css(0);
  ctx.fillRect(0, y0, W, H - y0);
  ctx.globalAlpha = p.reflect;
  const strip = 2;
  for (let y = y0; y < H; y += strip) {
    const d = y - y0;
    const sy = y0 - d - strip;
    if (sy < 0) break;
    const k = d / Math.max(1, H - y0);
    const off = nz.fbm(y * 0.015 * p.rippleScale, 3.3, 2) * p.ripple * o.u * (0.3 + k * 2);
    ctx.drawImage(tmp, 0, sy, W, strip, off, y, W, strip);
  }
  // Water darkens and takes its own colour with distance from the line.
  const g = ctx.createLinearGradient(0, y0, 0, H);
  const c0 = st.base.rgb(0), c1 = st.base.rgb(-0.6);
  g.addColorStop(0, rgba(c0, 0.1));
  g.addColorStop(1, rgba(c1, 0.55));
  ctx.globalAlpha = 1;
  ctx.fillStyle = g;
  ctx.fillRect(0, y0, W, H - y0);
  const rng = hashInts(layer.seed, 3);
  const light = st.base.css(1, 0.25);
  ctx.fillStyle = light;
  for (let i = 0; i < p.streakCount; i++) {
    const t = Math.pow(hash01(rng, i, 'y'), 1.4);
    const y = y0 + 3 + t * (H - y0);
    const x = hash01(rng, i, 'x') * W, w = (60 + 400 * t) * o.u * hash01(rng, i, 'w');
    ctx.globalAlpha = 0.18;
    ctx.fillRect(x, y, w, Math.max(1, 1.5 * o.u * (0.5 + t)));
  }
  ctx.globalAlpha = 0.8;
  for (let i = 0; i < p.glints; i++) {
    const t = Math.pow(hash01(rng, i, 'gy'), 1.2);
    const y = y0 + 2 + t * (H - y0);
    const x = hash01(rng, i, 'gx') * W, w = (3 + 12 * t) * o.u;
    ctx.fillRect(x, y, w, Math.max(1, o.u * (0.6 + t)));
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = st.base.css(-1, -0.12);
  ctx.fillRect(0, y0, W, Math.max(1, 1.5 * o.u));
  ctx.restore();
}

// Light shafts: take the visible bright sky, smear it outward from the sun in a few
// zoom passes, and add it on top. Near shapes that block the sky cut the shafts.
function drawRays(ctx, g, L, o, grey) {
  const s = 4;
  const w = Math.ceil(o.W / s), h = Math.ceil(o.H / s);
  const A = o.rayA, B = o.rayB;
  for (const c of [A, B]) if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  const ac = A.getContext('2d'), bc = B.getContext('2d');
  ac.globalCompositeOperation = 'source-over';
  ac.clearRect(0, 0, w, h);
  ac.drawImage(o.mainCanvas, 0, 0, w, h);
  ac.globalCompositeOperation = 'destination-out';
  ac.drawImage(o.landMask, 0, 0, w, h);
  ac.globalCompositeOperation = 'multiply';
  ac.drawImage(A, 0, 0);
  ac.globalCompositeOperation = 'source-over';
  const [sx, sy] = sunPos(g, L, o.W, o.H).map((v) => v / s);
  let src = A, dst = B;
  for (let pass = 0; pass < 3; pass++) {
    const dc = dst.getContext('2d');
    dc.clearRect(0, 0, w, h);
    const n = 8;
    for (let i = 0; i < n; i++) {
      const k = 1 + (i / n) * g.rayLength * 0.5 * Math.pow(2, pass) * 0.5;
      dc.globalAlpha = 1 / (i + 1) ** 0.3 / 3;
      dc.drawImage(src, sx - sx * k, sy - sy * k, w * k, h * k);
    }
    [src, dst] = [dst, src];
  }
  const ab = grey ? [0, 0] : hueAB(g.sunHue, 0.12);
  const sc = src.getContext('2d');
  sc.globalAlpha = 1;
  sc.globalCompositeOperation = 'multiply';
  sc.fillStyle = labCss(0.95, ab[0], ab[1]);
  sc.fillRect(0, 0, w, h);
  sc.globalCompositeOperation = 'source-over';
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = g.rays;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(src, 0, 0, w, h, 0, 0, o.W, o.H);
  ctx.restore();
}

let grainCanvas = null;
function grainPattern(ctx) {
  if (!grainCanvas) {
    grainCanvas = document.createElement('canvas');
    grainCanvas.width = grainCanvas.height = 256;
    const gc = grainCanvas.getContext('2d');
    const img = gc.createImageData(256, 256);
    const nz = noiseFor(4242);
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
      const i = (y * 256 + x) * 4;
      const v = 128 + (hash01(x, y, 'g') - 0.5) * 120 + nz.fbm(x / 22, y / 22, 3) * 50;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = clamp(v, 0, 255);
      img.data[i + 3] = 255;
    }
    gc.putImageData(img, 0, 0);
  }
  return ctx.createPattern(grainCanvas, 'repeat');
}

function finish(ctx, g, o, grey) {
  const { W, H } = o;
  ctx.save();
  if (!grey && g.saturation < 1 && g.contrast === 1) {
    // Pulling saturation down: paint grey in "saturation" mode at partial strength.
    ctx.globalCompositeOperation = 'saturation';
    ctx.globalAlpha = 1 - g.saturation;
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  } else if (!grey && (g.saturation !== 1 || g.contrast !== 1)) {
    ctx.filter = `saturate(${g.saturation}) contrast(${g.contrast})`;
    ctx.drawImage(o.mainCanvas, 0, 0);
    ctx.filter = 'none';
  } else if (grey && g.contrast !== 1) {
    ctx.filter = `contrast(${g.contrast})`;
    ctx.drawImage(o.mainCanvas, 0, 0);
    ctx.filter = 'none';
  }
  if (!grey && g.warmth) {
    ctx.globalCompositeOperation = 'soft-light';
    ctx.globalAlpha = Math.abs(g.warmth) * 0.5;
    ctx.fillStyle = g.warmth > 0 ? '#ff9a40' : '#4080ff';
    ctx.fillRect(0, 0, W, H);
  }
  if (g.vignette > 0) {
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 1;
    const r = Math.hypot(W, H) / 2;
    const rg = ctx.createRadialGradient(W / 2, H / 2, r * 0.35, W / 2, H / 2, r);
    rg.addColorStop(0, 'rgba(255,255,255,0)');
    rg.addColorStop(1, `rgba(40,35,45,${g.vignette * 0.75})`);
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, W, H);
  }
  if (g.grain > 0) {
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = g.grain * 0.45;
    ctx.fillStyle = grainPattern(ctx);
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
}

function drawLayer(ctx, layer, geo, st, L, o, grey) {
  const p = layer.p;
  const items = geo.items;
  const lg = groupsFor(geo, p.lightGroup);
  const view = o.view;
  const lineOn = p.lineMode !== 'none' && view !== 'groups';
  let runs = [[0, items.length]];
  if (lineOn) {
    const keys = groupsFor(geo, p.lineMode).keys;
    runs = [];
    let start = 0;
    for (let i = 1; i <= items.length; i++) {
      if (i === items.length || keys[i] !== keys[start]) { runs.push([start, i]); start = i; }
    }
  }
  st.renderStyle = view === 'groups' ? 'modelled' : o.scene.globals.renderStyle || 'modelled';
  st.roleMap = st.palette && p.roleMix ? rolesByArea(geo, layer, st.palette, o.W, o.H) : null;
  const lc = lineOn ? lineColor(p, st, o.scene.globals, grey) : null;
  const behind = lineOn && p.lineLost > 0 ? { at: behindSampler(o), L: st.base.L } : null;
  const lod = view === 'groups' ? 0 : 3.5 * o.u;
  for (const [a, b] of runs) {
    if (lineOn) strokeRun(ctx, items, a, b, p, L, o.u, lc, behind);
    for (let i = a; i < b; i++) fillItem(ctx, items[i], i, st, L, lg, layer, view, lod);
  }
  if (view === 'groups') return;
  if (p.hatch > 0) drawHatch(ctx, geo, p, st, L, o, lg);
  if (p.rim > 0) drawCrescent(ctx, geo, o, L, p.rim * 6 * o.u, st.base.css(1, 0.14), 0, 1, null);
  if (p.glow > 0 && L.z < 0.25) {
    const ab = grey ? [0, 0] : hueAB(o.scene.globals.sunHue, 0.14);
    drawCrescent(ctx, geo, o, L, p.glow * 16 * o.u, labCss(Math.min(0.95, st.base.L + 0.3), ab[0], ab[1]), p.glow * 6 * o.u, clamp((0.25 - L.z) * 1.5), 'screen');
  }
  if (p.dapple > 0) drawDapple(ctx, layer, geo, st, o);
}

// Value check: squash the picture into 2 or 3 flat values.
function notan(ctx, W, H, levels, t1, t2) {
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  const lin = new Float32Array(256);
  for (let i = 0; i < 256; i++) { const c = i / 255; lin[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  const outs = [labToRgb(0.16, 0, 0)[0], labToRgb(0.58, 0, 0)[0], labToRgb(0.94, 0, 0)[0]];
  for (let i = 0; i < d.length; i += 4) {
    const L = Math.cbrt(0.2126 * lin[d[i]] + 0.7152 * lin[d[i + 1]] + 0.0722 * lin[d[i + 2]]);
    const v = levels === 2 ? (L < t1 ? outs[0] : outs[2]) : L < t1 ? outs[0] : L < t2 ? outs[1] : outs[2];
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
}

function drawStructure(ctx, scene, geos, selectedId, u) {
  ctx.save();
  ctx.lineWidth = 1.5 * u;
  for (const layer of scene.layers) {
    if (!layer.visible || (selectedId && selectedId !== 'scene' && layer.id !== selectedId)) continue;
    const geo = geos.get(layer.id);
    if (!geo) continue;
    ctx.strokeStyle = 'rgba(255,40,200,0.85)';
    ctx.setLineDash([]);
    for (const line of geo.debug.lines) {
      ctx.beginPath();
      line.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(0,230,255,0.9)';
    for (const [x, y, r] of geo.debug.points) { ctx.beginPath(); ctx.arc(x, y, Math.max(2, r), 0, Math.PI * 2); ctx.stroke(); }
    const lg = groupsFor(geo, layer.p.lightGroup);
    ctx.strokeStyle = 'rgba(255,220,0,0.9)';
    ctx.setLineDash([6 * u, 5 * u]);
    for (const grp of lg.map.values()) {
      if (grp.n < 2) continue;
      ctx.beginPath();
      ctx.arc(grp.cx, grp.cy, grp.r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawSelection(ctx, geos, sel, u) {
  const geo = geos.get(sel.layerId);
  if (!geo) return;
  const grp = groupsFor(geo, 'object').map.get(`o${sel.ob}`);
  if (!grp) return;
  ctx.save();
  ctx.lineWidth = 2 * u;
  ctx.setLineDash([8 * u, 6 * u]);
  ctx.strokeStyle = '#ffd24a';
  ctx.strokeRect(grp.x0 - 4 * u, grp.y0 - 4 * u, grp.x1 - grp.x0 + 8 * u, grp.foot - grp.y0 + 8 * u);
  ctx.fillStyle = '#ffd24a';
  ctx.beginPath();
  ctx.arc((grp.x0 + grp.x1) / 2, grp.foot, 5 * u, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Camera parallax (near layers move more than far ones) and drifting sky layers.
export function layerOffset(scene, layer, W, H, t = 0, drift = 0) {
  const g = scene.globals;
  const d = layerDepth(scene, layer);
  const par = d * (layer.p.parallax ?? 1);
  let dx = -(g.camX || 0) * W * par, dy = -(g.camY || 0) * H * par;
  const drifting = !!drift && layer.band === 'sky' && layer.kind !== 'sky';
  if (drifting) dx = ((((dx + t * drift * W * 0.015 * (0.4 + d * 6)) % W) + W) % W);
  return [dx, dy, drifting];
}

// A layer either paints straight onto the picture, or (for blur, fades, noise masks and
// grain) onto its own canvas first, which is then treated and composited.
function drawLayerBody(ctx, lctx, LC, layer, geo, st, L, o, grey, blur) {
  const p = layer.p;
  const look = o.view !== 'groups' && ((p.opacity ?? 1) < 0.999 || p.opGrade > 0 || (p.mask && p.mask !== 'none') || p.texture > 0);
  if (blur <= 0.35 && !look) { drawLayer(ctx, layer, geo, st, L, o, grey); return; }
  lctx.setTransform(1, 0, 0, 1, 0, 0);
  lctx.globalCompositeOperation = 'source-over';
  lctx.globalAlpha = 1;
  lctx.clearRect(0, 0, o.W, o.H);
  drawLayer(lctx, layer, geo, st, L, o, grey);
  if (look) {
    if (p.texture > 0 && o.view !== 'notan2' && o.view !== 'notan3') applyTexture(lctx, LC, layer, o, grey);
    if (p.mask && p.mask !== 'none') applyMask(lctx, LC, layer, o);
    if (p.opGrade > 0) applyGrade(lctx, geo, p, o);
  }
  ctx.save();
  ctx.globalAlpha = p.opacity ?? 1;
  if (blur > 0.35 && blur < 3) {
    // Small blurs: shrink and stretch back with smoothing. Far cheaper than a filter.
    const k = 1 / (1 + blur * 0.8);
    const sw = Math.ceil(o.W * k), sh = Math.ceil(o.H * k);
    const SB = o.smallBlur;
    if (SB.width !== sw || SB.height !== sh) { SB.width = sw; SB.height = sh; }
    const sc = SB.getContext('2d');
    sc.clearRect(0, 0, sw, sh);
    sc.imageSmoothingEnabled = true;
    sc.drawImage(LC, 0, 0, sw, sh);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(SB, 0, 0, sw, sh, 0, 0, o.W, o.H);
  } else {
    if (blur >= 3) ctx.filter = `blur(${blur}px)`;
    ctx.drawImage(LC, 0, 0);
  }
  ctx.restore();
}

// Grain inside the shapes (Chroma Mat's colour noise): a noise image blended over the
// layer's own pixels only.
const texCache = new Map();
function textureImage(layer, W, H, grey) {
  const p = layer.p;
  const s = 2;
  const key = [layer.seed, p.textureScale, grey ? 0 : p.textureHue, W, H].join(',');
  let c = texCache.get(key);
  if (c) return c;
  const w = Math.ceil(W / s), h = Math.ceil(H / s);
  c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const cx = c.getContext('2d');
  const img = cx.createImageData(w, h);
  const n0 = noiseFor(hashInts(layer.seed, 901)), n1 = noiseFor(hashInts(layer.seed, 902)), n2 = noiseFor(hashInts(layer.seed, 903));
  const f = 1 / (4 * p.textureScale);
  const hue = grey ? 0 : p.textureHue;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const X = x * f, Y = y * f;
      const v = 128 + (n0.fbm(X, Y, 3) * 0.75 + (hash01(x, y, layer.seed) - 0.5) * 0.5) * 170;
      const i = (y * w + x) * 4;
      if (hue) {
        const hr = n1.fbm(X * 0.5, Y * 0.5, 2) * hue * 80, hb = n2.fbm(X * 0.5, Y * 0.5, 2) * hue * 80;
        img.data[i] = clamp(v + hr, 0, 255);
        img.data[i + 1] = clamp(v - (hr + hb) * 0.5, 0, 255);
        img.data[i + 2] = clamp(v + hb, 0, 255);
      } else img.data[i] = img.data[i + 1] = img.data[i + 2] = clamp(v, 0, 255);
      img.data[i + 3] = 255;
    }
  }
  cx.putImageData(img, 0, 0);
  if (texCache.size > 12) texCache.clear();
  texCache.set(key, c);
  return c;
}
function applyTexture(lctx, LC, layer, o, grey) {
  const p = layer.p;
  const tex = textureImage(layer, o.W, o.H, grey);
  const T = o.texCanvas;
  if (T.width !== o.W || T.height !== o.H) { T.width = o.W; T.height = o.H; }
  const tc = T.getContext('2d');
  tc.globalCompositeOperation = 'source-over';
  tc.clearRect(0, 0, o.W, o.H);
  tc.imageSmoothingEnabled = true;
  tc.drawImage(tex, 0, 0, o.W, o.H);
  tc.globalCompositeOperation = 'destination-in';
  tc.drawImage(LC, 0, 0);
  tc.globalCompositeOperation = 'source-over';
  lctx.save();
  lctx.globalCompositeOperation = p.textureBlend || 'soft-light';
  lctx.globalAlpha = Math.min(1, p.texture);
  lctx.drawImage(T, 0, 0);
  if (p.texture > 1) { lctx.globalAlpha = p.texture - 1; lctx.drawImage(T, 0, 0); }
  lctx.restore();
}

// Noise mask (Chroma Mat): noise decides which parts of the layer survive. "Dissolve" cuts
// holes; "Torn" adds noise to a blurred copy of the outline so only the rim breaks up.
function applyMask(lctx, LC, layer, o) {
  const p = layer.p;
  const s = 2;
  const f = fieldFor(hashInts(layer.seed, 777), p.maskScale, p.maskStretch, o.W, o.H, s);
  const M = o.maskCanvas;
  if (M.width !== f.w || M.height !== f.h) { M.width = f.w; M.height = f.h; }
  const mc = M.getContext('2d', { willReadFrequently: true });
  mc.setTransform(1, 0, 0, 1, 0, 0);
  let A = null;
  if (p.mask === 'torn') {
    mc.clearRect(0, 0, f.w, f.h);
    mc.filter = `blur(${Math.max(0.5, p.maskReach * o.u / s)}px)`;
    mc.drawImage(LC, 0, 0, f.w, f.h);
    mc.filter = 'none';
    A = mc.getImageData(0, 0, f.w, f.h).data;
  }
  const img = mc.createImageData(f.w, f.h);
  const wd = lerp(0.45, 0.01, clamp(p.maskSharp));
  for (let i = 0; i < f.data.length; i++) {
    const n = clamp(f.data[i] * 0.75 + 0.5);
    const v = A ? A[i * 4 + 3] / 255 + p.maskDepth * (n - 0.5) : n;
    img.data[i * 4 + 3] = clamp((v - p.maskClip) / wd + 0.5) * 255;
  }
  mc.putImageData(img, 0, 0);
  lctx.save();
  lctx.globalCompositeOperation = 'destination-in';
  lctx.imageSmoothingEnabled = true;
  lctx.drawImage(M, 0, 0, f.w, f.h, 0, 0, o.W, o.H);
  lctx.restore();
}

// Graded opacity: the layer fades toward one side.
function applyGrade(lctx, geo, p, o) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const it of geo.items) { x0 = Math.min(x0, it.bb.x0); y0 = Math.min(y0, it.bb.y0); x1 = Math.max(x1, it.bb.x1); y1 = Math.max(y1, Math.min(o.H, it.bb.y1)); }
  const a = deg(p.opAngle), dx = Math.cos(a), dy = Math.sin(a);
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, r = Math.abs((x1 - x0) / 2 * dx) + Math.abs((y1 - y0) / 2 * dy);
  const g = lctx.createLinearGradient(cx - dx * r, cy - dy * r, cx + dx * r, cy + dy * r);
  g.addColorStop(0, 'rgba(0,0,0,1)');
  g.addColorStop(1, `rgba(0,0,0,${1 - p.opGrade})`);
  lctx.save();
  lctx.globalCompositeOperation = 'destination-in';
  lctx.fillStyle = g;
  lctx.fillRect(0, 0, o.W, o.H);
  lctx.restore();
}

export function renderScene(ctx, scene, geos, o) {
  const g = scene.globals;
  const L = lightVec(g);
  const grey = o.view !== 'color' && o.view !== 'groups';
  o.mainCanvas = ctx.canvas;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = grey ? '#777' : '#8aa';
  ctx.fillRect(0, 0, o.W, o.H);
  let shapes = 0;
  const mk = o.landMask;
  const mw = Math.ceil(o.W / 2), mh = Math.ceil(o.H / 2);
  if (mk.width !== mw || mk.height !== mh) { mk.width = mw; mk.height = mh; }
  const mc = mk.getContext('2d');
  mc.setTransform(1, 0, 0, 1, 0, 0);
  mc.clearRect(0, 0, mw, mh);
  mc.setTransform(0.5, 0, 0, 0.5, 0, 0);
  mc.fillStyle = '#000';
  let raysDone = !(g.rays > 0) || o.view === 'groups';
  const LC = o.layerCanvas;
  if (LC.width !== o.W || LC.height !== o.H) { LC.width = o.W; LC.height = o.H; }
  const lctx = LC.getContext('2d');
  for (const layer of scene.layers) {
    if (!layer.visible) continue;
    if (!raysDone && (layer.band === 'close' || layer.band === 'veryclose')) { drawRays(ctx, g, L, o, grey); raysDone = true; }
    const st = layerStyles(scene, layer, grey);
    if (layer.kind === 'sky') {
      if (o.view !== 'groups') drawSky(ctx, layer, st, g, L, o, grey);
      else { ctx.fillStyle = '#222'; ctx.fillRect(0, 0, o.W, o.H); }
      continue;
    }
    if (layer.kind === 'water') {
      if (o.view !== 'groups') drawWater(ctx, layer, st, o);
      mc.fillRect(0, layer.p.waterY * o.H, o.W, o.H);
      continue;
    }
    const geo = geos.get(layer.id);
    if (!geo) continue;
    ensurePaths(geo);
    const [ox, oy, wrap] = layerOffset(scene, layer, o.W, o.H, o.time, o.drift);
    const blur = o.view === 'groups' ? 0 : (g.dof || 0) * 8 * o.u * Math.abs(st.depth - (g.focus ?? 0.8)) + (layer.p.blur || 0) * o.u;
    for (const dx of wrap ? [ox, ox - o.W] : [ox]) {
      ctx.save();
      ctx.translate(dx, oy);
      if (o.view !== 'groups') drawUnder(ctx, layer, geo, st, L, o, grey);
      drawLayerBody(ctx, lctx, LC, layer, geo, st, L, o, grey, blur);
      ctx.restore();
      if (layer.band !== 'sky') { mc.save(); mc.translate(dx, oy); mc.fill(geo.union); mc.restore(); }
    }
    shapes += geo.items.length;
  }
  if (!raysDone) drawRays(ctx, g, L, o, grey);
  if (o.view !== 'groups') finish(ctx, g, o, grey);
  if (o.view === 'notan2') notan(ctx, o.W, o.H, 2, g.notan1, g.notan2);
  if (o.view === 'notan3') notan(ctx, o.W, o.H, 3, g.notan1, g.notan2);
  if (o.structure) drawStructure(ctx, scene, geos, o.selectedId, o.u);
  if (o.selObj) drawSelection(ctx, geos, o.selObj, o.u);
  ctx.restore();
  return { shapes };
}

// Which layer and object is under a canvas point (front-most first).
export function pick(ctx, scene, geos, x, y, H) {
  for (let li = scene.layers.length - 1; li >= 0; li--) {
    const layer = scene.layers[li];
    if (!layer.visible) continue;
    if (layer.kind === 'sky') return { layerId: layer.id };
    if (layer.kind === 'water') { if (y >= layer.p.waterY * H) return { layerId: layer.id }; continue; }
    const geo = geos.get(layer.id);
    if (!geo || !geo.pathsReady) continue;
    const [ox, oy] = layerOffset(scene, layer, ctx.canvas.width, H);
    for (let i = geo.items.length - 1; i >= 0; i--) {
      const it = geo.items[i];
      if (ctx.isPointInPath(it.p2d, x - ox, y - oy)) return { layerId: layer.id, ob: it.ob, ground: it.ground || it.detail };
    }
  }
  return null;
}
