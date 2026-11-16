/* Progress tab — stats, activity chart, per-category mastery, sync settings. */
import { VOCAB, CATEGORIES } from "../data/vocab.js";
import { LESSONS, LESSON_BY_ID } from "../data/lessons.js";
import { SCENARIOS } from "../data/scenarios.js";
import {
  GOALS, bestStreak, dailyGoal, getPhrases, getSettings, getState, isMastered, lastDays, mergeIn, resetAll, setSetting,
  streak, subscribe, summarize, talkId,
} from "../lib/store.js";
import { BADGES, levelFor } from "../lib/game.js";
import { sound } from "../lib/fx.js";
import { bao } from "../lib/mascot.js";
import { forcePush, formatCode, getStatus, getSyncId, linkCode, onStatus, syncNow } from "../lib/sync.js";
import { esc } from "../lib/util.js";

const STATUS_TEXT = {
  idle: "Not synced yet",
  syncing: "Syncing…",
  synced: "Synced to the cloud",
  offline: "Offline — saved on this device, will sync when back online",
  unavailable: "Cloud sync isn't set up on this server — progress is saved on this device only",
  error: "Sync failed — will retry",
};

function activityChart(days) {
  const max = Math.max(10, ...days.map((d) => d.n));
  const fmt = (d) => d.date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  return `
    <div class="chart" role="img" aria-label="Answers per day, last ${days.length} days">
      <div class="chart-plot">
        <div class="chart-grid"><span>${max}</span><span>${Math.round(max / 2)}</span><span>0</span></div>
        <div class="bars">
          ${days
            .map(
              (d, i) => `
            <div class="bar-col" tabindex="0" data-tip="${esc(fmt(d))}: ${d.n} answers${d.n ? `, ${Math.round((d.ok / d.n) * 100)}% right` : ""}">
              <div class="bar ${i === days.length - 1 ? "today" : ""}" style="height:${(d.n / max) * 100}%"></div>
            </div>`
            )
            .join("")}
        </div>
      </div>
      <div class="chart-x">
        <span>${esc(days[0].date.toLocaleDateString(undefined, { month: "short", day: "numeric" }))}</span>
        <span>today</span>
      </div>
    </div>`;
}

