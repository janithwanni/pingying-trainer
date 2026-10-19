/* Text-to-speech using the browser's built-in Mandarin voice (free, offline on
 * most phones). Everything degrades gracefully when no zh voice exists. */
const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
let voice = null;

function pickVoice() {
  if (!synth) return;
  const voices = synth.getVoices();
  voice =
    voices.find((v) => /zh[-_]CN/i.test(v.lang)) ||
    voices.find((v) => /^zh/i.test(v.lang) && !/HK|yue/i.test(v.lang)) ||
    voices.find((v) => /^zh/i.test(v.lang)) ||
    null;
}

if (synth) {
  pickVoice();
  synth.addEventListener?.("voiceschanged", pickVoice);
}

export function canSpeak() {
  if (!synth) return false;
  if (!voice) pickVoice();
  return !!voice;
}

export function speak(text, rate = 0.85) {
  if (!synth) return;
  if (!voice) pickVoice();
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/\.\.\./g, ""));
  u.lang = voice?.lang || "zh-CN";
  if (voice) u.voice = voice;
  u.rate = rate;
  synth.speak(u);
}

export function stopSpeaking() {
  synth?.cancel();
}
