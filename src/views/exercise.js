/* One sentence exercise. Renders into `root`, calls done(ok) when the learner
 * presses Continue. Returns a cleanup function.
 *
 * Types:
 *   meaning — see 汉字 + pinyin, choose the English
 *   pick    — see English, choose the right Chinese sentence
 *   build   — see English, tap word tiles into the right order
 *   listen  — hear the sentence, tap tiles into order
 *   type    — see 汉字 + English, type the pinyin with tones
 */
import { ALL_SENTENCES } from "../data/lessons.js";
import { checkPinyin, numbersToMarks } from "../lib/pinyin.js";
import { speak, canSpeak } from "../lib/speech.js";
import { esc, shuffle, sample, onKeys, SPEAKER } from "../lib/util.js";

export const EXERCISE_LABELS = {
  meaning: "What does this mean?",
  pick: "Choose the Chinese",
  build: "Build the sentence",
  listen: "Listen & build",
  type: "Type the pinyin",
};

function distractorSentences(s, pool, n, field) {
  const others = pool.filter((o) => o.key !== s.key && o[field] !== s[field]);
  let picks = sample(others, n);
  if (picks.length < n) {
    const extra = ALL_SENTENCES.filter(
      (o) => o.key !== s.key && o[field] !== s[field] && !picks.includes(o)
    );
    picks = picks.concat(sample(extra, n - picks.length));
  }
  return picks;
}

function distractorTiles(s, pool, n) {
  const used = new Set(s.words.map((w) => w.hz));
  const cands = [];
  const seen = new Set();
  for (const o of shuffle([...pool, ...sample(ALL_SENTENCES, 6)])) {
    for (const w of o.words) {
      if (!used.has(w.hz) && !seen.has(w.hz)) {
        seen.add(w.hz);
        cands.push(w);
      }
    }
  }
  return sample(cands, n);
}

const speakBtn = (text, cls = "") =>
  canSpeak()
    ? `<button class="icon-btn ${cls}" data-say="${esc(text)}" aria-label="Play audio">${SPEAKER}</button>`
    : "";