export function mount(root) {
  function render() {
    const s = getState();
    const w = summarize("w:");
    const sn = summarize("s:");
    const days = lastDays(14);
    const month = lastDays(30);
    const mN = month.reduce((a, d) => a + d.n, 0);
    const mOk = month.reduce((a, d) => a + d.ok, 0);
    const lessonsDone = LESSONS.filter((l) => s.lessons[l.id]?.done).length;
    const chats = SCENARIOS.filter((sc) => s.lessons[talkId(sc.id)]?.done).length;
    const id = getSyncId();
    const st = getStatus();
    const lvl = levelFor(s.xp);
    const earned = BADGES.filter((b) => s.badges[b.id]).length;
    const GOAL_LABELS = { [GOALS[0]]: "Casual", [GOALS[1]]: "Regular", [GOALS[2]]: "Intensive" };

    root.innerHTML = `
      <section class="profile">
        <div class="hero-bao">${bao(streak() ? "cheer" : "happy", 88)}</div>
        <div class="profile-main">
          <div class="lesson-kicker">Level ${lvl.level}</div>
          <h2>${lvl.title}</h2>
          <div class="progress-track" role="progressbar" aria-label="Progress to level ${lvl.level + 1}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${lvl.pct}">
            <div class="progress-fill" style="width:${lvl.pct}%"></div>
          </div>
          <small class="muted">${s.xp.toLocaleString()} XP · ${(lvl.need - lvl.into).toLocaleString()} to level ${lvl.level + 1}</small>
        </div>
      </section>

      <div class="tiles">
        <div class="tile-stat"><b>${streak()}</b><span>day streak</span><small>best ${bestStreak()}</small></div>
        <div class="tile-stat"><b>${days[days.length - 1].x || 0}</b><span>XP today</span><small>${mN} answers in 30 days</small></div>
        <div class="tile-stat"><b>${mN ? Math.round((mOk / mN) * 100) + "%" : "—"}</b><span>accuracy</span><small>last 30 days</small></div>
        <div class="tile-stat"><b>${lessonsDone}/${LESSONS.length}</b><span>lessons</span><small>${sn.mastered} sentences mastered</small></div>
      </div>

      <section class="card-section">
        <h3 class="section-title">Badges · ${earned} / ${BADGES.length}</h3>
        <ul class="badges">
          ${BADGES.map(
            (b) => `<li class="${s.badges[b.id] ? "on" : ""}" title="${esc(b.how)}">
              <span class="badge-ico" aria-hidden="true">${s.badges[b.id] ? b.ico : "🔒"}</span>
              <b>${esc(b.name)}</b><small>${esc(b.how)}</small>
            </li>`
          ).join("")}
        </ul>
      </section>

      <section class="card-section">
        <h3 class="section-title">What you can do in Mandarin · ${chats} / ${SCENARIOS.length}</h3>
        <ul class="cando">
          ${SCENARIOS.map((sc) => {
            const talked = s.lessons[talkId(sc.id)]?.done;
            const learned = s.lessons[sc.after]?.done;
            const l = LESSON_BY_ID.get(sc.after);
            return `<li class="${talked ? "ok" : ""}">
              <span class="step-mark" aria-hidden="true">${talked ? "✓" : ""}</span>
              <span><b>${esc(sc.cando)}</b><br /><small>${
                talked
                  ? "You've held this conversation."
                  : learned
                    ? `Lesson done — now <a href="#/talk/${sc.id}">have the conversation</a>.`
                    : `Start with <a href="#/lesson/${l.id}">Lesson ${l.n}: ${esc(l.title)}</a>`
              }</small></span>
            </li>`;
          }).join("")}
        </ul>
        <p class="muted">A skill is ticked once you've finished its lesson's conversation in Talk. ${getPhrases().length} phrases saved from your chats.</p>
      </section>

      <section class="card-section">
        <h3 class="section-title">Answers per day · last 14 days</h3>
        ${activityChart(days)}
      </section>

      <section class="card-section">
        <h3 class="section-title">Words</h3>
        ${stackBar(w.mastered, w.learning, w.seen - w.mastered - w.learning, VOCAB.length)}
        <div class="stack-legend">
          <span><i class="sw mastered"></i>${w.mastered} mastered</span>
          <span><i class="sw learning"></i>${w.learning} learning</span>
          <span><i class="sw seen"></i>${w.seen - w.mastered - w.learning} seen</span>
          <span><i class="sw unseen"></i>${VOCAB.length - w.seen} not seen</span>
          ${w.due ? `<a href="#/words/due">${w.due} due →</a>` : ""}
        </div>
        <table class="cat-table">
          <thead><tr><th>Category</th><th>Mastered</th><th class="bar-th"></th></tr></thead>
          <tbody>
          ${CATEGORIES.map((c) => {
            const vs = VOCAB.filter((v) => v.cat === c);
            const m = vs.filter((v) => isMastered(s.items[v.key])).length;
            const l = vs.filter((v) => s.items[v.key]?.b > 0 && !isMastered(s.items[v.key])).length;
            return `<tr><td>${esc(c)}</td><td>${m}/${vs.length}</td><td>${stackBar(m, l, 0, vs.length, true)}</td></tr>`;
          }).join("")}
          </tbody>
        </table>
      </section>

      <section class="card-section">
        <h3 class="section-title">Sentence lessons</h3>
        <ul class="lesson-scores">
          ${LESSONS.map((l) => {
            const r = s.lessons[l.id];
            return `<li><a href="#/lesson/${l.id}"><span>${l.n}. ${esc(l.title)}</span><b>${r?.done ? r.best + "%" : "—"}</b></a></li>`;
          }).join("")}
        </ul>
        <p class="muted">${sn.seen} sentences studied · ${sn.mastered} mastered · ${sn.due} due</p>
      </section>

      <section class="card-section" id="settings">
        <h3 class="section-title">Settings</h3>
        <div class="setting">
          <span><b>Daily goal</b><small>XP to earn each day</small></span>
          <div class="seg" role="radiogroup" aria-label="Daily goal">
            ${GOALS.map((g) => `<button class="seg-opt ${g === dailyGoal() ? "active" : ""}" data-goal="${g}" role="radio" aria-checked="${g === dailyGoal()}">${GOAL_LABELS[g]} <small>${g}</small></button>`).join("")}
          </div>
        </div>
        <label class="setting">
          <span><b>Sound effects &amp; vibration</b><small>Chimes for right and wrong answers</small></span>
          <input type="checkbox" class="switch" id="sfxToggle" ${getSettings().sfx !== false ? "checked" : ""} />
        </label>
      </section>

      <section class="card-section" id="sync">
        <h3 class="section-title">Cloud sync & backup</h3>
        <p class="sync-status ${st.status}" id="syncStatus">${STATUS_TEXT[st.status]}</p>
        <p class="muted">Progress saves on this device instantly and syncs to Cloudflare. To continue on another phone or computer, enter this sync code there. Keep it private — anyone with the code can see and change this progress.</p>
        <div class="code-row">
          <code class="sync-code">${formatCode(id)}</code>
          <button class="btn" id="copyCode">Copy</button>
          <button class="btn" id="syncBtn">Sync now</button>
        </div>
        <form class="code-row" id="linkForm">
          <input class="py-input" id="linkInput" placeholder="Paste a sync code from another device" autocomplete="off" autocapitalize="off" spellcheck="false" />
          <button class="btn primary" type="submit">Link</button>
        </form>
        <div class="code-row">
          <button class="btn ghost" id="exportBtn">Export backup</button>
          <label class="btn ghost">Import backup<input type="file" id="importFile" accept="application/json" hidden /></label>
          <button class="btn ghost danger" id="resetBtn">Reset all progress</button>
        </div>
      </section>

      <section class="card-section" id="privacy">
        <h3 class="section-title">Your data</h3>
        <ul class="plain-list muted">
          <li><b>No account, no tracking.</b> There are no ads or analytics. Progress is stored in this browser.</li>
          <li><b>Cloud sync</b> stores your progress (which items you've studied and when — no name or email) on
          Cloudflare under your sync code. It's deleted after a year without use, or right away with <i>Reset all progress</i>.</li>
          <li><b>Talk</b> sends your messages to an AI model running on Cloudflare Workers AI to get a reply. Don't
          put personal details in a chat. AI replies and translations can be wrong.</li>
          <li><b>Voice.</b> Audio playback and speech recognition use your browser's built-in services; in some
          browsers (Chrome, for example) recognition sends your recording to the browser maker to be transcribed.
          The app never stores audio.</li>
        </ul>
      </section>`;

    root.querySelectorAll("[data-goal]").forEach((b) =>
      b.addEventListener("click", () => {
        setSetting("goal", Number(b.dataset.goal));
        render();
      })
    );
    root.querySelector("#sfxToggle").addEventListener("change", (e) => {
      setSetting("sfx", e.target.checked);
      sound("right");
    });
    root.querySelector("#copyCode").addEventListener("click", async (e) => {
      try {
        await navigator.clipboard.writeText(formatCode(id));
        e.target.textContent = "Copied";
      } catch {
        e.target.textContent = "Select & copy";
      }
    });
    root.querySelector("#syncBtn").addEventListener("click", () => syncNow());
    root.querySelector("#linkForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const v = root.querySelector("#linkInput").value;
      if (!v.trim()) return;
      if (!confirm("Link to this code? Progress on this device will be merged with it.")) return;
      try {
        await linkCode(v);
        render();
      } catch (err) {
        alert(err.message);
      }
    });
    root.querySelector("#exportBtn").addEventListener("click", () => {
      const blob = new Blob([JSON.stringify(getState())], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `pinyin-progress-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    });
    root.querySelector("#importFile").addEventListener("change", async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      try {
        if (!mergeIn(JSON.parse(await f.text()))) alert("Nothing new in that file.");
      } catch {
        alert("That file isn't a valid backup.");
      }
    });
    root.querySelector("#resetBtn").addEventListener("click", () => {
      if (!confirm("Erase all progress on this device and in the cloud copy for this sync code?")) return;
      resetAll();
      forcePush();
    });
  }

  render();
  const offState = subscribe(render);
  const offStatus = onStatus((status) => {
    const p = root.querySelector("#syncStatus");
    if (p) {
      p.className = "sync-status " + status;
      p.textContent = STATUS_TEXT[status];
    }
  });
  return () => {
    offState();
    offStatus();
  };
}

function stackBar(m, l, s, total, compact = false) {
  const pct = (n) => (total ? (n / total) * 100 : 0);
  return `<div class="stack ${compact ? "compact" : ""}">
    ${m ? `<span class="seg mastered" style="width:${pct(m)}%"></span>` : ""}
    ${l ? `<span class="seg learning" style="width:${pct(l)}%"></span>` : ""}
    ${s ? `<span class="seg seen" style="width:${pct(s)}%"></span>` : ""}
  </div>`;
}
