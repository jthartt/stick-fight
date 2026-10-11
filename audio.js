// Stick Fight! audio: pure Web Audio synthesis, no samples.
const MIN = 0.0001;

export class Sound {
  constructor() {
    this.ctx = null; this.master = null; this.noise = null; this.muted = false;
  }

  init() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ctx = new AC();
        const master = ctx.createGain();
        master.gain.value = this.muted ? 0 : 0.8;
        const comp = ctx.createDynamicsCompressor();
        master.connect(comp); comp.connect(ctx.destination);
        const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        this.ctx = ctx; this.master = master; this.noise = buf;
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch (e) { /* ignore */ }
  }

  get ready() { return !!this.ctx; }
  get now() { return this.ctx ? this.ctx.currentTime : performance.now() / 1000; }

  latency() {
    if (!this.ctx) return 0;
    return (this.ctx.outputLatency || 0) + (this.ctx.baseLatency || 0);
  }

  toggleMute() {
    this.muted = !this.muted;
    try {
      if (this.master) {
        const g = this.master.gain, t = this.ctx.currentTime;
        g.cancelScheduledValues(t); g.setValueAtTime(this.muted ? 0 : 0.8, t);
      }
    } catch (e) { /* ignore */ }
    return this.muted;
  }

  // ---- internal helpers (all assume ctx exists) ----
  _t(t) { return Math.max(t == null ? 0 : t, this.ctx.currentTime); }

  // Oscillator with frequency sweep f0->f1 and exponential gain envelope.
  _osc(type, f0, f1, t, dur, vol, dest) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(f0, 1), t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
    g.gain.setValueAtTime(Math.max(vol, MIN), t);
    g.gain.exponentialRampToValueAtTime(MIN, t + dur);
    o.connect(g); g.connect(dest || this.master);
    o.start(t); o.stop(t + dur + 0.02);
    return o;
  }

  // Filtered noise burst.
  _noise(ftype, freq, t, dur, vol, dest) {
    const s = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    s.buffer = this.noise; f.type = ftype; f.frequency.value = freq;
    g.gain.setValueAtTime(Math.max(vol, MIN), t);
    g.gain.exponentialRampToValueAtTime(MIN, t + dur);
    s.connect(f); f.connect(g); g.connect(dest || this.master);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
    return s;
  }

  drum(type, t, { vol = 1, pitch = 1, dull = false } = {}) {
    if (!this.ctx) return [];
    try {
      t = this._t(t);
      let dest = this.master;
      if (dull) { // cardboard kit: muffled
        const lp = this.ctx.createBiquadFilter();
        lp.type = 'lowpass'; lp.frequency.value = 3000; lp.connect(this.master); dest = lp;
      }
      const n = [];
      if (type === 'kick') {
        n.push(this._osc('sine', 170 * pitch, 45 * pitch, t, 0.28, 1.0 * vol, dest));
        n.push(this._osc('square', 1800 * pitch, 300 * pitch, t, 0.012, 0.3 * vol, dest)); // click
      } else if (type === 'snare') {
        n.push(this._noise('highpass', 1800 * pitch, t, 0.2, 0.7 * vol, dest));
        n.push(this._osc('triangle', 220 * pitch, 160 * pitch, t, 0.12, 0.6 * vol, dest));
      } else if (type === 'hihat') {
        n.push(this._noise('highpass', 7000 * pitch, t, 0.05, 0.45 * vol, dest));
      } else if (type === 'tom') {
        n.push(this._osc('sine', 260 * pitch, 130 * pitch, t, 0.3, 0.9 * vol, dest));
        n.push(this._osc('triangle', 520 * pitch, 260 * pitch, t, 0.06, 0.2 * vol, dest)); // stick tone
      }
      return n;
    } catch (e) { return []; }
  }

  click(t, accent, vol = 0.4) {
    if (!this.ctx) return;
    try { this._osc('square', accent ? 1760 : 1200, accent ? 1760 : 1200, this._t(t), 0.03, vol * 0.5); } catch (e) { /* ignore */ }
  }

  bass(t, semitone, rootHz, dur) {
    if (!this.ctx) return;
    try {
      const f = (rootHz || 55) * Math.pow(2, (semitone || 0) / 12);
      this._osc('triangle', f, f, this._t(t), Math.max(dur || 0.2, 0.05), 0.5);
    } catch (e) { /* ignore */ }
  }

  blip(freq) {
    if (!this.ctx) return;
    try { this._osc('square', freq || 400, freq || 400, this.ctx.currentTime, 0.05, 0.12); } catch (e) { /* ignore */ }
  }

  bwomp() { // hero hurt: descending saw
    if (!this.ctx) return;
    try { const t = this.ctx.currentTime; this._osc('sawtooth', 380, 70, t, 0.35, 0.45); this._osc('square', 190, 50, t, 0.3, 0.2); } catch (e) { /* ignore */ }
  }

  zap() { // projectile hits boss: pew + crunch
    if (!this.ctx) return;
    try { const t = this.ctx.currentTime; this._osc('square', 1600, 200, t, 0.18, 0.3); this._noise('bandpass', 2500, t, 0.1, 0.4); } catch (e) { /* ignore */ }
  }

  _seq(type, notes, step, dur, vol) {
    const t0 = this.ctx.currentTime + 0.02;
    notes.forEach((f, i) => this._osc(type, f, f, t0 + i * step, dur, vol));
  }

  cheer() { // boss defeated: happy arpeggio + crowd noise
    if (!this.ctx) return;
    try {
      this._seq('triangle', [523, 659, 784, 1047, 1319], 0.08, 0.25, 0.4);
      this._noise('bandpass', 1500, this.ctx.currentTime, 0.8, 0.25);
    } catch (e) { /* ignore */ }
  }

  boo() { // sad trombone: wah wah wah waaah
    if (!this.ctx) return;
    try {
      const t0 = this.ctx.currentTime + 0.02;
      [[233, 0.35], [220, 0.35], [208, 0.35], [196, 0.9]].reduce((t, [f, d]) => {
        this._osc('sawtooth', f * 1.03, f * (d > 0.5 ? 0.8 : 0.97), t, d, 0.3);
        return t + d;
      }, t0);
    } catch (e) { /* ignore */ }
  }

  fanfare() { // champion jingle
    if (!this.ctx) return;
    try {
      const t0 = this.ctx.currentTime + 0.02;
      const notes = [[392, 0], [392, 0.15], [392, 0.3], [523, 0.45], [659, 0.75], [523, 0.95], [659, 1.15], [784, 1.4]];
      notes.forEach(([f, dt], i) => {
        const d = i === notes.length - 1 ? 1.0 : 0.22;
        this._osc('sawtooth', f, f, t0 + dt, d, 0.22);
        this._osc('square', f / 2, f / 2, t0 + dt, d, 0.15);
      });
      this._noise('highpass', 6000, t0 + 1.4, 0.6, 0.3); // cymbal crash
    } catch (e) { /* ignore */ }
  }
}
