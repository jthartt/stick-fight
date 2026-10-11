// Stick Fight! — engine, scenes, HUD.
import { Sound } from './audio.js';
import * as A from './art.js';
import { BOSSES } from './bosses.js';

// ───────────────────────── constants ─────────────────────────
const W = 1280, H = 720;
const HERO = { x: 250, y: 600 };
const BOSS = { x: 1030, y: 600 };
const HERO_HEAD = [350, 345];
const DRUMS = ['hihat', 'kick', 'snare', 'tom'];            // pad order D F J K
const KEYS = { d: 'hihat', f: 'kick', j: 'snare', k: 'tom' };
const LETTER = { hihat: 'D', kick: 'F', snare: 'J', tom: 'K' };
const DNAME = { hihat: 'HI-HAT', kick: 'KICK', snare: 'SNARE', tom: 'TOM' };
const COL = { hihat: '#38d9ff', kick: '#ff4d6d', snare: '#ffd43b', tom: '#69db7c' };
const OUT = '#1d1433';
const PERFECT = 0.09, GOOD = 0.22;
const HERO_HP = 100;
const TRACK = { x: 330, y: 96, w: 620, h: 72 };
const FONT = 'Bangers, Impact, "Arial Black", sans-serif';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const sound = new Sound();

// ───────────────────────── state ─────────────────────────
const newAnim = () => ({ hihat: 0, kick: 0, snare: 0, tom: 0, hurt: 0, ko: 0, talk: 0 });
const G = {
  t: 0, scene: 'title', bossIdx: 0, total: 0, sceneT: 0,
  hero: newAnim(), boss: newAnim(), pad: { hihat: 0, kick: 0, snare: 0, tom: 0 },
  shake: 0, particles: [], floats: [], projectiles: [], bubbles: { hero: null, boss: null },
  B: null, last: null, champFanfare: false,
};
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const cfgNow = () => BOSSES[G.bossIdx];

// ───────────────────────── canvas setup ─────────────────────────
let dpr = 1;
function resize() {
  dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
}
resize();
window.addEventListener('resize', resize);

