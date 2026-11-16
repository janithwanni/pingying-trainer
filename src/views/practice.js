/* Practice tab — spaced-repetition review of sentences from lessons you've
 * started, plus the phrases saved from Talk. `#/practice/due` starts the due
 * review straight away (used by the daily plan). */
import { ALL_SENTENCES, LESSON_BY_ID } from "../data/lessons.js";
import { VOCAB } from "../data/vocab.js";
import { XP, dayNum, getPhrases, getState, removePhrase, review, summarize } from "../lib/store.js";
import { confetti, sound } from "../lib/fx.js";
import { bao } from "../lib/mascot.js";
import { createDrill, endFocus, resultsHtml } from "./drill.js";
import { canSpeak, stopSpeaking } from "../lib/speech.js";
import { pickOne, sample, esc } from "../lib/util.js";
import { renderExercise, SPOKEN } from "./exercise.js";

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

/* Phrases saved from Talk: due ones first, then the newest. */
function phraseQueue() {
  const { items } = getState();
  const today = dayNum();
  const all = getPhrases();
  const due = all.filter((p) => (items[p.key]?.d ?? 0) <= today);
  return { all, due, set: [...due, ...all.filter((p) => !due.includes(p))].slice(0, SESSION) };
}

export function mount(root, arg) {
  let cleanupEx = () => {};

  function home() {
    endFocus();
    const learned = learnedSentences();
    const due = dueSentences();
    const weak = weakSentences();
    const sum = summarize("s:");
    const wDue = summarize("w:").due;
    const phrases = phraseQueue();
    const card = ({ mode, href, ico, title, sub, tag = "", hot = false, off = false }) =>
      href
        ? `<a class="drill-card ${hot ? "hot" : ""}" href="${href}"><span class="drill-ico" aria-hidden="true">${ico}</span><span class="drill-main"><b>${title}</b><small>${sub}</small></span>${tag}</a>`
        : `<button class="drill-card ${hot ? "hot" : ""}" data-mode="${mode}" ${off ? "disabled" : ""}><span class="drill-ico" aria-hidden="true">${ico}</span><span class="drill-main"><b>${title}</b><small>${sub}</small></span>${tag}</button>`;
    const count = (n, cls = "ready") => (n ? `<span class="scene-tag ${cls}">${n}</span>` : "");
    root.innerHTML = `
      <div class="hero-row">
        <div class="hero-bao">${bao(due.length ? "think" : "happy", 84)}</div>
        <div class="lesson-head">
          <div class="lesson-kicker">Practice</div>
          <h2>${due.length ? `${due.length} sentence${due.length > 1 ? "s are" : " is"} fading` : "The gym"}</h2>
          <p class="muted">${due.length ? "A quick review now keeps them for good." : "Keep what you've learned, and sharpen your ear and your tones."}</p>
        </div>
      </div>

      <h3 class="section-title">Sentences</h3>
      <div class="drill-grid">
        ${card({ mode: "due", ico: "⏰", title: "Review", sub: due.length ? `${Math.min(SESSION, due.length)} sentences that are due` : learned.length ? "All caught up 🎉" : "Finish a lesson first", tag: count(due.length), hot: due.length > 0, off: !due.length })}
        ${card({ mode: "mix", ico: "🎲", title: "Mixed bag", sub: learned.length ? `${Math.min(SESSION, learned.length)} random sentences you know` : "Finish a lesson first", off: !learned.length })}
        ${card({ mode: "weak", ico: "🩹", title: "Trouble spots", sub: weak.length ? "Sentences you've missed before" : "None yet", tag: count(weak.length, ""), off: !weak.length })}
        ${card({ mode: "phrases", ico: "📒", title: "My phrases", sub: phrases.all.length ? `Say them aloud · ${phrases.due.length} due` : "Saved from your Talk chats", tag: count(phrases.all.length, ""), off: !phrases.all.length })}
      </div>

      <h3 class="section-title">Skills</h3>
      <div class="drill-grid">
        ${card({ href: "#/tones", ico: "🎵", title: "Tones & sounds", sub: "Ear training and the tone mirror" })}
        ${card({ href: wDue ? "#/words/due" : "#/words", ico: "🃏", title: "Word cards", sub: wDue ? `${wDue} word${wDue > 1 ? "s" : ""} due for review` : `${VOCAB.length} words, rapid-fire`, tag: count(wDue) })}
      </div>

      ${
        learned.length
          ? `<p class="muted">${sum.mastered} sentences mastered · ${sum.learning} learning · ${sum.seen - sum.mastered - sum.learning} new.
             Each correct review pushes a sentence further out (1 → 2 → 4 → 7 → 15 → 30 days); a miss brings it back today.</p>`
          : ""
      }
      ${
        phrases.all.length
          ? `<details class="phrasebook">
               <summary>My phrases (${phrases.all.length})</summary>
               <p class="muted">Things you wanted to say in Talk, as translated by the AI partner. Remove any that look wrong.</p>
               <ul>${phrases.all
                 .map(
                   (p) => `<li>
                     <span><b lang="zh">${esc(p.text)}</b> <span class="pb-py">${esc(p.pinyin)}</span><br /><small>${esc(p.en)}</small></span>
                     <button class="icon-btn sm" data-drop="${esc(p.text)}" aria-label="Remove ${esc(p.text)}">✕</button>
                   </li>`
                 )
                 .join("")}</ul>
             </details>`
          : ""
      }`;
    root.querySelectorAll("[data-drop]").forEach((b) =>
      b.addEventListener("click", () => {
        const open = root.querySelector(".phrasebook")?.open;
        removePhrase(b.dataset.drop);
        home();
        const pb = root.querySelector(".phrasebook");
        if (pb && open) pb.open = true;
      })
    );
    root.querySelectorAll("[data-mode]").forEach((b) =>
      b.addEventListener("click", () => {
        const mode = b.dataset.mode;
        if (mode === "phrases") return run(phrases.set, ["speak"]);
        const set =
          mode === "due" ? due.slice(0, SESSION) : mode === "weak" ? weak.slice(0, SESSION) : sample(learned, SESSION);
        run(set);
      })
    );
  }

  function run(set, only) {
    const types =
      only || (canSpeak() ? ["build", "speak", "speak", "hear", "listen", "type", "pick"] : ["build", "speak", "speak", "type", "pick", "meaning"]);
    const queue = set.map((s) => {
      const pool = LESSON_BY_ID.get(s.lessonId)?.sentences || [];
      return { type: pickOne(types), s, pool };
    });
    const total = queue.length;
    let n = 0;
    let right = 0;
    const missed = [];
    const hud = createDrill(root, {
      quitLabel: "End session",
      onQuit: () => {
        cleanupEx();
        home();
      },
    });
    function next() {
      cleanupEx();
      hud.progress(n, total);
      const ex = queue.shift();
      if (!ex) return done();
      window.scrollTo({ top: 0 });
      cleanupEx =
        renderExercise(
          hud.exRoot,
          ex,
          (ok) => {
            review(ex.s.key, ok, { spoken: SPOKEN.has(ex.type) });
            n++;
            if (ok) right++;
            else missed.push(ex.s);
            next();
          },
          { onAnswer: hud.mark }
        ) || (() => {});
    }
    function done() {
      endFocus();
      const pct = total ? right / total : 0;
      if (pct >= 0.8) {
        sound("done");
        confetti(pct === 1 ? 60 : 25);
      }
      root.innerHTML = resultsHtml({
        mood: pct >= 0.8 ? "cheer" : pct >= 0.5 ? "happy" : "calm",
        title: pct === 1 ? "Perfect round!" : "Session done",
        big: { value: `${right}/${total}`, label: "correct" },
        xp: right * XP.right + (total - right) * XP.wrong,
        combo: hud.bestCombo(),
        extra: missed.length
          ? `<p class="muted">To revisit:</p><ul class="missed">${missed.map((s) => `<li><b lang="zh">${esc(s.text)}</b> ${esc(s.pinyin)} — ${esc(s.en)}</li>`).join("")}</ul>`
          : "",
        buttons: `<button class="btn primary" id="homeBtn">Back to practice</button><a class="btn" href="#/learn">Path</a>`,
      });
      root.querySelector("#homeBtn").addEventListener("click", home);
    }
    next();
  }

  const due = arg === "due" ? dueSentences() : [];
  if (due.length) run(due.slice(0, SESSION));
  else home();
  return () => {
    cleanupEx();
    endFocus();
    stopSpeaking();
  };
}
