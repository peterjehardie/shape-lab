// Drawing: sky, shadow clones, lit fills, outlines, rim light, dappled patches, views.
import { makeStyle, hexToLab, hueAB, labCss, labToRgb, rgbCss } from './color.js';
import { valueGroupIndex, layerDepth } from './scene.js';
import { groupsFor } from './pipeline.js';
import { clamp, lerp, hash01, hashStr, hashInts, smoothstep } from './util.js';
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

export function layerStyles(scene, layer, grey) {
  const g = scene.globals;
  const p = layer.p;
  const vg = g.valueGroups[valueGroupIndex(scene, layer)] || { value: 0.5, spread: 0.1 };
  const depth = layerDepth(scene, layer);
  const haze = clamp(g.haze * p.haze * Math.pow(1 - depth, g.hazeCurve));
  const hz = hexToLab(g.hazeColor || g.skyHorizon);
  const steps = p.lightSteps === 'inherit' || p.lightSteps === undefined ? +g.lightSteps : +p.lightSteps;
  const mk = (hex, lOff = 0) => {
    const lab = hexToLab(hex);
    return makeStyle({
      L: vg.value + p.valueNudge + lOff,
      spread: vg.spread * p.spreadMul,
      ab: [lerp(lab[1] * p.chroma, hz[1], haze), lerp(lab[2] * p.chroma, hz[2], haze)],
      sunAB: hueAB(g.sunHue, 0.13), sunWarm: g.sunWarm,
      shadowAB: hueAB(g.shadowHue, 0.09), shadowCool: g.shadowCool,
      steps, bias: p.lightBias, strength: g.lightStrength, grey,
    });
  };
  return { base: mk(p.color), trunk: mk(p.trunkColor, p.trunkValue), accent: mk(p.accentColor, p.accentValue), vg, depth, haze, steps };
}

function greyCss(hex) {
  return labCss(hexToLab(hex)[0], 0, 0);
}

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
    if (!it.ground) geo.unionNoGround.addPath(it.p2d);
  }
  geo.pathsReady = true;
}

// Sphere-like shading squeezed into a linear gradient along the light axis.
// Position s runs +1 (edge facing the light) to -1 (far edge); the surface normal there is
// (s along the light, sqrt(1-s^2) toward the viewer), so front vs back light changes the look.
function sphereGrad(ctx, cx, cy, r, L, sty, lo, steps) {
  const g = ctx.createLinearGradient(cx + L.dx * r, cy + L.dy * r, cx - L.dx * r, cy - L.dy * r);
  const N = steps ? 36 : 10;
  let prev = null;
  for (let i = 0; i <= N; i++) {
    const t = i / N, s = 1 - 2 * t;
    const shade = s * L.k + Math.sqrt(Math.max(0, 1 - s * s)) * L.z;
    const col = sty.css(shade, lo);
    if (steps && prev && col !== prev) g.addColorStop(t, prev);
    g.addColorStop(t, col);
    prev = col;
  }
  return g;
}

// Squarish model: treat the shape as a block with a bevel. Each side plane faces
// outward from its edge, the top plane faces the viewer and slightly up.
const TOP = norm3(0, -0.45, 1);
function drawBevel(ctx, it, sty, lo, L) {
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
    ctx.fillStyle = sty.css(dot3(n3, L), lo);
    ctx.fill();
  }
  ctx.beginPath();
  cs.forEach((q, i) => {
    const r = at(q, 0.45);
    i ? ctx.lineTo(r[0], r[1]) : ctx.moveTo(r[0], r[1]);
  });
  ctx.closePath();
  ctx.fillStyle = sty.css(dot3(TOP, L), lo);
  ctx.fill();
}

function styleFor(st, it) {
  return it.col === 'trunk' ? st.trunk : it.col === 'accent' ? st.accent : st.base;
}

function groupColor(key) {
  const h = hashStr(String(key)) % 360;
  return `hsl(${h} 60% 58%)`;
}