// ───────────────────────── drawing helpers ─────────────────────────
const T = (s, x, y, size, fill, opts) => A.text(ctx, s, x, y, size, fill, opts);
function rr(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function panel(x, y, w, h, fill = 'rgba(22,12,44,0.88)', r = 18) {
  rr(x, y, w, h, r); ctx.fillStyle = fill; ctx.fill();
  ctx.lineWidth = 5; ctx.strokeStyle = OUT; ctx.stroke();
}
function bossHead(key) {
  const art = A.BOSS_ART[key];
  const [hx, hy] = art.head;
  return [BOSS.x - hx * art.s, BOSS.y + hy * art.s];
}
const bossScale = (key) => A.BOSS_ART[key].s;

// ───────────────────────── particles / floats ─────────────────────────
function spark(x, y, color, n = 10, speed = 260) {
  for (let i = 0; i < n; i++) {
    const a = rnd(0, Math.PI * 2), s = rnd(speed * 0.3, speed);
    G.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, g: 500, life: rnd(0.35, 0.7), max: 0.7, color, size: rnd(3, 7), kind: 'spark' });
  }
}
function confetti(n, x0 = 0, x1 = W) {
  const cols = ['#ff4d6d', '#ffd43b', '#38d9ff', '#69db7c', '#c77dff', '#ff922b'];
  for (let i = 0; i < n; i++) {
    G.particles.push({ x: rnd(x0, x1), y: rnd(-120, -10), vx: rnd(-60, 60), vy: rnd(120, 320), g: 30, life: rnd(3.5, 6), max: 6,
      color: pick(cols), size: rnd(8, 15), rot: rnd(0, 6), vr: rnd(-8, 8), kind: 'conf' });
  }
}
function floatText(text, x, y, color, size = 40, life = 0.9, vy = -70) {
  G.floats.push({ text, x, y, color, size, t0: G.t, life, vy });
}
function updateFx(dt) {
  for (const p of G.particles) {
    p.life -= dt; p.vy += (p.g || 0) * dt; p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.kind === 'conf') { p.rot += p.vr * dt; p.vx += Math.sin(G.t * 3 + p.rot) * 20 * dt; }
  }
  G.particles = G.particles.filter((p) => p.life > 0 && p.y < H + 40);
  G.floats = G.floats.filter((f) => G.t - f.t0 < f.life);
  G.shake = Math.max(0, G.shake - dt * 30);
}
function drawFx() {
  for (const p of G.particles) {
    ctx.globalAlpha = clamp(p.life / 0.4, 0, 1);
    ctx.fillStyle = p.color;
    if (p.kind === 'conf') {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); ctx.restore();
    } else {
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * clamp(p.life / p.max + 0.3, 0, 1), 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  for (const f of G.floats) {
    const k = (G.t - f.t0) / f.life;
    ctx.globalAlpha = clamp(2 - k * 2, 0, 1);
    const pop = 1 + Math.max(0, 0.4 - k * 2);
    T(f.text, f.x, f.y + f.vy * (G.t - f.t0), f.size * pop, f.color, { align: 'center' });
  }
  ctx.globalAlpha = 1;
}

// ───────────────────────── speech bubbles ─────────────────────────
function say(who, text) {
  const cfg = cfgNow();
  G.bubbles[who] = { text, t0: G.t, lines: null, typed: 0, blipEvery: who === 'boss' ? cfg.blip : 330, who };
}
function layoutBubble(b) {
  ctx.font = `28px ${FONT}`;
  const maxW = 380, words = b.text.split(' '), lines = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; } else cur = test;
  }
  lines.push(cur);
  b.lines = lines;
  b.w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 44;
  b.h = lines.length * 34 + 28;
}
const bubbleTyping = (b) => b && b.typed < b.text.length;
function updateBubbles() {
  for (const who of ['hero', 'boss']) {
    const b = G.bubbles[who];
    if (!b) { continue; }
    const n = Math.min(b.text.length, Math.floor((G.t - b.t0) * 40));
    if (Math.floor(n / 2) > Math.floor(b.typed / 2) && n < b.text.length) sound.blip(b.blipEvery);
    b.typed = n;
    if (G.t - b.t0 > b.text.length / 40 + 2.4) G.bubbles[who] = null;
  }
}
function drawBubble(b, cx, cy, tx, ty) {
  if (!b) return;
  if (!b.lines) layoutBubble(b);
  const x = cx - b.w / 2, y = cy - b.h / 2;
  const pop = clamp((G.t - b.t0) * 8, 0, 1);
  ctx.save();
  ctx.translate(cx, cy); ctx.scale(0.7 + 0.3 * pop, 0.7 + 0.3 * pop); ctx.translate(-cx, -cy);
  // tail (from the side facing the speaker's head)
  ctx.fillStyle = '#fff'; ctx.lineWidth = 5; ctx.strokeStyle = OUT; ctx.lineJoin = 'round';
  ctx.beginPath();
  let sx, sy, sw, sh;
  if (tx > x + b.w) {                        // head is to the right
    const by2 = clamp(ty, y + 24, y + b.h - 24);
    ctx.moveTo(x + b.w - 4, by2 - 14); ctx.lineTo(tx, ty); ctx.lineTo(x + b.w - 4, by2 + 14);
    sx = x + b.w - 7; sy = by2 - 11; sw = 5; sh = 22;
  } else if (tx < x) {                       // head is to the left
    const by2 = clamp(ty, y + 24, y + b.h - 24);
    ctx.moveTo(x + 4, by2 - 14); ctx.lineTo(tx, ty); ctx.lineTo(x + 4, by2 + 14);
    sx = x + 2; sy = by2 - 11; sw = 5; sh = 22;
  } else {
    const bx = clamp(tx, x + 30, x + b.w - 30), by = y + b.h;
    ctx.moveTo(bx - 16, by - 4); ctx.lineTo(tx, ty); ctx.lineTo(bx + 16, by - 4);
    sx = bx - 13; sy = by - 7; sw = 26; sh = 5;
  }
  ctx.closePath(); ctx.fill(); ctx.stroke();
  rr(x, y, b.w, b.h, 22); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.fillRect(sx, sy, sw, sh);   // cover tail seam
  ctx.font = `28px ${FONT}`; ctx.fillStyle = OUT; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  let left = b.typed;
  b.lines.forEach((l, i) => {
    const s = l.slice(0, Math.max(0, left)); left -= l.length + 1;
    ctx.fillText(s, x + 22, y + 14 + 17 + i * 34);
  });
  ctx.restore();
}
function drawBubbles() {
  const key = cfgNow().key;
  const [hx, hy] = bossHead(key);
  drawBubble(G.bubbles.boss, 760, 280, hx - 50, hy + 10);
  drawBubble(G.bubbles.hero, 500, 270, HERO_HEAD[0], HERO_HEAD[1]);
}

// ───────────────────────── pads / input visuals ─────────────────────────
function drawPads(dimFor) {
  DRUMS.forEach((d, i) => {
    const cx = 640 + (i - 1.5) * 130, cy = 628, lit = G.pad[d];
    const dim = dimFor && !dimFor.drums.includes(d);
    ctx.globalAlpha = dim ? 0.35 : 1;
    ctx.save(); ctx.translate(cx, cy); const sc = 1 + lit * 0.1; ctx.scale(sc, sc);
    rr(-55, -34, 110, 68, 16);
    ctx.fillStyle = lit > 0.05 ? COL[d] : 'rgba(30,18,58,0.85)'; ctx.fill();
    ctx.lineWidth = 5; ctx.strokeStyle = COL[d]; ctx.stroke();
    ctx.lineWidth = 3; ctx.strokeStyle = OUT; rr(-58, -37, 116, 74, 18); ctx.stroke();
    T(LETTER[d], 0, -8, 34, lit > 0.05 ? '#fff' : COL[d], { align: 'center' });
    T(DNAME[d], 0, 20, 17, '#fff', { align: 'center', lw: 4 });
    ctx.restore();
    ctx.globalAlpha = 1;
  });
}

// ───────────────────────── battle: pattern + timeline ─────────────────────────
function newBattle() {
  const cfg = cfgNow();
  const beat = 60 / cfg.bpm;
  return {
    cfg, beat, bar: beat * 4, start: sound.now + 0.6, rounds: [], nextBeat: 0,
    bossHP: cfg.hp, heroHP: HERO_HP, bossHPd: cfg.hp, heroHPd: HERO_HP,
    state: 'play', endAt: 0, score: 0, combo: 0, maxCombo: 0,
    perfect: 0, good: 0, judged: 0, tauntAt: 0, waitAt: 0, tip: 0,
  };
}

