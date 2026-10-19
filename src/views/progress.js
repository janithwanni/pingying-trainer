/* Progress tab — stats, activity chart, per-category mastery, sync settings. */
import { VOCAB, CATEGORIES } from "../data/vocab.js";
import { LESSONS } from "../data/lessons.js";
import { bestStreak, getState, isMastered, lastDays, mergeIn, resetAll, streak, subscribe, summarize } from "../lib/store.js";
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
    const id = getSyncId();
    const st = getStatus();

    root.innerHTML = `
      <div class="lesson-head"><div class="lesson-kicker">Your progress</div><h2>进步 · Progress</h2></div>

      <div class="tiles">
        <div class="tile-stat"><b>${streak()}</b><span>day streak</span><small>best ${bestStreak()}</small></div>
        <div class="tile-stat"><b>${days[days.length - 1].n}</b><span>answers today</span><small>${mN} in 30 days</small></div>
        <div class="tile-stat"><b>${mN ? Math.round((mOk / mN) * 100) + "%" : "—"}</b><span>accuracy</span><small>last 30 days</small></div>
        <div class="tile-stat"><b>${lessonsDone}/${LESSONS.length}</b><span>lessons</span><small>${sn.mastered} sentences mastered</small></div>
      </div>

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
      </section>`;

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
