/* Progress store: spaced-repetition state per word/sentence, lesson results and
 * daily activity. Saved to localStorage immediately and synced to Cloudflare KV
 * (see sync.js). Kept compact so a full profile stays well under 64 KB.
 *
 * items[key] = { b: box 0-7, d: due day number, c: correct, w: wrong, t: last update ms }
 *   key = "w:<hanzi>" for words, "s:<hanzi sentence>" for sentences,
 *         "p:<hanzi>" for phrases saved from Talk
 * lessons[id] = { best: 0-100, done: first completion ms, runs, t }
 *   id = lesson id, or "talk:<scenario id>" for conversations (best = most
 *   learner turns in one chat, runs = learner messages, done = first full chat)
 * days["YYYY-MM-DD"] = { n: answers, ok: correct answers, x: XP earned,
 *   s: sentences spoken aloud, t: Talk replies, o: tone-trainer answers,
 *   q: bitmask of daily quests already rewarded }
 * xp = total experience points; badges[id] = ms when earned
 * phrases[hanzi] = { py, en, t } — the learner's own phrasebook; { x: 1, t }
 *   marks a removed phrase so the removal survives a sync merge
 */
const KEY = "pinyin-sprint:progress:v1";
const SETTINGS_KEY = "pinyin-sprint:settings";
const DAY_MS = 86400000;
// Days until the next review for each Leitner box.
export const INTERVALS = [0, 1, 2, 4, 7, 15, 30, 60];
export const MASTERED_BOX = 4;

export const MAX_PHRASES = 150;
export const TALK_DONE_TURNS = 4; // learner turns that count as a full conversation

/* XP per action. Flashcards are self-graded, so they earn less. */
export const XP = { right: 10, wrong: 2, card: 4, talk: 15, questBonus: 25 };

const fresh = () => ({ v: 1, items: {}, lessons: {}, days: {}, phrases: {}, badges: {}, xp: 0, updatedAt: 0 });

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.v === 1) return { ...fresh(), ...clean(s) };
  } catch {}
  return fresh();
}

/* Keep only well-formed records from untrusted input (cloud copy, imported
 * backup, older versions), so one bad entry can't break every screen. */
