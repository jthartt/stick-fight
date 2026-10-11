// Stick Fight! — procedural cartoon art (Canvas 2D only, no images).
// Pure drawing: no game state. See CONTRACT.md (art.js section).

export const OUT = '#1d1433';
const TAU = Math.PI * 2;
const frac = (v) => v - Math.floor(v);
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const eo = (k) => { k = clamp(k); return 1 - (1 - k) * (1 - k); };
const rnd = (i) => frac(Math.sin(i * 127.1 + 311.7) * 43758.5453);

// ---------------------------------------------------------------- primitives
function fs(ctx, fill, lw) {
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (lw) { ctx.strokeStyle = OUT; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); }
}
export function circle(ctx, x, y, r, fill, lw = 5) {
  ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, TAU); fs(ctx, fill, lw);
}
export function ell(ctx, x, y, rx, ry, fill, lw = 5, rot = 0) {
  ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.01, Math.abs(rx)), Math.max(0.01, Math.abs(ry)), rot, 0, TAU); fs(ctx, fill, lw);
}
function rrPath(ctx, x, y, w, h, r) {
  r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath(); ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
export function rrect(ctx, x, y, w, h, r, fill, lw = 5) { rrPath(ctx, x, y, w, h, r); fs(ctx, fill, lw); }
export function poly(ctx, pts, fill, lw = 5, close = true) {
  ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
  if (close) ctx.closePath(); fs(ctx, fill, lw);
}
export function line(ctx, x1, y1, x2, y2, color = OUT, lw = 5) {
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
  ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.stroke();
}
export function text(ctx, s, x, y, size, fill = '#fff', opts = {}) {
  ctx.save();
  ctx.font = opts.font || `${size}px Bangers, Impact, "Comic Sans MS", sans-serif`;
  ctx.textAlign = opts.align || 'center'; ctx.textBaseline = opts.base || 'middle';
  ctx.lineJoin = 'round'; ctx.lineWidth = opts.lw == null ? Math.max(4, size / 5) : opts.lw;
  ctx.strokeStyle = opts.stroke || OUT;
  if (ctx.lineWidth > 0) ctx.strokeText(s, x, y);
  ctx.fillStyle = fill; ctx.fillText(s, x, y); ctx.restore();
}
let FLIP = false;
function ctext(ctx, s, x, y, size, fill, opts) {
  if (!FLIP) return text(ctx, s, x, y, size, fill, opts);
  ctx.save(); ctx.translate(x, y); ctx.scale(-1, 1); text(ctx, s, 0, 0, size, fill, opts); ctx.restore();
}
function starPath(ctx, cx, cy, ro, ri, n, rot) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? ri : ro, a = rot + (i * Math.PI) / n;
    const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath();
}
function star(ctx, cx, cy, ro, ri, n, rot, fill, lw = 4) { starPath(ctx, cx, cy, ro, ri, n, rot); fs(ctx, fill, lw); }
function limb(ctx, pts, w, fill) {
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
  ctx.strokeStyle = OUT; ctx.lineWidth = w + 10; ctx.stroke();
  ctx.strokeStyle = fill; ctx.lineWidth = w; ctx.stroke();
}
function bez(p0, p1, p2, p3, u) {
  const v = 1 - u, a = v * v * v, b = 3 * v * v * u, c = 3 * v * u * u, d = u * u * u;
  return [a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]];
}
// tapered tentacle along a cubic; outline pass then fill pass; optional suckers
function tent(ctx, p0, p1, p2, p3, w0, w1, fill, sucker, n = 16) {
  const pts = []; for (let i = 0; i <= n; i++) pts.push(bez(p0, p1, p2, p3, i / n));
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let pass = 0; pass < 2; pass++) {
    ctx.strokeStyle = pass ? fill : OUT;
    for (let i = 0; i < n; i++) {
      const w = lerp(w0, w1, i / n);
      ctx.lineWidth = pass ? w : w + 10;
      ctx.beginPath(); ctx.moveTo(pts[i][0], pts[i][1]); ctx.lineTo(pts[i + 1][0], pts[i + 1][1]); ctx.stroke();
    }
  }
  if (sucker) {
    for (let i = 2; i < n; i += 2) {
      const a = pts[i - 1], b = pts[i + 1]; const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1;
      const w = lerp(w0, w1, i / n);
      circle(ctx, pts[i][0] - (dy / d) * w * 0.18, pts[i][1] + (dx / d) * w * 0.18, Math.max(2, w * 0.17), sucker, 0);
    }
  }
}
function gear(ctx, cx, cy, r, teeth, rot, fill, lw = 5) {
  ctx.beginPath();
  const step = TAU / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = rot + i * step;
    const pts = [[r * 0.82, -0.28], [r, -0.2], [r, 0.2], [r * 0.82, 0.28]];
    pts.forEach((p, j) => {
      const aa = a + p[1] * step, px = cx + Math.cos(aa) * p[0], py = cy + Math.sin(aa) * p[0];
      (i === 0 && j === 0) ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    });
  }
  ctx.closePath(); fs(ctx, fill, lw);
}

// ---------------------------------------------------------------- kit geometry
export const KIT = { kick: [0, -62], snare: [96, -116], hihat: [-104, -170], tom: [40, -156] };
export function kitPoint(x, y, m, s, drum) { const k = KIT[drum]; return [x + m * s * k[0], y + s * k[1]]; }

const normAnim = (a) => Object.assign({ hihat: 0, kick: 0, snare: 0, tom: 0, hurt: 0, ko: 0, talk: 0 }, a || {});

// ---------------------------------------------------------------- faces
function eyeBall(ctx, x, y, rx, ry, look, st, t, side, seed = 0) {
  if (st === 'ko') {
    const r = Math.min(rx, ry) * 0.85;
    line(ctx, x - r, y - r, x + r, y + r, OUT, 6); line(ctx, x - r, y + r, x + r, y - r, OUT, 6); return;
  }
  if (st === 'hurt') {
    const r = Math.min(rx, ry) * 0.9, d = side;
    ctx.beginPath(); ctx.moveTo(x - r * d, y - r); ctx.lineTo(x + r * d, y); ctx.lineTo(x - r * d, y + r);
    ctx.strokeStyle = OUT; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(); return;
  }
  const blink = frac(t * 0.43 + seed) < 0.035 ? 0.12 : 1;
  ell(ctx, x, y, rx, ry * blink, '#fff', 4);
  if (blink > 0.5) {
    circle(ctx, x + look * rx * 0.38, y + ry * 0.08, Math.min(rx, ry) * 0.52, OUT, 0);
    circle(ctx, x + look * rx * 0.38 - rx * 0.12, y - ry * 0.12, Math.min(rx, ry) * 0.17, '#fff', 0);
  }
}
function mouthShape(ctx, x, y, w, open, mood, teeth, tongue) {
  if (open < 0.08) {
    ctx.beginPath(); ctx.moveTo(x - w / 2, y); ctx.quadraticCurveTo(x, y + mood * w * 0.5, x + w / 2, y);
    ctx.strokeStyle = OUT; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.stroke(); return;
  }
  const depth = open * w * 0.62, cv = mood * w * 0.14;
  const p = () => {
    ctx.beginPath(); ctx.moveTo(x - w / 2, y);
    ctx.quadraticCurveTo(x, 2 * (y + cv) - y, x + w / 2, y);
    ctx.quadraticCurveTo(x + w * 0.45, y + 2 * (depth + cv) - 0, x, y + depth + cv + depth * 0.15);
    ctx.quadraticCurveTo(x - w * 0.45, y + 2 * (depth + cv), x - w / 2, y); ctx.closePath();
  };
  p(); ctx.fillStyle = '#5a1030'; ctx.fill();
  ctx.save(); p(); ctx.clip();
  if (tongue) ell(ctx, x + w * 0.05, y + depth * 1.05 + cv, w * 0.3, depth * 0.45, '#ff7aa2', 0);
  if (teeth) { ctx.fillStyle = '#fff'; ctx.fillRect(x - w / 2, y - 6, w, Math.max(7, depth * 0.3) + cv * 0.5 + 6); }
  ctx.restore();
  p(); ctx.strokeStyle = OUT; ctx.lineWidth = 5; ctx.lineJoin = 'round'; ctx.stroke();
}
function mouthOpenAmt(a, t) {
  let o = 0;
  if (a.talk > 0) o = Math.max(o, a.talk * (0.18 + 0.82 * Math.abs(Math.sin(t * 15))));
  if (a.hurt > 0.05) o = Math.max(o, 0.5 + 0.15 * Math.sin(t * 40));
  if (a.ko > 0.02) o = Math.max(o, 0.45);
  return o;
}
function sweat(ctx, x, y, t, k) {
  const dy = (t * 40) % 24;
  ctx.save(); ctx.globalAlpha = clamp(k * 2);
  ctx.beginPath(); ctx.moveTo(x, y - 14 + dy); ctx.quadraticCurveTo(x + 10, y + 4 + dy, x, y + 8 + dy); ctx.quadraticCurveTo(x - 10, y + 4 + dy, x, y - 14 + dy);
  fs(ctx, '#74c0fc', 3); ctx.restore();
}
function koStars(ctx, hx, hy, rx, t) {
  for (let i = 0; i < 3; i++) {
    const a = t * 3.2 + (i * TAU) / 3;
    star(ctx, hx + Math.cos(a) * rx, hy + Math.sin(a) * rx * 0.25, 15, 7, 5, t * 4 + i, '#ffe14d', 4);
  }
}

