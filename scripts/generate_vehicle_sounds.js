const fs = require('fs');
const path = require('path');

const sampleRate = 44100;
const soundDuration = 2.0;
const outDir = path.join(__dirname, '..', 'assets', 'sounds');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function makeBuffer(seconds = soundDuration) {
  return new Float32Array(Math.ceil(seconds * sampleRate));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function smoothstep(value) {
  const x = clamp(value, 0, 1);
  return x * x * (3 - 2 * x);
}

function envelope(t, duration, attack = 0.02, release = 0.14) {
  if (t < 0 || t > duration) return 0;
  const rise = attack > 0 ? smoothstep(t / attack) : 1;
  const fall = release > 0 ? smoothstep((duration - t) / release) : 1;
  return Math.min(rise, fall, 1);
}

function expLerp(a, b, p) {
  return a * Math.pow(b / a, clamp(p, 0, 1));
}

function seedFromName(name) {
  let seed = 2166136261;
  for (let i = 0; i < name.length; i++) {
    seed ^= name.charCodeAt(i);
    seed = Math.imul(seed, 16777619);
  }
  return seed >>> 0;
}

function randomFactory(name) {
  let state = seedFromName(name) || 1;
  return function random() {
    state |= 0;
    state = (state + 0x6D2B79F5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function waveValue(type, phase, pulseWidth = 0.5) {
  const wrapped = phase / (Math.PI * 2);
  const unit = wrapped - Math.floor(wrapped);
  if (type === 'square') return Math.sin(phase) >= 0 ? 1 : -1;
  if (type === 'pulse') return unit < pulseWidth ? 1 : -1;
  if (type === 'saw') return 2 * (unit - 0.5);
  if (type === 'triangle') return 2 * Math.asin(Math.sin(phase)) / Math.PI;
  return Math.sin(phase);
}

function addOsc(data, options) {
  const {
    start,
    duration,
    type = 'sine',
    freq = 440,
    amp = 0.25,
    attack = 0.02,
    release = 0.14,
    pulseWidth = 0.5,
    drive = 0,
    phaseOffset = 0
  } = options;

  const startIndex = Math.max(0, Math.floor(start * sampleRate));
  const endIndex = Math.min(data.length, Math.floor((start + duration) * sampleRate));
  let phase = phaseOffset;

  for (let i = startIndex; i < endIndex; i++) {
    const t = (i - startIndex) / sampleRate;
    const p = duration > 0 ? t / duration : 1;
    const f = typeof freq === 'function' ? freq(p, t) : freq;
    const a = typeof amp === 'function' ? amp(p, t) : amp;
    phase += Math.PI * 2 * Math.max(1, f) / sampleRate;
    let sample = waveValue(type, phase, pulseWidth);
    if (drive > 0) sample = Math.tanh(sample * (1 + drive));
    data[i] += sample * a * envelope(t, duration, attack, release);
  }
}

function addSweep(data, start, duration, f0, f1, amp, type = 'sine', options = {}) {
  const curve = options.curve || 'linear';
  addOsc(data, {
    start,
    duration,
    type,
    amp,
    attack: options.attack ?? 0.02,
    release: options.release ?? 0.14,
    pulseWidth: options.pulseWidth ?? 0.5,
    drive: options.drive ?? 0,
    freq: (p) => {
      const shaped = curve === 'ease' ? smoothstep(p) : p;
      return expLerp(f0, f1, shaped);
    }
  });
}

function addNoise(data, options) {
  const {
    start,
    duration,
    amp = 0.2,
    seed = 'noise',
    mode = 'lowpass',
    cutoff = 0.05,
    attack = 0.01,
    release = 0.12,
    rattle = 0,
    ampMod = null
  } = options;

  const random = randomFactory(seed);
  const startIndex = Math.max(0, Math.floor(start * sampleRate));
  const endIndex = Math.min(data.length, Math.floor((start + duration) * sampleRate));
  let low = 0;
  let low2 = 0;

  for (let i = startIndex; i < endIndex; i++) {
    const t = (i - startIndex) / sampleRate;
    const p = duration > 0 ? t / duration : 1;
    const mod = ampMod ? ampMod(p, t) : 1;
    const raw = random() * 2 - 1;
    const c = clamp(typeof cutoff === 'function' ? cutoff(p, t) : cutoff, 0.001, 0.5);
    low += (raw - low) * c;
    low2 += (low - low2) * c;
    let sample = raw;
    if (mode === 'lowpass') sample = low2;
    if (mode === 'highpass') sample = raw - low;
    if (mode === 'bandpass') sample = low - low2;
    if (rattle > 0) sample *= 0.62 + 0.38 * Math.sin(Math.PI * 2 * rattle * t);
    data[i] += sample * amp * mod * envelope(t, duration, attack, release);
  }
}

function addEngineBurst(data, start, duration, lowFreq, highFreq, amp, brightness = 1, seed = 'engine') {
  const revFreq = (p) => {
    if (p < 0.46) return expLerp(lowFreq, highFreq, smoothstep(p / 0.46));
    return expLerp(highFreq, lowFreq * 0.78, smoothstep((p - 0.46) / 0.54));
  };
  const pulse = (p, t) => amp * (0.78 + 0.22 * Math.sin(Math.PI * 2 * (11 + brightness * 5) * t));

  addOsc(data, {
    start,
    duration,
    type: 'saw',
    freq: revFreq,
    amp: pulse,
    attack: 0.035,
    release: 0.18,
    drive: 0.12 * brightness
  });
  addOsc(data, {
    start,
    duration,
    type: 'triangle',
    freq: (p) => revFreq(p) * 0.48,
    amp: amp * 0.46,
    attack: 0.035,
    release: 0.2
  });
  addOsc(data, {
    start: start + duration * 0.04,
    duration: duration * 0.86,
    type: 'sine',
    freq: (p) => revFreq(p) * 1.5,
    amp: amp * 0.16 * brightness,
    attack: 0.02,
    release: 0.18
  });
  addNoise(data, {
    start: start + duration * 0.08,
    duration: duration * 0.68,
    amp: amp * 0.18 * brightness,
    seed,
    mode: 'highpass',
    cutoff: 0.025,
    attack: 0.012,
    release: 0.16
  });
}

function addDiesel(data, start, duration, baseFreq, amp, seed, thumpRate = 13) {
  const mod = (p, t) => amp * (0.68 + 0.22 * Math.sin(Math.PI * 2 * thumpRate * t) + 0.1 * Math.sin(Math.PI * 2 * 3.1 * t));
  addOsc(data, {
    start,
    duration,
    type: 'square',
    freq: (p, t) => baseFreq * (1 + 0.035 * Math.sin(Math.PI * 2 * 4.5 * t)),
    amp: mod,
    attack: 0.05,
    release: 0.22,
    drive: 0.2
  });
  addOsc(data, {
    start,
    duration,
    type: 'saw',
    freq: (p, t) => baseFreq * 1.9 * (1 + 0.025 * Math.sin(Math.PI * 2 * 6.2 * t)),
    amp: amp * 0.24,
    attack: 0.05,
    release: 0.2,
    drive: 0.1
  });
  addNoise(data, {
    start,
    duration,
    amp: amp * 0.58,
    seed,
    mode: 'lowpass',
    cutoff: 0.016,
    attack: 0.04,
    release: 0.28,
    rattle: thumpRate * 1.8
  });
}

function addBeep(data, start, freq, duration, amp, seed, type = 'sine') {
  addOsc(data, {
    start,
    duration,
    type,
    freq,
    amp,
    attack: 0.006,
    release: 0.045,
    pulseWidth: 0.28
  });
  addOsc(data, {
    start,
    duration,
    type: 'triangle',
    freq: freq * 1.5,
    amp: amp * 0.22,
    attack: 0.006,
    release: 0.04
  });
  addNoise(data, {
    start,
    duration: Math.min(duration, 0.09),
    amp: amp * 0.05,
    seed,
    mode: 'highpass',
    cutoff: 0.05,
    attack: 0.003,
    release: 0.04
  });
}

function addHorn(data, start, duration, freq, amp, seed, beating = false) {
  const wobble = (p, t) => freq * (1 + 0.014 * Math.sin(Math.PI * 2 * 5.2 * t));
  addOsc(data, {
    start,
    duration,
    type: 'saw',
    freq: wobble,
    amp,
    attack: 0.035,
    release: 0.2,
    drive: 0.16
  });
  addOsc(data, {
    start,
    duration,
    type: 'triangle',
    freq: (p, t) => freq * 1.48 * (1 + 0.01 * Math.sin(Math.PI * 2 * 4.3 * t)),
    amp: amp * 0.48,
    attack: 0.035,
    release: 0.2
  });
  if (beating) {
    addOsc(data, {
      start,
      duration,
      type: 'sine',
      freq: freq * 1.055,
      amp: amp * 0.55,
      attack: 0.035,
      release: 0.2
    });
  }
  addNoise(data, {
    start,
    duration,
    amp: amp * 0.08,
    seed,
    mode: 'bandpass',
    cutoff: 0.036,
    attack: 0.02,
    release: 0.18
  });
}

function addAirBrake(data, start, duration, amp, seed) {
  addNoise(data, {
    start,
    duration,
    amp,
    seed,
    mode: 'highpass',
    cutoff: (p) => 0.16 - 0.11 * smoothstep(p),
    attack: 0.008,
    release: 0.28
  });
  addNoise(data, {
    start: start + 0.04,
    duration: duration * 0.7,
    amp: amp * 0.28,
    seed: `${seed}-body`,
    mode: 'bandpass',
    cutoff: 0.05,
    attack: 0.01,
    release: 0.22
  });
}

function addMetalClank(data, start, amp, seed) {
  addSweep(data, start, 0.1, 2100, 580, amp, 'triangle', { attack: 0.002, release: 0.085, curve: 'ease' });
  addSweep(data, start + 0.018, 0.075, 3200, 920, amp * 0.46, 'pulse', { attack: 0.002, release: 0.055, pulseWidth: 0.18, drive: 0.28 });
  addOsc(data, {
    start: start + 0.055,
    duration: 0.13,
    type: 'sine',
    freq: 760,
    amp: amp * 0.15,
    attack: 0.002,
    release: 0.12
  });
  addNoise(data, {
    start,
    duration: 0.18,
    amp: amp * 0.48,
    seed,
    mode: 'highpass',
    cutoff: 0.055,
    attack: 0.002,
    release: 0.13
  });
}

function addSubRumble(data, start, duration, freq, amp, rate = 4, drive = 0.3) {
  addOsc(data, {
    start,
    duration,
    type: 'sine',
    freq,
    amp: (p, t) => amp * (0.58 + 0.42 * Math.pow(0.5 + 0.5 * Math.sin(Math.PI * 2 * rate * t), 1.5)),
    attack: 0.06,
    release: 0.3,
    drive
  });
  addOsc(data, {
    start,
    duration,
    type: 'triangle',
    freq: freq * 2,
    amp: amp * 0.32,
    attack: 0.06,
    release: 0.28
  });
}

function addThump(data, start, amp, seed) {
  addSweep(data, start, 0.16, 86, 34, amp, 'sine', { attack: 0.004, release: 0.15, drive: 0.4 });
  addNoise(data, {
    start,
    duration: 0.12,
    amp: amp * 0.2,
    seed,
    mode: 'lowpass',
    cutoff: 0.018,
    attack: 0.003,
    release: 0.1
  });
}

function addWubRumble(data, start, duration, amp, seed) {
  addOsc(data, {
    start,
    duration,
    type: 'saw',
    freq: (p, t) => 74 + 8 * Math.sin(Math.PI * 2 * 2.6 * t),
    amp: (p, t) => amp * (0.45 + 0.55 * Math.pow(0.5 + 0.5 * Math.sin(Math.PI * 2 * 3.1 * t), 1.7)),
    attack: 0.05,
    release: 0.24,
    drive: 0.18
  });
  addNoise(data, {
    start,
    duration,
    amp: amp * 0.42,
    seed,
    mode: 'lowpass',
    cutoff: (p, t) => 0.012 + 0.085 * Math.pow(0.5 + 0.5 * Math.sin(Math.PI * 2 * 3.1 * t), 2),
    attack: 0.05,
    release: 0.24,
    rattle: 8
  });
}

function addHydraulicWhine(data, start, duration, amp, seed) {
  addSweep(data, start, duration * 0.58, 420, 1320, amp, 'sine', { attack: 0.04, release: 0.08, curve: 'ease' });
  addSweep(data, start + duration * 0.44, duration * 0.52, 1180, 480, amp * 0.72, 'triangle', { attack: 0.03, release: 0.16, curve: 'ease' });
  addNoise(data, {
    start: start + duration * 0.12,
    duration: duration * 0.72,
    amp: amp * 0.15,
    seed,
    mode: 'highpass',
    cutoff: 0.028,
    attack: 0.02,
    release: 0.14
  });
}

function addTireWhoosh(data, start, duration, amp, seed) {
  addNoise(data, {
    start,
    duration,
    amp,
    seed,
    mode: 'bandpass',
    cutoff: 0.025,
    attack: 0.05,
    release: 0.2,
    ampMod: (p) => 0.55 + 0.45 * smoothstep(p)
  });
}

function normalize(data) {
  let peak = 0;
  let rms = 0;
  for (const sample of data) {
    peak = Math.max(peak, Math.abs(sample));
    rms += sample * sample;
  }
  rms = Math.sqrt(rms / data.length);
  const peakGain = peak > 0 ? 0.9 / peak : 1;
  const rmsGain = rms > 0 ? 0.23 / rms : 1;
  const gain = Math.min(peakGain, rmsGain, 1.8);
  for (let i = 0; i < data.length; i++) {
    data[i] = Math.tanh(data[i] * gain * 1.08) * 0.92;
  }
}

function writeWav(file, data) {
  normalize(data);
  const bytes = Buffer.alloc(44 + data.length * 2);
  bytes.write('RIFF', 0);
  bytes.writeUInt32LE(36 + data.length * 2, 4);
  bytes.write('WAVE', 8);
  bytes.write('fmt ', 12);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(sampleRate, 24);
  bytes.writeUInt32LE(sampleRate * 2, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36);
  bytes.writeUInt32LE(data.length * 2, 40);
  for (let i = 0; i < data.length; i++) {
    const sample = clamp(data[i], -1, 1);
    bytes.writeInt16LE(Math.round(sample * 32767), 44 + i * 2);
  }
  fs.writeFileSync(file, bytes);
}

const recipes = {
  'red-sedan': () => {
    const data = makeBuffer();
    addEngineBurst(data, 0.06, 0.76, 210, 720, 0.27, 1.0, 'red-sedan-vroom-a');
    addEngineBurst(data, 0.94, 0.78, 235, 790, 0.29, 1.08, 'red-sedan-vroom-b');
    addTireWhoosh(data, 0.18, 1.5, 0.045, 'red-sedan-whoosh');
    return data;
  },
  'purple-hatchback': () => {
    const data = makeBuffer();
    addEngineBurst(data, 0.04, 0.68, 260, 880, 0.25, 1.28, 'hatchback-vroom-a');
    addEngineBurst(data, 0.86, 0.74, 300, 980, 0.27, 1.35, 'hatchback-vroom-b');
    addOsc(data, { start: 0.2, duration: 1.3, type: 'sine', freq: 980, amp: 0.025, attack: 0.04, release: 0.22 });
    addTireWhoosh(data, 0.16, 1.42, 0.052, 'hatchback-whoosh');
    return data;
  },
  'yellow-taxi': () => {
    const data = makeBuffer();
    addEngineBurst(data, 0.05, 0.58, 205, 560, 0.19, 0.9, 'taxi-engine-a');
    addEngineBurst(data, 1.05, 0.58, 220, 600, 0.17, 0.92, 'taxi-engine-b');
    addBeep(data, 0.34, 1120, 0.12, 0.36, 'taxi-beep-a', 'sine');
    addBeep(data, 0.58, 1280, 0.11, 0.34, 'taxi-beep-b', 'sine');
    addBeep(data, 1.34, 1120, 0.1, 0.28, 'taxi-beep-c', 'sine');
    addBeep(data, 1.55, 1280, 0.095, 0.25, 'taxi-beep-d', 'sine');
    addTireWhoosh(data, 0.18, 1.55, 0.04, 'taxi-whoosh');
    return data;
  },
  'blue-bus': () => {
    const data = makeBuffer();
    addDiesel(data, 0.02, 1.84, 58, 0.31, 'bus-diesel', 11);
    addHorn(data, 0.28, 0.44, 118, 0.31, 'bus-horn-a', true);
    addHorn(data, 0.86, 0.5, 106, 0.29, 'bus-horn-b', true);
    addAirBrake(data, 1.48, 0.38, 0.28, 'bus-air-brake');
    return data;
  },
  'orange-van': () => {
    const data = makeBuffer();
    addEngineBurst(data, 0.12, 0.72, 150, 360, 0.28, 0.68, 'van-brum-a');
    addEngineBurst(data, 0.98, 0.7, 160, 390, 0.26, 0.66, 'van-brum-b');
    addOsc(data, { start: 0.04, duration: 1.8, type: 'sine', freq: 92, amp: 0.11, attack: 0.08, release: 0.3 });
    addNoise(data, { start: 0.1, duration: 1.65, amp: 0.08, seed: 'van-cabin', mode: 'lowpass', cutoff: 0.02, attack: 0.06, release: 0.24, rattle: 7 });
    return data;
  },
  'tow-truck': () => {
    const data = makeBuffer();
    addDiesel(data, 0.02, 1.72, 76, 0.24, 'tow-diesel', 12);
    [0.16, 0.46, 0.76, 1.06].forEach((time, index) => {
      addBeep(data, time, 740, 0.13, 0.24 - index * 0.015, `tow-warning-${index}`, 'pulse');
    });
    addMetalClank(data, 1.28, 0.32, 'tow-clank-a');
    addMetalClank(data, 1.48, 0.25, 'tow-clank-b');
    addNoise(data, { start: 1.2, duration: 0.48, amp: 0.12, seed: 'tow-chain-rattle', mode: 'highpass', cutoff: 0.04, attack: 0.02, release: 0.18, rattle: 28 });
    return data;
  },
  'dump-truck': () => {
    const data = makeBuffer();
    addSubRumble(data, 0.02, 1.86, 38, 0.32, 4.4, 0.55);
    addDiesel(data, 0.02, 1.78, 48, 0.34, 'dump-diesel', 9);
    addHorn(data, 0.5, 0.36, 92, 0.31, 'dump-honk-a', true);
    addHorn(data, 1.02, 0.42, 86, 0.29, 'dump-honk-b', true);
    addNoise(data, { start: 0.2, duration: 1.45, amp: 0.14, seed: 'dump-gravel-bed', mode: 'lowpass', cutoff: 0.018, attack: 0.04, release: 0.26, rattle: 18 });
    return data;
  },
  'cement-mixer': () => {
    const data = makeBuffer();
    addDiesel(data, 0.02, 1.78, 62, 0.25, 'mixer-diesel', 10);
    addWubRumble(data, 0.08, 1.68, 0.26, 'mixer-wub-filter');
    addNoise(data, { start: 0.18, duration: 1.44, amp: 0.1, seed: 'mixer-slosh', mode: 'bandpass', cutoff: 0.025, attack: 0.08, release: 0.24, rattle: 5 });
    return data;
  },
  'road-roller': () => {
    const data = makeBuffer();
    addSubRumble(data, 0.02, 1.82, 34, 0.34, 3.2, 0.35);
    addOsc(data, { start: 0.02, duration: 1.82, type: 'triangle', freq: 68, amp: 0.18, attack: 0.08, release: 0.3 });
    [0.2, 0.52, 0.84, 1.16, 1.48].forEach((time, index) => addThump(data, time, 0.24, `roller-thump-${index}`));
    addNoise(data, { start: 0.08, duration: 1.68, amp: 0.15, seed: 'roller-ground', mode: 'lowpass', cutoff: 0.011, attack: 0.08, release: 0.28, rattle: 6 });
    return data;
  },
  'mobile-crane': () => {
    const data = makeBuffer();
    addDiesel(data, 0.02, 1.68, 66, 0.22, 'crane-diesel', 10);
    addHydraulicWhine(data, 0.22, 1.12, 0.28, 'crane-hydraulic');
    [0.36, 0.68, 1.0].forEach((time, index) => addBeep(data, time, 880, 0.11, 0.18, `crane-beep-${index}`, 'sine'));
    addMetalClank(data, 1.44, 0.25, 'crane-clank-a');
    addMetalClank(data, 1.64, 0.2, 'crane-clank-b');
    return data;
  }
};

ensureDir(outDir);
const manifest = {};
for (const [name, make] of Object.entries(recipes)) {
  const file = `${name}.wav`;
  writeWav(path.join(outDir, file), make());
  manifest[name] = `assets/sounds/${file}`;
}

fs.writeFileSync(path.join(outDir, 'vehicle-sounds.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Generated ${Object.keys(manifest).length} vehicle sounds in ${outDir}`);
