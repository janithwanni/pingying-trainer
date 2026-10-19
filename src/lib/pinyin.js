/* Pinyin answer checking.
 * Accepts tone marks (nǐ hǎo), tone numbers (ni3 hao3) or a mix. Spaces,
 * apostrophes and punctuation are ignored; ü can be typed as v or u:.
 * Neutral tones (5 / 0 / unmarked) are ignored on both sides.
 */
const MARKS = {
  ā: ["a", 1], á: ["a", 2], ǎ: ["a", 3], à: ["a", 4],
  ē: ["e", 1], é: ["e", 2], ě: ["e", 3], è: ["e", 4],
  ī: ["i", 1], í: ["i", 2], ǐ: ["i", 3], ì: ["i", 4],
  ō: ["o", 1], ó: ["o", 2], ǒ: ["o", 3], ò: ["o", 4],
  ū: ["u", 1], ú: ["u", 2], ǔ: ["u", 3], ù: ["u", 4],
  ǖ: ["v", 1], ǘ: ["v", 2], ǚ: ["v", 3], ǜ: ["v", 4],
  ü: ["v", 0],
};

export function analyze(str) {
  const s = str.normalize("NFC").toLowerCase().replace(/u:/g, "v");
  let letters = "";
  const tones = [];
  for (const ch of s) {
    const m = MARKS[ch];
    if (m) {
      letters += m[0];
      if (m[1]) tones.push(m[1]);
    } else if (ch >= "a" && ch <= "z") {
      letters += ch;
    } else if (ch >= "1" && ch <= "4") {
      tones.push(Number(ch));
    }
  }
  return { letters, tones };
}

/* Tone sequence for a sentence, plus a variant that uses the dictionary
 * tones of 不 (bù) and 一 (yī) so learners who ignore tone sandhi still pass. */
function targetTones(tokens) {
  const strict = [];
  const citation = [];
  for (const t of tokens) {
    const tones = analyze(t.py).tones;
    strict.push(...tones);
    const first = t.hz[0];
    if (tones.length && (first === "不" || first === "一")) {
      citation.push(first === "不" ? 4 : 1, ...tones.slice(1));
    } else citation.push(...tones);
  }
  return [strict, citation];
}

const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

/** @returns {"correct" | "tones" | "wrong"} */
export function checkPinyin(input, tokens) {
  const user = analyze(input);
  const target = analyze(tokens.map((t) => t.py).join(" "));
  if (user.letters !== target.letters) return "wrong";
  const [strict, citation] = targetTones(tokens);
  if (same(user.tones, strict) || same(user.tones, citation)) return "correct";
  return "tones";
}

/* Convert "ni3 hao3" style input to tone marks for live preview. */
const VOWEL_MARKS = {
  a: "āáǎà", e: "ēéěè", i: "īíǐì", o: "ōóǒò", u: "ūúǔù", v: "ǖǘǚǜ",
};
function markSyllable(syl, tone) {
  const s = syl.replace(/u:/g, "v");
  if (!tone || tone === 5 || tone === 0) return s.replace(/v/g, "ü");
  let idx = -1;
  if (/[ae]/.test(s)) idx = s.search(/[ae]/);
  else if (s.includes("ou")) idx = s.indexOf("o");
  else {
    for (let i = s.length - 1; i >= 0; i--) {
      if ("aeiouv".includes(s[i])) {
        idx = i;
        break;
      }
    }
  }
  if (idx < 0) return s;
  const marked = VOWEL_MARKS[s[idx]][tone - 1];
  return (s.slice(0, idx) + marked + s.slice(idx + 1)).replace(/v/g, "ü");
}

export function numbersToMarks(str) {
  return str.replace(/([a-zA-Zü:]+)([0-5])/g, (_, syl, t) => markSyllable(syl, Number(t)));
}