// ---------------------------------------------------------------- pose + arms
function pose(a, t, beats, amp, topple) {
  const bf = frac(beats), ko = eo(a.ko);
  const bob = (-amp * Math.sin(bf * Math.PI) + 12 * eo(a.kick)) * (1 - ko) + ko * 8;
  return {
    bf, bob, ko,
    jx: Math.sin(t * 83) * 7 * a.hurt * (1 - ko), jy: Math.cos(t * 71) * 4 * a.hurt * (1 - ko),
    topple: ko * topple,
  };
}
function elbowOf(sx, sy, hx, hy, l1, l2, pref) {
  let dx = hx - sx, dy = hy - sy, d = Math.hypot(dx, dy) || 0.001;
  const mx = l1 + l2 - 0.5;
  if (d > mx) { hx = sx + (dx / d) * mx; hy = sy + (dy / d) * mx; dx = hx - sx; dy = hy - sy; d = mx; }
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const ux = dx / d, uy = dy / d; let px = -uy, py = ux;
  if (px * pref[0] + py * pref[1] < 0) { px = -px; py = -py; }
  return [sx + ux * a + px * h, sy + uy * a + py * h, hx, hy];
}
function drawArm(ctx, cfg, tip, ang, bob, t) {
  const len = 54, dx = Math.cos(ang), dy = Math.sin(ang);
  const H = [tip[0] - dx * len, tip[1] - dy * len], S = [cfg.s[0], cfg.s[1] + bob];
  if (cfg.style === 'tentacle') {
    const mid = [(S[0] + H[0]) / 2, (S[1] + H[1]) / 2];
    const c1 = [mid[0] + cfg.pref[0] * 40 + Math.sin(t * 6) * 8, mid[1] + cfg.pref[1] * 40];
    tent(ctx, S, [lerp(S[0], c1[0], 0.8), lerp(S[1], c1[1], 0.8)], [lerp(H[0], c1[0], 0.7), lerp(H[1], c1[1], 0.7)], H, cfg.w, cfg.w * 0.55, cfg.fill, cfg.sucker, 12);
  } else {
    const dd = Math.hypot(H[0] - S[0], H[1] - S[1]), ll = clamp(dd * 0.56, cfg.l1 * 0.55, cfg.l1 * 1.7);
    const e = elbowOf(S[0], S[1], H[0], H[1], ll, ll, cfg.pref);
    limb(ctx, [S, [e[0], e[1]], [e[2], e[3]]], cfg.w, cfg.fill);
    if (cfg.joint) circle(ctx, e[0], e[1], cfg.w * 0.55, cfg.joint, 4);
    if (cfg.shoulder) circle(ctx, S[0], S[1], cfg.w * 0.7, cfg.shoulder, 4);
    H[0] = e[2]; H[1] = e[3];
  }
  // stick
  line(ctx, H[0] - dx * 16, H[1] - dy * 16, tip[0], tip[1], OUT, 11);
  line(ctx, H[0] - dx * 16, H[1] - dy * 16, tip[0], tip[1], '#fff1d6', 6);
  circle(ctx, tip[0], tip[1], 6.5, cfg.tipCol || '#ff6b6b', 3);
  circle(ctx, H[0], H[1], cfg.handR, cfg.hand, 4.5);
  if (cfg.claw) {
    line(ctx, H[0] + dx * 8, H[1] + dy * 8 - 9, H[0] + dx * 17, H[1] + dy * 17 - 14, OUT, 6);
    line(ctx, H[0] + dx * 8, H[1] + dy * 8 + 9, H[0] + dx * 17, H[1] + dy * 17 + 14, OUT, 6);
  }
}
function drawArms(ctx, arms, a, t, beats, bob) {
  const bf = frac(beats), sw = Math.sin(bf * Math.PI), idle = Math.sin(t * 2.3);
  // arm A: hi-hat
  const hh = KIT.hihat, wA = eo(clamp(a.hihat * 1.15));
  const idleA = [hh[0] + 4 + idle * 4, hh[1] - 74 - 10 * sw];
  drawArm(ctx, arms.A, [lerp(idleA[0], hh[0], wA), lerp(idleA[1], hh[1] - 3, wA)], lerp(-1.3, 1.4, wA), bob, t);
  // arm B: snare / tom
  const sn = KIT.snare, tm = KIT.tom;
  let ws = eo(clamp(a.snare * 1.15)), wt = eo(clamp(a.tom * 1.15));
  const sum = ws + wt; if (sum > 1) { ws /= sum; wt /= sum; }
  const base = [66 - idle * 4, -214 - 12 * sw];
  const tip = [base[0] + (sn[0] - base[0]) * ws + (tm[0] - base[0]) * wt, base[1] + (sn[1] - 3 - base[1]) * ws + (tm[1] - 3 - base[1]) * wt];
  const w = clamp(ws + wt);
  drawArm(ctx, arms.B, tip, lerp(-1.75, 1.2, w), bob, t);
}
function hangArms(ctx, arms, t) {
  [arms.A, arms.B].forEach((c, i) => {
    const sgn = i ? 1 : -1, S = c.s, H = [S[0] + sgn * 36 + Math.sin(t * 3 + i) * 5, S[1] + 96 + Math.cos(t * 2.4 + i) * 4];
    if (c.style === 'tentacle') {
      tent(ctx, S, [S[0] + sgn * 30, S[1] + 30], [H[0] + sgn * 20, H[1] - 30], H, c.w, c.w * 0.55, c.fill, c.sucker, 10);
    } else {
      const e = elbowOf(S[0], S[1], H[0], H[1], c.l1, c.l2, [sgn, 0.3]);
      limb(ctx, [S, [e[0], e[1]], [e[2], e[3]]], c.w, c.fill);
      circle(ctx, e[2], e[3], c.handR, c.hand, 4.5);
    }
  });
}

// ---------------------------------------------------------------- drum shapes
function jig(ctx, drum, a, fn) {
  const k = KIT[drum], v = eo(a[drum]);
  ctx.save(); ctx.translate(k[0], k[1]); ctx.scale(1 + 0.1 * v, 1 - 0.12 * v); fn(-k[1]); ctx.restore();
}
// cylinder drum: origin = center of top head
function cyl(ctx, rx, ry, h, head, side, o = {}) {
  ctx.beginPath(); ctx.moveTo(-rx, 0); ctx.lineTo(-rx * (o.taper || 1), h); ctx.ellipse(0, h, rx * (o.taper || 1), ry * (o.taper || 1), 0, Math.PI, 0, true);
  ctx.lineTo(rx, 0); ctx.closePath(); fs(ctx, side, 5);
  if (o.stripes) {
    ctx.save(); ctx.beginPath(); ctx.moveTo(-rx, 0); ctx.lineTo(-rx * (o.taper || 1), h); ctx.ellipse(0, h, rx * (o.taper || 1), ry * (o.taper || 1), 0, Math.PI, 0, true); ctx.lineTo(rx, 0); ctx.closePath(); ctx.clip();
    ctx.strokeStyle = o.stripes; ctx.lineWidth = 3; ctx.globalAlpha = 0.5;
    for (let i = -rx + 10; i < rx; i += 14) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i * (o.taper || 1), h + ry); ctx.stroke(); }
    ctx.restore();
  }
  ell(ctx, 0, 0, rx, ry, head, 5);
  if (o.rim) { ell(ctx, 0, 0, rx - 5, ry - 2.5, null, 0); ctx.strokeStyle = o.rim; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, 0, rx - 5, ry - 3, 0, 0, TAU); ctx.stroke(); }
}
function stand(ctx, floorY, topY, col = '#6b6b80') {
  line(ctx, 0, topY, 0, floorY - 4, OUT, 12); line(ctx, 0, topY, 0, floorY - 4, col, 6);
  [-1, 1].forEach((s) => { line(ctx, 0, floorY - 26, s * 34, floorY, OUT, 11); line(ctx, 0, floorY - 26, s * 34, floorY, col, 5); });
}
function cymbalPair(ctx, rx, flip, c1, c2, knob) {
  ell(ctx, 0, 12, rx, rx * 0.2, c2, 5);
  ctx.save(); ctx.translate(0, 0); ctx.rotate(-0.12 * flip);
  ell(ctx, 0, 0, rx + 3, rx * 0.22, c1, 5);
  ell(ctx, 0, -2, rx * 0.25, rx * 0.07, 'rgba(255,255,255,0.45)', 0);
  rrect(ctx, -6, -14, 12, 12, 5, knob, 4);
  ctx.restore();
}

// ---------------------------------------------------------------- HERO
const HERO_ARMS = {
  A: { s: [-40, -196], l1: 50, l2: 50, w: 22, fill: '#ff922b', hand: '#ffd3a8', handR: 14, pref: [-0.6, 1], tipCol: '#e03131' },
  B: { s: [26, -192], l1: 52, l2: 52, w: 22, fill: '#ff922b', hand: '#ffd3a8', handR: 14, pref: [0.6, 1], tipCol: '#e03131' },
};
function heroBody(ctx, a, t, beats, P) {
  const hx = 0, hy = 0, skin = '#ffd3a8';
  // legs + sneakers
  limb(ctx, [[-26, -100], [-36, -50], [-44, -12]], 24, '#3b5bdb');
  limb(ctx, [[14, -100], [30, -50], [44, -12]], 24, '#3b5bdb');
  ell(ctx, -50, -8, 30, 15, '#fff', 5); ell(ctx, -54, -6, 14, 7, '#e03131', 0);
  ell(ctx, 52, -8, 30, 15, '#fff', 5); ell(ctx, 56, -6, 14, 7, '#e03131', 0);
  // torso: hoodie
  rrect(ctx, -64, -204, 112, 116, 36, '#ff922b', 5);
  ell(ctx, -8, -206, 50, 20, '#f76707', 5);          // hood
  rrect(ctx, -44, -138, 72, 36, 14, '#f9a24a', 4);   // pocket
  line(ctx, -26, -190, -30, -150, '#fff', 4); line(ctx, 10, -190, 14, -150, '#fff', 4);
  circle(ctx, -30, -148, 5, '#fff', 3); circle(ctx, 14, -148, 5, '#fff', 3);
  // head (scaled up: big cartoon head)
  ctx.save(); ctx.translate(-4, -262); ctx.scale(1.22, 1.22);
  ell(ctx, hx - 60, hy + 8, 14, 17, skin, 5);
  circle(ctx, hx, hy, 62, skin, 5);
  // hair tufts (front) under cap
  poly(ctx, [[hx + 36, hy - 44], [hx + 64, hy - 66], [hx + 58, hy - 38]], '#8b4513', 4);
  poly(ctx, [[hx + 46, hy - 36], [hx + 72, hy - 44], [hx + 62, hy - 22]], '#8b4513', 4);
  // backwards cap: bill (pointing back), dome
  poly(ctx, [[hx - 50, hy - 40], [hx - 124, hy - 22], [hx - 118, hy - 4], [hx - 56, hy - 14]], '#c92a2a', 5);
  ctx.beginPath(); ctx.arc(hx, hy, 66, Math.PI * 0.96, Math.PI * 1.8);
  ctx.quadraticCurveTo(hx - 5, hy - 12, hx - 64, hy - 8); ctx.closePath(); fs(ctx, '#e03131', 5);
  circle(ctx, hx - 8, hy - 66, 7, '#c92a2a', 4);
  star(ctx, hx - 16, hy - 40, 12, 5, 5, -Math.PI / 2, '#fff', 3);
  // face
  const ko = a.ko > 0.02, hurt = a.hurt > 0.05 && !ko, st = ko ? 'ko' : hurt ? 'hurt' : null;
  const look = 0.8;
  eyeBall(ctx, hx + 12, hy - 2, 14, 19, look, st, t, 1, 0.1);
  eyeBall(ctx, hx + 44, hy - 1, 13, 18, look, st, t, -1, 0.1);
  // brows
  const bb = a.talk * Math.abs(Math.sin(t * 9)) * 3;
  if (hurt || ko) { line(ctx, hx + 2, hy - 32, hx + 24, hy - 24, OUT, 6); line(ctx, hx + 56, hy - 30, hx + 34, hy - 24, OUT, 6); }
  else { line(ctx, hx + 2, hy - 28 - bb, hx + 24, hy - 31 - bb, OUT, 6); line(ctx, hx + 34, hy - 31 - bb, hx + 56, hy - 28 - bb, OUT, 6); }
  circle(ctx, hx + 66, hy + 12, 9, skin, 5);           // nose bump
  // freckles + blush
  ctx.save(); ctx.globalAlpha = 0.5; ell(ctx, hx + 30, hy + 26, 12, 8, '#ff8787', 0); ctx.restore();
  [[-36, 6], [-28, 12], [-20, 5], [-14, 14], [-40, 16], [-24, 20]].forEach((p) => circle(ctx, hx + p[0], hy + p[1], 2.4, '#b5651d', 0));
  // band-aid
  ctx.save(); ctx.translate(hx - 12, hy + 34); ctx.rotate(-0.5);
  rrect(ctx, -17, -7, 34, 14, 6, '#f1c27d', 3.5); rrect(ctx, -7, -7, 14, 14, 1, '#f8d9a0', 0);
  circle(ctx, -2, -2, 1.2, '#c9954a', 0); circle(ctx, 3, 2, 1.2, '#c9954a', 0); ctx.restore();
  // mouth
  const mo = mouthOpenAmt(a, t);
  if (mo < 0.08 && !hurt && !ko) {
    ctx.beginPath(); ctx.moveTo(hx + 12, hy + 38); ctx.quadraticCurveTo(hx + 34, hy + 80, hx + 62, hy + 36); ctx.closePath();
    fs(ctx, '#fff', 5);
    line(ctx, hx + 36, hy + 44, hx + 36, hy + 58, OUT, 3);
    ctx.save(); ctx.beginPath(); ctx.moveTo(hx + 12, hy + 38); ctx.quadraticCurveTo(hx + 34, hy + 80, hx + 62, hy + 36); ctx.closePath(); ctx.clip();
    ell(ctx, hx + 36, hy + 62, 10, 6, '#ff7aa2', 0); ctx.restore();
    rrect(ctx, hx + 36, hy + 36, 7, 12, 2, skin, 2.5); // gap tooth
  } else mouthShape(ctx, hx + 38, hy + 40, 44, mo, hurt ? -0.4 : 0.7, !hurt, ko);
  if (hurt) { sweat(ctx, hx - 52, hy - 40, t, a.hurt); sweat(ctx, hx + 62, hy - 60, t + 0.5, a.hurt); }
  ctx.restore();
  if (ko) koStars(ctx, -4, -262 - 96, 84, t);
}
function heroKit(ctx, a, t) {
  const card = '#d9a566', cardD = '#b7823f', cardL = '#f0d29c';
  jig(ctx, 'hihat', a, (fl) => {
    stand(ctx, fl, 0, '#7a7a8c');
    ctx.save(); ctx.translate(0, 4 - 6 * eo(a.hihat)); cymbalPair(ctx, 46, a.hihat > 0.3 ? 1 : 0, '#adb5bd', '#868e96', '#343a40'); ctx.restore();
  });
  jig(ctx, 'kick', a, () => {
    rrect(ctx, -52, -46, 104, 94, 8, card, 5);
    poly(ctx, [[-52, -46], [-30, -62], [-4, -46]], cardL, 5); poly(ctx, [[4, -46], [30, -62], [52, -46]], cardL, 5);
    for (let i = -34; i < 52; i += 22) line(ctx, i, -40, i, 42, cardD, 2.5);
    ctx.save(); ctx.globalAlpha = 0.85; poly(ctx, [[-52, 20], [-30, 14], [52, 40], [52, 48], [30, 48], [-52, 30]], '#ffe8a3', 3); ctx.restore();
    ctx.save(); ctx.translate(0, -6); ctx.rotate(-0.07); ctext(ctx, 'MY BAND', -6, 0, 25, '#e03131', { lw: 4, stroke: '#7a1c1c' }); ctx.restore();
    star(ctx, -34, 22, 8, 3.5, 5, 0, '#4dabf7', 2.5);
    ctx.beginPath(); ctx.arc(30, -26, 9, 0, TAU * 1.2); ctx.strokeStyle = '#2f9e44'; ctx.lineWidth = 4; ctx.stroke();
  });
  jig(ctx, 'tom', a, (fl) => {
    line(ctx, 0, 46, 0, 62, OUT, 12);
    ctx.save(); ctx.translate(0, 0);
    cyl(ctx, 40, 13, 50, '#d0ebff', '#4dabf7', { taper: 0.82, stripes: '#1c7ed6' });
    ctx.beginPath(); ctx.arc(0, 4, 44, Math.PI * 1.05, Math.PI * 1.95); ctx.strokeStyle = OUT; ctx.lineWidth = 4; ctx.stroke();
    ctx.restore();
  });
  jig(ctx, 'snare', a, (fl) => {
    stand(ctx, fl, 40, '#7a7a8c');
    cyl(ctx, 52, 16, 40, cardL, card, { stripes: cardD });
    rrect(ctx, -54, 12, 108, 11, 3, '#ffe8a3', 3.5);
  });
}

