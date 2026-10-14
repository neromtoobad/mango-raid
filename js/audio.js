// MANGO RAID sound: all synthesized in WebAudio.
let ctx = null, master, sfx, mus, comp, noise, muted = false;
try { muted = localStorage.getItem('mr:muted') === '1'; } catch (e) {}
let musicOn = false, nextStep = 0, step = 0, timer = null, tension = 0, alarm = false;
let snore = null, birdsT = 0;

function init() {
  if (ctx) return true;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
  ctx = new AC();
  comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -12; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.2;
  master = ctx.createGain(); master.gain.value = muted ? 0 : 0.9;
  sfx = ctx.createGain(); sfx.gain.value = 1;
  mus = ctx.createGain(); mus.gain.value = 0.3;
  sfx.connect(comp); mus.connect(comp); comp.connect(master); master.connect(ctx.destination);
  const len = ctx.sampleRate * 2;
  noise = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = noise.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return true;
}
export function unlock() { if (!init()) return; if (ctx.state === 'suspended') ctx.resume(); }
const now = () => ctx.currentTime;
function env(g, t, a, p, d) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, p), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
function nsrc(t, dur, rate = 1) { const s = ctx.createBufferSource(); s.buffer = noise; s.playbackRate.value = rate; s.start(t, Math.random() * 1.5, dur + 0.05); return s; }
function tone(type, f0, f1, t, a, p, d, out = sfx) {
  const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t);
  if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + a + d);
  env(g, t, a, p, d); o.connect(g); g.connect(out); o.start(t); o.stop(t + a + d + 0.05);
}
function burst(type, f, q, t, a, p, d, out = sfx, rate = 1) {
  const s = nsrc(t, a + d, rate), fl = ctx.createBiquadFilter(), g = ctx.createGain();
  fl.type = type; fl.frequency.value = f; fl.Q.value = q; env(g, t, a, p, d); s.connect(fl); fl.connect(g); g.connect(out);
}