function genPattern(B) {
  const cfg = B.cfg, steps = cfg.steps, perBeat = steps / 4;
  const diff = 1 - clamp(B.bossHP / cfg.hp, 0, 1);
  const n = clamp(Math.round(cfg.minN + (cfg.maxN - cfg.minN) * diff + rnd(-0.4, 0.4)), 2, steps);
  const w = [];
  for (let s = 0; s < steps; s++) {
    const onBeat = s % perBeat === 0, half = perBeat >= 4 && s % (perBeat / 2) === 0;
    let v = onBeat ? 4 : (steps === 8 ? 1.4 : (half ? 1.6 : 0.8));
    if (!onBeat && !half && steps === 16) v *= cfg.syncop * 2;
    if (steps === 8 && !onBeat) v *= cfg.syncop * 1.6;
    w.push(v);
  }
  const chosen = new Set([0]);
  while (chosen.size < n) {
    let tot = 0; w.forEach((v, s) => { if (!chosen.has(s)) tot += v; });
    let r = Math.random() * tot, sel = -1;
    for (let s = 0; s < steps; s++) { if (chosen.has(s)) continue; r -= w[s]; if (r <= 0) { sel = s; break; } }
    if (sel < 0) { for (let s = 0; s < steps; s++) if (!chosen.has(s)) { sel = s; break; } }
    chosen.add(sel);
  }
  const notes = [];
  [...chosen].sort((a, b) => a - b).forEach((s) => {
    const beatIdx = s / perBeat, onBeat = s % perBeat === 0;
    let drum;
    if (s === 0 && cfg.drums.includes('kick')) drum = 'kick';
    else {
      const ww = cfg.drums.map((d) => {
        if (d === 'kick') return onBeat && (beatIdx === 0 || beatIdx === 2) ? 3 : 1;
        if (d === 'snare') return onBeat && (beatIdx === 1 || beatIdx === 3) ? 5 : 1;
        if (d === 'hihat') return onBeat ? 1.5 : 3;
        return 1.2;
      });
      let tot = ww.reduce((a, b) => a + b, 0), r = Math.random() * tot;
      drum = cfg.drums[cfg.drums.length - 1];
      for (let i = 0; i < ww.length; i++) { r -= ww[i]; if (r <= 0) { drum = cfg.drums[i]; break; } }
    }
    notes.push({ drum, step: s });
  });
  return notes;
}

function createRound(B) {
  const k = B.rounds.length, cfg = B.cfg;
  const callT = B.start + (1 + 2 * k) * B.bar;
  const round = { k, callT, respT: callT + B.bar, notes: genPattern(B), resolved: false, callLine: Math.random() < 0.3, lineDone: false };
  for (const n of round.notes) {
    n.tCall = callT + (n.step / cfg.steps) * B.bar;
    n.tResp = n.tCall + B.bar;
    n.state = 'pending'; n.fired = false; n.judgedAt = 0;
    n.nodes = sound.drum(n.drum, n.tCall, { pitch: cfg.pitch }) || [];
  }
  B.rounds.push(round);
}

function stopFutureNotes(B) {
  const now = sound.now;
  for (const r of B.rounds) for (const n of r.notes) {
    if (n.tCall > now - 0.02) for (const nd of n.nodes) { try { nd.stop(); } catch (e) { /* already stopped */ } }
  }
}

function scheduler(B, now) {
  const cfg = B.cfg;
  while (B.start + B.nextBeat * B.beat < now + 0.2) {
    const i = B.nextBeat++, t = B.start + i * B.beat;
    if (t < now - 0.01) continue;
    const bi = Math.floor(i / 4), accent = i % 4 === 0;
    const loud = bi === 0 || (bi >= 2 && bi % 2 === 0);
    sound.click(t, accent, loud ? 0.55 : 0.28);
    if (cfg.bassline) sound.bass(t, cfg.bassline[i % cfg.bassline.length], cfg.root, B.beat * 0.8);
  }
}

// phase of the timeline at visual time vt
function phase(B, vt) {
  const x = vt - B.start;
  if (x < 0) return { name: 'pre' };
  const bi = Math.floor(x / B.bar);
  if (bi === 0) return { name: 'count', beat: Math.floor(x / B.beat) };
  const k = Math.floor((bi - 1) / 2);
  return { name: bi % 2 === 1 ? 'listen' : 'resp', k, bi };
}
const trackX = (B, step) => TRACK.x + 40 + (step / B.cfg.steps) * (TRACK.w - 80);

function judgePress(B, drum, now) {
  const press = now - sound.latency();
  const recent = B.rounds.slice(-2);
  let best = null, bestAny = null;
  for (const r of recent) for (const n of r.notes) {
    if (n.state !== 'pending') continue;
    const d = Math.abs(press - n.tResp);
    if (d > GOOD) continue;
    if (!bestAny || d < bestAny.d) bestAny = { n, r, d };
    if (n.drum === drum && (!best || d < best.d)) best = { n, r, d };
  }
  if (best) { hitNote(B, best.r, best.n, best.d <= PERFECT ? 'perfect' : 'good', drum); return; }
  if (bestAny) { missNote(B, bestAny.r, bestAny.n, 'wrong'); return; }
  const ph = phase(B, press);
  if (ph.name === 'listen' && G.t > B.waitAt && !G.bubbles.boss) {
    B.waitAt = G.t + 4; say('boss', pick(B.cfg.lines.wait));
  }
}