// ---------------------------------------------------------------- RACCOON
const RAC = { fur: '#8c8fa6', furD: '#6a6c85', belly: '#e6e8f2', dark: '#2d2a3a' };
const RAC_ARMS = {
  A: { s: [-66, -214], l1: 56, l2: 58, w: 32, fill: RAC.fur, hand: RAC.dark, handR: 17, pref: [-0.6, 1], tipCol: '#ffd43b' },
  B: { s: [56, -212], l1: 56, l2: 58, w: 32, fill: RAC.fur, hand: RAC.dark, handR: 17, pref: [0.6, 1], tipCol: '#ffd43b' },
};
function racBody(ctx, a, t, beats, P) {
  const bf = frac(beats);
  // tail
  const wag = Math.sin(t * 3.2) * 14 + Math.sin(bf * TAU) * 6;
  const T0 = [-50, -110], T1 = [-150, -80], T2 = [-190 + wag, -190], T3 = [-130 + wag * 1.3, -270];
  tent(ctx, T0, T1, T2, T3, 56, 40, RAC.fur, null, 20);
  for (let i = 2; i < 20; i += 3) {
    const u = i / 20, p = bez(T0, T1, T2, T3, u), q = bez(T0, T1, T2, T3, u + 0.02);
    const dx = q[0] - p[0], dy = q[1] - p[1], d = Math.hypot(dx, dy) || 1, w = lerp(24, 16, u);
    ctx.beginPath(); ctx.moveTo(p[0] - (dy / d) * w, p[1] + (dx / d) * w); ctx.lineTo(p[0] + (dy / d) * w, p[1] - (dx / d) * w);
    ctx.strokeStyle = RAC.dark; ctx.lineWidth = 11; ctx.lineCap = 'butt'; ctx.stroke();
  }
  circle(ctx, T3[0], T3[1], 19, RAC.dark, 4);
  // legs
  limb(ctx, [[-30, -100], [-52, -48], [-56, -14]], 34, RAC.furD);
  limb(ctx, [[30, -100], [48, -48], [58, -14]], 34, RAC.furD);
  ell(ctx, -60, -8, 32, 15, RAC.dark, 5); ell(ctx, 62, -8, 32, 15, RAC.dark, 5);
  // body
  ell(ctx, 0, -168, 88, 98, RAC.fur, 5);
  ell(ctx, 10, -158, 54, 70, RAC.belly, 0);
  [[-20, -140], [20, -120], [4, -190]].forEach((p) => line(ctx, p[0], p[1], p[0] + 16, p[1] + 3, '#b6b9cf', 4));
  // head
  poly(ctx, [[-78, -318], [-62, -378], [-26, -330]], RAC.fur, 5); poly(ctx, [[-68, -328], [-60, -362], [-40, -334]], '#ffa8c4', 0);
  poly(ctx, [[34, -332], [66, -380], [86, -320]], RAC.fur, 5); poly(ctx, [[46, -332], [66, -364], [76, -328]], '#ffa8c4', 0);
  ell(ctx, 0, -282, 94, 70, RAC.fur, 5);
  poly(ctx, [[-90, -268], [-112, -256], [-92, -250]], RAC.fur, 4); poly(ctx, [[88, -262], [112, -250], [90, -244]], RAC.fur, 4);
  // mask
  ctx.fillStyle = RAC.dark;
  ell(ctx, -30, -288, 38, 28, RAC.dark, 0, -0.2); ell(ctx, 38, -288, 38, 28, RAC.dark, 0, 0.2); rrPath(ctx, -40, -296, 84, 24, 10); ctx.fill();
  const ko = a.ko > 0.02, hurt = a.hurt > 0.05 && !ko, st = ko ? 'ko' : hurt ? 'hurt' : null;
  ell(ctx, -26, -286, 19, 22, '#fff', 0); ell(ctx, 36, -286, 19, 22, '#fff', 0);
  const ex = (x, y, side) => {
    if (st) { ctx.save(); ctx.translate(0, 0); ell(ctx, x, y, 19, 22, '#fff', 0); eyeBall(ctx, x, y, 14, 16, 1, st, t, side, 0.3); ctx.restore(); }
    else { ell(ctx, x, y, 17, 20, '#fff', 3); circle(ctx, x + 7, y + 3, 8, OUT, 0); circle(ctx, x + 4, y - 1, 3, '#fff', 0); }
  };
  ex(-26, -286, 1); ex(36, -286, -1);
  // grumpy brows
  if (!st) { line(ctx, -58, -322, -6, -299, OUT, 12); line(ctx, 64, -322, 14, -299, OUT, 12); }
  else { line(ctx, -54, -304, -8, -314, OUT, 10); line(ctx, 60, -304, 14, -314, OUT, 10); }
  // snout
  ell(ctx, 56, -256, 42, 30, RAC.belly, 5);
  ell(ctx, 88, -268, 17, 12, OUT, 4); circle(ctx, 84, -272, 3, '#fff', 0);
  const mo = mouthOpenAmt(a, t);
  mouthShape(ctx, 48, -240, 46, mo, hurt || ko ? -0.3 : -1.0, false, ko);
  if (mo < 0.08) rrect(ctx, 56, -239, 11, 14, 3, '#fff', 3);
  ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.lineCap = 'round';
  [[-8, -12], [0, 0], [-6, 12]].forEach((p) => { ctx.beginPath(); ctx.moveTo(78, -248 + p[1] * 0.2); ctx.lineTo(112, -250 + p[1]); ctx.stroke(); });
  // banana peel on head
  ctx.save(); ctx.translate(-4, -345); ctx.rotate(Math.sin(t * 2) * 0.05 + Math.sin(bf * Math.PI) * 0.04);
  [[-1, -0.55], [1, 0.55], [0.1, 0]].forEach((f, i) => {
    ctx.save(); ctx.rotate(f[1]);
    ctx.beginPath(); ctx.moveTo(0, 6); ctx.bezierCurveTo(-22, -10, -18, -52, 0, -60 + i * 3); ctx.bezierCurveTo(18, -52, 22, -10, 0, 6);
    fs(ctx, i === 2 ? '#ffe066' : '#ffd43b', 5); line(ctx, 0, -2, 0, -46, '#e8b50c', 3); ctx.restore();
  });
  [[-18, -6], [16, -8], [-6, 10]].forEach((p) => circle(ctx, p[0], p[1] - 12, 3, '#8a5a1d', 0));
  rrect(ctx, -8, 2, 16, 14, 4, '#7d6b1a', 4);
  ctx.restore();
  if (hurt) sweat(ctx, -96, -310, t, a.hurt);
  if (ko) koStars(ctx, 0, -380, 90, t);
}
function racKit(ctx, a, t) {
  jig(ctx, 'hihat', a, (fl) => {
    stand(ctx, fl, 0, '#5c5c70');
    ctx.save(); ctx.translate(0, 4 - 6 * eo(a.hihat)); cymbalPair(ctx, 46, a.hihat > 0.3 ? 1 : 0, '#b5a06b', '#8f7d4c', '#3b3548'); ctx.restore();
  });
  jig(ctx, 'kick', a, () => {
    // dented trash can
    ctx.save(); ctx.translate(0, -46);
    cyl(ctx, 44, 14, 90, '#8d96a3', '#a7b0bc', { taper: 0.9, stripes: '#6b7480' });
    ctx.restore();
    rrect(ctx, -50, -62, 100, 14, 6, '#6c7480', 5);
    line(ctx, -30, -40, -14, 36, '#7d8794', 3);
    star(ctx, -12, -8, 14, 6, 5, 0.3, '#ffd43b', 3);
    // fish bone sticker
    ctx.save(); ctx.translate(18, 8); line(ctx, -16, 0, 16, 0, '#fff', 4); for (let i = -10; i <= 10; i += 7) { line(ctx, i, 0, i + 4, -8, '#fff', 3); line(ctx, i, 0, i + 4, 8, '#fff', 3); } ctx.restore();
  });
  jig(ctx, 'tom', a, () => {
    line(ctx, 0, 46, 0, 62, OUT, 12);
    cyl(ctx, 36, 12, 48, '#ffe3b0', '#e8590c', { stripes: '#c2410c' });
    rrect(ctx, -37, 14, 74, 18, 3, '#fff3bf', 3.5); ctext(ctx, 'BEANS', 0, 23, 15, '#c92a2a', { lw: 3 });
  });
  jig(ctx, 'snare', a, (fl) => {
    stand(ctx, fl, 40, '#5c5c70');
    cyl(ctx, 52, 16, 42, '#f1e1b6', '#38d9a9', { stripes: '#0ca678' });
    [[-30, 42], [10, 48], [34, 40]].forEach((d) => { ctx.beginPath(); ctx.moveTo(d[0], 20); ctx.lineTo(d[0], d[1]); ctx.strokeStyle = '#38d9a9'; ctx.lineWidth = 7; ctx.stroke(); circle(ctx, d[0], d[1], 4, '#38d9a9', 0); });
    rrect(ctx, -54, 12, 108, 7, 3, '#12b886', 3);
  });
}

