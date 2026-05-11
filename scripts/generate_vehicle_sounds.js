const fs = require('fs');
const path = require('path');

const sampleRate = 44100;
const outDir = path.join(__dirname, '..', 'assets', 'sounds');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function makeBuffer(seconds) {
  return new Float32Array(Math.ceil(seconds * sampleRate));
}

function envelope(t, duration, attack = 0.02, release = 0.08) {
  if (t < 0 || t > duration) return 0;
  const a = attack > 0 ? Math.min(1, t / attack) : 1;
  const r = release > 0 ? Math.min(1, (duration - t) / release) : 1;
  return Math.max(0, Math.min(a, r, 1));
}

function waveValue(type, phase) {
  const x = phase / (Math.PI * 2);
  if (type === 'square') return Math.sin(phase) >= 0 ? 1 : -1;
  if (type === 'saw') return 2 * (x - Math.floor(x + 0.5));
  if (type === 'triangle') return 2 * Math.asin(Math.sin(phase)) / Math.PI;
  return Math.sin(phase);
}

function addTone(data, start, duration, freq, amp, type = 'sine', options = {}) {
  const startIndex = Math.max(0, Math.floor(start * sampleRate));
  const endIndex = Math.min(data.length, Math.floor((start + duration) * sampleRate));
  let phase = options.phase || 0;
  for (let i = startIndex; i < endIndex; i++) {
    const t = (i - startIndex) / sampleRate;
    const vibrato = options.vibratoDepth
      ? Math.sin(Math.PI * 2 * (options.vibratoRate || 5) * t) * options.vibratoDepth
      : 0;
    phase += Math.PI * 2 * (freq + vibrato) / sampleRate;
    data[i] += waveValue(type, phase) * amp * envelope(t, duration, options.attack, options.release);
  }
}

function addSweep(data, start, duration, f0, f1, amp, type = 'saw', options = {}) {
  const startIndex = Math.max(0, Math.floor(start * sampleRate));
  const endIndex = Math.min(data.length, Math.floor((start + duration) * sampleRate));
  let phase = options.phase || 0;
  for (let i = startIndex; i < endIndex; i++) {
    const t = (i - startIndex) / sampleRate;
    const p = duration > 0 ? t / duration : 1;
    const curve = options.curve === 'ease' ? (1 - Math.cos(p * Math.PI)) / 2 : p;
    const freq = f0 * Math.pow(f1 / f0, curve);
    phase += Math.PI * 2 * freq / sampleRate;
    data[i] += waveValue(type, phase) * amp * envelope(t, duration, options.attack, options.release);
  }
}

function addNoise(data, start, duration, amp, options = {}) {
  const startIndex = Math.max(0, Math.floor(start * sampleRate));
  const endIndex = Math.min(data.length, Math.floor((start + duration) * sampleRate));
  let low = 0;
  let last = 0;
  const cutoff = options.cutoff || 0.08;
  for (let i = startIndex; i < endIndex; i++) {
    const t = (i - startIndex) / sampleRate;
    const raw = Math.random() * 2 - 1;
    low += (raw - low) * cutoff;
    const value = options.highpass ? raw - low : low;
    const sample = value * amp * envelope(t, duration, options.attack, options.release);
    data[i] += options.rattle ? sample * (0.55 + 0.45 * Math.sin(t * Math.PI * 2 * options.rattle)) : sample;
    last = value;
  }
  return last;
}

function addBeep(data, start, freq = 920, duration = 0.11, amp = 0.32) {
  addTone(data, start, duration, freq, amp, 'square', { attack: 0.006, release: 0.025 });
  addTone(data, start, duration, freq * 1.5, amp * 0.22, 'triangle', { attack: 0.006, release: 0.025 });
}

function addHonk(data, start, freq = 155, duration = 0.27, amp = 0.34) {
  addTone(data, start, duration, freq, amp, 'saw', { attack: 0.018, release: 0.08, vibratoDepth: 2.5, vibratoRate: 6 });
  addTone(data, start, duration, freq * 1.48, amp * 0.42, 'triangle', { attack: 0.018, release: 0.08 });
  addTone(data, start, duration, freq * 0.5, amp * 0.28, 'sine', { attack: 0.02, release: 0.1 });
}

function addEngineRev(data, start, low, high, duration, amp) {
  addSweep(data, start, duration * 0.56, low, high, amp, 'saw', { attack: 0.025, release: 0.08, curve: 'ease' });
  addSweep(data, start + duration * 0.36, duration * 0.62, high, low * 0.78, amp * 0.78, 'saw', { attack: 0.025, release: 0.12, curve: 'ease' });
  addSweep(data, start, duration, low * 0.5, high * 0.42, amp * 0.45, 'triangle', { attack: 0.02, release: 0.12 });
  addNoise(data, start + duration * 0.18, duration * 0.42, amp * 0.2, { highpass: true, cutoff: 0.03, attack: 0.01, release: 0.08 });
}

function addDiesel(data, start, duration, freq = 78, amp = 0.32) {
  addTone(data, start, duration, freq, amp, 'saw', { attack: 0.04, release: 0.14, vibratoDepth: 3, vibratoRate: 8 });
  addTone(data, start, duration, freq * 0.5, amp * 0.42, 'square', { attack: 0.04, release: 0.14 });
  addNoise(data, start, duration, amp * 0.34, { cutoff: 0.018, attack: 0.02, release: 0.16, rattle: 32 });
}