function hitNote(B, r, n, grade, drum) {
  n.state = grade; n.judgedAt = G.t; B.judged++;
  B.combo++; B.maxCombo = Math.max(B.maxCombo, B.combo);
  if (grade === 'perfect') B.perfect++; else B.good++;
  const mult = 1 + Math.min(3, Math.floor(B.combo / 5) * 0.5);
  B.score += Math.round((grade === 'perfect' ? 100 : 60) * mult);
  const x = trackX(B, n.step);
  floatText(grade === 'perfect' ? 'PERFECT!' : 'NICE!', x, TRACK.y + 70, grade === 'perfect' ? '#ffd43b' : '#69db7c', 34);
  const [sx, sy] = A.kitPoint(HERO.x, HERO.y, 1, 1, drum);
  fireProjectile(sx, sy, COL[drum], B.cfg.dmg * (grade === 'perfect' ? 1 : 0.6), false);
  checkRound(B, r);
}

function missNote(B, r, n, kind) {
  n.state = kind === 'wrong' ? 'wrong' : 'miss'; n.judgedAt = G.t; B.judged++;
  B.combo = 0;
  floatText(kind === 'wrong' ? 'WRONG DRUM!' : 'MISS', trackX(B, n.step), TRACK.y + 70, '#ff4d6d', 34);
  heroHurt(B, B.cfg.missDmg);
  if (G.t > B.tauntAt && Math.random() < 0.75) { B.tauntAt = G.t + 3.5; say('boss', pick(B.cfg.lines.taunt)); }
  checkRound(B, r);
}

function heroHurt(B, dmg) {
  if (B.state !== 'play') return;
  B.heroHP = Math.max(0, B.heroHP - dmg);
  G.hero.hurt = 1; G.shake = Math.max(G.shake, 8);
  sound.bwomp();
  spark(HERO.x, HERO.y - 150, '#ff4d6d', 8, 200);
  if (B.heroHP <= 0) loseBattle(B);
}

function checkRound(B, r) {
  if (r.resolved || !r.notes.every((n) => n.state !== 'pending')) return;
  r.resolved = true;
  if (B.state === 'play' && r.notes.every((n) => n.state === 'perfect' || n.state === 'good')) {
    floatText('FULL COMBO!', TRACK.x + TRACK.w / 2, TRACK.y + 40, '#ff922b', 58, 1.4, -40);
    const [sx, sy] = A.kitPoint(HERO.x, HERO.y, 1, 1, 'tom');
    fireProjectile(sx, sy, '#ffd43b', B.cfg.dmg * 2, true);
    B.score += 150;
    if (Math.random() < 0.5 && !G.bubbles.boss) say('boss', pick(B.cfg.lines.hurt));
    if (Math.random() < 0.35 && !G.bubbles.hero) say('hero', pick(['Nailed it!', 'Cardboard power!', "That's how it's done!", 'Yeah! Again!']));
  }
}

function fireProjectile(x, y, color, dmg, big) {
  const [tx, ty] = bossHead(cfgNow().key);
  G.projectiles.push({ x0: x, y0: y, x1: tx, y1: ty, t0: G.t, dur: big ? 0.6 : 0.45, color, dmg, big });
}

function updateProjectiles(B) {
  for (const p of G.projectiles) {
    const k = (G.t - p.t0) / p.dur;
    if (k >= 1) {
      p.done = true;
      if (B && B.state === 'play') {
        B.bossHP = Math.max(0, B.bossHP - p.dmg);
        G.boss.hurt = 1; G.shake = Math.max(G.shake, p.big ? 16 : 8);
        spark(p.x1, p.y1, p.color, p.big ? 24 : 12, 320);
        floatText(String(Math.round(p.dmg * 10) / 10), p.x1 + rnd(-30, 30), p.y1 - 30, p.color, p.big ? 56 : 38, 0.9, -80);
        sound.zap();
        if (B.bossHP <= 0) winBattle(B);
      }
    } else if (Math.random() < 0.6) {
      const e = p.x0 + (p.x1 - p.x0) * k, f = p.y0 + (p.y1 - p.y0) * k - Math.sin(k * Math.PI) * 140;
      G.particles.push({ x: e, y: f, vx: rnd(-30, 30), vy: rnd(-30, 30), g: 0, life: 0.3, max: 0.3, color: p.color, size: 5, kind: 'spark' });
    }
  }
  G.projectiles = G.projectiles.filter((p) => !p.done);
}
function drawProjectiles() {
  for (const p of G.projectiles) {
    const k = clamp((G.t - p.t0) / p.dur, 0, 1);
    const x = p.x0 + (p.x1 - p.x0) * k, y = p.y0 + (p.y1 - p.y0) * k - Math.sin(k * Math.PI) * 140;
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(G.t * 14) * 0.3);
    T('♪', 0, 0, p.big ? 110 : 62, p.color, { align: 'center', base: 'middle', lw: 7 });
    ctx.restore();
  }
}

function winBattle(B) {
  B.state = 'won'; B.endAt = G.t + 3;
  stopFutureNotes(B);
  sound.cheer();
  G.bubbles.boss = null; say('boss', pick(B.cfg.lines.defeat));
  confetti(120);
  setTimeout(() => { if (G.B === B && G.scene === 'battle' && !G.bubbles.hero) say('hero', pick(['Told you I could drum!', 'Garage rock FOREVER!'])); }, 800);
}
function loseBattle(B) {
  B.state = 'lost'; B.endAt = G.t + 2.8;
  stopFutureNotes(B);
  sound.boo();
  G.bubbles.boss = null; say('boss', pick(B.cfg.lines.win));
}