// ---------------------------------------------------------------- OCTOPUS
const OCT = { body: '#a259e6', dark: '#7b3fc4', light: '#c9a0f5' };
const OCT_ARMS = {
  A: { s: [-70, -204], w: 30, fill: OCT.body, sucker: OCT.light, hand: OCT.body, handR: 13, pref: [-0.9, 0.7], style: 'tentacle', tipCol: '#ffd43b' },
  B: { s: [60, -200], w: 30, fill: OCT.body, sucker: OCT.light, hand: OCT.body, handR: 13, pref: [0.9, 0.7], style: 'tentacle', tipCol: '#ffd43b' },
};
function octBody(ctx, a, t, beats, P) {
  const bf = frac(beats), sw = Math.sin(bf * Math.PI), ko = a.ko > 0.02, hurt = a.hurt > 0.05 && !ko;
  // floor tentacles
  const wv = (i, k) => Math.sin(t * 2.6 + i) * k;
  tent(ctx, [-60, -120], [-140, -110], [-186, -40 + wv(0, 6)], [-132 + wv(1, 8), -8], 42, 14, OCT.body, OCT.light, 18);
  tent(ctx, [60, -120], [140, -110], [186, -40 + wv(2, 6)], [132 + wv(3, 8), -8], 42, 14, OCT.body, OCT.light, 18);
  tent(ctx, [-34, -112], [-76, -80], [-70, -34], [-80 + wv(4, 6), -8], 38, 14, OCT.body, OCT.light, 14);
  tent(ctx, [34, -112], [76, -80], [70, -34], [84 + wv(5, 6), -8], 38, 14, OCT.body, OCT.light, 14);
  // dancing tentacles (up in the air)
  const da = Math.sin(t * 4) * 16 + (sw - 0.5) * 24;
  if (!ko) {
    tent(ctx, [-84, -236], [-160, -250], [-190, -320 - da], [-150 - da * 0.5, -392 + da * 0.5], 28, 12, OCT.body, OCT.light, 16);
    tent(ctx, [84, -236], [160, -250], [190, -320 + da], [150 + da * 0.5, -392 - da * 0.5], 28, 12, OCT.body, OCT.light, 16);
  }
  // head dome
  ell(ctx, 0, -250, 104, 112, OCT.body, 5);
  ell(ctx, -44, -318, 30, 18, 'rgba(255,255,255,0.28)', 0, -0.5);
  [[-70, -270, 11], [74, -300, 9], [58, -214, 8], [-62, -196, 7], [10, -346, 8]].forEach((p) => circle(ctx, p[0], p[1], p[2], OCT.dark, 0));
  ell(ctx, 0, -150, 92, 28, OCT.dark, 5);  // skirt rim
  // sequin flower
  [0, 1, 2, 3, 4].forEach((i) => ell(ctx, -62 + Math.cos(i * 1.26) * 16, -348 + Math.sin(i * 1.26) * 16, 12, 8, '#ff4d8d', 3.5, i * 1.26));
  circle(ctx, -62, -348, 8, '#ffd43b', 3.5);
  // shades (slip down when hurt)
  const sy = -264 + (hurt ? 10 : 0) + (ko ? 8 : 0);
  if (hurt || ko) {
    eyeBall(ctx, -34, sy - 8, 22, 22, 1, ko ? 'ko' : 'hurt', t, 1, 0.2);
    eyeBall(ctx, 40, sy - 8, 22, 22, 1, ko ? 'ko' : 'hurt', t, -1, 0.2);
  }
  ctx.save(); ctx.translate(0, sy); if (ko) ctx.rotate(0.18);
  const lens = (x) => {
    ell(ctx, x, 0, 42, 30, '#17102b', 5); ctx.strokeStyle = '#ffd43b'; ctx.lineWidth = 6; ctx.beginPath(); ctx.ellipse(x, 0, 42, 30, 0, 0, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x - 24, -14); ctx.lineTo(x - 8, -20); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 28, -4); ctx.lineTo(x - 22, -8); ctx.stroke();
  };
  if (!(hurt || ko)) { lens(-36); lens(42); line(ctx, -2, -4, 8, -4, '#ffd43b', 7); line(ctx, 82, -6, 98, -12, '#ffd43b', 6); }
  else { ctx.globalAlpha = 0.0; }
  ctx.restore();
  if (hurt || ko) { ctx.save(); ctx.translate(0, sy - 26); ctx.rotate(ko ? 0.3 : 0.15); ell(ctx, 0, 40, 100, 10, null, 0); ctx.restore(); }
  // brows
  if (!(hurt || ko)) { ctx.beginPath(); ctx.moveTo(-70, -304 - sw * 3); ctx.quadraticCurveTo(-36, -322 - sw * 3, -6, -304); ctx.strokeStyle = OUT; ctx.lineWidth = 7; ctx.stroke(); ctx.beginPath(); ctx.moveTo(14, -304); ctx.quadraticCurveTo(46, -322 - sw * 3, 78, -306 - sw * 3); ctx.stroke(); }
  // nose dots
  circle(ctx, 92, -238, 6, OCT.dark, 0); circle(ctx, 70, -242, 4, OCT.dark, 0);
  // lips + mouth
  const mo = mouthOpenAmt(a, t);
  ell(ctx, 30, -208, 44, 17 + mo * 8, '#ff3b7a', 5);
  if (mo > 0.08) mouthShape(ctx, 30, -212, 52, mo * 0.9, 0.5, true, ko);
  else { ctx.beginPath(); ctx.moveTo(-8, -210); ctx.quadraticCurveTo(30, -192, 68, -210); ctx.strokeStyle = OUT; ctx.lineWidth = 4; ctx.stroke(); }
  // gold chain + medallion
  const cy = -150 + sw * 4;
  ctx.beginPath(); ctx.moveTo(-70, -168); ctx.quadraticCurveTo(0, cy + 60, 70, -168);
  ctx.strokeStyle = OUT; ctx.lineWidth = 14; ctx.lineCap = 'round'; ctx.stroke(); ctx.strokeStyle = '#ffd43b'; ctx.lineWidth = 7; ctx.stroke();
  ctx.setLineDash([2, 12]); ctx.strokeStyle = '#fff3a8'; ctx.lineWidth = 4; ctx.stroke(); ctx.setLineDash([]);
  circle(ctx, 0, cy + 42, 22, '#ffd43b', 5);
  star(ctx, 0, cy + 42, 14, 6, 6, t * 2, '#fff7c2', 2.5);
  if (hurt) sweat(ctx, -92, -300, t, a.hurt);
  if (ko) koStars(ctx, 0, -378, 96, t);
}
function octKit(ctx, a, t) {
  const sparkle = (rx, ry, n, seed) => {
    for (let i = 0; i < n; i++) {
      const k = frac(t * 0.8 + rnd(seed + i)), x = (rnd(seed + i * 3) - 0.5) * rx * 1.6, y = (rnd(seed + i * 7) - 0.5) * ry * 1.6;
      star(ctx, x, y, 4 + 3 * Math.sin(k * Math.PI), 1.5, 4, 0, '#fff', 0);
    }
  };
  jig(ctx, 'hihat', a, (fl) => {
    stand(ctx, fl, 0, '#c9a227');
    ctx.save(); ctx.translate(0, 4 - 6 * eo(a.hihat)); cymbalPair(ctx, 46, a.hihat > 0.3 ? 1 : 0, '#ffd43b', '#e0a800', '#7b3fc4'); ctx.restore();
  });
  jig(ctx, 'kick', a, () => {
    circle(ctx, 0, 0, 54, '#ff4d8d', 5); circle(ctx, 0, 0, 44, '#ff8fb8', 3);
    ctx.beginPath(); ctx.arc(0, 0, 54, 0, TAU); ctx.setLineDash([6, 8]); ctx.strokeStyle = '#ffd43b'; ctx.lineWidth = 6; ctx.stroke(); ctx.setLineDash([]);
    star(ctx, 0, 0, 26, 12, 8, t * 0.5, '#ffd43b', 4); sparkle(70, 70, 5, 3);
  });
  jig(ctx, 'tom', a, () => {
    line(ctx, 0, 46, 0, 62, OUT, 12);
    cyl(ctx, 38, 13, 46, '#b2f2ff', '#15aabf', { stripes: '#0b7285', rim: '#fff' }); sparkle(60, 20, 4, 11);
  });
  jig(ctx, 'snare', a, (fl) => {
    stand(ctx, fl, 40, '#c9a227');
    cyl(ctx, 52, 16, 42, '#ffe066', '#f59f00', { stripes: '#e67700', rim: '#fff3bf' });
    for (let i = -40; i < 44; i += 20) circle(ctx, i, 22, 4, '#fff', 0);
    sparkle(80, 20, 5, 21);
  });
}