function addClank(data, start, amp = 0.34) {
  addSweep(data, start, 0.09, 1180, 520, amp, 'triangle', { attack: 0.002, release: 0.08 });
  addSweep(data, start + 0.025, 0.06, 1900, 820, amp * 0.44, 'square', { attack: 0.002, release: 0.045 });
  addNoise(data, start, 0.08, amp * 0.42, { highpass: true, cutoff: 0.025, attack: 0.001, release: 0.06 });
}

function addDrumPulse(data, start, count, gap, freq, amp) {
  for (let i = 0; i < count; i++) {
    const t = start + i * gap;
    addSweep(data, t, gap * 0.74, freq, freq * 0.72, amp, 'sine', { attack: 0.01, release: gap * 0.4 });
    addNoise(data, t + 0.015, gap * 0.48, amp * 0.3, { cutoff: 0.026, attack: 0.004, release: gap * 0.24 });
  }
}

function addHydraulic(data, start, duration, amp) {
  addSweep(data, start, duration * 0.62, 420, 1180, amp, 'sine', { attack: 0.03, release: 0.06, curve: 'ease' });
  addSweep(data, start + duration * 0.45, duration * 0.52, 1180, 640, amp * 0.75, 'triangle', { attack: 0.03, release: 0.1 });
  addNoise(data, start + duration * 0.18, duration * 0.42, amp * 0.2, { highpass: true, cutoff: 0.02, attack: 0.01, release: 0.08 });
}

function normalize(data) {
  let peak = 0;
  for (const sample of data) peak = Math.max(peak, Math.abs(sample));
  const gain = peak > 0 ? Math.min(1, 0.92 / peak) : 1;
  for (let i = 0; i < data.length; i++) {
    const soft = Math.tanh(data[i] * gain * 1.2);
    data[i] = soft * 0.9;
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
    const sample = Math.max(-1, Math.min(1, data[i]));
    bytes.writeInt16LE(Math.round(sample * 32767), 44 + i * 2);
  }
  fs.writeFileSync(file, bytes);
}

const recipes = {
  'red-sedan': () => {
    const data = makeBuffer(0.95);
    addEngineRev(data, 0.04, 210, 570, 0.34, 0.34);
    addEngineRev(data, 0.38, 230, 690, 0.32, 0.32);
    return data;
  },
  'purple-hatchback': () => {
    const data = makeBuffer(0.9);
    addEngineRev(data, 0.03, 250, 720, 0.31, 0.32);
    addEngineRev(data, 0.34, 285, 820, 0.3, 0.3);
    addBeep(data, 0.66, 980, 0.08, 0.18);
    return data;
  },
  'yellow-taxi': () => {
    const data = makeBuffer(0.96);
    addEngineRev(data, 0.02, 230, 540, 0.34, 0.25);
    addBeep(data, 0.12, 940, 0.1, 0.38);
    addBeep(data, 0.31, 1180, 0.095, 0.34);
    addBeep(data, 0.52, 940, 0.085, 0.25);
    return data;
  },
  'blue-bus': () => {
    const data = makeBuffer(1.25);
    addDiesel(data, 0.02, 0.98, 78, 0.36);
    addHonk(data, 0.1, 180, 0.31, 0.36);
    addHonk(data, 0.48, 158, 0.33, 0.32);
    addNoise(data, 0.88, 0.22, 0.22, { highpass: true, cutoff: 0.018, attack: 0.006, release: 0.14 });
    return data;
  },
  'orange-van': () => {
    const data = makeBuffer(0.98);
    addEngineRev(data, 0.03, 165, 400, 0.38, 0.34);
    addEngineRev(data, 0.43, 180, 455, 0.32, 0.3);
    addNoise(data, 0.16, 0.24, 0.08, { cutoff: 0.04, attack: 0.02, release: 0.12 });
    return data;
  },
  'tow-truck': () => {
    const data = makeBuffer(1.18);
    addDiesel(data, 0.02, 0.78, 94, 0.3);
    addBeep(data, 0.08, 760, 0.08, 0.28);
    addBeep(data, 0.27, 760, 0.08, 0.25);
    addBeep(data, 0.46, 760, 0.08, 0.22);
    addClank(data, 0.72, 0.34);
    addClank(data, 0.88, 0.22);
    return data;
  },
  'dump-truck': () => {
    const data = makeBuffer(1.18);
    addDiesel(data, 0.02, 0.92, 70, 0.42);
    addHonk(data, 0.18, 150, 0.2, 0.27);
    addHonk(data, 0.48, 132, 0.24, 0.25);
    addNoise(data, 0.22, 0.52, 0.16, { cutoff: 0.016, attack: 0.02, release: 0.2, rattle: 20 });
    return data;
  },
  'cement-mixer': () => {
    const data = makeBuffer(1.28);
    addDiesel(data, 0.02, 1.0, 82, 0.32);
    addDrumPulse(data, 0.08, 7, 0.145, 118, 0.22);
    addNoise(data, 0.08, 0.98, 0.1, { cutoff: 0.028, attack: 0.02, release: 0.18, rattle: 15 });
    return data;
  },
  'road-roller': () => {
    const data = makeBuffer(1.25);
    addDiesel(data, 0.02, 1.0, 58, 0.4);
    addDrumPulse(data, 0.05, 6, 0.17, 72, 0.25);
    addNoise(data, 0.1, 0.9, 0.18, { cutoff: 0.012, attack: 0.02, release: 0.22, rattle: 9 });
    return data;
  },
  'mobile-crane': () => {
    const data = makeBuffer(1.24);
    addDiesel(data, 0.02, 0.8, 74, 0.28);
    addHydraulic(data, 0.1, 0.62, 0.28);
    addBeep(data, 0.13, 880, 0.08, 0.22);
    addBeep(data, 0.43, 880, 0.08, 0.2);
    addClank(data, 0.82, 0.24);
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
