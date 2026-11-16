/* Home tab — Bao's nudge, today's goal and quests, and the path of lessons
 * and conversations grouped into units. */
import { LESSONS, UNITS } from "../data/lessons.js";
import { SCENARIOS } from "../data/scenarios.js";
import { dailyGoal, getState, isToday, lastDays, streak, summarize, talkId, todayStats } from "../lib/store.js";
import { questsFor } from "../lib/game.js";
import { bao } from "../lib/mascot.js";
import { esc } from "../lib/util.js";

export function nextLesson() {
  const { lessons } = getState();
  return LESSONS.find((l) => !lessons[l.id]?.done) || null;
}

/** The conversation to try next: the first unfinished one whose lesson is done. */
export function nextScenario() {
  const { lessons } = getState();
  const ready = SCENARIOS.filter((sc) => lessons[sc.after]?.done);
  return ready.find((sc) => !lessons[talkId(sc.id)]?.done) || ready[ready.length - 1] || null;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 11) return { zh: "早上好", py: "zǎoshang hǎo", en: "Good morning" };
  if (h < 18) return { zh: "下午好", py: "xiàwǔ hǎo", en: "Good afternoon" };
  return { zh: "晚上好", py: "wǎnshang hǎo", en: "Good evening" };
}

const starsFor = (best) => (best >= 90 ? 3 : best >= 70 ? 2 : 1);
const OFFSETS = [8, 44, 76, 44]; // px: the path winds left and right