// ---------------------------------------------------------------- ROBOT
const ROB_ARMS = {
  A: { s: [-70, -300], l1: 70, l2: 70, w: 20, fill: '#adb5bd', joint: '#868e96', shoulder: '#868e96', hand: '#ced4da', handR: 14, pref: [-0.7, 1], tipCol: '#3dff9c', claw: true },
  B: { s: [66, -296], l1: 70, l2: 70, w: 20, fill: '#adb5bd', joint: '#868e96', shoulder: '#868e96', hand: '#ced4da', handR: 14, pref: [0.7, 1], tipCol: '#3dff9c', claw: true },
};
function robBody(ctx, a, t, beats, P) {
  const bf = frac(beats), ko = a.ko > 0.02, hurt = a.hurt > 0.05 && !ko;
  // legs
  limb(ctx, [[-52, -76], [-56, -30]], 30, '#868e96'); limb(ctx, [[52, -76], [56, -30]], 30, '#868e96');
  rrect(ctx, -92, -26, 72, 24, 10, '#495057', 5); rrect(ctx, 20, -26, 78, 24, 10, '#495057', 5);
  // body trapezoid (metronome)
  ctx.lineJoin = 'round';
  poly(ctx, [[-112, -66], [112, -66], [62, -372], [-62, -372]], '#4dabf7', 6);
  poly(ctx, [[-96, -74], [96, -74], [90, -112], [-90, -112]], '#1c7ed6', 0);
  rrect(ctx, -122, -92, 244, 34, 12, '#364fc7', 5);
  poly(ctx, [[-62, -372], [62, -372], [58, -392], [-58, -392]], '#364fc7', 5);
  // side highlights
  line(ctx, -88, -120, -58, -350, 'rgba(255,255,255,0.35)', 8);
  // key winder
  ctx.save(); ctx.translate(86, -190); ctx.rotate(t * 1.5 * (ko ? 0 : 1)); rrect(ctx, -6, -22, 12, 44, 5, '#ffd43b', 4); circle(ctx, 0, 0, 7, '#f59f00', 3); ctx.restore();
  // pendulum window
  poly(ctx, [[-62, -252], [62, -252], [24, -100], [-24, -100]], '#0f1f45', 5);
  poly(ctx, [[-52, -246], [-20, -246], [-12, -112], [-18, -112]], 'rgba(255,255,255,0.10)', 0);
  for (let i = 0; i < 6; i++) { const y = -240 + i * 24, hw = lerp(56, 20, (y + 240) / 140); line(ctx, -hw, y, -hw + 7, y, '#4cc9f0', 3); line(ctx, hw, y, hw - 7, y, '#4cc9f0', 3); }
  // pendulum (angle from beats)
  const ang = ko ? 0.5 : 0.42 * Math.sin(Math.PI * beats);
  ctx.save(); ctx.translate(0, -108); ctx.rotate(ang);
  line(ctx, 0, 0, 0, -136, OUT, 10); line(ctx, 0, 0, 0, -136, '#e9ecef', 5);
  rrect(ctx, -15, -128 + 0, 30, 22, 7, '#ffd43b', 4.5); circle(ctx, 0, -138, 9, '#ff6b6b', 4);
  ctx.restore();
  circle(ctx, 0, -108, 11, '#868e96', 4.5);
  // screen face
  rrect(ctx, -48, -352, 96, 76, 16, '#0b1a2e', 5);
  const col = hurt ? '#ff6b6b' : ko ? '#ff6b6b' : '#3dff9c';
  ctx.save();
  ctx.globalAlpha = 1;
  if (ko) { [[-22, -322], [22, -322]].forEach((p) => { line(ctx, p[0] - 9, p[1] - 9, p[0] + 9, p[1] + 9, col, 6); line(ctx, p[0] - 9, p[1] + 9, p[0] + 9, p[1] - 9, col, 6); }); }
  else if (hurt) { [[-22, -322, 1], [22, -322, -1]].forEach((p) => { ctx.beginPath(); ctx.moveTo(p[0] - 9 * p[2], p[1] - 10); ctx.lineTo(p[0] + 9 * p[2], p[1]); ctx.lineTo(p[0] - 9 * p[2], p[1] + 10); ctx.strokeStyle = col; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(); }); }
  else {
    const bl = frac(t * 0.4) < 0.04 ? 0.15 : 1;
    [-22, 22].forEach((x) => { ctx.fillStyle = 'rgba(61,255,156,0.25)'; ctx.fillRect(x - 15, -337, 30, 30); rrPath(ctx, x - 11, -334 + 11 * (1 - bl), 22, 24 * bl, 6); ctx.fillStyle = col; ctx.fill(); });
    ctx.fillStyle = '#0b1a2e'; ctx.fillRect(7 - 22 + 22, -333, 6, 6);
  }
  // LED mouth
  const mo = mouthOpenAmt(a, t);
  for (let i = 0; i < 7; i++) {
    const hgt = mo > 0.05 ? 4 + mo * 14 * (0.5 + 0.5 * Math.abs(Math.sin(t * 20 + i * 1.7))) : (i === 0 || i === 6 ? 8 : 5);
    const y0 = -294 + (mo > 0.05 ? 0 : (i === 0 || i === 6 ? -4 : 0));
    ctx.fillStyle = col; ctx.fillRect(-30 + i * 9, y0 - hgt / 2 + 2, 6, hgt);
  }
  ctx.restore();
  // antenna
  line(ctx, 0, -392, 0, -418, OUT, 10); line(ctx, 0, -392, 0, -418, '#adb5bd', 4);
  const bl2 = frac(beats) < 0.25;
  circle(ctx, 0, -426, 11, bl2 ? '#ff6b6b' : '#862e2e', 4.5);
  if (bl2) { ctx.save(); ctx.globalAlpha = 0.4; circle(ctx, 0, -426, 20, '#ff6b6b', 0); ctx.restore(); }
  // bolts
  [[-100, -78], [100, -78]].forEach((p) => circle(ctx, p[0], p[1], 5, '#adb5bd', 3));
  // sparks when hurt
  if (hurt) for (let i = 0; i < 3; i++) { const k = frac(t * 6 + i / 3), sx = -90 + i * 90 + Math.sin(i * 5) * 20, sy = -280 - k * 40; ctx.save(); ctx.globalAlpha = 1 - k; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + 8, sy - 10); ctx.lineTo(sx - 2, sy - 14); ctx.lineTo(sx + 8, sy - 26); ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 4; ctx.stroke(); ctx.restore(); }
  if (ko) koStars(ctx, 0, -450, 80, t);
}
function robKit(ctx, a, t) {
  jig(ctx, 'hihat', a, (fl) => {
    stand(ctx, fl, 0, '#495057');
    ctx.save(); ctx.translate(0, 4 - 6 * eo(a.hihat));
    ell(ctx, 0, 12, 46, 9, '#495057', 5);
    gear(ctx, 0, 0, 46, 12, t * (a.hihat > 0.3 ? 4 : 0.6), '#74c0fc', 5); circle(ctx, 0, 0, 8, '#1c7ed6', 4);
    ctx.restore();
  });
  jig(ctx, 'kick', a, () => {
    rrect(ctx, -52, -48, 104, 96, 12, '#343a40', 5);
    circle(ctx, 0, 0, 36, '#212529', 5);
    const g = 0.5 + 0.5 * a.kick;
    for (let i = 3; i > 0; i--) { ctx.beginPath(); ctx.arc(0, 0, i * 10, 0, TAU); ctx.strokeStyle = `rgba(61,255,156,${0.35 + g * 0.5})`; ctx.lineWidth = 4; ctx.stroke(); }
    circle(ctx, 0, 0, 6, '#3dff9c', 3);
    [[-42, -38], [42, -38], [-42, 38], [42, 38]].forEach((p) => circle(ctx, p[0], p[1], 4, '#adb5bd', 2.5));
  });
  jig(ctx, 'tom', a, () => {
    line(ctx, 0, 46, 0, 62, OUT, 12);
    cyl(ctx, 38, 13, 46, '#d0f4de', '#2b8a3e', { rim: '#3dff9c' });
    rrect(ctx, -34, 14, 68, 10, 4, `rgba(61,255,156,${0.6 + 0.4 * a.tom})`, 3);
  });
  jig(ctx, 'snare', a, (fl) => {
    stand(ctx, fl, 40, '#495057');
    cyl(ctx, 52, 16, 42, '#dee2e6', '#5c7cfa', { rim: '#4cc9f0' });
    for (let i = -36; i <= 36; i += 18) rrect(ctx, i - 5, 14, 10, 18, 3, ((Math.floor(t * 4) + i / 18) % 2 ? '#ffe14d' : '#ff6b6b'), 2.5);
  });
}