const isObj = (x) => !!x && typeof x === "object" && !Array.isArray(x);
const num = (x) => (Number.isFinite(x) ? x : 0);
function clean(raw) {
  const out = fresh();
  for (const [k, it] of Object.entries(isObj(raw.items) ? raw.items : {})) {
    if (!isObj(it) || !/^[wsp]:./.test(k)) continue;
    const b = Math.min(Math.max(Math.floor(num(it.b)), 0), INTERVALS.length - 1);
    out.items[k] = { b, d: num(it.d), c: num(it.c), w: num(it.w), t: num(it.t) };
  }
  for (const [k, l] of Object.entries(isObj(raw.lessons) ? raw.lessons : {})) {
    if (isObj(l)) out.lessons[k] = { best: num(l.best), done: num(l.done), runs: num(l.runs), t: num(l.t) };
  }
  for (const [k, d] of Object.entries(isObj(raw.days) ? raw.days : {})) {
    if (!isObj(d) || !/^\d{4}-\d{2}-\d{2}$/.test(k)) continue;
    out.days[k] = { n: num(d.n), ok: num(d.ok) };
    for (const f of ["x", "s", "t", "o", "q"]) if (num(d[f])) out.days[k][f] = num(d[f]);
  }
  for (const [k, p] of Object.entries(isObj(raw.phrases) ? raw.phrases : {})) {
    if (!isObj(p) || !k) continue;
    out.phrases[k] = p.x ? { x: 1, t: num(p.t) } : { py: String(p.py || ""), en: String(p.en || ""), t: num(p.t) };
  }
  for (const [k, t] of Object.entries(isObj(raw.badges) ? raw.badges : {})) if (num(t)) out.badges[k] = num(t);
  out.xp = Math.max(0, num(raw.xp));
  out.updatedAt = num(raw.updatedAt);
  return out;
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
export function review(key, ok, { log = true, ...how } = {}) {
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
  if (log) bumpDay(ok, how);
  touch();
}

/**
 * Count an answer toward today's activity without touching SRS.
 * `how`: { xp } overrides the XP earned; { spoken } / { tone } mark the answer
 * as said aloud / from the tone trainer, for the daily quests.
 */
export function logAnswer(ok, how) {
  bumpDay(ok, how);
  touch();
}
const today = () => (state.days[dayKey()] ||= { n: 0, ok: 0 });
function earn(n) {
  if (!(n > 0)) return;
  const d = today();
  d.x = (d.x || 0) + n;
  state.xp += n;
}
function bumpDay(ok, { xp, spoken, tone } = {}) {
  const d = today();
  d.n++;
  if (ok) d.ok++;
  if (spoken && ok) d.s = (d.s || 0) + 1;
  if (tone) d.o = (d.o || 0) + 1;
  earn(xp ?? (ok ? XP.right : XP.wrong));
}

/** Bonus XP outside an answer (finishing a lesson, a perfect round). */
export function addXp(n) {
  earn(n);
  touch();
}

/** Reward a daily quest once; `bit` identifies it in today's record. */
export function claimQuest(bit) {
  const d = today();
  if ((d.q || 0) & bit) return false;
  d.q = (d.q || 0) | bit;
  earn(XP.questBonus);
  touch();
  return true;
}

export function awardBadge(id) {
  if (state.badges[id]) return false;
  state.badges[id] = Date.now();
  touch();
  return true;
}

/** Best result for a tone-trainer drill: lessons["tone:<id>"], best = best round %, runs = rounds. */
export const toneId = (drill) => "tone:" + drill;
export function recordDrill(drill, score) {
  const l = (state.lessons[toneId(drill)] ||= { best: 0, done: 0, runs: 0, t: 0 });
  l.best = Math.max(l.best, score);
  if (score >= 80) l.done ||= Date.now();
  l.runs++;
  l.t = Date.now();
  touch();
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

/* ---------- conversations (Talk tab) ---------- */
export const talkId = (scenarioId) => "talk:" + scenarioId;

/** Record one learner message in a conversation; `turns` = learner turns so far in this chat. */
export function recordTalk(scenarioId, turns) {
  const l = (state.lessons[talkId(scenarioId)] ||= { best: 0, done: 0, runs: 0, t: 0 });
  l.best = Math.max(l.best, turns);
  if (turns >= TALK_DONE_TURNS) l.done ||= Date.now();
  l.runs++;
  l.t = Date.now();
  today().t = (today().t || 0) + 1;
  touch();
}

/** True when a lesson or conversation record was last updated today. */
export const isToday = (ms) => !!ms && dayKey(new Date(ms)) === dayKey();

/* ---------- phrasebook ---------- */
export const phraseKey = (zh) => "p:" + zh;

/** Saved phrases, newest first, shaped like sentences so exercises can use them. */
export function getPhrases() {
  return Object.entries(state.phrases)
    .filter(([, p]) => !p.x)
    .sort((a, b) => b[1].t - a[1].t)
    .map(([zh, p]) => ({ key: phraseKey(zh), text: zh, pinyin: p.py, en: p.en, phrase: true }));
}

export function savePhrase(zh, py, en) {
  zh = String(zh || "").trim();
  if (!zh || (state.phrases[zh] && !state.phrases[zh].x)) return false;
  state.phrases[zh] = { py: String(py || ""), en: String(en || ""), t: Date.now() };
  state.items[phraseKey(zh)] ||= { b: 0, d: dayNum(), c: 0, w: 0, t: Date.now() };
  // Oldest phrases make room for new ones.
  for (const old of getPhrases().slice(MAX_PHRASES)) dropPhrase(old.text);
  touch();
  return true;
}

function dropPhrase(zh) {
  state.phrases[zh] = { x: 1, t: Date.now() };
  delete state.items[phraseKey(zh)];
}
export function removePhrase(zh) {
  if (!state.phrases[zh] || state.phrases[zh].x) return;
  dropPhrase(zh);
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
  remote = clean(remote);
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
  const badges = { ...state.badges };
  for (const [k, t] of Object.entries(remote.badges)) badges[k] = Math.min(badges[k] || Infinity, t);
  const phrases = { ...state.phrases };
  for (const [k, p] of Object.entries(remote.phrases)) phrases[k] = newer(phrases[k], p);
  // A removed phrase takes its review record with it.
  for (const [k, p] of Object.entries(phrases)) if (p.x) delete items[phraseKey(k)];
  state = {
    v: 1,
    items,
    lessons,
    days,
    phrases,
    badges,
    xp: Math.max(state.xp, remote.xp),
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
export const GOALS = [100, 250, 500]; // XP per day
let settings = { speed: 0, autoSpeak: false, goal: 250, sfx: true };
export const dailyGoal = () => (GOALS.includes(settings.goal) ? settings.goal : 250);
export const todayStats = () => ({ n: 0, ok: 0, x: 0, s: 0, t: 0, o: 0, q: 0, ...state.days[dayKey()] });
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
