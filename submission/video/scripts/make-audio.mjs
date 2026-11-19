// Synthesizes the intro and outro soundtracks from scratch (oscillators, filtered noise, delay and a
// small Schroeder reverb), timed from src/timeline.ts. No samples and no third-party music, as the
// challenge rules require. Output: public/intro.wav and public/outro.wav (44.1 kHz, 16-bit stereo).

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FPS, INTRO, OUTRO, buildOrder, landFrame, checkFrame, WORD } from "../src/timeline.ts";

const SR = 44100;
const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(here, "../public");

const note = (name) => {
  const m = name.match(/^([A-G])(#?)(\d)$/);
  const semis = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 }[m[1]] + (m[2] ? 1 : 0) + (Number(m[3]) - 4) * 12;
  return 440 * 2 ** (semis / 12);
};
const sec = (frame) => frame / FPS;

class Mix {
  constructor(seconds) {
    this.n = Math.ceil(seconds * SR);
    this.L = new Float32Array(this.n);
    this.R = new Float32Array(this.n);
    this.sendL = new Float32Array(this.n); // reverb / delay send
    this.sendR = new Float32Array(this.n);
    this.seed = 1234567;
  }
  rand() {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }
  put(i, v, pan, send) {
    if (i < 0 || i >= this.n) return;
    const l = Math.cos((pan + 1) * Math.PI / 4), r = Math.sin((pan + 1) * Math.PI / 4);
    this.L[i] += v * l; this.R[i] += v * r;
    if (send) { this.sendL[i] += v * l * send; this.sendR[i] += v * r * send; }
  }
  /** An oscillator with an ADSR-ish envelope, a frequency function and a one-pole low-pass. */
  tone(t0, dur, { freq, type = "sine", amp = 0.2, pan = 0, attack = 0.005, release = 0.08, send = 0.25, cutoff = 6000, vibrato = 0 }) {
    const start = Math.floor(t0 * SR), len = Math.floor((dur + release) * SR);
    let phase = 0, lp = 0;
    const a = 1 - Math.exp(-2 * Math.PI * cutoff / SR);
    for (let k = 0; k < len; k += 1) {
      const t = k / SR;
      const f = (typeof freq === "function" ? freq(t / dur) : freq) * (1 + vibrato * Math.sin(2 * Math.PI * 5.5 * t));
      phase += f / SR;
      const p = phase % 1;
      let s;
      if (type === "square") s = p < 0.5 ? 1 : -1;
      else if (type === "triangle") s = 4 * Math.abs(p - 0.5) - 1;
      else if (type === "saw") s = 2 * p - 1;
      else s = Math.sin(2 * Math.PI * p);
      lp += a * (s - lp);
      let env = t < attack ? t / attack : 1;
      if (t > dur) env *= Math.max(0, 1 - (t - dur) / release);
      this.put(start + k, lp * env * amp, pan, send);
    }
  }
  /** Filtered noise with a cutoff sweep: whooshes, clicks and air. */
  noise(t0, dur, { amp = 0.2, pan = 0, from = 200, to = 4000, attack = 0.2, send = 0.4, curve = 1 }) {
    const start = Math.floor(t0 * SR), len = Math.floor(dur * SR);
    let lp1 = 0, lp2 = 0;
    for (let k = 0; k < len; k += 1) {
      const x = k / len;
      const cutoff = from + (to - from) * x ** curve;
      const a = 1 - Math.exp(-2 * Math.PI * cutoff / SR);
      const w = this.rand() * 2 - 1;
      lp1 += a * (w - lp1); lp2 += a * (lp1 - lp2);
      const env = Math.min(1, x / Math.max(0.0001, attack)) * (1 - x) ** 1.6;
      this.put(start + k, lp2 * env * amp * 2.2, pan, send);
    }
  }
  /** A low thump: a sine dropping in pitch. */
  thump(t0, { amp = 0.5, from = 120, to = 45, dur = 0.35 }) {
    this.tone(t0, dur, { freq: (x) => from * (to / from) ** x, amp, release: 0.12, send: 0.1, cutoff: 900 });
  }
  /** Stereo feedback delay and a small Schroeder reverb on the send bus, then soft clip and normalize. */
  finish() {
    const combs = [1557, 1617, 1491, 1422].map((d) => ({ d, bufL: new Float32Array(d), bufR: new Float32Array(d + 23), i: 0, j: 0 }));
    const aps = [225, 556].map((d) => ({ d, bufL: new Float32Array(d), bufR: new Float32Array(d), i: 0 }));
    const delay = Math.floor(0.19 * SR), dl = new Float32Array(delay), dr = new Float32Array(delay);
    let di = 0;
    for (let k = 0; k < this.n; k += 1) {
      const inL = this.sendL[k], inR = this.sendR[k];
      // ping-pong delay
      const outL = dl[di], outR = dr[di];
      dl[di] = inL + outR * 0.38; dr[di] = inR + outL * 0.38; di = (di + 1) % delay;
      let rl = 0, rr = 0;
      for (const c of combs) {
        const yl = c.bufL[c.i], yr = c.bufR[c.j];
        c.bufL[c.i] = inL + yl * 0.82; c.bufR[c.j] = inR + yr * 0.82;
        c.i = (c.i + 1) % c.bufL.length; c.j = (c.j + 1) % c.bufR.length;
        rl += yl; rr += yr;
      }
      for (const ap of aps) {
        const bl = ap.bufL[ap.i], br = ap.bufR[ap.i];
        const ol = -rl + bl, or = -rr + br;
        ap.bufL[ap.i] = rl + bl * 0.5; ap.bufR[ap.i] = rr + br * 0.5;
        ap.i = (ap.i + 1) % ap.d; rl = ol; rr = or;
      }
      this.L[k] += outL * 0.45 + rl * 0.08;
      this.R[k] += outR * 0.45 + rr * 0.08;
    }
    let peak = 0;
    for (let k = 0; k < this.n; k += 1) {
      this.L[k] = Math.tanh(this.L[k] * 1.2); this.R[k] = Math.tanh(this.R[k] * 1.2);
      peak = Math.max(peak, Math.abs(this.L[k]), Math.abs(this.R[k]));
    }
    const gain = 0.89 / (peak || 1);
    // Short fades at the edges so the clip never clicks.
    const edge = Math.floor(0.02 * SR);
    for (let k = 0; k < this.n; k += 1) {
      const e = Math.min(1, k / edge, (this.n - 1 - k) / edge);
      this.L[k] *= gain * e; this.R[k] *= gain * e;
    }
  }
  wav() {
    const data = Buffer.alloc(this.n * 4);
    for (let k = 0; k < this.n; k += 1) {
      data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, this.L[k])) * 32767), k * 4);
      data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, this.R[k])) * 32767), k * 4 + 2);
    }
    const h = Buffer.alloc(44);
    h.write("RIFF", 0); h.writeUInt32LE(36 + data.length, 4); h.write("WAVE", 8); h.write("fmt ", 12);
    h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22); h.writeUInt32LE(SR, 24);
    h.writeUInt32LE(SR * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(data.length, 40);
    return Buffer.concat([h, data]);
  }
}