// ---------------------------------------------------------------- VOLCANO
const VOL_ARMS = {
  A: { s: [-80, -236], l1: 60, l2: 60, w: 42, fill: '#8d4a2f', hand: '#5b2c1c', handR: 20, pref: [-0.7, 1], tipCol: '#ff922b' },
  B: { s: [78, -232], l1: 60, l2: 60, w: 42, fill: '#8d4a2f', hand: '#5b2c1c', handR: 20, pref: [0.7, 1], tipCol: '#ff922b' },
};
function volBody(ctx, a, t, beats, P) {
  const bf = frac(beats), pulse = 0.5 + 0.5 * Math.cos(bf * TAU), ko = a.ko > 0.02, hurt = a.hurt > 0.05 && !ko;
  const lavaCol = ko ? '#a85a2a' : `rgb(255,${150 + 60 * pulse | 0},${20 + 30 * pulse | 0})`;
  // cone silhouette
  const cone = () => { ctx.beginPath(); ctx.moveTo(-182, 0); ctx.bezierCurveTo(-130, -60, -80, -240, -54, -344); ctx.lineTo(54, -344); ctx.bezierCurveTo(80, -240, 130, -60, 182, 0); ctx.closePath(); };
  cone(); const g = ctx.createLinearGradient(-180, 0, 180, 0);
  g.addColorStop(0, '#6b3322'); g.addColorStop(0.55, '#9a5236'); g.addColorStop(1, '#6b3322'); fs(ctx, g, 6);
  // shade
  ctx.save(); cone(); ctx.clip();
  ctx.fillStyle = 'rgba(40,10,10,0.25)'; ctx.fillRect(-190, -350, 60, 360); ctx.fillRect(130, -350, 60, 360);
  // rock cracks
  [[-120, -60, -100, -110], [100, -80, 120, -130], [-60, -290, -40, -250], [70, -300, 56, -260]].forEach((c) => { line(ctx, c[0], c[1], c[2], c[3], '#4a1f12', 4); line(ctx, c[0], c[1], c[2], c[3], lavaCol, 2); });
  // lava drips from crater
  [[-30, 0.0, 62], [32, 0.4, 56]].forEach((d, i) => {
    const wob = Math.sin(t * 1.4 + i * 2) * 3;
    ctx.beginPath(); ctx.moveTo(d[0] - 11, -340); ctx.bezierCurveTo(d[0] - 14 + wob, -340 + d[2] * 0.5, d[0] - 8, -340 + d[2] * 0.8, d[0], -340 + d[2]);
    ctx.bezierCurveTo(d[0] + 8, -340 + d[2] * 0.8, d[0] + 14, -340 + d[2] * 0.5, d[0] + 11, -340); ctx.closePath();
    ctx.fillStyle = lavaCol; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 4; ctx.stroke();
  });
  ctx.restore();
  cone(); ctx.strokeStyle = OUT; ctx.lineWidth = 6; ctx.lineJoin = 'round'; ctx.stroke();
  // crater lava
  ell(ctx, 0, -344, 60, 15, '#5b2c1c', 5); ell(ctx, 0, -342, 50, 10, lavaCol, 0);
  // flames
  if (!ko) for (let i = 0; i < 5; i++) {
    const fx = -40 + i * 20, hh = 44 + 26 * Math.abs(Math.sin(t * 5 + i * 1.3)) + 20 * pulse;
    poly(ctx, [[fx - 11, -346], [fx + Math.sin(t * 7 + i) * 6, -346 - hh], [fx + 11, -346]], i % 2 ? '#ffd43b' : '#ff922b', 4);
  }
  // face
  const st = ko ? 'ko' : hurt ? 'hurt' : null, ey = -252;
  ell(ctx, -42, ey, 27, 31, '#fff', 5); ell(ctx, 44, ey, 27, 31, '#fff', 5);
  if (st) { eyeBall(ctx, -42, ey, 22, 26, 1, st, t, 1, 0.5); eyeBall(ctx, 44, ey, 22, 26, 1, st, t, -1, 0.5); }
  else { circle(ctx, -32, ey + 6, 12, '#d9480f', 0); circle(ctx, -32, ey + 6, 6.5, OUT, 0); circle(ctx, 54, ey + 6, 12, '#d9480f', 0); circle(ctx, 54, ey + 6, 6.5, OUT, 0); circle(ctx, -36, ey, 3.5, '#fff', 0); circle(ctx, 50, ey, 3.5, '#fff', 0); }
  if (!st) { line(ctx, -72, ey - 46, -20, ey - 26, OUT, 12); line(ctx, 74, ey - 46, 22, ey - 26, OUT, 12); }
  else { line(ctx, -68, ey - 34, -20, ey - 42, OUT, 10); line(ctx, 70, ey - 34, 22, ey - 42, OUT, 10); }
  // mouth with jagged teeth + lava inside
  const mo = Math.max(0.28, mouthOpenAmt(a, t) + 0.15 * a.kick), mw = 104, my = -200, md = 10 + mo * 38;
  ctx.beginPath(); ctx.moveTo(-mw / 2, my); ctx.quadraticCurveTo(0, my - 14, mw / 2, my); ctx.quadraticCurveTo(mw * 0.5, my + md * 2, 0, my + md * 1.15); ctx.quadraticCurveTo(-mw * 0.5, my + md * 2, -mw / 2, my); ctx.closePath();
  ctx.fillStyle = lavaCol; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.fillStyle = '#c92a2a'; ctx.fillRect(-mw / 2, my + md * 0.6, mw, md);
  for (let i = 0; i < 6; i++) { const tx = -mw / 2 + 4 + i * 17; poly(ctx, [[tx, my - 4], [tx + 16, my - 4], [tx + 8, my + 14 + (i % 2) * 5]], '#fff', 3.5); }
  if (md > 24) for (let i = 0; i < 5; i++) { const tx = -mw / 2 + 12 + i * 17; poly(ctx, [[tx, my + md * 1.2], [tx + 15, my + md * 1.2], [tx + 8, my + md * 1.2 - 13]], '#fff', 3.5); }
  ctx.restore();
  ctx.beginPath(); ctx.moveTo(-mw / 2, my); ctx.quadraticCurveTo(0, my - 14, mw / 2, my); ctx.quadraticCurveTo(mw * 0.5, my + md * 2, 0, my + md * 1.15); ctx.quadraticCurveTo(-mw * 0.5, my + md * 2, -mw / 2, my); ctx.closePath();
  ctx.strokeStyle = OUT; ctx.lineWidth = 6; ctx.lineJoin = 'round'; ctx.stroke();
  // smoke puffs
  for (let i = 0; i < 5; i++) {
    const k = frac(t * 0.28 + i / 5), px = Math.sin(k * 6 + i) * 24 + k * 30, py = -380 - k * 170, r = 22 + k * 36;
    ctx.save(); ctx.globalAlpha = (1 - k) * 0.9; circle(ctx, px, py, r, '#b9a9c9', 4); ctx.restore();
  }
  if (hurt) sweat(ctx, -100, -300, t, a.hurt);
  if (ko) koStars(ctx, 0, -400, 110, t);
}
function volKit(ctx, a, t) {
  const rock = '#6c6c80';
  jig(ctx, 'hihat', a, (fl) => {
    stand(ctx, fl, 0, '#4b3a3a');
    ctx.save(); ctx.translate(0, 4 - 6 * eo(a.hihat)); cymbalPair(ctx, 46, a.hihat > 0.3 ? 1 : 0, '#3d3d52', '#2b2b3c', '#ff922b');
    ctx.strokeStyle = '#ff922b'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, 0, 40, 8, -0.12 * (a.hihat > 0.3 ? 1 : 0), 0, TAU); ctx.stroke(); ctx.restore();
  });
  jig(ctx, 'kick', a, () => {
    poly(ctx, [[-52, 44], [-58, -10], [-34, -46], [8, -52], [48, -34], [58, 12], [46, 46]], rock, 5);
    poly(ctx, [[-28, -40], [8, -46], [30, -32], [0, -14]], '#8a8aa0', 0);
    ctx.beginPath(); ctx.moveTo(-40, 30); ctx.lineTo(-10, 6); ctx.lineTo(-18, -14); ctx.lineTo(20, -32); ctx.strokeStyle = '#ff922b'; ctx.lineWidth = 5; ctx.stroke();
    ctext(ctx, 'BOOM', 8, 18, 22, '#ffd43b', { lw: 4 });
  });
  jig(ctx, 'tom', a, () => {
    line(ctx, 0, 46, 0, 62, OUT, 12);
    cyl(ctx, 38, 13, 46, '#ff922b', '#4b4b60', { rim: '#ffd43b', stripes: '#2b2b3c' });
    ell(ctx, 0, 0, 30, 8, '#ffd43b', 0);
  });
  jig(ctx, 'snare', a, (fl) => {
    stand(ctx, fl, 40, '#4b3a3a');
    cyl(ctx, 52, 16, 42, '#2d2640', '#4b4b60', { rim: '#ff6b00', stripes: '#2b2b3c' });
    ell(ctx, -12, -2, 18, 4, 'rgba(255,255,255,0.35)', 0);
  });
}

// ---------------------------------------------------------------- character table
const CHARS = {
  hero: { bobAmp: 7, topple: 0.55, shadow: 120, body: heroBody, kit: heroKit, arms: HERO_ARMS },
  raccoon: { bobAmp: 6, topple: 0.5, shadow: 160, body: racBody, kit: racKit, arms: RAC_ARMS },
  octopus: { bobAmp: 9, topple: 0.55, shadow: 170, body: octBody, kit: octKit, arms: OCT_ARMS },
  robot: { bobAmp: 3, topple: 0.55, shadow: 150, body: robBody, kit: robKit, arms: ROB_ARMS },
  volcano: { bobAmp: 5, topple: 0.4, shadow: 200, body: volBody, kit: volKit, arms: VOL_ARMS },
};
function drawChar(ctx, def, x, y, m, anim, t, beats, s) {
  FLIP = m < 0;
  const a = normAnim(anim), P = pose(a, t, beats, def.bobAmp, def.topple);
  ctx.save();
  ctx.translate(x, y); ctx.scale(m * s, s);
  ctx.globalAlpha = 0.22; ell(ctx, 0, 2, def.shadow, 16, OUT, 0); ctx.globalAlpha = 1;
  ctx.translate(P.jx, P.jy);
  ctx.save();
  ctx.translate(0, P.bob + P.ko * 6);
  if (P.topple) ctx.rotate(-P.topple);
  def.body(ctx, a, t, beats, P);
  if (a.ko > 0.02) hangArms(ctx, def.arms, t);
  ctx.restore();
  def.kit(ctx, a, t, beats);
  if (a.ko <= 0.02) drawArms(ctx, def.arms, a, t, beats, P.bob);
  ctx.restore();
}

export const BOSS_ART = {
  raccoon: { s: 1, head: [0, -285] },
  octopus: { s: 1, head: [0, -262] },
  robot: { s: 1, head: [0, -318] },
  volcano: { s: 1.12, head: [0, -240] },
};
export function drawHero(ctx, x, y, anim, t, beats, s = 1) { drawChar(ctx, CHARS.hero, x, y, 1, anim, t, beats, s); }
export function drawBoss(ctx, key, x, y, anim, t, beats, s = 1) {
  const def = CHARS[key]; if (!def) return;
  drawChar(ctx, def, x, y, -1, anim, t, beats, s);
}

// ---------------------------------------------------------------- bursts
const BURST = { kick: ['BOOM!', '#ff4d6d', [70, -34]], snare: ['CRACK!', '#ffd43b', [50, -64]], hihat: ['TSS!', '#38d9ff', [-50, -64]], tom: ['BONG!', '#69db7c', [30, -64]] };
export function drawBursts(ctx, x, y, m, s, anim) {
  if (!anim) return;
  for (const d of ['hihat', 'tom', 'snare', 'kick']) {
    const a = anim[d] || 0; if (a <= 0.45) continue;
    const b = BURST[d], [px, py] = kitPoint(x, y, m, s, d), k = (a - 0.45) / 0.55;
    ctx.save();
    ctx.globalAlpha = clamp(k * 3);
    ctx.translate(px + m * b[2][0] * s, py + b[2][1] * s);
    const sc = s * (0.65 + 0.45 * k); ctx.scale(sc, sc); ctx.rotate((d.charCodeAt(0) % 5 - 2) * 0.07 + (1 - k) * 0.3);
    star(ctx, 0, 0, 66, 40, 11, 0.1, '#fff7d6', 5);
    star(ctx, 0, 0, 58, 34, 11, 0.1, b[1], 0);
    text(ctx, b[0], 0, 2, 30, '#fff', { lw: 6 });
    ctx.restore();
  }
}

// ---------------------------------------------------------------- backgrounds
const layers = {};
function layer(key, fn) {
  if (typeof document === 'undefined') return null;
  if (!layers[key]) {
    const c = document.createElement('canvas'); c.width = 1280; c.height = 720;
    const g = c.getContext('2d'); fn(g); layers[key] = c;
  }
  return layers[key];
}
function blit(ctx, key, fn) {
  const c = layer(key, fn);
  if (c) ctx.drawImage(c, 0, 0); else fn(ctx);
}
function vgrad(g, y0, y1, stops) { const gr = g.createLinearGradient(0, y0, 0, y1); stops.forEach((s) => gr.addColorStop(s[0], s[1])); return gr; }

