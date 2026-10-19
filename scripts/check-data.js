/* Sanity checks for vocab + lessons: run with `npm run check-data`. */
import { VOCAB, VOCAB_BY_HZ } from "../src/data/vocab.js";
import { LESSONS } from "../src/data/lessons.js";
import { checkPinyin } from "../src/lib/pinyin.js";

let problems = 0;
const warn = (msg) => {
  problems++;
  console.log("✗", msg);
};

const seen = new Set();
for (const v of VOCAB) {
  if (seen.has(v.hz)) warn(`duplicate vocab hanzi: ${v.hz}`);
  seen.add(v.hz);
  if (v.hz !== "太...了" && checkPinyin(v.plain, [{ hz: v.hz, py: v.py }]) !== "correct")
    warn(`vocab tone mismatch: ${v.hz} "${v.py}" vs "${v.plain}"`);
}

const keys = new Set();
for (const l of LESSONS) {
  for (const s of l.sentences) {
    const [a, b] = s._rawCounts;
    if (a !== b) warn(`${s.id} tile count mismatch (${a} hanzi vs ${b} pinyin): ${s.text}`);
    if (keys.has(s.key)) warn(`duplicate sentence: ${s.text}`);
    keys.add(s.key);
    if (s.words.length < 2) warn(`${s.id} needs at least 2 tiles`);
    for (const alt of s.answers.slice(1)) {
      if ([...alt].sort().join("") !== [...s.answers[0]].sort().join(""))
        warn(`${s.id} alt uses different characters: ${alt}`);
    }
    if (checkPinyin(s.pinyin, s.words) !== "correct") warn(`${s.id} pinyin self-check failed`);
    const unknown = s.words.filter((w) => !VOCAB_BY_HZ.has(w.hz)).map((w) => w.hz);
    if (unknown.length) console.log(`  ${s.id} words not in vocab (ok for names): ${unknown.join(" ")}`);
  }
}

// pinyin checker behaviour
const t = [{ hz: "我", py: "wǒ" }, { hz: "不", py: "bú" }, { hz: "是", py: "shì" }];
const cases = [
  ["wo3 bu2 shi4", "correct"],
  ["wǒ bú shì", "correct"],
  ["wo3bu4shi4", "correct"], // dictionary tone for 不 accepted
  ["wo bu shi", "tones"],
  ["wo3 bu2 si4", "wrong"],
];
for (const [input, want] of cases) {
  const got = checkPinyin(input, t);
  if (got !== want) warn(`checkPinyin("${input}") = ${got}, want ${want}`);
}

console.log(`\n${VOCAB.length} words, ${keys.size} sentences in ${LESSONS.length} lessons — ${problems ? problems + " problem(s)" : "all good"}`);
process.exit(problems ? 1 : 0);
