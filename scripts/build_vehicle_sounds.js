/*
 * Build vehicle spawn sounds from real-world Mixkit recordings.
 *
 * Pipeline per vehicle:
 *   1. Download the Mixkit MP3 preview into scripts/sources/ (cached).
 *   2. Use macOS afconvert to decode it to mono 44.1 kHz 16-bit WAV.
 *   3. Read the PCM, slice the configured window, apply optional gain,
 *      fade in/out, peak/RMS normalisation, and write to assets/sounds/.
 *
 * Mixkit Sound Effects Free License: free for commercial and non-commercial
 * use, no attribution required (https://mixkit.co/license/).
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execFileSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const SOURCE_DIR = path.join(__dirname, 'sources');
const TMP_DIR = path.join(__dirname, '.cache');
const OUT_DIR = path.join(REPO_ROOT, 'assets', 'sounds');
const TARGET_SAMPLE_RATE = 44100;
const TARGET_DURATION = 2.0;
const FADE_IN_SEC = 0.025;
const FADE_OUT_SEC = 0.08;
const PEAK_TARGET = 0.92;
const RMS_TARGET = 0.22;
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';

// Mixkit-sourced clips, hand-matched to each vehicle sprite.
const SOURCES = [
  {
    name: 'red-sedan',
    mixkitId: 1559,
    title: 'Car start ignition',
    start: 0.05,
    duration: 1.95,
    gain: 1.0
  },
  {
    name: 'purple-hatchback',
    mixkitId: 1538,
    title: 'Fast car drive by',
    start: 0.4,
    duration: 1.95,
    gain: 1.05
  },
  {
    name: 'yellow-taxi',
    mixkitId: 719,
    title: 'Car double horn',
    start: 0.0,
    duration: 1.95,
    gain: 1.0,
    loopToFill: true
  },
  {
    name: 'blue-bus',
    mixkitId: 3033,
    title: 'Old bus arrival',
    start: 1.5,
    duration: 1.95,
    gain: 1.1
  },
  {
    name: 'orange-van',
    mixkitId: 1623,
    title: 'Truck start engine',
    start: 0.6,
    duration: 1.95,
    gain: 1.05
  },
  {
    name: 'tow-truck',
    mixkitId: 1077,
    title: 'Truck reversing beeps loop',
    start: 0.0,
    duration: 1.95,
    gain: 1.0,
    loopToFill: true
  },
  {
    name: 'dump-truck',
    mixkitId: 1622,
    title: 'Truck accelerates',
    start: 1.2,
    duration: 1.95,
    gain: 1.1
  },
  {
    name: 'cement-mixer',
    mixkitId: 813,
    title: 'Cement mixer stops',
    start: 0.5,
    duration: 1.95,
    gain: 1.05
  },
  {
    name: 'road-roller',
    mixkitId: 802,
    title: 'Construction machine motor passing',
    start: 9.0,
    duration: 1.95,
    gain: 1.05
  },
  {
    name: 'mobile-crane',
    mixkitId: 1618,
    title: 'Fire truck ladder engine',
    start: 0.6,
    duration: 1.95,
    gain: 1.1
  }
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function downloadIfNeeded(url, destPath) {
  if (fs.existsSync(destPath) && fs.statSync(destPath).size > 1024) return Promise.resolve(false);
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': USER_AGENT } }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        downloadIfNeeded(res.headers.location, destPath).then(() => resolve(true)).catch(reject);
        res.resume();
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        res.resume();
        return;
      }
      const file = fs.createWriteStream(destPath);
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve(true)));
      file.on('error', reject);
    });
    req.on('error', reject);
  });
}

function mp3ToWav(srcMp3, destWav) {
  // afconvert writes mono 44.1 kHz 16-bit little-endian WAV.
  execFileSync('afconvert', [
    '-f', 'WAVE',
    '-d', `LEI16@${TARGET_SAMPLE_RATE}`,
    '-c', '1',
    srcMp3,
    destWav
  ], { stdio: ['ignore', 'ignore', 'inherit'] });
}

function readWavMono(filePath) {
  const buf = fs.readFileSync(filePath);
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error(`Not a WAV file: ${filePath}`);
  }
  let offset = 12;
  let fmt = null;
  let dataOffset = null;
  let dataSize = null;
  while (offset < buf.length - 8) {
    const chunkId = buf.toString('ascii', offset, offset + 4);
    const chunkSize = buf.readUInt32LE(offset + 4);
    if (chunkId === 'fmt ') {
      const audioFormat = buf.readUInt16LE(offset + 8);
      const numChannels = buf.readUInt16LE(offset + 10);
      const sampleRate = buf.readUInt32LE(offset + 12);
      const bitsPerSample = buf.readUInt16LE(offset + 22);
      fmt = { audioFormat, numChannels, sampleRate, bitsPerSample };
    } else if (chunkId === 'data') {
      dataOffset = offset + 8;
      dataSize = chunkSize;
      break;
    }
    offset += 8 + chunkSize + (chunkSize & 1);
  }
  if (!fmt || dataOffset == null) throw new Error(`Missing fmt/data chunk in ${filePath}`);
  if (fmt.audioFormat !== 1 || fmt.bitsPerSample !== 16) {
    throw new Error(`Unsupported WAV (format=${fmt.audioFormat}, bits=${fmt.bitsPerSample})`);
  }
  const sampleCount = Math.floor(dataSize / 2 / fmt.numChannels);
  const data = new Float32Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    let acc = 0;
    for (let ch = 0; ch < fmt.numChannels; ch++) {
      acc += buf.readInt16LE(dataOffset + (i * fmt.numChannels + ch) * 2);
    }
    data[i] = acc / fmt.numChannels / 32768;
  }
  return { sampleRate: fmt.sampleRate, data };
}

function writeWavMono(filePath, samples, sampleRate = TARGET_SAMPLE_RATE) {
  const buf = Buffer.alloc(44 + samples.length * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + samples.length * 2, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(clamped * 32767), 44 + i * 2);
  }
  fs.writeFileSync(filePath, buf);
}

function sliceWindow(source, sampleRate, startSec, durationSec, loopToFill) {
  const total = Math.max(1, Math.floor(durationSec * sampleRate));
  const result = new Float32Array(total);
  const startIndex = Math.max(0, Math.floor(startSec * sampleRate));
  if (startIndex >= source.length) return result;
  const available = source.length - startIndex;
  const copyLen = Math.min(total, available);
  result.set(source.subarray(startIndex, startIndex + copyLen), 0);
  if (loopToFill && copyLen < total) {
    let pos = copyLen;
    while (pos < total) {
      const chunk = Math.min(copyLen, total - pos);
      result.set(source.subarray(startIndex, startIndex + chunk), pos);
      pos += chunk;
    }
  }
  return result;
}

function applyGain(samples, gain) {
  if (gain === 1) return;
  for (let i = 0; i < samples.length; i++) samples[i] *= gain;
}

function applyFades(samples, sampleRate, fadeInSec, fadeOutSec) {
  const fadeInLen = Math.min(samples.length, Math.floor(fadeInSec * sampleRate));
  const fadeOutLen = Math.min(samples.length, Math.floor(fadeOutSec * sampleRate));
  for (let i = 0; i < fadeInLen; i++) {
    const t = i / fadeInLen;
    samples[i] *= t * t * (3 - 2 * t);
  }
  for (let i = 0; i < fadeOutLen; i++) {
    const t = i / fadeOutLen;
    const env = t * t * (3 - 2 * t);
    samples[samples.length - 1 - i] *= env;
  }
}

function normalizeLoudness(samples) {
  let peak = 0;
  let sumSq = 0;
  for (const s of samples) {
    const a = Math.abs(s);
    if (a > peak) peak = a;
    sumSq += s * s;
  }
  const rms = Math.sqrt(sumSq / Math.max(1, samples.length));
  if (peak === 0) return { peak: 0, rms: 0, gain: 0 };
  const peakGain = PEAK_TARGET / peak;
  const rmsGain = rms > 0 ? RMS_TARGET / rms : peakGain;
  const gain = Math.min(peakGain, rmsGain, 6);
  for (let i = 0; i < samples.length; i++) {
    samples[i] = Math.tanh(samples[i] * gain * 1.04) * 0.95;
  }
  return { peak, rms, gain };
}

async function buildOne(spec) {
  const url = `https://assets.mixkit.co/active_storage/sfx/${spec.mixkitId}/${spec.mixkitId}-preview.mp3`;
  const mp3Path = path.join(SOURCE_DIR, `mixkit-${spec.mixkitId}.mp3`);
  const wavCachePath = path.join(TMP_DIR, `mixkit-${spec.mixkitId}.wav`);
  const outPath = path.join(OUT_DIR, `${spec.name}.wav`);

  await downloadIfNeeded(url, mp3Path);
  if (!fs.existsSync(wavCachePath) || fs.statSync(wavCachePath).mtimeMs < fs.statSync(mp3Path).mtimeMs) {
    mp3ToWav(mp3Path, wavCachePath);
  }
  const { data, sampleRate } = readWavMono(wavCachePath);
  const sliced = sliceWindow(data, sampleRate, spec.start, spec.duration, !!spec.loopToFill);
  applyGain(sliced, spec.gain ?? 1);
  applyFades(sliced, sampleRate, FADE_IN_SEC, FADE_OUT_SEC);
  const stats = normalizeLoudness(sliced);

  // Re-pad / trim to exact target duration (use sample rate from decode).
  const targetSamples = Math.floor(TARGET_DURATION * sampleRate);
  let final = sliced;
  if (sliced.length !== targetSamples) {
    final = new Float32Array(targetSamples);
    final.set(sliced.subarray(0, Math.min(sliced.length, targetSamples)));
  }
  writeWavMono(outPath, final, sampleRate);
  return {
    name: spec.name,
    mixkitId: spec.mixkitId,
    title: spec.title,
    sourceSec: data.length / sampleRate,
    windowStart: spec.start,
    windowDur: spec.duration,
    peak: stats.peak,
    rms: stats.rms,
    gain: stats.gain,
    bytes: fs.statSync(outPath).size
  };
}

async function main() {
  ensureDir(SOURCE_DIR);
  ensureDir(TMP_DIR);
  ensureDir(OUT_DIR);
  const manifest = {};
  const report = [];
  for (const spec of SOURCES) {
    process.stdout.write(`Building ${spec.name} (mixkit/${spec.mixkitId} "${spec.title}")... `);
    try {
      const result = await buildOne(spec);
      manifest[spec.name] = `assets/sounds/${spec.name}.wav`;
      report.push(result);
      console.log(`ok  bytes=${result.bytes}  peak=${result.peak.toFixed(3)}  gain=${result.gain.toFixed(2)}`);
    } catch (err) {
      console.error(`FAILED: ${err.message}`);
      throw err;
    }
  }
  fs.writeFileSync(
    path.join(OUT_DIR, 'vehicle-sounds.json'),
    JSON.stringify(manifest, null, 2) + '\n'
  );
  fs.writeFileSync(
    path.join(OUT_DIR, 'vehicle-sounds-credits.json'),
    JSON.stringify({
      source: 'Mixkit Sound Effects Free License (https://mixkit.co/license/)',
      attributionRequired: false,
      tracks: report.map(r => ({
        vehicle: r.name,
        mixkitId: r.mixkitId,
        title: r.title,
        previewUrl: `https://assets.mixkit.co/active_storage/sfx/${r.mixkitId}/${r.mixkitId}-preview.mp3`,
        windowStart: r.windowStart,
        windowDuration: r.windowDur
      }))
    }, null, 2) + '\n'
  );
  console.log(`\nWrote ${SOURCES.length} WAVs to ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