export function renderExercise(root, { type, s, pool = [] }, done) {
  root.innerHTML = `
    <div class="ex">
      <div class="ex-kind">${EXERCISE_LABELS[type]}</div>
      <div class="ex-body"></div>
      <div class="ex-foot"></div>
    </div>`;
  const body = root.querySelector(".ex-body");
  const foot = root.querySelector(".ex-foot");
  let answered = false;
  let offKeys = () => {};

  root.querySelector(".ex").addEventListener("click", (e) => {
    const say = e.target.closest("[data-say]");
    if (say) speak(say.dataset.say, say.dataset.rate ? Number(say.dataset.rate) : undefined);
  });

  function finish(ok, status = ok ? "correct" : "wrong", note = "") {
    if (answered) return;
    answered = true;
    root.querySelector(".ex").classList.add("answered", ok ? "is-ok" : "is-bad");
    const title = { correct: "Correct!", tones: "Almost — check the tones", wrong: "Not quite" }[status];
    foot.innerHTML = `
      <div class="feedback ${status}">
        <div class="fb-title">${status === "correct" ? "✓" : status === "tones" ? "≈" : "✗"} ${title}</div>
        ${note ? `<div class="fb-note">${note}</div>` : ""}
        <div class="fb-answer">
          <div class="fb-zh">${esc(s.text)} ${speakBtn(s.text)}</div>
          <div class="fb-py">${esc(s.pinyin)}</div>
          <div class="fb-en">${esc(s.en)}</div>
        </div>
        <button class="btn primary wide" data-continue>Continue ↵</button>
      </div>`;
    if (canSpeak()) speak(s.text);
    const cont = foot.querySelector("[data-continue]");
    cont.focus({ preventScroll: true });
    cont.scrollIntoView({ block: "nearest", behavior: "smooth" });
    let gone = false;
    const go = () => {
      if (gone) return;
      gone = true;
      offKeys();
      done(ok);
    };
    cont.addEventListener("click", go);
    offKeys();
    offKeys = onKeys((e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        go();
      }
    });
  }

  /* ---------- multiple choice ---------- */
  function choice(options, isRight, renderOpt) {
    const wrap = document.createElement("div");
    wrap.className = "options";
    options.forEach((o, i) => {
      const b = document.createElement("button");
      b.className = "option";
      b.innerHTML = `<span class="opt-key">${i + 1}</span>${renderOpt(o)}`;
      b.addEventListener("click", () => {
        if (answered) return;
        const ok = isRight(o);
        b.classList.add(ok ? "right" : "wrong");
        wrap.querySelectorAll(".option").forEach((x, j) => {
          x.disabled = true;
          if (isRight(options[j])) x.classList.add("right");
        });
        finish(ok);
      });
      wrap.appendChild(b);
    });
    body.appendChild(wrap);
    offKeys = onKeys((e) => {
      const n = Number(e.key);
      if (!answered && n >= 1 && n <= options.length) wrap.children[n - 1].click();
    });
  }

  if (type === "meaning") {
    body.innerHTML = `
      <div class="prompt-zh">${esc(s.text)}</div>
      <div class="prompt-py">${esc(s.pinyin)} ${speakBtn(s.text)}</div>`;
    const opts = shuffle([s, ...distractorSentences(s, pool, 3, "en")]);
    choice(opts, (o) => o.key === s.key, (o) => `<span>${esc(o.en)}</span>`);
  }

  if (type === "pick") {
    body.innerHTML = `<div class="prompt-en">“${esc(s.en)}”</div>`;
    const opts = shuffle([s, ...distractorSentences(s, pool, 3, "text")]);
    choice(
      opts,
      (o) => o.key === s.key,
      (o) => `<span class="opt-zh"><b>${esc(o.text)}</b><small>${esc(o.pinyin)}</small></span>`
    );
  }

  /* ---------- tile builder ---------- */
  if (type === "build" || type === "listen") {
    const listen = type === "listen";
    body.innerHTML = listen
      ? `<div class="listen-row">
           <button class="btn primary big-say" data-say="${esc(s.text)}">${SPEAKER} Play</button>
           <button class="btn ghost" data-say="${esc(s.text)}" data-rate="0.55">🐢 Slow</button>
         </div>`
      : `<div class="prompt-en">“${esc(s.en)}”</div>`;
    body.insertAdjacentHTML(
      "beforeend",
      `<div class="slots" aria-label="Your sentence"><span class="slots-hint">tap the words below in order</span></div>
       <div class="bank"></div>`
    );
    const slots = body.querySelector(".slots");
    const bank = body.querySelector(".bank");
    const tiles = shuffle([...s.words, ...distractorTiles(s, pool, Math.min(3, 1 + Math.floor(s.words.length / 3)))]);
    tiles.forEach((w) => {
      const t = document.createElement("button");
      t.className = "tile";
      t.dataset.hz = w.hz;
      t.innerHTML = `<span class="tile-py">${esc(w.py)}</span><span class="tile-hz">${esc(w.hz)}</span>`;
      t.addEventListener("click", () => {
        if (answered) return;
        (t.parentElement === bank ? slots : bank).appendChild(t);
        slots.classList.toggle("has-tiles", !!slots.querySelector(".tile"));
        check.disabled = !slots.querySelector(".tile");
      });
      bank.appendChild(t);
    });
    foot.innerHTML = `<button class="btn primary wide" disabled>Check ↵</button>`;
    const check = foot.querySelector("button");
    const doCheck = () => {
      if (answered || check.disabled) return;
      const built = [...slots.querySelectorAll(".tile")].map((t) => t.dataset.hz).join("");
      finish(s.answers.includes(built));
    };
    check.addEventListener("click", doCheck);
    offKeys = onKeys((e) => {
      if (e.key === "Enter" && !answered) {
        e.preventDefault();
        doCheck();
      }
    });
    if (listen) setTimeout(() => speak(s.text), 250);
  }

  /* ---------- type the pinyin ---------- */
  if (type === "type") {
    body.innerHTML = `
      <div class="prompt-zh">${esc(s.text)}</div>
      <div class="prompt-en small">“${esc(s.en)}”</div>
      <label class="type-label" for="pyInput">Type the pinyin — tone marks or numbers (ni3 hao3)</label>
      <input id="pyInput" class="py-input" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" inputmode="text" placeholder="wo3 shi4 …" />
      <div class="py-preview" aria-live="polite">&nbsp;</div>
      <div class="tone-keys">
        ${[1, 2, 3, 4].map((n) => `<button class="tone-key" data-ins="${n}">${n}<small>${["ˉ", "ˊ", "ˇ", "ˋ"][n - 1]}</small></button>`).join("")}
        <button class="tone-key" data-ins="v">ü</button>
      </div>`;
    const input = body.querySelector("input");
    const preview = body.querySelector(".py-preview");
    input.addEventListener("input", () => {
      preview.textContent = numbersToMarks(input.value) || " ";
    });
    body.querySelectorAll("[data-ins]").forEach((b) =>
      b.addEventListener("click", () => {
        const pos = input.selectionStart ?? input.value.length;
        input.value = input.value.slice(0, pos) + b.dataset.ins + input.value.slice(pos);
        input.dispatchEvent(new Event("input"));
        input.focus();
        input.setSelectionRange(pos + 1, pos + 1);
      })
    );
    foot.innerHTML = `<button class="btn primary wide">Check ↵</button>`;
    const doCheck = () => {
      if (answered || !input.value.trim()) return;
      input.disabled = true;
      const r = checkPinyin(input.value, s.words);
      const note =
        r === "tones"
          ? `You typed: <b>${esc(numbersToMarks(input.value))}</b>. The letters are right — the tones need work.`
          : r === "wrong"
            ? `You typed: <b>${esc(numbersToMarks(input.value))}</b>`
            : "";
      finish(r === "correct", r, note);
    };
    foot.querySelector("button").addEventListener("click", doCheck);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        doCheck();
      }
    });
    setTimeout(() => input.focus({ preventScroll: true }), 50);
  }

  return () => offKeys();
}
