/* Speech recognition for speaking exercises, using the browser's built-in
 * Mandarin recogniser where there is one (Chrome, Edge, Safari). Exercises
 * fall back to self-checking when it's missing or the mic is refused.
 *
 * Recognisers return characters, and often pick a homophone (她 for 他), so
 * speech is compared by sound: toneless pinyin, syllable by syllable.
 */
import { syllableSimilarity } from "./pinyin.js";

const SR = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : undefined;
export const PASS_SCORE = 0.8;
/** Recogniser errors that mean the mic can't be used at all (as opposed to "try again"). */
export const MIC_BLOCKED = new Set(["not-allowed", "service-not-allowed", "audio-capture", "language-not-supported"]);

let micOff = false; // the mic was refused this session; don't keep asking
export const canListen = () => !!SR && !micOff;

let active = null;
export function stopListening() {
  try {
    active?.abort();
  } catch {}
  active = null;
}

/**
 * Listen for one utterance.
 * @returns {{promise: Promise<string[]>, stop: () => void}} promise resolves with
 *   the recogniser's alternatives, best first; it rejects with `err.code` set
 *   to the recogniser's error ("no-speech", "not-allowed"…).
 */
export function listenOnce({ onInterim } = {}) {
  stopListening();
  const rec = new SR();
  rec.lang = "zh-CN";
  rec.interimResults = true;
  rec.maxAlternatives = 5;
  const promise = new Promise((resolve, reject) => {
    let finals = [];
    let code = "";
    rec.onresult = (ev) => {
      const results = Array.from(ev.results);
      onInterim?.(results.map((r) => r[0].transcript).join(""));
      const last = results[results.length - 1];
      if (last?.isFinal) finals = Array.from(last, (alt) => alt.transcript).filter(Boolean);
    };
    rec.onerror = (ev) => {
      code = ev.error || "error";
    };
    rec.onend = () => {
      if (active === rec) active = null;
      if (MIC_BLOCKED.has(code)) micOff = true;
      if (finals.length) resolve(finals);
      else reject(Object.assign(new Error(code || "no-speech"), { code: code || "no-speech" }));
    };
    try {
      rec.start();
      active = rec;
    } catch {
      reject(Object.assign(new Error("error"), { code: "error" }));
    }
  });
  return { promise, stop: () => rec.stop() };
}

const strip = (t) => String(t || "").replace(/[^一-鿿0-9a-zA-Z]/g, "");

/**
 * Compare what the recogniser heard with the target sentence.
 * @returns {Promise<{score: number, heard: string}>} best alternative and its score (0–1)
 */
export async function scoreSpeech(alternatives, target) {
  const want = strip(target);
  const exact = alternatives.find((a) => strip(a) === want);
  if (exact) return { score: 1, heard: exact };
  const { pinyin } = await import("pinyin-pro");
  const syllables = (t) => pinyin(strip(t), { toneType: "none", type: "array", nonZh: "consecutive", v: true });
  const goal = syllables(want);
  let best = { score: 0, heard: alternatives[0] || "" };
  for (const a of alternatives) {
    const score = syllableSimilarity(syllables(a), goal);
    if (score > best.score) best = { score, heard: a };
  }
  return best;
}