export function mount(root) {
  const { lessons } = getState();
  const next = nextLesson();
  const done = LESSONS.filter((l) => lessons[l.id]?.done).length;
  const sDue = summarize("s:").due;
  const scene = nextScenario();
  const goal = dailyGoal();
  const day = todayStats();
  const days = streak();
  const week = lastDays(7);
  const quests = questsFor();

  const learnedToday = LESSONS.some((l) => isToday(lessons[l.id]?.t));
  const talkedToday = SCENARIOS.some((sc) => isToday(lessons[talkId(sc.id)]?.t));
  // The daily loop, in the order that gets people speaking: recall what's
  // fading, add one new pattern, then use it in a conversation.
  const steps = [
    done > 0 && { label: "Review", cta: `Review ${sDue} sentence${sDue > 1 ? "s" : ""}`, href: "#/practice/due", ok: !sDue },
    next && { label: "Learn", cta: `Lesson ${next.n}: ${next.title}`, href: `#/lesson/${next.id}`, ok: learnedToday },
    scene && { label: "Talk", cta: `Chat: ${scene.title}`, href: `#/talk/${scene.id}`, ok: talkedToday },
  ].filter(Boolean);
  const todo = steps.find((s) => !s.ok);

  const hi = greeting();
  let mood = "happy";
  let line;
  if (!done && !day.n) line = "I'm Bao. Let's say your first Mandarin sentence — it takes five minutes.";
  else if (day.x >= goal) {
    mood = "cheer";
    line = todo ? "Daily goal done! Got a little more in you?" : "Daily goal done and everything ticked. See you tomorrow!";
  } else if (sDue) {
    mood = "think";
    line = `${sDue} sentence${sDue > 1 ? "s are" : " is"} starting to fade. A quick review locks ${sDue > 1 ? "them" : "it"} in.`;
  } else if (days > 1 && !day.n) line = `You're on a ${days}-day streak. One lesson keeps it alive.`;
  else if (next) line = `Next up: “${next.title}”. Ready when you are.`;
  else line = "You've finished every lesson. Keep chatting to stay sharp!";

  const pct = Math.min(1, day.x / goal);
  const R = 34;
  const C = 2 * Math.PI * R;

  let i = 0; // position along the whole path, for the winding offset
  const row = (node, label) => `<li class="path-row"><span class="path-node" style="margin-left:${OFFSETS[i++ % OFFSETS.length]}px">${node}</span>${label}</li>`;

  root.innerHTML = `
    <section class="home-hero">
      <div class="hero-bao">${bao(mood, 96)}</div>
      <div class="bubble">
        <b><span lang="zh">${hi.zh}!</span> <small>${hi.py} · ${hi.en}</small></b>
        <span>${esc(line)}</span>
      </div>
    </section>
    ${
      todo
        ? `<a class="btn primary wide big-cta" href="${todo.href}">${day.n || done ? "Continue" : "Start"} · ${esc(todo.cta)}</a>`
        : `<a class="btn primary wide big-cta" href="#/talk">Have another chat</a>`
    }

    <section class="today-card">
      <a class="goal-ring" href="#/progress" aria-label="Daily goal: ${day.x} of ${goal} XP">
        <svg viewBox="0 0 80 80" aria-hidden="true">
          <circle cx="40" cy="40" r="${R}" class="ring-bg"/>
          <circle cx="40" cy="40" r="${R}" class="ring-fg ${pct >= 1 ? "full" : ""}" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C * (1 - pct)).toFixed(1)}"/>
        </svg>
        <span class="ring-text"><b>${day.x}</b><small>/ ${goal} XP</small></span>
      </a>
      <div class="today-main">
        <div class="today-title">${days ? `🔥 ${days}-day streak` : "Start a streak today"}</div>
        <ol class="week" aria-label="Last 7 days">
          ${week
            .map(
              (d, j) => `<li class="${d.n ? "on" : ""} ${j === 6 ? "today" : ""}" title="${d.date.toLocaleDateString(undefined, { weekday: "long" })}: ${d.n} answers">
                <span>${d.date.toLocaleDateString(undefined, { weekday: "narrow" })}</span><i>${d.n ? "🔥" : ""}</i></li>`
            )
            .join("")}
        </ol>
        <ul class="today-steps">
          ${steps.map((s) => `<li class="${s.ok ? "ok" : s === todo ? "now" : ""}"><a href="${s.href}"><span class="step-mark" aria-hidden="true">${s.ok ? "✓" : ""}</span>${s.label}</a></li>`).join("")}
        </ul>
      </div>
    </section>

    <section class="quests">
      <h3 class="section-title">Daily quests</h3>
      ${quests
        .map(
          (q) => `
        <div class="quest ${q.done ? "done" : ""}">
          <span class="quest-ico" aria-hidden="true">${q.done ? "✓" : q.ico}</span>
          <div class="quest-main">
            <div class="quest-text">${esc(q.text)}</div>
            <div class="progress-track" role="progressbar" aria-label="${esc(q.text)}" aria-valuemin="0" aria-valuemax="${q.target}" aria-valuenow="${q.have}">
              <div class="progress-fill" style="width:${(q.have / q.target) * 100}%"></div>
            </div>
          </div>
          <span class="quest-count">${q.have}/${q.target}</span>
        </div>`
        )
        .join("")}
    </section>

    ${UNITS.map((u) => {
      const got = u.lessons.filter((l) => lessons[l.id]?.done).length;
      return `
      <section class="unit hue-${u.hue}">
        <header class="unit-banner">
          <span class="unit-zh" lang="zh" aria-hidden="true">${u.zh}</span>
          <span class="unit-main"><small>Unit ${u.n}</small><b>${esc(u.title)}</b></span>
          <span class="unit-count">${got}/${u.lessons.length}</span>
        </header>
        <ol class="path">
          ${u.lessons
            .map((l) => {
              const rec = lessons[l.id];
              const state = rec?.done ? "done" : l === next ? "next" : "";
              const sc = SCENARIOS.find((x) => x.after === l.id);
              const chatDone = sc && lessons[talkId(sc.id)]?.done;
              const stars = rec?.done ? starsFor(rec.best) : 0;
              return (
                row(
                  `<a class="node ${state}" href="#/lesson/${l.id}" aria-label="Lesson ${l.n}: ${esc(l.title)}${rec?.done ? `, done, ${stars} of 3 stars` : state === "next" ? ", up next" : ""}">
                     ${state === "next" ? `<span class="node-flag">${done ? "Next" : "Start"}</span>` : ""}
                     <span class="node-face">${rec?.done ? "✓" : l.n}</span>
                   </a>`,
                  `<a class="path-label" href="#/lesson/${l.id}" tabindex="-1" aria-hidden="true">
                     <b>${esc(l.title)}</b>
                     <small lang="zh">${esc(l.pattern.zh)}</small>
                     ${stars ? `<span class="node-stars">${"★".repeat(stars)}<i>${"★".repeat(3 - stars)}</i></span>` : ""}
                   </a>`
                ) +
                (sc
                  ? row(
                      `<a class="node chat ${chatDone ? "done" : rec?.done ? "next" : ""}" href="#/talk/${sc.id}" aria-label="Conversation: ${esc(sc.title)}${chatDone ? ", done" : ""}">
                         <span class="node-face" lang="zh">${chatDone ? "✓" : sc.ico}</span>
                       </a>`,
                      `<a class="path-label" href="#/talk/${sc.id}" tabindex="-1" aria-hidden="true"><b>💬 ${esc(sc.title)}</b><small>Conversation</small></a>`
                    )
                  : "")
              );
            })
            .join("")}
        </ol>
      </section>`;
    }).join("")}`;
}
