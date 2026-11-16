import "./setup.js";
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import * as store from "../src/lib/store.js";
import { BADGES, counts, levelFor, questsFor } from "../src/lib/game.js";
import { classifyTone, detectPitch, toContour } from "../src/lib/pitch.js";
import { LESSONS, UNITS } from "../src/data/lessons.js";
import { SCENARIOS } from "../src/data/scenarios.js";
import { PAIRS, SOUNDS, SYLLABLES } from "../src/data/tones.js";
import { analyze } from "../src/lib/pinyin.js";

beforeEach(() => store.resetAll());

test("answers earn XP: more for right than wrong, and it adds up per day", () => {
  store.logAnswer(true);
  store.logAnswer(false);
  store.review("w:茶", true, { xp: store.XP.card });
  store.logAnswer(true, { xp: store.XP.talk });
  const want = store.XP.right + store.XP.wrong + store.XP.card + store.XP.talk;
  assert.equal(store.getState().xp, want);
  assert.equal(store.todayStats().x, want);
  store.addXp(30);
  assert.equal(store.getState().xp, want + 30);
});

test("spoken, tone and talk answers are counted for quests", () => {
  store.logAnswer(true, { spoken: true });
  store.logAnswer(false, { spoken: true }); // a miss isn't "said aloud"
  store.logAnswer(true, { tone: true });
  store.recordTalk("cafe", 1);
  const d = store.todayStats();
  assert.deepEqual([d.s, d.o, d.t], [1, 1, 1]);
});

test("levels start at 1 and need more XP each time", () => {
  assert.equal(levelFor(0).level, 1);
  assert.equal(levelFor(99).level, 1);
  assert.equal(levelFor(100).level, 2);
  assert.equal(levelFor(400).level, 3);
  const l = levelFor(250);
  assert.deepEqual([l.level, l.into, l.need, l.pct], [2, 150, 300, 50]);
  assert.ok(levelFor(1e6).title);
});

test("daily quests: the goal plus two others, stable for a day, rewarded once", () => {
  const a = questsFor("2026-11-16");
  assert.equal(a.length, 3);
  assert.equal(a[0].id, "goal");
  assert.equal(new Set(a.map((q) => q.id)).size, 3);
  assert.deepEqual(a.map((q) => q.id), questsFor("2026-11-16").map((q) => q.id));
  const seen = new Set();
  for (let d = 1; d <= 28; d++) questsFor(`2026-02-${String(d).padStart(2, "0")}`).forEach((q) => seen.add(q.id));
  assert.equal(seen.size, 6); // every quest comes up within a month
  const before = store.getState().xp;
  assert.equal(store.claimQuest(1), true);
  assert.equal(store.claimQuest(1), false);
  assert.equal(store.getState().xp, before + store.XP.questBonus);
  assert.ok(questsFor().find((q) => q.id === "goal").claimed);
});

test("the goal quest follows today's XP", () => {
  const goal = store.dailyGoal();
  assert.equal(questsFor()[0].done, false);
  store.addXp(goal);
  const q = questsFor()[0];
  assert.deepEqual([q.have, q.done], [goal, true]);
});

test("badges unlock from progress", () => {
  const earned = () => BADGES.filter((b) => b.test(counts(), store.getState())).map((b) => b.id);
  assert.deepEqual(earned(), []);
  store.completeLesson("l01", 95);
  for (let n = 1; n <= store.TALK_DONE_TURNS; n++) store.recordTalk("hello", n);
  store.recordDrill("ear", 90);
  assert.deepEqual(earned().sort(), ["first-chat", "first-lesson", "perfect", "tones"]);
  assert.equal(store.awardBadge("first-lesson"), true);
  assert.equal(store.awardBadge("first-lesson"), false);
  assert.equal(new Set(BADGES.map((b) => b.id)).size, BADGES.length);
});