function fillItem(ctx, it, idx, st, L, lg, p, view, lod) {
  if (view === 'groups') {
    ctx.fillStyle = it.ground ? '#444' : groupColor(lg.keys[idx] + lod);
    ctx.fill(it.p2d);
    return;
  }
  const sty = styleFor(st, it);
  const lo = it.lOff || 0;
  // Tiny shapes: one flat colour, read off the group's volume at the shape's centre.
  if (it.r < lod && !it.facets) {
    let shade = it.n3 ? dot3(it.n3, L) : 0.15;
    const grp = lg.map.get(lg.keys[idx]);
    if (p.volume > 0 && grp && (grp.n > 1 || p.lightGroup === 'layer')) {
      const sx = clamp(((it.c[0] - grp.cx) * L.dx + (it.c[1] - grp.cy) * L.dy) / grp.r, -1, 1);
      shade = lerp(shade, sx * L.k + Math.sqrt(1 - sx * sx) * L.z, p.volume);
    }
    ctx.fillStyle = sty.css(shade, lo);
    ctx.fill(it.p2d);
    return;
  }
  if (it.n3) {
    ctx.fillStyle = sty.css(dot3(it.n3, L), lo);
    ctx.fill(it.p2d);
  } else if (it.facets) {
    ctx.fillStyle = sty.css(0, lo);
    ctx.fill(it.p2d);
    ctx.save();
    ctx.clip(it.p2d);
    for (const f of it.facets) {
      ctx.fillStyle = sty.css(dot3(f.n3, L), lo);
      ctx.fill(f.p2d);
    }
    ctx.restore();

  } else {
    let r = it.fixedRound ? it.round : p.roundAuto ? it.round : p.roundness;
    // Blends near either end look the same as the pure model and cost twice as much.
    if (r > 0.88) r = 1;
    else if (r < 0.12) r = 0;
    if (r < 1) {
      ctx.fillStyle = sty.css(0, lo);
      ctx.fill(it.p2d);
      ctx.save();
      ctx.clip(it.p2d);
      drawBevel(ctx, it, sty, lo, L);
      ctx.restore();
    }
    if (r > 0) {
      const v = it.vol || { cx: it.c[0], cy: it.c[1], r: it.r };
      ctx.globalAlpha = r;
      ctx.fillStyle = sphereGrad(ctx, v.cx, v.cy, v.r, L, sty, lo, st.steps);
      ctx.fill(it.p2d);
      ctx.globalAlpha = 1;
    }
  }
  // Fade toward a flat colour lower down: mountain planes melt into one mass,
  // hill bumps melt into the ground plane.
  if (it.fade) {
    const c = sty.rgb(it.fade.n3 ? dot3(it.fade.n3, L) : 0, lo);
    const g = ctx.createLinearGradient(0, it.fade.y0, 0, it.fade.y1);
    g.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},0)`);
    g.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},1)`);
    ctx.fillStyle = g;
    ctx.fill(it.p2d);
  }
  if (p.volume > 0 && !it.ground) {
    const grp = lg.map.get(lg.keys[idx]);
    if (grp && (grp.n > 1 || p.lightGroup === 'layer')) {
      ctx.globalAlpha = p.volume;
      ctx.fillStyle = sphereGrad(ctx, grp.cx, grp.cy, grp.r, L, sty, lo, st.steps);
      ctx.fill(it.p2d);
      ctx.globalAlpha = 1;
    }
  }
}