function updateBattle(dt) {
  const B = G.B; if (!B) return;
  const now = sound.now, vt = now - sound.latency();
  if (B.state === 'play') {
    while (now >= B.start + (1 + 2 * B.rounds.length) * B.bar - 0.3) createRound(B);
    scheduler(B, now);
    for (const r of B.rounds.slice(-2)) {
      if (r.callLine && !r.lineDone && vt >= r.callT) {
        r.lineDone = true;
        if (!G.bubbles.boss) say('boss', pick(B.cfg.lines.call));
      }
      for (const n of r.notes) {
        if (!n.fired && vt >= n.tCall) { n.fired = true; G.boss[n.drum] = 1; }
        if (n.state === 'pending' && vt > n.tResp + GOOD && B.state === 'play') missNote(B, r, n, 'miss');
      }
    }
  } else if (G.t >= B.endAt) {
    if (B.state === 'won') {
      G.total += B.score;
      if (G.bossIdx >= BOSSES.length - 1) toScene('champion'); else toScene('victory');
    } else toScene('defeat');
  }
  // smoothed HP
  B.bossHPd += (B.bossHP - B.bossHPd) * Math.min(1, dt * 8);
  B.heroHPd += (B.heroHP - B.heroHPd) * Math.min(1, dt * 8);
}

// ───────────────────────── scenes ─────────────────────────
function resetFx() {
  G.particles = []; G.floats = []; G.projectiles = []; G.bubbles = { hero: null, boss: null };
  G.hero = newAnim(); G.boss = newAnim(); G.shake = 0;
}
function endBattleAudio() {
  if (G.B) { stopFutureNotes(G.B); G.B.state = 'dead'; }
}
function toScene(s) {
  if (s !== 'battle' && s !== 'victory' && s !== 'defeat') endBattleAudio();
  if (s !== 'victory' && s !== 'defeat') { /* keep B only for result scenes */ }
  G.scene = s; G.sceneT = G.t;
  if (s === 'title') { resetFx(); G.B = null; G.bossIdx = 0; G.total = 0; G.champFanfare = false; }
  if (s === 'intro') {
    resetFx(); G.B = null;
    say('boss', cfgNow().lines.intro[0]);
  }
  if (s === 'champion') { G.bubbles = { hero: null, boss: null }; confetti(200); sound.fanfare(); }
}
function startBattle() {
  resetFx();
  G.B = newBattle();
  G.scene = 'battle'; G.sceneT = G.t;
}
function advance() {
  switch (G.scene) {
    case 'title': G.bossIdx = 0; G.total = 0; toScene('intro'); break;
    case 'intro': startBattle(); break;
    case 'victory': G.bossIdx++; toScene('intro'); break;
    case 'defeat': startBattle(); break;
    case 'champion': toScene('title'); break;
    default: break;
  }
}

// ───────────────────────── input ─────────────────────────
function drumPress(d) {
  const now = sound.now;
  sound.drum(d, now, { dull: true });
  G.hero[d] = 1; G.pad[d] = 1;
  if (G.scene === 'battle' && G.B && G.B.state === 'play') judgePress(G.B, d, now);
}
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  sound.init();
  const k = e.key.toLowerCase();
  if (KEYS[k]) { e.preventDefault(); drumPress(KEYS[k]); return; }
  if (k === ' ' || k === 'enter') { e.preventDefault(); advance(); return; }
  if (k === 'm') { sound.toggleMute(); return; }
  if (k === 'escape') { if (G.scene !== 'title') toScene('title'); }
});
window.addEventListener('pointerdown', () => { sound.init(); advance(); });

// ───────────────────────── scene drawing ─────────────────────────
function decay(a, dt) {
  for (const d of DRUMS) a[d] = Math.max(0, a[d] - dt * 6);
  a.hurt = Math.max(0, a.hurt - dt * 2.5);
}
function drawHeroChar(beats) { A.drawHero(ctx, HERO.x, HERO.y, G.hero, G.t, beats, 1); }
function drawBossChar(key, beats) {
  A.drawBoss(ctx, key, BOSS.x, BOSS.y, G.boss, G.t, beats, bossScale(key));
  A.drawBursts(ctx, BOSS.x, BOSS.y, -1, bossScale(key), G.boss);
}
function drawBurstsHero() { A.drawBursts(ctx, HERO.x, HERO.y, 1, 1, G.hero); }

function drawTitle() {
  A.drawBg(ctx, 'garage', G.t, G.t * 2);
  drawHeroChar(G.t * 2); drawBurstsHero();
  // bosses lined up small
  BOSSES.forEach((b, i) => {
    const x = 720 + i * 150, s = bossScale(b.key) * 0.32;
    A.drawBoss(ctx, b.key, x, 590, newAnim(), G.t + i, G.t * 2 + i * 0.5, s);
  });
  ctx.save();
  ctx.translate(640, 150); ctx.rotate(Math.sin(G.t * 2) * 0.04); const sc = 1 + Math.sin(G.t * 3) * 0.03; ctx.scale(sc, sc);
  T('STICK FIGHT!', 0, 0, 150, '#ffd43b', { align: 'center', base: 'middle', lw: 14 });
  ctx.restore();
  T('GARAGE KID vs. THE BOSS DRUMMERS', 640, 250, 40, '#fff', { align: 'center', base: 'middle', lw: 8 });
  T("Listen to the boss's beat — then play it back!", 640, 310, 34, '#38d9ff', { align: 'center', base: 'middle', lw: 7 });
  T('D = hi-hat   F = kick   J = snare   K = tom', 640, 360, 28, '#fff', { align: 'center', base: 'middle', lw: 6 });
  const pulse = 1 + Math.sin(G.t * 5) * 0.06;
  ctx.save(); ctx.translate(640, 440); ctx.scale(pulse, pulse);
  T('PRESS SPACE TO START', 0, 0, 56, '#ff4d6d', { align: 'center', base: 'middle', lw: 10 });
  ctx.restore();
  T('Try the drums! Jam on D F J K', 640, 500, 24, '#ffd9a0', { align: 'center', base: 'middle', lw: 5 });
  T('M = mute', 1250, 700, 22, '#fff', { align: 'right', base: 'middle', lw: 5 });
  drawPads(null);
}

