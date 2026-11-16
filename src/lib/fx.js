/* Feedback effects: short synthesised sounds, haptics, confetti and toasts.
 * All of it is decoration — every function is safe to call anywhere and does
 * nothing when the device, the user's settings or reduced-motion say no. */
import { getSettings } from "./store.js";

const hasDom = typeof document !== "undefined";
const calm = () => hasDom && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/* ---------- sound ---------- */
let ctx = null;
// [frequency Hz, start s, length s] per note
const TUNES = {
  right: { wave: "sine", notes: [[660, 0, 0.09], [990, 0.08, 0.14]] },
  wrong: { wave: "triangle", notes: [[220, 0, 0.12], [165, 0.1, 0.2]] },
  tap: { wave: "sine", notes: [[520, 0, 0.04]] },
  combo: { wave: "sine", notes: [[784, 0, 0.07], [988, 0.06, 0.07], [1319, 0.12, 0.16]] },
  done: { wave: "triangle", notes: [[523, 0, 0.12], [659, 0.11, 0.12], [784, 0.22, 0.12], [1047, 0.33, 0.3]] },
  badge: { wave: "sine", notes: [[880, 0, 0.1], [1175, 0.1, 0.1], [1568, 0.2, 0.25]] },
  level: { wave: "triangle", notes: [[392, 0, 0.1], [523, 0.1, 0.1], [659, 0.2, 0.1], [784, 0.3, 0.1], [1047, 0.4, 0.35]] },
};

export function sound(name) {
  const tune = TUNES[name];
  if (!hasDom || !tune || getSettings().sfx === false) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx ||= new AC();
    if (ctx.state === "suspended") ctx.resume();
    const t0 = ctx.currentTime + 0.01;
    for (const [freq, at, len] of tune.notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = tune.wave;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t0 + at);
      gain.gain.exponentialRampToValueAtTime(0.16, t0 + at + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + at + len);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0 + at);
      osc.stop(t0 + at + len + 0.02);
    }
  } catch {}
}

export function buzz(pattern) {
  if (!hasDom || getSettings().sfx === false) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {}
}

/* ---------- confetti ---------- */
const COLORS = ["var(--seal)", "var(--gold)", "var(--jade-bright)", "var(--sky)", "var(--plum)"];
export function confetti(count = 60) {
  if (!hasDom || calm()) return;
  const box = document.createElement("div");
  box.className = "confetti";
  box.setAttribute("aria-hidden", "true");
  for (let i = 0; i < count; i++) {
    const p = document.createElement("i");
    p.style.cssText = `left:${Math.random() * 100}%;background:${COLORS[i % COLORS.length]};--dx:${(Math.random() - 0.5) * 240}px;--rot:${Math.random() * 900 - 450}deg;animation-delay:${Math.random() * 0.35}s;animation-duration:${1.6 + Math.random() * 1.2}s;${i % 3 ? "" : "border-radius:50%;"}`;
    box.appendChild(p);
  }
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 3600);
}

/* ---------- toasts ---------- */
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export function toast({ ico = "✨", title, text = "" }) {
  if (!hasDom) return;
  let host = document.getElementById("toasts");
  if (!host) {
    host = document.createElement("div");
    host.id = "toasts";
    host.setAttribute("role", "status");
    host.setAttribute("aria-live", "polite");
    document.body.appendChild(host);
  }
  const el = document.createElement("div");
  el.className = "toast";
  el.innerHTML = `<span class="toast-ico" aria-hidden="true">${esc(ico)}</span><span><b>${esc(title)}</b>${text ? `<small>${esc(text)}</small>` : ""}</span>`;
  host.appendChild(el);
  const close = () => {
    el.classList.add("out");
    setTimeout(() => el.remove(), 300);
  };
  el.addEventListener("click", close);
  setTimeout(close, 4200);
}
