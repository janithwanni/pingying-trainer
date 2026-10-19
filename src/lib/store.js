/* Progress store: spaced-repetition state per word/sentence, lesson results and
 * daily activity. Saved to localStorage immediately and synced to Cloudflare KV
 * (see sync.js). Kept compact so a full profile stays well under 64 KB.
 *
 * items[key] = { b: box 0-7, d: due day number, c: correct, w: wrong, t: last update ms }
 *   key = "w:<hanzi>" for words, "s:<hanzi sentence>" for sentences
 * lessons[id] = { best: 0-100, done: first completion ms, runs, t }
 * days["YYYY-MM-DD"] = { n: answers, ok: correct answers }
 */
const KEY = "pinyin-sprint:progress:v1";
const SETTINGS_KEY = "pinyin-sprint:settings";
const DAY_MS = 86400000;
// Days until the next review for each Leitner box.
export const INTERVALS = [0, 1, 2, 4, 7, 15, 30, 60];
export const MASTERED_BOX = 4;

const fresh = () => ({ v: 1, items: {}, lessons: {}, days: {}, updatedAt: 0 });

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.v === 1) return { ...fresh(), ...s };
  } catch {}
  return fresh();
}

let state = load();
const listeners = new Set();
let onChange = null; // set by sync.js

export const getState = () => state;
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function setChangeHook(fn) {
  onChange = fn;
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {}
}
function emit() {
  listeners.forEach((fn) => fn(state));
}
function touch() {
  state.updatedAt = Date.now();
  pruneDays();
  save();
  emit();
  onChange?.();
}

/* ---------- dates ---------- */
export function dayNum(d = new Date()) {
  return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / DAY_MS);
}
export function dayKey(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function pruneDays() {
  const keys = Object.keys(state.days).sort();
  for (const k of keys.slice(0, Math.max(0, keys.length - 400))) delete state.days[k];
}

/* ---------- items ---------- */
export const getItem = (key) => state.items[key];
export const isDue = (it) => !!it && it.d <= dayNum();
export const isMastered = (it) => !!it && it.b >= MASTERED_BOX;

export function markSeen(key) {
  if (state.items[key]) return;
  state.items[key] = { b: 0, d: dayNum(), c: 0, w: 0, t: Date.now() };
  touch();
}

/** Update spaced-repetition box for one item. */
export function review(key, ok, { log = true } = {}) {
  const it = state.items[key] || { b: 0, d: 0, c: 0, w: 0, t: 0 };
  if (ok) {
    it.b = Math.min(it.b + 1, INTERVALS.length - 1);
    it.c++;
  } else {
    it.b = Math.max(0, it.b - 2);
    it.w++;
  }
  it.d = dayNum() + (ok ? INTERVALS[it.b] : 0);
  it.t = Date.now();
  state.items[key] = it;
  if (log) bumpDay(ok);
  touch();
}

/** Count an answer toward today's activity without touching SRS. */
export function logAnswer(ok) {
  bumpDay(ok);
  touch();
}
function bumpDay(ok) {
  const d = (state.days[dayKey()] ||= { n: 0, ok: 0 });
  d.n++;
  if (ok) d.ok++;
}

/* ---------- lessons ---------- */
export function completeLesson(id, score) {
  const l = (state.lessons[id] ||= { best: 0, done: 0, runs: 0, t: 0 });
  l.best = Math.max(l.best, score);
  l.done ||= Date.now();
  l.runs++;
  l.t = Date.now();
  touch();
}

/* ---------- derived stats ---------- */
export function streak() {
  const d = new Date();
  if (!state.days[dayKey(d)]?.n) d.setDate(d.getDate() - 1);
  let n = 0;
  while (state.days[dayKey(d)]?.n) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

export function bestStreak() {
  const keys = Object.keys(state.days)
    .filter((k) => state.days[k].n)
    .sort();
  let best = 0;
  let run = 0;
  let prev = null;
  for (const k of keys) {
    const cur = new Date(k + "T12:00:00");
    run = prev && Math.round((cur - prev) / DAY_MS) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = cur;
  }
  return best;
}

export function lastDays(n) {
  const out = [];
  const d = new Date();
  d.setDate(d.getDate() - (n - 1));
  for (let i = 0; i < n; i++) {
    const k = dayKey(d);
    out.push({ key: k, date: new Date(d), ...(state.days[k] || { n: 0, ok: 0 }) });
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export function summarize(prefix) {
  let seen = 0, learning = 0, mastered = 0, due = 0;
  const today = dayNum();
  for (const [k, it] of Object.entries(state.items)) {
    if (!k.startsWith(prefix)) continue;
    seen++;
    if (it.b >= MASTERED_BOX) mastered++;
    else if (it.b > 0) learning++;
    if (it.d <= today && (it.c || it.w)) due++;
  }
  return { seen, learning, mastered, due };
}

/* ---------- sync / backup ---------- */
function newer(a, b) {
  if (!a) return b;
  if (!b) return a;
  return (b.t || 0) > (a.t || 0) ? b : a;
}

/** Merge a remote snapshot into local state (per-item last-write-wins). */
export function mergeIn(remote, { silent = false } = {}) {
  if (!remote || remote.v !== 1) return false;
  const before = JSON.stringify(state);
  const items = { ...state.items };
  for (const [k, it] of Object.entries(remote.items || {})) items[k] = newer(items[k], it);
  const lessons = { ...state.lessons };
  for (const [k, l] of Object.entries(remote.lessons || {})) {
    const a = lessons[k];
    const firstDone = Math.min(a?.done || Infinity, l.done || Infinity);
    lessons[k] = a
      ? {
          best: Math.max(a.best, l.best),
          done: firstDone === Infinity ? 0 : firstDone,
          runs: Math.max(a.runs, l.runs),
          t: Math.max(a.t, l.t),
        }
      : l;
  }
  const days = { ...state.days };
  for (const [k, d] of Object.entries(remote.days || {})) {
    const a = days[k];
    days[k] = !a || d.n > a.n ? d : a;
  }
  state = {
    v: 1,
    items,
    lessons,
    days,
    updatedAt: Math.max(state.updatedAt, remote.updatedAt || 0),
  };
  const changed = JSON.stringify(state) !== before;
  if (changed) {
    save();
    emit();
    if (!silent) onChange?.();
  }
  return changed;
}

export function resetAll() {
  state = fresh();
  state.updatedAt = Date.now();
  save();
  emit();
  onChange?.();
}

/* ---------- per-device settings (not synced) ---------- */
let settings = { speed: 0, autoSpeak: false };
try {
  settings = { ...settings, ...JSON.parse(localStorage.getItem(SETTINGS_KEY)) };
} catch {}
export const getSettings = () => settings;
export function setSetting(k, v) {
  settings[k] = v;
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {}
}