test("XP, badges and day counters survive a merge", () => {
  store.addXp(50);
  store.mergeIn({
    v: 1, items: {}, lessons: {}, phrases: {}, updatedAt: 1, xp: 900,
    days: { "2026-01-01": { n: 12, ok: 10, x: 110, s: 3, q: 1 } },
    badges: { "first-lesson": 123, bogus: "x" },
  });
  const s = store.getState();
  assert.equal(s.xp, 900);
  assert.deepEqual(s.days["2026-01-01"], { n: 12, ok: 10, x: 110, s: 3, q: 1 });
  assert.deepEqual(s.badges, { "first-lesson": 123 });
});

test("course data: units cover every lesson, scenarios point at real lessons", () => {
  assert.equal(UNITS.flatMap((u) => u.lessons).length, LESSONS.length);
  assert.ok(UNITS.every((u) => u.lessons.length === 5));
  const ids = new Set(LESSONS.map((l) => l.id));
  assert.ok(SCENARIOS.every((sc) => ids.has(sc.after) && sc.cando && sc.opener.zh));
  assert.equal(new Set(SCENARIOS.map((sc) => sc.id)).size, SCENARIOS.length);
  assert.equal(new Set(SCENARIOS.map((sc) => sc.after)).size, SCENARIOS.length);
});

test("tone data: the stated tones match the pinyin", () => {
  for (const s of SYLLABLES) assert.deepEqual(analyze(s.py).tones, [s.tone], s.hz);
  for (const p of PAIRS) assert.deepEqual(analyze(p.py).tones, p.tones, p.hz);
  for (const p of SOUNDS) assert.notEqual(p.a.py, p.b.py);
  assert.equal(new Set(SYLLABLES.map((s) => s.hz)).size, SYLLABLES.length);
});

/* ---------- pitch ---------- */
const RATE = 48000;
function tone(hz, { n = 2048, amp = 0.3, harmonics = true } = {}) {
  const buf = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = (2 * Math.PI * hz * i) / RATE;
    buf[i] = amp * (Math.sin(t) + (harmonics ? 0.5 * Math.sin(2 * t) + 0.25 * Math.sin(3 * t) : 0));
  }
  return buf;
}

test("detectPitch finds the pitch of voiced sound across speaking range", () => {
  for (const hz of [95, 130, 180, 220, 310, 400]) {
    const got = detectPitch(tone(hz), RATE);
    assert.ok(Math.abs(got - hz) / hz < 0.02, `${hz} Hz detected as ${got}`);
  }
});

test("detectPitch ignores silence and noise", () => {
  assert.equal(detectPitch(new Float32Array(2048), RATE), null);
  assert.equal(detectPitch(tone(200, { amp: 0.002 }), RATE), null);
  let seed = 1;
  const noise = Float32Array.from({ length: 2048 }, () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 0.6);
  assert.equal(detectPitch(noise, RATE), null);
});

const glide = (points, frames = 30, base = 200) =>
  Array.from({ length: frames }, (_, i) => {
    const x = (i / (frames - 1)) * (points.length - 1);
    const a = Math.floor(x), b = Math.min(points.length - 1, a + 1);
    return base * 2 ** ((points[a] + (points[b] - points[a]) * (x - a)) / 12);
  });

test("classifyTone recognises the four tone shapes, for low and high voices", () => {
  const shapes = { 1: [0, 0, 0], 2: [-3, 0, 4], 3: [0, -5, -1], 4: [5, 0, -6] };
  for (const base of [110, 240]) {
    for (const [want, pts] of Object.entries(shapes)) {
      const got = classifyTone(toContour([null, null, ...glide(pts, 30, base), null]));
      assert.equal(got.tone, Number(want), `tone ${want} at ${base} Hz`);
    }
  }
  // The everyday low, sinking 3rd tone with no final rise still reads as 3.
  assert.equal(classifyTone(toContour(glide([0, -1.5, -3]))).tone, 3);
});

test("toContour needs enough voiced sound and drops octave glitches", () => {
  assert.deepEqual(toContour([null, 200, 201, null]), []);
  assert.equal(classifyTone([]), null);
  const frames = glide([0, 0, 0]);
  frames[10] = 400; // an octave error mid-syllable
  const c = toContour(frames);
  assert.ok(c.length >= 20 && Math.max(...c.map(Math.abs)) < 1);
});