function bgGarageStatic(g) {
  g.fillStyle = vgrad(g, 0, 600, [[0, '#d9a066'], [1, '#bd7f45']]); g.fillRect(0, 0, 1280, 600);
  g.strokeStyle = 'rgba(80,40,10,0.22)'; g.lineWidth = 3;
  for (let x = 0; x <= 1280; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 600); g.stroke(); }
  for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(80,40,10,0.08)'; g.fillRect(rnd(i) * 1280, rnd(i + 50) * 580, 4, 30 + rnd(i + 9) * 40); }
  // concrete floor
  g.fillStyle = vgrad(g, 590, 720, [[0, '#8e8aa6'], [1, '#6f6b88']]); g.fillRect(0, 590, 1280, 130);
  g.fillStyle = OUT; g.fillRect(0, 586, 1280, 8);
  ell(g, 640, 660, 220, 28, 'rgba(60,40,90,0.35)', 0); ell(g, 980, 680, 60, 12, 'rgba(30,20,50,0.3)', 0);
  // rug
  ell(g, 250, 626, 250, 36, '#e64980', 5); ell(g, 250, 626, 190, 24, '#f783ac', 0); ell(g, 250, 626, 120, 14, '#e64980', 0);
  // pegboard (left)
  rrect(g, 36, 130, 230, 190, 8, '#c49a62', 5);
  for (let i = 0; i < 5; i++) for (let j = 0; j < 4; j++) circle(g, 62 + i * 46, 156 + j * 44, 2.5, '#8a6535', 0);
  line(g, 70, 150, 70, 250, '#868e96', 8); poly(g, [[56, 250], [84, 250], [84, 290], [56, 290]], '#e03131', 4);
  circle(g, 150, 190, 28, null, 0); g.beginPath(); g.arc(150, 190, 26, 0, TAU); g.strokeStyle = OUT; g.lineWidth = 14; g.stroke(); g.strokeStyle = '#adb5bd'; g.lineWidth = 7; g.stroke();
  line(g, 214, 150, 214, 290, '#fcc419', 10);
  // shelves
  rrect(g, 36, 340, 250, 14, 3, '#8a5a2b', 5); rrect(g, 36, 450, 250, 14, 3, '#8a5a2b', 5);
  rrect(g, 56, 290, 46, 50, 5, '#4dabf7', 5); rrect(g, 108, 304, 40, 36, 5, '#fcc419', 5); rrect(g, 170, 296, 56, 44, 5, '#e8590c', 5);
  circle(g, 252, 318, 20, '#d0ebff', 4);
  rrect(g, 60, 402, 70, 48, 3, '#d9a566', 5); rrect(g, 140, 394, 54, 56, 3, '#c08a4a', 5); circle(g, 240, 424, 24, '#e64980', 5);
  // posters (right)
  g.save(); g.translate(1040, 300); g.rotate(-0.06);
  rrect(g, -70, -90, 140, 180, 4, '#fff3bf', 5); text(g, 'ROCK!', 0, -50, 38, '#e03131', { lw: 6 });
  star(g, 0, 20, 44, 20, 8, 0, '#4dabf7', 4); circle(g, 0, 20, 12, '#ffd43b', 3); g.restore();
  g.save(); g.translate(1190, 360); g.rotate(0.08);
  rrect(g, -50, -70, 100, 140, 4, '#d0bfff', 5);
  g.beginPath(); g.ellipse(-4, 6, 22, 30, 0.2, 0, TAU); fs(g, '#e8590c', 4); line(g, 8, -20, 34, -52, OUT, 6); text(g, 'LIVE', 0, 48, 24, '#fff', { lw: 5 }); g.restore();
  // amp
  rrect(g, 1100, 470, 140, 118, 8, '#343a40', 6); circle(g, 1170, 534, 38, '#212529', 5); circle(g, 1170, 534, 12, '#495057', 4);
  [0, 1, 2].forEach((i) => circle(g, 1126 + i * 24, 490, 6, '#fcc419', 3));
  // window
  rrect(g, 820, 150, 130, 100, 6, '#a5d8ff', 6); line(g, 885, 150, 885, 250, OUT, 6); line(g, 820, 200, 950, 200, OUT, 6);
  g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(828, 158, 20, 36);
}
function bgGarage(ctx, t, beats) {
  blit(ctx, 'garage', bgGarageStatic);
  // hanging bulb (swaying)
  const sw = Math.sin(t * 1.3) * 0.06, bx = 1180 + Math.sin(sw) * 130, by = 130 + (1 - Math.cos(sw)) * 20;
  ctx.save();
  const gr = ctx.createRadialGradient(bx, by, 6, bx, by, 300);
  gr.addColorStop(0, 'rgba(255,240,150,0.55)'); gr.addColorStop(1, 'rgba(255,240,150,0)');
  ctx.fillStyle = gr; ctx.fillRect(bx - 300, by - 300, 600, 600);
  ctx.restore();
  line(ctx, 1180, -4, bx, by - 22, OUT, 5);
  rrect(ctx, bx - 9, by - 28, 18, 14, 3, '#495057', 4);
  circle(ctx, bx, by, 16, '#fff3a3', 4.5);
}

