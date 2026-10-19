/* Learn tab — the lesson path. */
import { LESSONS } from "../data/lessons.js";
import { getState, summarize } from "../lib/store.js";
import { esc } from "../lib/util.js";

export function nextLesson() {
  const { lessons } = getState();
  return LESSONS.find((l) => !lessons[l.id]?.done) || null;
}

export function mount(root) {
  const { lessons } = getState();
  const next = nextLesson();
  const done = LESSONS.filter((l) => lessons[l.id]?.done).length;
  const sDue = summarize("s:").due;
  const wDue = summarize("w:").due;

  root.innerHTML = `
    <section class="intro">
      <div>
        <h2>From single words to real sentences.</h2>
        <p>Each lesson teaches one sentence pattern you'll use in your first conversations, then drills it
        four ways: <b>read</b> it, <b>build</b> it from word tiles, <b>hear</b> it, and <b>type</b> the pinyin.
        Missed sentences come back sooner in <a href="#/practice">Practice</a>.</p>
        <div class="cta-row">
          ${
            next
              ? `<a class="btn primary" href="#/lesson/${next.id}">${done ? "Continue" : "Start"}: Lesson ${next.n} →</a>`
              : `<a class="btn primary" href="#/practice">All lessons done — review →</a>`
          }
          <a class="btn" href="#/words">Word flashcards</a>
        </div>
      </div>
      <div class="method">
        <b>Today</b><br />
        ${done} / ${LESSONS.length} lessons complete<br />
        ${sDue ? `<a href="#/practice">${sDue} sentence${sDue > 1 ? "s" : ""} due for review</a>` : "No sentences due"}<br />
        ${wDue ? `<a href="#/words/due">${wDue} word${wDue > 1 ? "s" : ""} due for review</a>` : "No words due"}
        <div class="legend-row">
          <div class="legend"><span class="dot" style="background: var(--seal)"></span>pīnyīn</div>
          <div class="legend"><span class="dot" style="background: var(--jade)"></span>English</div>
          <div class="legend"><span class="dot" style="background: var(--gold)"></span>needs review</div>
        </div>
      </div>
    </section>

    <h3 class="section-title">Sentence path</h3>
    <ol class="path">
      ${LESSONS.map((l) => {
        const rec = lessons[l.id];
        const state = rec?.done ? "done" : l === next ? "next" : "";
        return `
        <li>
          <a class="lesson-card ${state}" href="#/lesson/${l.id}">
            <span class="lesson-num">${rec?.done ? "✓" : l.n}</span>
            <span class="lesson-main">
              <span class="lesson-title">${esc(l.title)}</span>
              <span class="lesson-pattern"><b>${esc(l.pattern.zh)}</b> · ${esc(l.pattern.py)}</span>
            </span>
            <span class="lesson-meta">
              ${rec?.done ? `<b>${rec.best}%</b> best` : l === next ? "<b>up next</b>" : ""}
              <small>${l.sentences.length} sentences</small>
            </span>
          </a>
        </li>`;
      }).join("")}
    </ol>`;
}
