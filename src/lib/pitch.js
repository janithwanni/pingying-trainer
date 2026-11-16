/* Pitch tracking for the tone mirror: find the voice's pitch in a slice of
 * microphone audio, turn a recording into a contour, and say which Mandarin
 * tone that contour looks most like. Pure functions, so they're unit-tested;
 * only record() touches the microphone.
 */

/**
 * Fundamental frequency of an audio frame by normalised autocorrelation.
 * @param {Float32Array} buf time-domain samples (−1…1)
 * @returns {number|null} Hz, or null for silence / unvoiced sound
 */
export function detectPitch(buf, sampleRate, { minHz = 70, maxHz = 520 } = {}) {
  const n = buf.length;
  let energy = 0;
  for (let i = 0; i < n; i++) energy += buf[i] * buf[i];
  if (Math.sqrt(energy / n) < 0.012) return null; // too quiet to be speech
  const minLag = Math.max(2, Math.floor(sampleRate / maxHz));
  const maxLag = Math.min(Math.ceil(sampleRate / minHz), (n >> 1) - 1);
  const win = n - maxLag;
  const corr = new Float32Array(maxLag + 2);
  let peak = 0;
  for (let lag = minLag - 1; lag <= maxLag + 1; lag++) {
    let ab = 0, aa = 0, bb = 0;
    for (let i = 0; i < win; i++) {
      const a = buf[i], b = buf[i + lag];
      ab += a * b;
      aa += a * a;
      bb += b * b;
    }
    corr[lag] = ab / (Math.sqrt(aa * bb) || 1);
    if (lag >= minLag && lag <= maxLag && corr[lag] > peak) peak = corr[lag];
  }
  if (peak < 0.6) return null; // no clear period: noise or a consonant
  // The first strong peak, not the strongest: later peaks are octaves below.
  for (let lag = minLag; lag <= maxLag; lag++) {
    if (corr[lag] >= peak * 0.93 && corr[lag] >= corr[lag - 1] && corr[lag] >= corr[lag + 1]) {
      const a = corr[lag - 1], b = corr[lag], c = corr[lag + 1];
      const shift = a - 2 * b + c ? (0.5 * (a - c)) / (a - 2 * b + c) : 0; // parabolic refinement
      return sampleRate / (lag + shift);
    }
  }
  return null;
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

/**
 * Turn per-frame pitches (Hz or null) into a contour in semitones around the
 * speaker's own median, so high and low voices look alike. Keeps the longest
 * voiced stretch, drops octave jumps and smooths.
 * @returns {number[]} empty if there wasn't enough voiced sound
 */
export function toContour(pitches) {
  let best = [];
  let run = [];
  for (const p of [...pitches, null]) {
    if (p) run.push(p);
    else {
      if (run.length > best.length) best = run;
      run = [];
    }
  }
  if (best.length < 6) return [];
  const mid = median(best);
  const st = best.map((hz) => 12 * Math.log2(hz / mid)).filter((x) => Math.abs(x) < 10);
  if (st.length < 6) return [];
  return st.map((_, i) => median(st.slice(Math.max(0, i - 1), i + 2)));
}

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

/**
 * Which tone a contour (semitones) looks like.
 * @returns {{tone: 1|2|3|4, start: number, end: number, low: number}|null}
 */
export function classifyTone(st) {
  if (st.length < 6) return null;
  const edge = Math.max(1, Math.round(st.length * 0.2));
  const start = mean(st.slice(0, edge));
  const end = mean(st.slice(-edge));
  const low = Math.min(...st);
  const lowAt = st.indexOf(low) / (st.length - 1);
  let tone;
  if (lowAt > 0.2 && lowAt < 0.85 && start - low >= 1.5 && end - low >= 2) tone = 3; // down then up
  else if (end - start >= 2.5) tone = 2;
  else if (start - end >= 4.5) tone = 4;
  else if (start - end >= 2) tone = 3; // the everyday "half third": low and sinking
  else tone = 1;
  return { tone, start, end, low };
}

/**
 * Record up to `maxMs` from the microphone and return the pitch of each frame.
 * Stops early once the speaker has gone quiet after saying something.
 * @returns {{promise: Promise<(number|null)[]>, stop: () => void}}
 */
export function record({ maxMs = 2600, onFrame } = {}) {
  let stopped = false;
  const promise = (async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: true } });
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = new AC();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const buf = new Float32Array(analyser.fftSize);
    const pitches = [];
    const t0 = performance.now();
    let voiced = 0;
    let quiet = 0;
    try {
      await new Promise((done) => {
        const tick = () => {
          analyser.getFloatTimeDomainData(buf);
          const hz = detectPitch(buf, ctx.sampleRate);
          pitches.push(hz);
          onFrame?.(hz);
          if (hz) {
            voiced++;
            quiet = 0;
          } else quiet++;
          const over = performance.now() - t0 > maxMs || (voiced >= 6 && quiet >= 14);
          if (stopped || over) done();
          else requestAnimationFrame(tick);
        };
        tick();
      });
    } finally {
      stream.getTracks().forEach((t) => t.stop());
      ctx.close().catch(() => {});
    }
    return pitches;
  })();
  return { promise, stop: () => (stopped = true) };
}

export const canRecord = () =>
  typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && !!(window.AudioContext || window.webkitAudioContext);