function bgAlleyStatic(g) {
  g.fillStyle = vgrad(g, 0, 300, [[0, '#14122e'], [1, '#2b2a5a']]); g.fillRect(0, 0, 1280, 300);
  for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(rnd(i) * 1280, rnd(i + 3) * 190, 2, 2); }
  // moon
  circle(g, 1140, 112, 54, '#fff3bf', 5); circle(g, 1122, 100, 10, '#f1e29a', 0); circle(g, 1158, 132, 8, '#f1e29a', 0); circle(g, 1150, 90, 5, '#f1e29a', 0);
  // skyline
  g.fillStyle = '#1d1a40'; [[0, 190, 120], [120, 150, 90], [210, 200, 100], [900, 170, 110], [1010, 210, 80], [1180, 160, 100]].forEach((b) => { g.fillRect(b[0], b[1], b[2], 300 - b[1]); g.strokeStyle = OUT; g.lineWidth = 4; g.strokeRect(b[0], b[1], b[2], 300 - b[1]); });
  g.fillStyle = '#ffd43b'; [[20, 210], [60, 240], [140, 180], [160, 220], [920, 200], [960, 240], [1200, 190], [1230, 230]].forEach((w) => g.fillRect(w[0], w[1], 14, 18));
  // brick wall
  g.fillStyle = '#7a3b3b'; g.fillRect(0, 250, 1280, 340);
  g.fillStyle = vgrad(g, 250, 590, [[0, 'rgba(0,0,0,0.25)'], [1, 'rgba(0,0,0,0)']]); g.fillRect(0, 250, 1280, 340);
  g.strokeStyle = 'rgba(30,10,20,0.55)'; g.lineWidth = 3;
  for (let r = 0, y = 250; y < 590; y += 34, r++) {
    g.beginPath(); g.moveTo(0, y); g.lineTo(1280, y); g.stroke();
    for (let x = (r % 2) * 40; x < 1280; x += 80) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 34); g.stroke(); }
  }
  for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(${rnd(i) > 0.5 ? '255,160,140' : '40,10,20'},0.12)`; g.fillRect(Math.floor(rnd(i + 1) * 16) * 80 + (Math.floor(rnd(i + 2) * 10) % 2) * 40, 250 + Math.floor(rnd(i + 3) * 10) * 34, 80, 34); }
  g.fillStyle = OUT; g.fillRect(0, 246, 1280, 8);
  // graffiti
  g.save(); g.translate(120, 420); g.rotate(-0.08); text(g, 'ROCK', 0, 0, 78, '#ff4d6d', { lw: 8 }); g.restore();
  g.save(); g.translate(1150, 380); g.rotate(0.06); text(g, 'RACC', 0, 0, 64, '#38d9ff', { lw: 7 }); text(g, '4EVER', 0, 56, 38, '#ffd43b', { lw: 5 }); g.restore();
  star(g, 440, 330, 20, 9, 5, 0, '#69db7c', 4); g.save(); g.translate(820, 320); g.rotate(0.05); text(g, 'TRASH PUNX', 0, 0, 36, '#c0eb75', { lw: 5 }); g.restore();
  // pipes
  g.fillStyle = '#495057'; g.fillRect(380, 250, 26, 336); g.strokeStyle = OUT; g.lineWidth = 5; g.strokeRect(380, 250, 26, 336);
  g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(386, 250, 6, 336);
  // dumpster (right, behind raccoon)
  rrect(g, 1118, 470, 190, 118, 8, '#2f9e44', 6); rrect(g, 1108, 452, 210, 28, 8, '#2b8a3e', 6);
  g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(1124, 500, 178, 6); text(g, 'FREE FOOD', 1212, 540, 22, '#d8f5a2', { lw: 4 });
  // trash cans + bags (left)
  rrect(g, 20, 490, 70, 98, 8, '#868e96', 5); rrect(g, 14, 478, 82, 18, 6, '#adb5bd', 5);
  circle(g, 118, 560, 34, '#343a40', 5); circle(g, 80, 572, 26, '#212529', 5);
  // floor
  g.fillStyle = vgrad(g, 586, 720, [[0, '#4a4764'], [1, '#2c2a44']]); g.fillRect(0, 590, 1280, 130);
  g.fillStyle = OUT; g.fillRect(0, 586, 1280, 8);
  g.fillStyle = 'rgba(0,0,0,0.25)'; for (let i = 0; i < 16; i++) g.fillRect(i * 90 + 10, 640 + (i % 3) * 18, 60, 3);
  ell(g, 680, 662, 130, 20, '#5c6bc0', 0); ell(g, 660, 660, 70, 9, 'rgba(255,255,255,0.25)', 0);
}
function bgAlley(ctx, t, beats) {
  blit(ctx, 'alley', bgAlleyStatic);
  // flickering street lamp glow (left)
  const fl = 0.75 + 0.25 * Math.sin(t * 17) * Math.sin(t * 3.1);
  ctx.save(); const gr = ctx.createRadialGradient(210, 90, 4, 210, 90, 240); gr.addColorStop(0, `rgba(255,220,120,${0.35 * fl})`); gr.addColorStop(1, 'rgba(255,220,120,0)');
  ctx.fillStyle = gr; ctx.fillRect(0, 0, 460, 340); ctx.restore();
  line(ctx, 210, 0, 210, 62, OUT, 6); poly(ctx, [[188, 64], [232, 64], [222, 84], [198, 84]], '#495057', 4);
  ell(ctx, 210, 90, 12, 8, `rgba(255,240,170,${0.6 + 0.4 * fl})`, 3);
  // steam
  for (let i = 0; i < 4; i++) { const k = frac(t * 0.2 + i / 4); ctx.save(); ctx.globalAlpha = (1 - k) * 0.25; circle(ctx, 1010 + Math.sin(k * 5 + i) * 14, 600 - k * 150, 14 + k * 24, '#cbd5ff', 0); ctx.restore(); }
}

function bgDiscoStatic(g) {
  g.fillStyle = vgrad(g, 0, 600, [[0, '#1b0a3d'], [0.7, '#3a1070'], [1, '#5a1a8a']]); g.fillRect(0, 0, 1280, 600);
  for (let i = 0; i < 30; i++) { g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(rnd(i) * 1280, rnd(i + 7) * 360, 3, 3); }
  // speaker stacks
  [[30, 1], [1130, 1]].forEach((p) => {
    rrect(g, p[0], 330, 120, 260, 8, '#2b2b3c', 6); circle(g, p[0] + 60, 400, 36, '#14141f', 5); circle(g, p[0] + 60, 400, 12, '#4b4b60', 4);
    circle(g, p[0] + 60, 510, 28, '#14141f', 5); circle(g, p[0] + 60, 510, 9, '#4b4b60', 4);
  });
  g.fillStyle = OUT; g.fillRect(0, 586, 1280, 8);
}
function bgDisco(ctx, t, beats) {
  blit(ctx, 'disco', bgDiscoStatic);
  const cols = ['#ff4d8d', '#38d9ff', '#ffd43b', '#69db7c'];
  // light beams
  const bx = 640, by = 72;
  ctx.save();
  for (let i = 0; i < 8; i++) {
    const a = Math.PI / 2 + Math.sin(t * 0.7 + i * 0.9) * 0.9 + (i - 3.5) * 0.28, w = 0.09;
    ctx.globalAlpha = 0.16; ctx.fillStyle = cols[i % 4];
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(a - w) * 900, by + Math.sin(a - w) * 900); ctx.lineTo(bx + Math.cos(a + w) * 900, by + Math.sin(a + w) * 900); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  // dance floor tiles (perspective), colors cycle with beat
  const nb = Math.floor(beats), pulse = 1 - frac(beats);
  const y0 = 592, y1 = 720, rows = 4, cols_n = 14;
  for (let r = 0; r < rows; r++) {
    const ya = lerp(y0, y1, r / rows), yb = lerp(y0, y1, (r + 1) / rows);
    const wa = lerp(1100, 1700, r / rows), wb = lerp(1100, 1700, (r + 1) / rows);
    for (let c = 0; c < cols_n; c++) {
      const xa0 = 640 - wa / 2 + (c * wa) / cols_n, xa1 = xa0 + wa / cols_n;
      const xb0 = 640 - wb / 2 + (c * wb) / cols_n, xb1 = xb0 + wb / cols_n;
      const idx = (c + r + nb) % 4, on = (c + r) % 2 === 0;
      ctx.beginPath(); ctx.moveTo(xa0, ya); ctx.lineTo(xa1, ya); ctx.lineTo(xb1, yb); ctx.lineTo(xb0, yb); ctx.closePath();
      ctx.fillStyle = on ? cols[idx] : '#2a1052'; ctx.globalAlpha = on ? 0.55 + 0.4 * pulse : 1; ctx.fill(); ctx.globalAlpha = 1;
      ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.stroke();
    }
  }
  // disco ball
  line(ctx, bx, -4, bx, by - 48, OUT, 5);
  ctx.save(); ctx.translate(bx, by);
  circle(ctx, 0, 0, 48, '#b8c0d8', 5);
  ctx.save(); ctx.beginPath(); ctx.arc(0, 0, 46, 0, TAU); ctx.clip();
  const spin = t * 1.2;
  for (let i = -5; i <= 5; i++) {
    const xx = Math.sin(i * 0.3 + spin) * 46; ctx.beginPath(); ctx.moveTo(xx, -48); ctx.quadraticCurveTo(xx * 1.2, 0, xx, 48); ctx.strokeStyle = 'rgba(40,30,80,0.55)'; ctx.lineWidth = 2; ctx.stroke();
  }
  for (let j = -4; j <= 4; j++) { const yy = j * 11, rr = Math.sqrt(Math.max(0, 48 * 48 - yy * yy)); ctx.beginPath(); ctx.ellipse(0, yy, rr, 3, 0, 0, TAU); ctx.strokeStyle = 'rgba(40,30,80,0.55)'; ctx.lineWidth = 2; ctx.stroke(); }
  for (let i = 0; i < 14; i++) { const k = frac(rnd(i) + t * 0.5 + i * 0.1), px = Math.sin(rnd(i + 3) * 6 + spin) * 36, py = (rnd(i + 8) - 0.5) * 80; ctx.fillStyle = cols[i % 4]; ctx.globalAlpha = 0.5 + 0.5 * Math.sin(k * Math.PI); ctx.fillRect(px - 5, py - 5, 10, 10); }
  ctx.globalAlpha = 1; ell(ctx, -16, -18, 14, 9, 'rgba(255,255,255,0.7)', 0, -0.6);
  ctx.restore(); ctx.restore();
  ctx.save(); ctx.translate(bx, by); ctx.beginPath(); ctx.arc(0, 0, 48, 0, TAU); ctx.strokeStyle = OUT; ctx.lineWidth = 5; ctx.stroke(); ctx.restore();
  // twinkles around the ball
  for (let i = 0; i < 6; i++) { const k = frac(t * 0.9 + i / 6), a = i * 1.05 + t * 0.3; star(ctx, bx + Math.cos(a) * 78, by + Math.sin(a) * 60, 4 + 6 * Math.sin(k * Math.PI), 1.5, 4, 0, '#fff', 0); }
}

function bgLabStatic(g) {
  g.fillStyle = vgrad(g, 0, 600, [[0, '#0b1d33'], [1, '#14405f']]); g.fillRect(0, 0, 1280, 600);
  g.strokeStyle = 'rgba(77,201,240,0.18)'; g.lineWidth = 2;
  for (let x = 0; x <= 1280; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 590); g.stroke(); }
  for (let y = 0; y <= 590; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(1280, y); g.stroke(); }
  // side machines
  rrect(g, 24, 300, 130, 290, 10, '#37495f', 6); rrect(g, 40, 320, 98, 70, 8, '#0b1a2e', 5);
  for (let i = 0; i < 4; i++) circle(g, 56 + i * 24, 420, 7, ['#ff6b6b', '#ffd43b', '#3dff9c', '#4cc9f0'][i], 3);
  rrect(g, 1126, 280, 130, 310, 10, '#37495f', 6); rrect(g, 1142, 300, 98, 80, 8, '#0b1a2e', 5);
  g.strokeStyle = '#3dff9c'; g.lineWidth = 3; g.beginPath(); g.moveTo(1150, 350); for (let i = 0; i < 8; i++) g.lineTo(1150 + i * 12, 350 - (i % 2 ? 22 : -4)); g.stroke();
  // pipes
  g.fillStyle = '#546a82'; g.fillRect(200, 0, 22, 560); g.fillRect(1030, 0, 22, 560); g.strokeStyle = OUT; g.lineWidth = 5; g.strokeRect(200, 0, 22, 560); g.strokeRect(1030, 0, 22, 560);
  // floor + hazard stripes
  g.fillStyle = vgrad(g, 590, 720, [[0, '#506680'], [1, '#33445a']]); g.fillRect(0, 590, 1280, 130);
  g.save(); g.beginPath(); g.rect(0, 560, 1280, 30); g.clip(); g.fillStyle = '#ffd43b'; g.fillRect(0, 560, 1280, 30);
  g.fillStyle = OUT; for (let x = -40; x < 1320; x += 60) { g.beginPath(); g.moveTo(x, 590); g.lineTo(x + 30, 590); g.lineTo(x + 60, 560); g.lineTo(x + 30, 560); g.closePath(); g.fill(); }
  g.restore(); g.strokeStyle = OUT; g.lineWidth = 6; g.strokeRect(-4, 560, 1288, 30);
  g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 3; for (let x = 0; x < 1280; x += 100) { g.beginPath(); g.moveTo(x, 590); g.lineTo(x - 60, 720); g.stroke(); }
}
function bgLab(ctx, t, beats) {
  blit(ctx, 'lab', bgLabStatic);
  const pulse = 1 - frac(beats);
  // glowing grid pulse line
  ctx.save(); ctx.globalAlpha = 0.12 + 0.18 * pulse; ctx.strokeStyle = '#4cc9f0'; ctx.lineWidth = 3;
  const sy = (t * 90) % 590; ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(1280, sy); ctx.stroke(); ctx.restore();
  // gears
  const gl = [[110, 190, 62, 12, 1, '#5c7cfa'], [210, 240, 36, 8, -1.6, '#ff922b'], [1160, 170, 70, 14, -1, '#3dff9c'], [1060, 235, 40, 9, 1.6, '#ffd43b'], [300, 70, 34, 8, 1.3, '#ff6b6b'], [980, 80, 30, 8, -1.3, '#4cc9f0']];
  gl.forEach((g) => { gear(ctx, g[0], g[1], g[2], g[3], t * 0.5 * g[4], g[5], 5); circle(ctx, g[0], g[1], g[2] * 0.28, '#0b1a2e', 4); });
  // blinking lights
  for (let i = 0; i < 6; i++) { const on = (Math.floor(beats * 2) + i) % 3 === 0; circle(ctx, 1160 + (i % 3) * 20 - 40, 420 + Math.floor(i / 3) * 24, 6, on ? '#3dff9c' : '#1f6b45', 3); }
}

function bgVolcanoStatic(g) {
  g.fillStyle = vgrad(g, 0, 600, [[0, '#2a0a1a'], [0.45, '#8c1c1c'], [0.85, '#ff7a1a'], [1, '#ffb347']]); g.fillRect(0, 0, 1280, 600);
  // far mountains
  g.fillStyle = '#5a1a2a'; g.beginPath(); g.moveTo(0, 480); [[120, 360], [230, 440], [380, 330], [520, 450], [700, 380], [860, 450], [1000, 340], [1130, 440], [1280, 370]].forEach((p) => g.lineTo(p[0], p[1])); g.lineTo(1280, 600); g.lineTo(0, 600); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = 5; g.stroke();
  g.fillStyle = '#3c0f1e'; g.beginPath(); g.moveTo(0, 540); [[160, 450], [300, 520], [460, 440], [640, 530], [800, 460], [980, 530], [1130, 450], [1280, 520]].forEach((p) => g.lineTo(p[0], p[1])); g.lineTo(1280, 600); g.lineTo(0, 600); g.closePath(); g.fill(); g.stroke();
  // lava glow on mountain
  g.strokeStyle = 'rgba(255,160,40,0.7)'; g.lineWidth = 4; g.beginPath(); g.moveTo(380, 330); g.lineTo(372, 372); g.lineTo(388, 410); g.stroke(); g.beginPath(); g.moveTo(1000, 340); g.lineTo(1010, 380); g.lineTo(992, 420); g.stroke();
  // ground
  g.fillStyle = vgrad(g, 586, 720, [[0, '#4a2020'], [1, '#2a1018']]); g.fillRect(0, 590, 1280, 130);
  g.fillStyle = OUT; g.fillRect(0, 586, 1280, 8);
  g.fillStyle = 'rgba(0,0,0,0.3)'; for (let i = 0; i < 14; i++) { g.beginPath(); g.ellipse(rnd(i) * 1280, 620 + rnd(i + 4) * 90, 30 + rnd(i + 2) * 40, 7, 0, 0, TAU); g.fill(); }
}
const LAVA_CRACKS = [
  [[60, 640], [140, 660], [210, 640], [290, 676], [380, 660]],
  [[500, 700], [580, 672], [650, 690], [740, 660], [820, 684]],
  [[900, 650], [980, 676], [1060, 650], [1150, 684], [1240, 660]],
  [[120, 706], [220, 690], [300, 712]], [[420, 628], [470, 640], [540, 624], [610, 640]],
  [[700, 620], [760, 636], [840, 620]], [[1000, 706], [1090, 700], [1180, 712]],
];
function bgVolcano(ctx, t, beats) {
  blit(ctx, 'volcano', bgVolcanoStatic);
  const pulse = 1 - frac(beats), p2 = pulse * pulse;
  // pulsing lava cracks
  ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  LAVA_CRACKS.forEach((c) => {
    ctx.beginPath(); c.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.strokeStyle = `rgba(255,90,10,${0.35 + 0.3 * p2})`; ctx.lineWidth = 12 + 6 * p2; ctx.stroke();
    ctx.strokeStyle = `rgb(255,${190 + 50 * p2 | 0},${40 + 60 * p2 | 0})`; ctx.lineWidth = 5 + 2 * p2; ctx.stroke();
  });
  ctx.restore();
  // heat shimmer band
  ctx.save(); ctx.globalAlpha = 0.08 + 0.08 * p2; ctx.fillStyle = '#ffb347'; ctx.fillRect(0, 560, 1280, 30); ctx.restore();
  // embers
  ctx.save();
  for (let i = 0; i < 36; i++) {
    const sp = 0.05 + rnd(i) * 0.08, k = frac(t * sp + rnd(i + 5)), x = rnd(i + 2) * 1280 + Math.sin(t * 1.5 + i) * 22, y = 700 - k * 720;
    ctx.globalAlpha = Math.sin(k * Math.PI) * 0.9; ctx.fillStyle = i % 3 ? '#ffb347' : '#fff3a3'; const r = 2 + rnd(i + 9) * 3;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.restore();
}

export function drawBg(ctx, stage, t, beats) {
  ctx.save();
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  switch (stage) {
    case 'alley': bgAlley(ctx, t, beats); break;
    case 'disco': bgDisco(ctx, t, beats); break;
    case 'lab': bgLab(ctx, t, beats); break;
    case 'volcano': bgVolcano(ctx, t, beats); break;
    default: bgGarage(ctx, t, beats);
  }
  ctx.restore();
}
