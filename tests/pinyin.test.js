import { test } from "node:test";
import assert from "node:assert/strict";
import { analyze, checkPinyin, looksLikePinyin, numbersToMarks, syllableSimilarity } from "../src/lib/pinyin.js";
import { PASS_SCORE, scoreSpeech } from "../src/lib/listen.js";

const tokens = [
  { hz: "我", py: "wǒ" },
  { hz: "不", py: "bú" },
  { hz: "是", py: "shì" },
];

test("checkPinyin accepts tone marks, tone numbers and no spaces", () => {
  assert.equal(checkPinyin("wǒ bú shì", tokens), "correct");
  assert.equal(checkPinyin("wo3 bu2 shi4", tokens), "correct");
  assert.equal(checkPinyin("Wo3bu2shi4!", tokens), "correct");
});

test("checkPinyin accepts the dictionary tone of 不 and 一", () => {
  assert.equal(checkPinyin("wo3 bu4 shi4", tokens), "correct");
  assert.equal(checkPinyin("yi1 ge", [{ hz: "一", py: "yí" }, { hz: "个", py: "ge" }]), "correct");
});

test("checkPinyin separates tone slips from wrong letters", () => {
  assert.equal(checkPinyin("wo bu shi", tokens), "tones");
  assert.equal(checkPinyin("wo3 bu2 si4", tokens), "wrong");
});

test("ü can be typed as v or u:", () => {
  const t = [{ hz: "女", py: "nǚ" }];
  assert.equal(checkPinyin("nv3", t), "correct");
  assert.equal(checkPinyin("nu:3", t), "correct");
  assert.deepEqual(analyze("lǜ"), { letters: "lv", tones: [4] });
});

test("numbersToMarks puts the mark on the right vowel", () => {
  assert.equal(numbersToMarks("ni3 hao3"), "nǐ hǎo");
  assert.equal(numbersToMarks("xue2 dui4 liu4 nv3 gou3"), "xué duì liù nǚ gǒu");
  assert.equal(numbersToMarks("ma5"), "ma");
});

test("looksLikePinyin tells pinyin from English", () => {
  assert.ok(looksLikePinyin("wǒ yào kāfēi"));
  assert.ok(looksLikePinyin("ni hao"));
  assert.ok(!looksLikePinyin("I want a coffee"));
  assert.ok(!looksLikePinyin(""));
});

test("syllableSimilarity is 1 for a match and drops per wrong syllable", () => {
  assert.equal(syllableSimilarity(["wo", "shi"], ["wo", "shi"]), 1);
  assert.equal(syllableSimilarity(["wo", "shi", "xue", "sheng"], ["wo", "si", "xue", "sheng"]), 0.75);
  assert.equal(syllableSimilarity([], ["wo"]), 0);
});

test("scoreSpeech passes homophones and ignores punctuation", async () => {
  // Recognisers often write 她 for 他; it sounds the same, so it must pass.
  assert.equal((await scoreSpeech(["她是我朋友"], "他是我朋友。")).score, 1);
  assert.equal((await scoreSpeech(["你 好 吗？"], "你好吗？")).score, 1);
});

test("scoreSpeech picks the best alternative and fails a different sentence", async () => {
  const r = await scoreSpeech(["我喜欢喝咖啡", "我喜欢喝茶"], "我喜欢喝茶。");
  assert.equal(r.heard, "我喜欢喝茶");
  assert.equal(r.score, 1);
  assert.ok((await scoreSpeech(["今天很冷"], "我喜欢喝茶。")).score < PASS_SCORE);
  assert.equal((await scoreSpeech([], "你好")).score, 0);
});