/** A slow drone: sub sine plus a soft detuned triangle pad, with a swell envelope. */
function drone(m, t0, dur, notes, { amp = 0.12, swell = 0.5 } = {}) {
  for (const [i, n] of notes.entries()) {
    for (const det of [-0.004, 0.004]) {
      m.tone(t0, dur, {
        freq: note(n) * (1 + det), type: i === 0 ? "sine" : "triangle", amp: amp / (i + 1), pan: det > 0 ? 0.35 : -0.35,
        attack: dur * swell, release: 1.2, send: 0.35, cutoff: 1200,
      });
    }
  }
}

function chime(m, t0, notes, { amp = 0.14, step = 0.045, len = 0.9 } = {}) {
  notes.forEach((n, i) => {
    const pan = (i / Math.max(1, notes.length - 1)) * 1.2 - 0.6;
    m.tone(t0 + i * step, len, { freq: note(n), type: "square", amp: amp * 0.55, pan, release: 0.9, send: 0.6, cutoff: 2800 });
    m.tone(t0 + i * step, len, { freq: note(n) * 2, type: "triangle", amp: amp * 0.35, pan: -pan, release: 1.1, send: 0.7, cutoff: 6000 });
  });
}

function intro() {
  const total = INTRO.frames / FPS + 0.6;
  const m = new Mix(total);
  // Deep sub drone in E minor, swelling as the cube assembles.
  drone(m, 0, sec(INTRO.keyLock), ["E1", "E2", "B2"], { amp: 0.34, swell: 0.75 });
  // The rush into the void.
  m.noise(0, 2.1, { amp: 0.42, from: 120, to: 5200, attack: 0.55, curve: 1.6, send: 0.5 });
  m.noise(0.25, 1.6, { amp: 0.18, pan: 0.5, from: 300, to: 7000, attack: 0.6, curve: 2, send: 0.6 });
  // Each voxel locking into place: a soft 8-bit tick climbing the pentatonic, with a little weight.
  const scale = ["E4", "G4", "A4", "B4", "D5", "E5", "G5", "A5", "B5"];
  buildOrder().forEach(([x, y, z], i) => {
    const t = sec(landFrame(i));
    const n = scale[Math.min(scale.length - 1, Math.floor((i / 26) * scale.length))];
    m.tone(t, 0.035, { freq: note(n), type: "square", amp: 0.07 + y * 0.01, pan: (x - z) * 0.3, release: 0.05, send: 0.22, cutoff: 3200 });
    m.thump(t, { amp: 0.16, from: 160, to: 70, dur: 0.07 });
  });
  // The keystone descends: a rising, shimmering glide.
  const a = sec(INTRO.keyAppear), l = sec(INTRO.keyLock);
  m.tone(a, l - a, { freq: (x) => 220 * 4 ** x, type: "triangle", amp: 0.09, attack: 0.3, release: 0.05, send: 0.5, cutoff: 2600, vibrato: 0.01 });
  m.noise(a, l - a + 0.05, { amp: 0.12, from: 800, to: 9000, attack: 0.9, curve: 2.5, send: 0.6 });
  // Lock: impact, click, and the drone resolving from E minor to E major.
  m.thump(l, { amp: 0.75, from: 140, to: 38, dur: 0.6 });
  m.noise(l, 0.08, { amp: 0.5, from: 6000, to: 1500, attack: 0.01, send: 0.2 });
  chime(m, l + 0.02, ["E4", "G#4", "B4", "E5", "F#5", "B5"], { amp: 0.17, step: 0.05, len: 1.2 });
  drone(m, l, total - l, ["E2", "B2", "G#3"], { amp: 0.16, swell: 0.08 });
  // Wordmark letters.
  [...WORD].forEach((_, i) => {
    const t = sec(INTRO.wordStart + i * INTRO.letterStep);
    m.tone(t, 0.03, { freq: note(["B5", "E6", "G#5", "B5", "E6", "F#6", "B6"][i] ?? "E6"), type: "square", amp: 0.045, pan: i / 3 - 1, release: 0.04, send: 0.3, cutoff: 5000 });
  });
  // Tagline: an airy swell into the tail.
  m.noise(sec(INTRO.taglineStart), 1.3, { amp: 0.07, from: 2000, to: 9000, attack: 0.5, send: 0.8 });
  return m;
}

