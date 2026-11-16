import "./setup.js";
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import * as store from "../src/lib/store.js";

beforeEach(() => store.resetAll());

test("a correct review moves an item up a box and schedules it later", () => {
  store.review("s:我是学生", true);
  const it = store.getItem("s:我是学生");
  assert.equal(it.b, 1);
  assert.equal(it.d, store.dayNum() + store.INTERVALS[1]);
  assert.ok(!store.isDue(it));
});

test("a miss drops two boxes and makes the item due today", () => {
  for (let i = 0; i < 4; i++) store.review("w:你好", true);
  assert.ok(store.isMastered(store.getItem("w:你好")));
  store.review("w:你好", false);
  const it = store.getItem("w:你好");
  assert.equal(it.b, 2);
  assert.ok(store.isDue(it));
  assert.equal(store.summarize("w:").due, 1);
});

test("answers count toward today and the streak", () => {
  assert.equal(store.streak(), 0);
  store.logAnswer(true);
  store.logAnswer(false);
  const today = store.lastDays(1)[0];
  assert.deepEqual([today.n, today.ok], [2, 1]);
  assert.equal(store.streak(), 1);
  assert.equal(store.bestStreak(), 1);
});

test("completeLesson keeps the best score and the first completion time", () => {
  store.completeLesson("l01", 80);
  const first = store.getState().lessons.l01.done;
  store.completeLesson("l01", 60);
  const l = store.getState().lessons.l01;
  assert.deepEqual([l.best, l.runs, l.done], [80, 2, first]);
});

test("a conversation is done after enough learner turns", () => {
  for (let n = 1; n < store.TALK_DONE_TURNS; n++) store.recordTalk("cafe", n);
  assert.ok(!store.getState().lessons[store.talkId("cafe")].done);
  store.recordTalk("cafe", store.TALK_DONE_TURNS);
  const l = store.getState().lessons[store.talkId("cafe")];
  assert.ok(l.done);
  assert.equal(l.best, store.TALK_DONE_TURNS);
  assert.ok(store.isToday(l.t));
});

test("phrases are saved once, reviewed like sentences and removable", () => {
  assert.equal(store.savePhrase("我想要一杯咖啡", "wǒ xiǎng yào yì bēi kāfēi", "I'd like a coffee"), true);
  assert.equal(store.savePhrase("我想要一杯咖啡", "", ""), false);
  const [p] = store.getPhrases();
  assert.deepEqual([p.key, p.text, p.en], ["p:我想要一杯咖啡", "我想要一杯咖啡", "I'd like a coffee"]);
  assert.ok(store.getItem(p.key));
  store.removePhrase(p.text);
  assert.equal(store.getPhrases().length, 0);
  assert.equal(store.getItem(p.key), undefined);
});

test("the phrasebook is capped, dropping the oldest", () => {
  for (let i = 0; i < store.MAX_PHRASES + 5; i++) {
    store.getState().phrases["旧" + i] = { py: "", en: "", t: i + 1 };
  }
  store.savePhrase("新", "xīn", "new");
  const all = store.getPhrases();
  assert.equal(all.length, store.MAX_PHRASES);
  assert.equal(all[0].text, "新");
  assert.ok(!all.some((p) => p.text === "旧0"));
});

test("mergeIn keeps the newer item, the best lesson score and the busier day", () => {
  store.review("w:茶", true);
  store.completeLesson("l01", 70);
  const local = store.getItem("w:茶");
  const changed = store.mergeIn({
    v: 1,
    items: {
      "w:茶": { b: 5, d: 99999, c: 9, w: 0, t: local.t + 1000 },
      "w:水": { b: 1, d: 1, c: 1, w: 0, t: 5 },
    },
    lessons: { l01: { best: 90, done: 1, runs: 1, t: 1 } },
    days: { "2026-01-01": { n: 12, ok: 10 } },
    phrases: { 你好: { py: "nǐ hǎo", en: "hello", t: 5 } },
    updatedAt: 1,
  });
  assert.equal(changed, true);
  assert.equal(store.getItem("w:茶").b, 5);
  assert.ok(store.getItem("w:水"));
  const l = store.getState().lessons.l01;
  assert.deepEqual([l.best, l.done, l.runs], [90, 1, 1]);
  assert.equal(store.getState().days["2026-01-01"].n, 12);
  assert.equal(store.getPhrases()[0].text, "你好");
});

test("a phrase removed on one device stays removed after a merge", () => {
  store.savePhrase("再见", "zàijiàn", "goodbye");
  const t = store.getState().phrases["再见"].t;
  store.mergeIn({ v: 1, items: {}, lessons: {}, days: {}, phrases: { 再见: { x: 1, t: t + 1000 } }, updatedAt: 1 });
  assert.equal(store.getPhrases().length, 0);
  assert.equal(store.getItem("p:再见"), undefined);
});

test("mergeIn rejects other versions and drops malformed records", () => {
  assert.equal(store.mergeIn({ v: 2, items: {} }), false);
  assert.equal(store.mergeIn(null), false);
  store.mergeIn({
    v: 1,
    items: { "w:好": { b: 99, d: "x", c: null, w: 1, t: 10 }, junk: { b: 1 }, "w:坏": "nope" },
    lessons: { l02: null },
    days: { yesterday: { n: 5, ok: 5 } },
    phrases: "nope",
  });
  const it = store.getItem("w:好");
  assert.deepEqual(it, { b: store.INTERVALS.length - 1, d: 0, c: 0, w: 1, t: 10 });
  assert.equal(store.getItem("junk"), undefined);
  assert.equal(store.getItem("w:坏"), undefined);
  assert.deepEqual(store.getState().lessons, {});
  assert.deepEqual(store.getState().days, {});
});