function drawLadder() {
  BOSSES.forEach((b, i) => {
    const cx = 640 + (i - 1.5) * 90, cy = 52, r = 32;
    const cur = i === G.bossIdx, ko = i < G.bossIdx;
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = '#2a1a50'; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    const art = A.BOSS_ART[b.key], s = art.s * 0.2;
    ctx.globalAlpha = ko ? 0.45 : 1;
    A.drawBoss(ctx, b.key, cx + art.head[0] * s, cy - art.head[1] * s + 4, newAnim(), G.t, G.t * 2, s);
    ctx.restore();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.lineWidth = cur ? 7 : 5; ctx.strokeStyle = cur ? '#ffd43b' : OUT; ctx.stroke();
    if (cur) { ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.arc(cx, cy, r + 6 + Math.sin(G.t * 6) * 2, 0, Math.PI * 2); ctx.stroke(); }
    if (ko) T('KO', cx, cy, 30, '#ff4d6d', { align: 'center', base: 'middle', lw: 7 });
  });
}

function drawIntro() {
  const cfg = cfgNow(), beats = G.t * cfg.bpm / 60;
  A.drawBg(ctx, cfg.stage, G.t, beats);
  drawHeroChar(beats); drawBossChar(cfg.key, beats);
  drawLadder();
  T(`ROUND ${G.bossIdx + 1} · ${cfg.name} · ${cfg.title}`, 640, 125, 40, '#fff', { align: 'center', base: 'middle', lw: 8 });
  T(`${cfg.bpm} BPM · drums: ${cfg.drums.map((d) => DNAME[d]).join(' · ')}`, 640, 168, 26, '#ffd43b', { align: 'center', base: 'middle', lw: 6 });
  drawBubbles();
  const pulse = 1 + Math.sin(G.t * 5) * 0.05;
  ctx.save(); ctx.translate(640, 692); ctx.scale(pulse, pulse);
  T('PRESS SPACE TO FIGHT!', 0, 0, 44, '#ff4d6d', { align: 'center', base: 'middle', lw: 9 });
  ctx.restore();
  drawPads(cfg);
}

function drawHpBar(x, y, w, h, frac, color, label, rightAlign) {
  rr(x, y, w, h, 10); ctx.fillStyle = 'rgba(20,10,40,0.85)'; ctx.fill();
  const fw = Math.max(0, (w - 6) * clamp(frac, 0, 1));
  if (fw > 0) {
    rr(rightAlign ? x + w - 3 - fw : x + 3, y + 3, fw, h - 6, 7); ctx.fillStyle = color; ctx.fill();
  }
  rr(x, y, w, h, 10); ctx.lineWidth = 5; ctx.strokeStyle = OUT; ctx.stroke();
  T(label, rightAlign ? x + w - 10 : x + 10, y + h / 2 + 1, 20, '#fff', { align: rightAlign ? 'right' : 'left', base: 'middle', lw: 5 });
}