function outro() {
  const total = OUTRO.frames / FPS + 0.8;
  const m = new Mix(total);
  drone(m, 0, total - 1, ["E2", "B2", "E3"], { amp: 0.2, swell: 0.25 });
  m.noise(0, 1.0, { amp: 0.16, from: 400, to: 3000, attack: 0.4, send: 0.6 });
  // C1..C9: nine checks climbing the E major scale, each with a little confirming fifth.
  const scale = ["E4", "F#4", "G#4", "A4", "B4", "C#5", "D#5", "E5", "F#5"];
  scale.forEach((n, i) => {
    const t = sec(checkFrame(i));
    m.tone(t, 0.05, { freq: note(n), type: "square", amp: 0.09, pan: ((i % 3) - 1) * 0.5, release: 0.08, send: 0.35, cutoff: 3600 });
    m.tone(t + 0.06, 0.07, { freq: note(n) * 1.5, type: "triangle", amp: 0.06, pan: ((i % 3) - 1) * -0.4, release: 0.15, send: 0.5, cutoff: 6000 });
  });
  // The keystone's nod: lift, then lock with the full resolution.
  const h = sec(OUTRO.hopStart), k = sec(OUTRO.hopLock);
  m.noise(h, k - h + 0.05, { amp: 0.14, from: 600, to: 8000, attack: 0.8, curve: 2, send: 0.6 });
  m.thump(k, { amp: 0.7, from: 150, to: 40, dur: 0.55 });
  chime(m, k + 0.02, ["E4", "B4", "E5", "G#5", "B5", "E6"], { amp: 0.18, step: 0.06, len: 1.6 });
  drone(m, k, total - k, ["E1", "E2", "B2", "G#3"], { amp: 0.22, swell: 0.1 });
  // Lockup sparkle, and a gentle final breath.
  m.noise(sec(OUTRO.lockupStart), 1.2, { amp: 0.06, from: 3000, to: 10000, attack: 0.4, send: 0.9 });
  return m;
}

await mkdir(OUT, { recursive: true });
for (const [name, build] of [["intro", intro], ["outro", outro]]) {
  const mix = build();
  mix.finish();
  await writeFile(path.join(OUT, `${name}.wav`), mix.wav());
  console.log(`public/${name}.wav  ${(mix.n / SR).toFixed(2)} s`);
}
