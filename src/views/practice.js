/* Practice tab — spaced-repetition review of sentences from lessons you've started. */
import { ALL_SENTENCES, LESSON_BY_ID } from "../data/lessons.js";
import { dayNum, getState, review, summarize } from "../lib/store.js";
import { canSpeak, stopSpeaking } from "../lib/speech.js";
import { pickOne, sample, esc } from "../lib/util.js";
import { renderExercise } from "./exercise.js";

const SESSION = 10;

function learnedSentences() {
  const { items } = getState();
  return ALL_SENTENCES.filter((s) => items[s.key]);
}

function dueSentences() {
  const { items } = getState();
  const today = dayNum();
  return learnedSentences()
    .filter((s) => items[s.key].d <= today)
    .sort((a, b) => items[a.key].d - items[b.key].d || items[a.key].b - items[b.key].b);
}

function weakSentences() {
  const { items } = getState();
  return learnedSentences()
    .filter((s) => items[s.key].w > 0)
    .sort((a, b) => items[b.key].w / (items[b.key].c + 1) - items[a.key].w / (items[a.key].c + 1));
}

export function mount(root) {
  let cleanupEx = () => {};

  function home() {
    const learned = learnedSentences();
    const due = dueSentences();
    const weak = weakSentences();
    const sum = summarize("s:");
    root.innerHTML = `
      <div class="lesson-head">
        <div class="lesson-kicker">Spaced repetition</div>
        <h2>Sentence practice</h2>
      </div>
      ${
        learned.length === 0
          ? `<div class="empty">
               <p>Sentences show up here after you finish a lesson.</p>
               <a class="btn primary" href="#/lesson/l01">Start Lesson 1 →</a>
             </div>`
          : `<div class="practice-grid">
               <button class="practice-card ${due.length ? "primary" : ""}" data-mode="due" ${due.length ? "" : "disabled"}>
                 <span class="pc-num">${due.length}</span>
                 <span class="pc-title">Due now</span>
                 <span class="pc-sub">${due.length ? `review ${Math.min(SESSION, due.length)} sentences` : "all caught up 🎉"}</span>
               </button>
               <button class="practice-card" data-mode="mix">
                 <span class="pc-num">${learned.length}</span>
                 <span class="pc-title">Mixed review</span>
                 <span class="pc-sub">${Math.min(SESSION, learned.length)} random learned sentences</span>
               </button>
               <button class="practice-card" data-mode="weak" ${weak.length ? "" : "disabled"}>
                 <span class="pc-num">${weak.length}</span>
                 <span class="pc-title">Trouble spots</span>
                 <span class="pc-sub">${weak.length ? "sentences you've missed before" : "none yet"}</span>
               </button>
             </div>
             <p class="muted">${sum.mastered} mastered · ${sum.learning} learning · ${sum.seen - sum.mastered - sum.learning} new.
             Each correct review pushes a sentence further out (1 → 2 → 4 → 7 → 15 → 30 days); a miss brings it back today.</p>`
      }`;
    root.querySelectorAll("[data-mode]").forEach((b) =>
      b.addEventListener("click", () => {
        const mode = b.dataset.mode;
        const set =
          mode === "due" ? due.slice(0, SESSION) : mode === "weak" ? weak.slice(0, SESSION) : sample(learned, SESSION);
        run(set);
      })
    );
  }

  function run(set) {
    const types = canSpeak() ? ["build", "build", "type", "listen", "pick", "meaning"] : ["build", "build", "type", "pick", "meaning"];
    const queue = set.map((s) => {
      const pool = LESSON_BY_ID.get(s.lessonId).sentences;
      return { type: pickOne(types), s, pool };
    });
    const total = queue.length;
    let n = 0;
    let right = 0;
    const missed = [];
    root.innerHTML = `
      <div class="drill-top">
        <button class="icon-btn" id="quitBtn" aria-label="End session">✕</button>
        <div class="progress-track"><div class="progress-fill" id="drillFill"></div></div>
        <span class="drill-count" id="drillCount"></span>
      </div>
      <div id="exRoot"></div>`;
    root.querySelector("#quitBtn").addEventListener("click", () => {
      cleanupEx();
      home();
    });
    const exRoot = root.querySelector("#exRoot");
    function next() {
      cleanupEx();
      root.querySelector("#drillFill").style.width = (n / total) * 100 + "%";
      root.querySelector("#drillCount").textContent = `${Math.min(n + 1, total)}/${total}`;
      const ex = queue.shift();
      if (!ex) return done();
      window.scrollTo({ top: 0 });
      cleanupEx = renderExercise(exRoot, ex, (ok) => {
        review(ex.s.key, ok);
        n++;
        if (ok) right++;
        else missed.push(ex.s);
        next();
      }) || (() => {});
    }
    function done() {
      root.innerHTML = `
        <div class="results">
          <h2>Session done</h2>
          <div class="score">${right}/${total}</div>
          ${
            missed.length
              ? `<p class="muted">To revisit:</p><ul class="missed">${missed.map((s) => `<li><b>${esc(s.text)}</b> ${esc(s.pinyin)} — ${esc(s.en)}</li>`).join("")}</ul>`
              : `<p class="muted">Perfect round.</p>`
          }
          <div class="cta-row center">
            <button class="btn primary" id="homeBtn">Back to practice</button>
            <a class="btn" href="#/learn">Lesson path</a>
          </div>
        </div>`;
      root.querySelector("#homeBtn").addEventListener("click", home);
    }
    next();
  }

  home();
  return () => {
    cleanupEx();
    stopSpeaking();
  };
}