function drawTrack(B, vt, ph) {
  const cfg = B.cfg;
  panel(TRACK.x, TRACK.y, TRACK.w, TRACK.h, 'rgba(22,12,44,0.88)', 16);
  const x0 = trackX(B, 0), span = TRACK.w - 80, cy = TRACK.y + 38;
  // grid
  for (let s = 0; s < cfg.steps; s++) {
    const x = trackX(B, s), isBeat = s % (cfg.steps / 4) === 0;
    ctx.strokeStyle = isBeat ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.12)';
    ctx.lineWidth = isBeat ? 3 : 1.5;
    ctx.beginPath(); ctx.moveTo(x, TRACK.y + (isBeat ? 8 : 18)); ctx.lineTo(x, TRACK.y + TRACK.h - (isBeat ? 8 : 18)); ctx.stroke();
    if (isBeat) T(String(s / (cfg.steps / 4) + 1), x, TRACK.y + 11, 14, 'rgba(255,255,255,0.6)', { align: 'center', base: 'middle', lw: 3 });
  }
  const round = (ph.name === 'listen' || ph.name === 'resp') ? B.rounds[ph.k] : null;
  if (!round) {
    if (ph.name === 'count' || ph.name === 'pre') T('...', TRACK.x + TRACK.w / 2, cy, 36, 'rgba(255,255,255,0.5)', { align: 'center', base: 'middle', lw: 4 });
    return;
  }
  const listen = ph.name === 'listen';
  for (const n of round.notes) {
    const x = trackX(B, n.step), col = COL[n.drum];
    if (listen) {
      if (vt < n.tCall) continue;
      const pop = 1 + Math.max(0, 1 - (vt - n.tCall) * 5) * 0.6;
      ctx.beginPath(); ctx.arc(x, cy, 17 * pop, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill();
      ctx.lineWidth = 4; ctx.strokeStyle = OUT; ctx.stroke();
      T(LETTER[n.drum], x, cy + 1, 20, '#fff', { align: 'center', base: 'middle', lw: 4 });
    } else if (n.state === 'pending') {
      ctx.globalAlpha = 0.45;
      ctx.beginPath(); ctx.arc(x, cy, 16, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke();
      ctx.globalAlpha = 1;
      T(LETTER[n.drum], x, cy + 1, 20, '#fff', { align: 'center', base: 'middle', lw: 4 });
      const d = n.tResp - vt;
      if (d > -0.1 && d < 0.8) {
        ctx.globalAlpha = clamp(1 - Math.abs(d) * 1.2, 0.2, 1);
        ctx.beginPath(); ctx.arc(x, cy, 16 + 34 * clamp(d / 0.8, 0, 1), 0, Math.PI * 2);
        ctx.lineWidth = 4; ctx.strokeStyle = col; ctx.stroke(); ctx.globalAlpha = 1;
      }
    } else if (n.state === 'perfect' || n.state === 'good') {
      const pop = 1 + Math.max(0, 0.5 - (G.t - n.judgedAt) * 3);
      ctx.beginPath(); ctx.arc(x, cy, 19 * pop, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill();
      ctx.lineWidth = 4; ctx.strokeStyle = n.state === 'perfect' ? '#ffd43b' : '#fff'; ctx.stroke();
      T('★', x, cy + 1, 24, '#fff', { align: 'center', base: 'middle', lw: 4 });
    } else {
      ctx.beginPath(); ctx.arc(x, cy, 16, 0, Math.PI * 2); ctx.fillStyle = '#777'; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = OUT; ctx.stroke();
      T('X', x, cy + 1, 24, '#ff4d6d', { align: 'center', base: 'middle', lw: 4 });
    }
  }
  // playhead
  const barStart = listen ? round.callT : round.respT;
  const f = clamp((vt - barStart) / B.bar, 0, 1), px = x0 + f * span;
  ctx.strokeStyle = listen ? '#ff8fd1' : '#69db7c'; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(px, TRACK.y + 6); ctx.lineTo(px, TRACK.y + TRACK.h - 6); ctx.stroke();
}

function drawBattleHud(B, vt, ph) {
  const cfg = B.cfg;
  drawHpBar(24, 20, 290, 30, B.heroHPd / HERO_HP, '#69db7c', 'YOU', false);
  drawHpBar(966, 20, 290, 30, B.bossHPd / cfg.hp, '#ff4d6d', cfg.name, true);
  T(String(B.score).padStart(6, '0'), 640, 40, 42, '#ffd43b', { align: 'center', base: 'middle', lw: 8 });
  if (B.combo > 1) T(`COMBO x${B.combo}`, 28, 84, 32 + Math.min(14, B.combo), '#ffd43b', { align: 'left', base: 'middle', lw: 7 });
  drawTrack(B, vt, ph);
  const cx = TRACK.x + TRACK.w / 2;
  if (B.state === 'play') {
    if (ph.name === 'listen') T('LISTEN...', cx, 208, 44, '#ff8fd1', { align: 'center', base: 'middle', lw: 9 });
    else if (ph.name === 'resp') {
      const p = 1 + Math.sin(G.t * 12) * 0.08;
      ctx.save(); ctx.translate(cx, 208); ctx.scale(p, p);
      T('YOUR TURN!', 0, 0, 48, '#69db7c', { align: 'center', base: 'middle', lw: 9 });
      ctx.restore();
    } else if (ph.name === 'count' || ph.name === 'pre') {
      T('GET READY!', cx, 208, 46, '#fff', { align: 'center', base: 'middle', lw: 9 });
      if (ph.name === 'count') {
        const k = (vt - B.start) / B.beat, fr = k - Math.floor(k);
        T(String(ph.beat + 1), 640, 340, 200 * (1 + (1 - fr) * 0.25), '#ffd43b', { align: 'center', base: 'middle', lw: 16 });
      }
    }
    if (G.bossIdx === 0 && (ph.name === 'listen' || ph.name === 'resp') && ph.k < 2) {
      T(ph.name === 'listen' ? 'Watch & listen…' : 'Now play it back!', cx, 250, 30, '#fff', { align: 'center', base: 'middle', lw: 6 });
    }
  }
}

function drawStage(cfg, beats) {
  A.drawBg(ctx, cfg.stage, G.t, beats);
  drawHeroChar(beats); drawBossChar(cfg.key, beats); drawBurstsHero();
}

function drawBattle() {
  const B = G.B, cfg = B.cfg, now = sound.now, vt = now - sound.latency();
  const beats = (vt - B.start) / B.beat;
  const ph = phase(B, vt);
  drawStage(cfg, beats);
  drawProjectiles();
  drawFx();
  drawBubbles();
  drawBattleHud(B, vt, ph);
  drawPads(cfg);
}

function drawResultPanel(title, lines, prompt, color) {
  ctx.fillStyle = 'rgba(10,5,25,0.55)'; ctx.fillRect(0, 0, W, H);
  panel(340, 150, 600, 360, 'rgba(34,18,70,0.96)', 26);
  T(title, 640, 215, 66, color, { align: 'center', base: 'middle', lw: 11 });
  lines.forEach((l, i) => T(l, 640, 290 + i * 48, 36, '#fff', { align: 'center', base: 'middle', lw: 7 }));
  const p = 1 + Math.sin(G.t * 5) * 0.05;
  ctx.save(); ctx.translate(640, 462); ctx.scale(p, p);
  T(prompt, 0, 0, 34, '#38d9ff', { align: 'center', base: 'middle', lw: 7 });
  ctx.restore();
}
const accuracy = (B) => (B.judged ? Math.round(((B.perfect + B.good) / B.judged) * 100) : 0);

function drawResult(win) {
  const B = G.B, cfg = B.cfg, beats = G.t * cfg.bpm / 60;
  drawStage(cfg, beats);
  drawFx();
  if (win) {
    drawResultPanel(`${cfg.name} DEFEATED!`, [`SCORE  ${B.score}`, `ACCURACY  ${accuracy(B)}%`, `MAX COMBO  ${B.maxCombo}`], 'SPACE: next boss', '#ffd43b');
  } else {
    drawBubbles();
    drawResultPanel('BOOED OFF STAGE!', [`"${B.cfg.lines.win[0]}"`.slice(0, 40), `SCORE  ${B.score}`, `ACCURACY  ${accuracy(B)}%`], 'SPACE: retry   ·   ESC: title', '#ff4d6d');
  }
}

function drawChampion() {
  const beats = G.t * 2;
  A.drawBg(ctx, 'garage', G.t, beats);
  const xs = [240, 440, 840, 1040];
  BOSSES.forEach((b, i) => {
    const bob = Math.abs(Math.sin(G.t * 4 + i)) * 14;
    const a = newAnim(); a.talk = (Math.sin(G.t * 6 + i) > 0) ? 1 : 0;
    a[DRUMS[Math.floor(G.t * 4 + i) % 4]] = Math.max(0, 1 - ((G.t * 4 + i) % 1) * 2);
    A.drawBoss(ctx, b.key, xs[i], 600 - bob, a, G.t + i, beats + i * 0.25, bossScale(b.key) * 0.6);
  });
  const ha = newAnim(); ha[DRUMS[Math.floor(G.t * 4) % 4]] = 1 - ((G.t * 4) % 1);
  A.drawHero(ctx, 640, 600 - Math.abs(Math.sin(G.t * 4)) * 14, ha, G.t, beats, 0.8);
  ctx.save(); ctx.translate(640, 130); ctx.rotate(Math.sin(G.t * 2) * 0.04); const sc = 1 + Math.sin(G.t * 4) * 0.04; ctx.scale(sc, sc);
  T('GARAGE LEGEND!', 0, 0, 130, '#ffd43b', { align: 'center', base: 'middle', lw: 13 });
  ctx.restore();
  T(`TOTAL SCORE  ${G.total}`, 640, 235, 52, '#fff', { align: 'center', base: 'middle', lw: 9 });
  T('Your new bandmates!', 640, 290, 36, '#ff8fd1', { align: 'center', base: 'middle', lw: 7 });
  const p = 1 + Math.sin(G.t * 5) * 0.05;
  ctx.save(); ctx.translate(640, 690); ctx.scale(p, p);
  T('SPACE: back to title', 0, 0, 36, '#38d9ff', { align: 'center', base: 'middle', lw: 7 });
  ctx.restore();
  drawFx();
}

// ───────────────────────── main loop ─────────────────────────
function update(dt) {
  decay(G.hero, dt); decay(G.boss, dt);
  for (const d of DRUMS) G.pad[d] = Math.max(0, G.pad[d] - dt * 7);
  const B = G.B;
  const bossKo = B && B.state === 'won', heroKo = B && B.state === 'lost';
  G.boss.ko = clamp(G.boss.ko + (bossKo ? dt * 1.5 : -dt * 4), 0, 1);
  G.hero.ko = clamp(G.hero.ko + (heroKo ? dt * 1.5 : -dt * 4), 0, 1);
  G.boss.talk = bubbleTyping(G.bubbles.boss) ? 1 : 0;
  G.hero.talk = bubbleTyping(G.bubbles.hero) ? 1 : 0;
  updateBubbles(); updateFx(dt);
  if (G.scene === 'battle') { updateProjectiles(G.B); updateBattle(dt); }
  if (G.scene === 'victory' || G.scene === 'defeat') { updateProjectiles(null); }
  if (G.scene === 'champion' && Math.random() < dt * 14) confetti(1);
  if (G.scene === 'victory' && Math.random() < dt * 8) confetti(1);
}

function draw() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  if (G.shake > 0.1) ctx.translate(rnd(-G.shake, G.shake), rnd(-G.shake, G.shake));
  switch (G.scene) {
    case 'title': drawTitle(); drawFx(); break;
    case 'intro': drawIntro(); break;
    case 'battle': drawBattle(); break;
    case 'victory': drawResult(true); break;
    case 'defeat': drawResult(false); break;
    case 'champion': drawChampion(); break;
    default: break;
  }
  ctx.restore();
  if (sound.muted) T('MUTED', 1250, 700, 22, '#ff4d6d', { align: 'right', base: 'middle', lw: 5 });
}

function frame(ts) {
  const dt = G.last == null ? 0.016 : Math.min(0.05, (ts - G.last) / 1000);
  G.last = ts; G.t += dt;
  try { update(dt); draw(); } catch (err) { console.error(err); }
  requestAnimationFrame(frame);
}

(async () => {
  try { await Promise.race([document.fonts.load(`28px Bangers`), new Promise((r) => setTimeout(r, 1500))]); } catch (e) { /* font optional */ }
  requestAnimationFrame(frame);
})();
window.__G = G; window.__sound = sound; // debug handles