// Outline: stroke every edge, then the fills cover the inner half and any inner edges
// of a group, leaving one line around the union. Each edge knows which way it faces,
// so its width can follow the light.
function strokeRun(ctx, items, a, b, p, L, u, color) {
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
      const P = it.poly, n = P.length;
      for (let k = 0; k < n; k++) {
        const q0 = P[k], q1 = P[(k + 1) % n];
        const ex = q1[0] - q0[0], ey = q1[1] - q0[1];
        const len = Math.hypot(ex, ey);
        if (len < 1e-6) continue;
        const d = (ey / len) * L.dx + (-ex / len) * L.dy;
        const f = p.lineBreak > 0 ? 1 - smoothstep(thr - 0.3, thr, d) : 1;
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
    for (const [w, path] of bins) {
      ctx.lineWidth = w;
      ctx.stroke(path);
    }
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

// Rim light, as a 2D trick: take the layer's silhouette, subtract a copy shifted away
// from the light, and what is left is a thin crescent along the lit outline only.
function drawRim(ctx, geo, p, st, L, o) {
  const w = p.rim * 6 * o.u;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const it of geo.items) {
    if (it.ground) continue;
    x0 = Math.min(x0, it.bb.x0); y0 = Math.min(y0, it.bb.y0);
    x1 = Math.max(x1, it.bb.x1); y1 = Math.max(y1, it.bb.y1);
  }
  const bx = Math.max(0, Math.floor(x0 - 2)), by = Math.max(0, Math.floor(y0 - 2));
  const bw = Math.min(o.W, Math.ceil(x1 + 2)) - bx, bh = Math.min(o.H, Math.ceil(y1 + 2)) - by;
  if (bw <= 0 || bh <= 0) return;
  const R = o.rimCanvas;
  if (R.width !== o.W || R.height !== o.H) { R.width = o.W; R.height = o.H; }
  const rc = R.getContext('2d');
  rc.setTransform(1, 0, 0, 1, 0, 0);
  rc.globalCompositeOperation = 'source-over';
  rc.clearRect(bx, by, bw, bh);
  rc.fillStyle = st.base.css(1, 0.14);
  rc.fill(geo.unionNoGround);
  rc.globalCompositeOperation = 'destination-out';
  rc.translate(-L.dx * w, -L.dy * w);
  rc.fill(geo.unionNoGround);
  rc.setTransform(1, 0, 0, 1, 0, 0);
  rc.globalCompositeOperation = 'source-over';
  ctx.drawImage(R, bx, by, bw, bh, bx, by, bw, bh);
}

// Shadow clone: a dark copy of the shapes, nudged away from the light and slipped
// underneath. It darkens whatever is behind, which reads as a cast shadow.
// Drawn at half resolution and only inside the clones' bounding box, since it is soft anyway.
function drawClones(ctx, layer, geo, L, o, grey) {
  const p = layer.p;
  const k = 0.5;
  const A = o.cloneA, B = o.cloneB;
  const cw = Math.ceil(o.W * k), ch = Math.ceil(o.H * k);
  for (const c of [A, B]) if (c.width !== cw || c.height !== ch) { c.width = cw; c.height = ch; }
  const ac = A.getContext('2d');
  const tx = -L.dx * p.cloneOffset * o.u, ty = -L.dy * p.cloneOffset * o.u;
  const pad = p.cloneSoft * o.u * 3 + 2;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  ac.setTransform(1, 0, 0, 1, 0, 0);
  ac.globalCompositeOperation = 'source-over';
  ac.clearRect(0, 0, cw, ch);
  ac.setTransform(k, 0, 0, k, tx * k, ty * k);
  ac.fillStyle = '#000';
  for (const it of geo.items) {
    if (it.ground) continue;
    if (p.cloneFraction < 1 && hash01(layer.seed, it.ob) > p.cloneFraction) continue;
    ac.fill(it.p2d);
    x0 = Math.min(x0, it.bb.x0); y0 = Math.min(y0, it.bb.y0);
    x1 = Math.max(x1, it.bb.x1); y1 = Math.max(y1, it.bb.y1);
  }
  if (x0 === Infinity) return;
  // bounding box in half-res pixels, clipped to the canvas
  const bx = Math.max(0, Math.floor((x0 + tx - pad) * k)), by = Math.max(0, Math.floor((y0 + ty - pad) * k));
  const bw = Math.min(cw, Math.ceil((x1 + tx + pad) * k)) - bx, bh = Math.min(ch, Math.ceil((y1 + ty + pad) * k)) - by;
  if (bw <= 0 || bh <= 0) return;
  ac.setTransform(1, 0, 0, 1, 0, 0);
  ac.globalCompositeOperation = 'source-in';
  const sh = hueAB(o.scene.globals.shadowHue, 0.06);
  ac.fillStyle = grey ? labCss(0.42, 0, 0) : labCss(0.42, sh[0], sh[1]);
  ac.fillRect(bx, by, bw, bh);
  if (!p.cloneOnSky) {
    // A shadow needs something to land on: keep only the parts over land drawn so far.
    ac.globalCompositeOperation = 'destination-in';
    ac.drawImage(o.landMask, bx, by, bw, bh, bx, by, bw, bh);
  }
  ac.globalCompositeOperation = 'source-over';
  let src = A;
  if (p.cloneSoft > 0) {
    const bc = B.getContext('2d');
    bc.clearRect(bx, by, bw, bh);
    bc.filter = `blur(${p.cloneSoft * o.u * k}px)`;
    bc.drawImage(A, bx, by, bw, bh, bx, by, bw, bh);
    bc.filter = 'none';
    src = B;
  }
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = p.clone;
  ctx.drawImage(src, bx, by, bw, bh, bx / k, by / k, bw / k, bh / k);
  ctx.restore();
}

// Dappled light for far layers: a noise field split into lit and shadowed patches,
// like cloud shadows drifting over distant hills.
const fieldCache = new Map();
function dappleField(layer, W, H, s) {
  const p = layer.p;
  const key = [layer.seed, p.dappleScale, p.dappleStretch, W, H].join(',');
  let f = fieldCache.get(key);
  if (f) return f;
  const w = Math.ceil(W / s), h = Math.ceil(H / s);
  const data = new Float32Array(w * h);
  const nz = noiseFor(hashInts(layer.seed, 555));
  const sc = p.dappleScale * 3;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      data[y * w + x] = nz.fbm(((x * s) / H) * sc / p.dappleStretch, ((y * s) / H) * sc, 3);
    }
  }
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
  grad.addColorStop(0, c(top, v - p.skyDrop));
  grad.addColorStop(0.55, c([0, lerp(top[1], hor[1], 0.45), lerp(top[2], hor[2], 0.45)], v - p.skyDrop * 0.35));
  grad.addColorStop(1, c(hor, v + p.skyDrop * 0.2));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, hy + 1);
  ctx.fillStyle = c(hor, v + p.skyDrop * 0.1);
  ctx.fillRect(0, hy, W, H - hy);
  if (p.glow > 0 && L.z < 0.35) {
    const strength = p.glow * clamp((0.35 - L.z) / 1.1);
    const sx = W / 2 + L.dx * W * 0.42;
    const sy = L.dy < 0 ? hy + L.dy * hy * 0.85 : hy - 4 * o.u;
    const r = p.glowSize * Math.max(W, H) * 0.6;
    const ab = grey ? [0, 0] : hueAB(g.sunHue, 0.11);
    const col = labToRgb(Math.min(1, v + 0.12), ab[0], ab[1]);
    const rg = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
    rg.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},${strength})`);
    rg.addColorStop(0.25, `rgba(${col[0]},${col[1]},${col[2]},${strength * 0.45})`);
    rg.addColorStop(1, `rgba(${col[0]},${col[1]},${col[2]},0)`);
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, W, H);
  }
}

function drawLayer(ctx, layer, geo, st, L, o, grey) {
  const p = layer.p;
  const items = geo.items;
  ensurePaths(geo);
  const lg = groupsFor(geo, p.lightGroup);
  const view = o.view;
  if (p.clone > 0 && view !== 'groups') drawClones(ctx, layer, geo, L, o, grey);
  const lineOn = p.lineMode !== 'none' && view !== 'groups';
  let runs = [[0, items.length]];
  if (lineOn) {
    const keys = groupsFor(geo, p.lineMode).keys;
    runs = [];
    let start = 0;
    for (let i = 1; i <= items.length; i++) {
      if (i === items.length || keys[i] !== keys[start]) {
        runs.push([start, i]);
        start = i;
      }
    }
  }
  const lc = lineOn ? lineColor(p, st, o.scene.globals, grey) : null;
  for (const [a, b] of runs) {
    if (lineOn) strokeRun(ctx, items, a, b, p, L, o.u, lc);
    const lod = view === 'groups' ? layer.seed : 3.5 * o.u;
    for (let i = a; i < b; i++) fillItem(ctx, items[i], i, st, L, lg, p, view, lod);
  }
  if (view === 'groups') return;
  if (p.rim > 0) drawRim(ctx, geo, p, st, L, o);
  if (p.dapple > 0) drawDapple(ctx, layer, geo, st, o);
}

// Value check: squash the picture into 2 or 3 flat values.
function notan(ctx, W, H, levels, t1, t2) {
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  const lin = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const c = i / 255;
    lin[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }
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
    for (const [x, y, r] of geo.debug.points) {
      ctx.beginPath();
      ctx.arc(x, y, Math.max(2, r), 0, Math.PI * 2);
      ctx.stroke();
    }
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

export function renderScene(ctx, scene, geos, o) {
  const g = scene.globals;
  const L = lightVec(g);
  const grey = o.view !== 'color' && o.view !== 'groups';
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
  for (const layer of scene.layers) {
    if (!layer.visible) continue;
    const st = layerStyles(scene, layer, grey);
    if (layer.kind === 'sky') {
      if (o.view !== 'groups') drawSky(ctx, layer, st, g, L, o, grey);
      else { ctx.fillStyle = '#222'; ctx.fillRect(0, 0, o.W, o.H); }
      continue;
    }
    const geo = geos.get(layer.id);
    if (!geo) continue;
    drawLayer(ctx, layer, geo, st, L, o, grey);
    if (layer.band !== 'sky') mc.fill(geo.union);
    shapes += geo.items.length;
  }
  if (o.view === 'notan2') notan(ctx, o.W, o.H, 2, g.notan1, g.notan2);
  if (o.view === 'notan3') notan(ctx, o.W, o.H, 3, g.notan1, g.notan2);
  if (o.structure) drawStructure(ctx, scene, geos, o.selectedId, o.u);
  ctx.restore();
  return { shapes };
}

// Which layer is under a canvas point (front-most first).
export function pickLayer(ctx, scene, geos, x, y) {
  for (let li = scene.layers.length - 1; li >= 0; li--) {
    const layer = scene.layers[li];
    if (!layer.visible) continue;
    if (layer.kind === 'sky') return layer.id;
    const geo = geos.get(layer.id);
    if (!geo || !geo.pathsReady) continue;
    for (let i = geo.items.length - 1; i >= 0; i--) if (ctx.isPointInPath(geo.items[i].p2d, x, y)) return layer.id;
  }
  return null;
}
