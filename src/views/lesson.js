/* A single lesson: pattern intro → drill queue → results. */
import { LESSON_BY_ID, LESSONS } from "../data/lessons.js";
import { VOCAB_BY_HZ } from "../data/vocab.js";
import { completeLesson, getState, logAnswer, markSeen, review } from "../lib/store.js";
import { canSpeak, speak, stopSpeaking } from "../lib/speech.js";
import { esc, shuffle, SPEAKER } from "../lib/util.js";
import { renderExercise } from "./exercise.js";

function plan(lesson) {
  const ss = lesson.sentences;
  const q = [];
  // Round 1: understand every sentence. Round 2: build every sentence.
  ss.forEach((s) => q.push({ type: "meaning", s }));
  shuffle([...ss]).forEach((s) => q.push({ type: "build", s }));
  // Round 3: harder recall on half of them.
  const hard = shuffle(canSpeak() ? ["type", "listen", "pick"] : ["type", "pick", "type"]);
  shuffle([...ss])
    .slice(0, Math.ceil(ss.length / 2))
    .forEach((s, i) => q.push({ type: hard[i % hard.length], s }));
  return q.map((x) => ({ ...x, pool: ss }));
}

function keyWords(lesson) {
  const seen = new Set();
  const out = [];
  for (const s of lesson.sentences)
    for (const w of s.words) {
      const v = VOCAB_BY_HZ.get(w.hz);
      if (v && !seen.has(w.hz)) {
        seen.add(w.hz);
        out.push({ hz: w.hz, py: w.py, en: v.en, key: v.key });
      }
    }
  return out;
}

export function mount(root, id) {
  const lesson = LESSON_BY_ID.get(id);
  if (!lesson) {
    root.innerHTML = `<p>Lesson not found. <a href="#/learn">Back to the path</a></p>`;
    return;
  }
  let cleanupEx = () => {};
  const onSay = (e) => {
    const b = e.target.closest("[data-say]");
    if (b && !b.closest(".ex")) speak(b.dataset.say);
  };
  root.addEventListener("click", onSay);

  function intro() {
    const words = keyWords(lesson);
    const rec = getState().lessons[lesson.id];
    const total = plan(lesson).length;
    root.innerHTML = `
      <a class="back-link" href="#/learn">← Sentence path</a>
      <div class="lesson-head">
        <div class="lesson-kicker">Lesson ${lesson.n} of ${LESSONS.length}${rec?.done ? ` · best ${rec.best}%` : ""}</div>
        <h2>${esc(lesson.title)}</h2>
      </div>
      <div class="pattern-card">
        <div class="pattern-zh">${esc(lesson.pattern.zh)}</div>
        <div class="pattern-py">${esc(lesson.pattern.py)}</div>
        <div class="pattern-en">${esc(lesson.pattern.en)}</div>
        <p class="pattern-note">${esc(lesson.note)}</p>
      </div>

      <h3 class="section-title">Example sentences</h3>
      <ul class="examples">
        ${lesson.sentences
          .map(
            (s) => `
          <li>
            ${canSpeak() ? `<button class="icon-btn" data-say="${esc(s.text)}" aria-label="Play">${SPEAKER}</button>` : ""}
            <div>
              <div class="ex-zh">${s.tokens.map((t) => `<ruby>${esc(t.hz)}<rt>${t.hz === "，" ? "" : esc(t.py)}</rt></ruby>`).join("")}${esc(s.text.slice(-1))}</div>
              <div class="ex-en">${esc(s.en)}</div>
            </div>
          </li>`
          )
          .join("")}
      </ul>

      <h3 class="section-title">Key words</h3>
      <div class="word-grid">
        ${words
          .map(
            (w) => `
          <button class="word-chip" data-say="${esc(w.hz)}">
            <b>${esc(w.hz)}</b><span>${esc(w.py)}</span><small>${esc(w.en)}</small>
          </button>`
          )
          .join("")}
      </div>

      <div class="sticky-cta">
        <button class="btn primary wide" id="startBtn">Start practice · ${total} exercises</button>
      </div>`;
    root.querySelector("#startBtn").addEventListener("click", () => {
      words.forEach((w) => markSeen(w.key));
      drill();
    });
  }

  function drill() {
    const queue = plan(lesson);
    const total = queue.length;
    let doneCount = 0;
    let firstTryRight = 0;
    const missed = new Set();

    root.innerHTML = `
      <div class="drill-top">
        <button class="icon-btn" id="quitBtn" aria-label="Quit lesson">✕</button>
        <div class="progress-track"><div class="progress-fill" id="drillFill"></div></div>
        <span class="drill-count" id="drillCount"></span>
      </div>
      <div id="exRoot"></div>`;
    const exRoot = root.querySelector("#exRoot");
    root.querySelector("#quitBtn").addEventListener("click", () => {
      if (confirm("Quit this lesson? Progress in this run won't be saved.")) location.hash = "#/learn";
    });

    function next() {
      cleanupEx();
      root.querySelector("#drillFill").style.width = (doneCount / total) * 100 + "%";
      root.querySelector("#drillCount").textContent = `${Math.min(doneCount + 1, total)}/${total}`;
      const ex = queue.shift();
      if (!ex) return results(Math.round((firstTryRight / total) * 100), missed);
      window.scrollTo({ top: 0 });
      cleanupEx = renderExercise(exRoot, ex, (ok) => {
        logAnswer(ok);
        if (!ex.retry) {
          doneCount++;
          if (ok) firstTryRight++;
        }
        if (!ok) {
          missed.add(ex.s.key);
          // Missed exercises come back once at the end of the queue.
          if (!ex.retry) queue.push({ ...ex, retry: true });
        }
        next();
      }) || (() => {});
    }
    next();
  }

  function results(score, missed) {
    cleanupEx();
    completeLesson(lesson.id, score);
    // One SRS update per sentence: clean run → box up, any miss → review soon.
    lesson.sentences.forEach((s) => review(s.key, !missed.has(s.key), { log: false }));
    const nextL = LESSONS[lesson.n] || null;
    const stars = score >= 90 ? 3 : score >= 70 ? 2 : 1;
    root.innerHTML = `
      <div class="results">
        <div class="seal big">${["", "好", "很好", "太棒"][stars]}</div>
        <h2>Lesson ${lesson.n} complete</h2>
        <div class="score">${score}%</div>
        <p>${"★".repeat(stars)}${"☆".repeat(3 - stars)} · first-try accuracy</p>
        ${
          missed.size
            ? `<p class="muted">${missed.size} sentence${missed.size > 1 ? "s" : ""} will come back in Practice today.</p>`
            : `<p class="muted">Flawless — these sentences return for review in a day.</p>`
        }
        <div class="cta-row center">
          ${nextL ? `<a class="btn primary" href="#/lesson/${nextL.id}">Next: ${esc(nextL.title)} →</a>` : `<a class="btn primary" href="#/practice">Review sentences →</a>`}
          <button class="btn" id="againBtn">Practice again</button>
          <a class="btn ghost" href="#/learn">Path</a>
        </div>
      </div>`;
    root.querySelector("#againBtn").addEventListener("click", drill);
  }

  intro();
  return () => {
    cleanupEx();
    stopSpeaking();
    root.removeEventListener("click", onSay);
  };
}