export const fx = {
  creak(k) { if (!ctx) return; const t = now(); burst('bandpass', 300 + k * 900, 6, t, 0.005, 0.05 + k * 0.05, 0.05); },
  twang(k = 1) {
    if (!ctx) return; const t = now();
    tone('triangle', 220, 70, t, 0.002, 0.35 * k, 0.18);
    tone('sawtooth', 140, 60, t, 0.002, 0.08 * k, 0.12);
    burst('highpass', 2500, 0.7, t, 0.001, 0.25 * k, 0.05);
    burst('bandpass', 900, 1, t + 0.02, 0.02, 0.15 * k, 0.25);
  },
  clang(i = 1, base) { // a hollow food tin
    if (!ctx) return; const t = now(); i = Math.min(1, Math.max(0.12, i));
    const f = base || (520 + Math.random() * 380);
    [[1, 0.5, 0.35], [2.32, 0.3, 0.25], [4.25, 0.18, 0.16], [6.63, 0.1, 0.1], [1.5, 0.12, 0.3]].forEach(([r, a, d]) => tone('sine', f * r, f * r * 0.995, t, 0.001, a * i * 0.5, d + i * 0.25));
    burst('bandpass', 3800, 2, t, 0.001, 0.4 * i, 0.03);
    tone('triangle', f * 0.5, f * 0.45, t, 0.001, 0.15 * i, 0.08);
  },
  tok(i = 0.6) { if (!ctx) return; const t = now(); burst('bandpass', 1400, 3, t, 0.001, 0.4 * i, 0.04); tone('sine', 300, 180, t, 0.001, 0.2 * i, 0.06); },
  thud(i = 0.7) { if (!ctx) return; const t = now(); tone('sine', 140, 55, t, 0.003, 0.5 * i, 0.16); burst('lowpass', 600, 0.8, t, 0.002, 0.3 * i, 0.12); },
  squish(i = 0.6) { if (!ctx) return; const t = now(); burst('bandpass', 700, 1.2, t, 0.004, 0.35 * i, 0.12, sfx, 0.6); tone('sine', 220, 90, t, 0.002, 0.25 * i, 0.1); },
  leaves(i = 0.6) {
    if (!ctx) return; const t = now(); const s = nsrc(t, 0.6), f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = 'highpass'; f.frequency.value = 3200; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.18 * i, t + 0.06); g.gain.linearRampToValueAtTime(0.0001, t + 0.55);
    s.connect(f); f.connect(g); g.connect(sfx);
  },
  smash() {
    if (!ctx) return; const t = now();
    burst('highpass', 2000, 0.5, t, 0.002, 0.7, 0.6);
    for (let k = 0; k < 14; k++) tone('sine', 2500 + Math.random() * 5000, 0, t + Math.random() * 0.5, 0.001, 0.08, 0.15 + Math.random() * 0.2);
    tone('sine', 180, 60, t, 0.002, 0.5, 0.25);
  },
  whiz() {
    if (!ctx) return; const t = now(); const s = nsrc(t, 0.5), f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = 'bandpass'; f.Q.value = 3; f.frequency.setValueAtTime(2400, t); f.frequency.exponentialRampToValueAtTime(700, t + 0.45);
    env(g, t, 0.03, 0.12, 0.4); s.connect(f); f.connect(g); g.connect(sfx);
  },
  pop(n = 0) { if (!ctx) return; const t = now(); const f = 660 * Math.pow(1.122, n); tone('triangle', f, f, t, 0.003, 0.18, 0.18); tone('sine', f * 2, f * 2, t, 0.003, 0.06, 0.12); },
  star(n) { if (!ctx) return; const t = now(); [784, 988, 1175, 1568].slice(0, 2 + n).forEach((f, k) => tone('triangle', f, f, t + k * 0.09, 0.004, 0.16, 0.3)); },
  win() { if (!ctx) return; const t = now(); [523, 659, 784, 1046, 1318].forEach((f, k) => { tone('triangle', f, f, t + k * 0.08, 0.004, 0.16, 0.35); tone('sine', f / 2, f / 2, t + k * 0.08, 0.004, 0.08, 0.3); }); },
  fail() { if (!ctx) return; const t = now(); [392, 370, 349, 262].forEach((f, k) => tone('triangle', f, f * 0.97, t + k * 0.16, 0.004, 0.15, 0.3)); },
  click() { if (!ctx) return; const t = now(); tone('square', 900, 600, t, 0.001, 0.07, 0.05); },
  bell() { if (!ctx) return; const t = now(); for (let k = 0; k < 6; k++) { [1, 2.76, 5.4].forEach((r, i) => tone('sine', 1180 * r, 0, t + k * 0.16, 0.001, 0.12 / (i + 1), 0.5)); } },
  cheer() { // the whole street: "UP NEPA!"
    if (!ctx) return; const t = now();
    for (let k = 0; k < 9; k++) voice(t + Math.random() * 0.25, 260 + Math.random() * 200, 380 + Math.random() * 120, 0.9, 0.05, [650 + Math.random() * 200, 1100 + Math.random() * 300]);
    burst('bandpass', 1200, 0.5, t, 0.1, 0.12, 0.9);
  },
  blackout() { if (!ctx) return; const t = now(); tone('sine', 220, 40, t, 0.003, 0.25, 0.35); burst('lowpass', 400, 1, t, 0.002, 0.2, 0.2); },
  laugh() { // agama 'kekeke'
    if (!ctx) return; const t = now(); for (let k = 0; k < 5; k++) tone('square', 1500 - k * 90, 1100, t + k * 0.075, 0.002, 0.045, 0.05);
  },
  power() { if (!ctx) return; const t = now(); [523, 784, 1046, 1568, 2093].forEach((f, k) => tone('sawtooth', f, f * 1.01, t + k * 0.05, 0.004, 0.06, 0.18)); },
  gold() { if (!ctx) return; const t = now(); [1318, 1568, 2093, 2637].forEach((f, k) => { tone('sine', f, f, t + k * 0.06, 0.002, 0.12, 0.4); }); },
  hmm() { // Baba stirs
    if (!ctx) return; const t = now(); voice(t, 130, 110, 0.5, 0.25, [500, 900]);
  },
  hey() { // Baba shouts
    if (!ctx) return; const t = now(); voice(t, 230, 160, 0.55, 0.4, [750, 1250]); voice(t + 0.6, 260, 170, 0.5, 0.35, [700, 1150]);
  },
};
function voice(t, f0, f1, dur, p, formants) {
  const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sawtooth';
  o.frequency.setValueAtTime(f0, t); o.frequency.linearRampToValueAtTime(f0 * 1.1, t + dur * 0.25); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const mix = ctx.createGain(); mix.gain.value = 1;
  for (const f of formants) { const b = ctx.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = f; b.Q.value = 6; o.connect(b); b.connect(mix); }
  mix.connect(g); g.connect(sfx);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(p, t + 0.04); g.gain.setValueAtTime(p, t + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.start(t); o.stop(t + dur + 0.05);
}

// Baba's snore: breathing noise whose loudness follows how deeply he sleeps
export function setSnore(level) {
  if (!ctx) return;
  if (!snore) {
    const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true; s.playbackRate.value = 0.35;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 260; f.Q.value = 2.5;
    const g = ctx.createGain(); g.gain.value = 0;
    s.connect(f); f.connect(g); g.connect(sfx); s.start();
    snore = { g, f };
  }
  const t = now(), cyc = (t % 3.2) / 3.2;
  const breath = cyc < 0.45 ? Math.sin(cyc / 0.45 * Math.PI) : cyc < 0.55 ? 0 : Math.sin((cyc - 0.55) / 0.45 * Math.PI) * 0.6;
  snore.g.gain.setTargetAtTime(level * breath * 0.12, t, 0.08);
  snore.f.frequency.setTargetAtTime(cyc < 0.45 ? 220 : 380, t, 0.1);
}

// Baba's generator: a chugging hum that covers your noise
let gen = null;
export function setGen(on) {
  if (!ctx) return;
  if (on && !gen) {
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.value = 48; o2.type = 'square'; o2.frequency.value = 96.5;
    f.type = 'lowpass'; f.frequency.value = 420; f.Q.value = 3;
    lfo.frequency.value = 11; lg.gain.value = 0.05; lfo.connect(lg); lg.connect(g.gain);
    g.gain.value = 0; o.connect(f); o2.connect(f); f.connect(g); g.connect(sfx);
    const n = ctx.createBufferSource(); n.buffer = noise; n.loop = true; const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 900; const ng = ctx.createGain(); ng.gain.value = 0.03; n.connect(nf); nf.connect(ng); ng.connect(g);
    o.start(); o2.start(); lfo.start(); n.start();
    g.gain.setTargetAtTime(0.11, now(), 0.4);
    gen = { stop() { const t = now(); g.gain.setTargetAtTime(0, t, 0.15); [o, o2, lfo, n].forEach(x => x.stop(t + 0.8)); } };
  } else if (!on && gen) { gen.stop(); gen = null; }
}

// ambience: birds by day, crickets by night
let ambEnv = 'day';
export function setEnv(e) { ambEnv = e; }
export function frame(dt) {
  if (!ctx) return;
  birdsT -= dt;
  if (birdsT < 0) {
    const t = now();
    if (ambEnv === 'night') {
      birdsT = 0.35 + Math.random() * 0.6;
      const f = 4200 + Math.random() * 600; for (let k = 0; k < 3; k++) tone('sine', f, f, t + k * 0.045, 0.002, 0.018, 0.025);
    } else {
      birdsT = 1.5 + Math.random() * 4;
      const n = 2 + Math.floor(Math.random() * 3), f = 2800 + Math.random() * 1800;
      for (let k = 0; k < n; k++) tone('sine', f, f * (Math.random() < 0.5 ? 1.3 : 0.75), t + k * 0.11, 0.005, 0.025, 0.07);
    }
  }
}

// music: sneaky pizzicato bass + shekere + bell; gets faster and tighter with tension (0..1); alarm = talking drum roll
const BASS = [[0, 0], [3, 3], [6, 5], [8, 7], [11, 5], [14, 3]];
const SCALE = [0, 2, 3, 5, 7, 8, 10, 12];
function schedule() {
  if (!musicOn) return;
  while (nextStep < now() + 0.15) {
    const bpm = alarm ? 150 : 96 + tension * 40, spb = 60 / bpm / 4;
    const t = nextStep, s = step % 16, bar = Math.floor(step / 16) % 4;
    burst('highpass', 7000, 0.8, t, 0.002, (s % 4 === 2 ? 0.12 : s % 2 === 0 ? 0.05 : 0.025) * (0.6 + tension), 0.04, mus);
    const root = [110, 110, 98, 123.5][bar];
    for (const [st, deg] of BASS) if (st === s) tone('triangle', root * Math.pow(2, SCALE[deg % 8] / 12), 0, t, 0.004, 0.32, 0.12, mus);
    if (s === 4 || s === 12) tone('sine', 1320, 1320, t, 0.001, 0.05, 0.12, mus);
    if (tension > 0.45 && (s === 0 || s === 8)) tone('sine', 110, 45, t, 0.002, 0.35 * tension, 0.18, mus);
    if (tension > 0.7 && s % 4 === 3) tone('sine', 880 * Math.pow(2, SCALE[(step * 3) % 7] / 12), 0, t, 0.002, 0.05, 0.08, mus);
    if (alarm) { tone('sine', s % 2 ? 190 : 140, s % 2 ? 120 : 160, t, 0.003, 0.3, 0.1, mus); if (s % 4 === 0) tone('sine', 100, 40, t, 0.002, 0.5, 0.2, mus); }
    nextStep += spb; step++;
  }
}
export function music(on) {
  if (!ctx) return;
  if (on && !musicOn) { musicOn = true; nextStep = now() + 0.05; timer = setInterval(schedule, 30); }
  if (!on && musicOn) { musicOn = false; clearInterval(timer); }
}
export function setTension(v, isAlarm) { tension = Math.max(0, Math.min(1, v)); alarm = !!isAlarm; }
export function setMuted(m) { muted = m; try { localStorage.setItem('mr:muted', m ? '1' : '0'); } catch (e) {} if (master) master.gain.setTargetAtTime(m ? 0 : 0.9, now(), 0.03); }
export const isMuted = () => muted;
