/* Talk tab — role-play conversations with an AI partner on Cloudflare Workers
 * AI (see lib/llm.js and functions/api/talk.js). The partner replies in
 * Chinese + English; when the learner writes English it also shows how to say
 * that in Chinese. To keep Workers AI usage (Neurons) low, pinyin is added
 * locally with pinyin-pro, scenario openers are built in, and reply
 * suggestions are only fetched when the learner taps Hint.
 *
 * Small models can't reliably judge a learner's grammar (in testing they
 * flagged correct sentences), so the AI only translates, never grades. The
 * session lives at module level so switching tabs doesn't lose the
 * conversation.
 */
import { LEVELS, SCENARIOS, SCENARIO_BY_ID } from "../data/scenarios.js";
import { MAX_CHARS, talkHints, talkTurn } from "../lib/llm.js";
import { getSettings, logAnswer, setSetting } from "../lib/store.js";
import { canSpeak, speak, stopSpeaking } from "../lib/speech.js";
import { looksLikePinyin, numbersToMarks } from "../lib/pinyin.js";
import { esc, SPEAKER } from "../lib/util.js";

const SR = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : undefined;

const hasHanzi = (t) => /[一-鿿]/.test(t || "");
const inChinese = (t) => hasHanzi(t) || looksLikePinyin(t);

/** @type {null | {scenario: object, level: string, turns: object[]}} */
let session = null;
let endChat = () => {}; // aborts the open chat's request / mic

const level = () => (LEVELS[getSettings().talkLevel] ? getSettings().talkLevel : "beginner");
const pref = (k, dflt) => getSettings()[k] ?? dflt;

const PUNCT = { "，": ", ", "。": ". ", "！": "! ", "？": "? ", "、": ", ", "；": "; ", "：": ": " };
async function toPinyin(text) {
  if (!text) return "";
  const { pinyin } = await import("pinyin-pro");
  return pinyin(text, { toneType: "symbol", nonZh: "consecutive" })
    .replace(/\s*([，。！？、；：])\s*/g, (_, p) => PUNCT[p])
    .trim();
}

/* What the server sees of the conversation: plain text per message. */
const asHistory = (turns) => turns.map((t) => ({ who: t.who, text: t.who === "me" ? t.text : t.zh }));

function newSession(sc) {
  const o = sc.opener;
  session = { scenario: sc, level: level(), turns: [{ who: "ai", zh: o.zh, py: o.py, en: o.en }] };
}

/* ---------- home: scenario picker ---------- */
function renderHome(root) {
  const lvl = level();
  root.innerHTML = `
    <div class="lesson-head">
      <div class="lesson-kicker">Conversation practice · AI partner</div>
      <h2>Talk it through</h2>
    </div>
    <p class="muted talk-lede">Role-play everyday situations with an AI partner. Reply in characters, pinyin
    (<code>ni3 hao3</code> works) or English. Your partner answers in Mandarin, shows how to say your English in
    Chinese, and can suggest what to say next.</p>
    ${
      navigator.onLine === false
        ? `<div class="llm-status warn"><span class="dot"></span><span>You're offline. Talk needs an internet connection;
           the rest of the app works offline.</span></div>`
        : ""
    }

    ${
      session
        ? `<div class="cta-row"><a class="btn primary" href="#/talk/${session.scenario.id}">Continue: ${esc(session.scenario.title)} →</a></div>`
        : ""
    }

    <h3 class="section-title">Level</h3>
    <div class="seg" role="radiogroup" aria-label="Level">
      ${Object.entries(LEVELS)
        .map(([k, L]) => `<button class="seg-opt ${k === lvl ? "active" : ""}" data-level="${k}" role="radio" aria-checked="${k === lvl}">${L.label} <small>${L.hsk}</small></button>`)
        .join("")}
    </div>

    <h3 class="section-title">Scenarios</h3>
    <div class="scene-grid">
      ${SCENARIOS.map(
        (sc) => `
        <a class="scene-card" href="#/talk/${sc.id}" data-new="${sc.id}">
          <span class="scene-ico">${sc.ico}</span>
          <span class="scene-main">
            <span class="scene-title">${esc(sc.title)}</span>
            <span class="scene-goal">${esc(sc.goal)}</span>
          </span>
        </a>`
      ).join("")}
    </div>`;

  root.querySelectorAll("[data-level]").forEach((b) =>
    b.addEventListener("click", () => {
      setSetting("talkLevel", b.dataset.level);
      renderHome(root);
    })
  );
  root.querySelectorAll("[data-new]").forEach((a) =>
    a.addEventListener("click", () => {
      // Picking a scenario from the list always starts it fresh.
      newSession(SCENARIO_BY_ID.get(a.dataset.new));
    })
  );
}

/* ---------- chat ---------- */
function renderChat(root) {
  endChat();
  const s = session;
  let ctrl = null;
  let rec = null;

  root.innerHTML = `
    <div class="talk">
      <div class="talk-top">
        <a class="back-link" href="#/talk">← Scenarios</a>
        <div class="talk-toggles">
          <label><input type="checkbox" data-pref="talkPy" ${pref("talkPy", true) ? "checked" : ""} /> pīnyīn</label>
          <label><input type="checkbox" data-pref="talkEn" ${pref("talkEn", false) ? "checked" : ""} /> English</label>
          ${canSpeak() ? `<label><input type="checkbox" data-pref="talkSpeak" ${pref("talkSpeak", true) ? "checked" : ""} /> auto-play</label>` : ""}
        </div>
      </div>
      <div class="talk-goal">
        <span class="scene-ico">${s.scenario.ico}</span>
        <div><b>${esc(s.scenario.title)}</b> · ${LEVELS[s.level].label}<br /><span>${esc(s.scenario.goal)}</span></div>
      </div>
      <div class="talk-log" id="talkLog" aria-live="polite"></div>
      <form class="talk-input" id="talkForm" autocomplete="off">
        <div class="py-preview talk-preview" id="talkPreview"></div>
        <div class="talk-row">
          <input class="py-input" id="talkText" placeholder="Reply in 汉字, pinyin or English…" lang="zh" enterkeyhint="send" maxlength="${MAX_CHARS}" />
          ${SR ? `<button type="button" class="icon-btn mic" id="micBtn" aria-label="Speak your reply" title="Speak (Mandarin)">🎙</button>` : ""}
          <button class="btn primary" id="sendBtn">Send</button>
        </div>
        <div class="talk-actions">
          <button type="button" class="btn ghost" id="hintBtn">💡 Hint</button>
          <button type="button" class="btn ghost" id="endBtn">End &amp; review</button>
        </div>
      </form>
      <p class="muted talk-note">Replies come from an AI model and can contain mistakes.</p>
    </div>`;

  const log = root.querySelector("#talkLog");
  const form = root.querySelector("#talkForm");
  const input = root.querySelector("#talkText");
  const preview = root.querySelector("#talkPreview");
  const sendBtn = root.querySelector("#sendBtn");
  const hintBtn = root.querySelector("#hintBtn");
  let showHints = false;
  let busy = false; // waiting on a reply
  let hinting = false; // waiting on hints
  let error = "";

  function bubble(t, i) {
    if (t.who === "me") {
      return `
        <div class="msg me">
          <div class="msg-text">${esc(t.text)}</div>
          ${
            t.say
              ? `<div class="msg-fix">
                   <span class="fix-label">In Chinese</span>
                   <span class="fix-zh">${esc(t.say.zh)} ${canSpeak() ? `<button class="icon-btn sm" data-say="${esc(t.say.zh)}" aria-label="Play">${SPEAKER}</button>` : ""}</span>
                   <span class="fix-py">${esc(t.say.py)}</span>
                 </div>`
              : ""
          }
        </div>`;
    }
    const last = i === s.turns.length - 1;
    return `
      <div class="msg ai">
        <div class="msg-zh">${esc(t.zh)} ${canSpeak() ? `<button class="icon-btn sm" data-say="${esc(t.zh)}" aria-label="Play">${SPEAKER}</button>` : ""}</div>
        ${pref("talkPy", true) ? `<div class="msg-py">${esc(t.py)}</div>` : ""}
        ${
          pref("talkEn", false)
            ? `<div class="msg-en">${esc(t.en)}</div>`
            : `<button class="msg-en reveal" data-reveal>Show English</button><div class="msg-en" hidden>${esc(t.en)}</div>`
        }
        ${
          last && showHints && t.hints?.length
            ? `<div class="hints">${t.hints
                .map((h) => `<button class="hint" data-use="${esc(h.zh)}"><b>${esc(h.zh)}</b><span>${esc(h.py)}</span><small>${esc(h.en)}</small></button>`)
                .join("")}</div>`
            : ""
        }
      </div>`;
  }

  function draw() {
    if (!log.isConnected) return;
    log.innerHTML =
      s.turns.map(bubble).join("") +
      (busy ? `<div class="msg ai typing"><span></span><span></span><span></span></div>` : "") +
      (error ? `<div class="msg err">${error} <button class="btn" id="retryBtn">Retry</button></div>` : "");
    const last = s.turns[s.turns.length - 1];
    hintBtn.disabled = busy || hinting || last.who !== "ai";
    hintBtn.textContent = hinting ? "💡 …" : "💡 Hint";
    sendBtn.disabled = busy;
    log.querySelector("#retryBtn")?.addEventListener("click", ask);
    log.lastElementChild?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  async function ask() {
    error = "";
    busy = true;
    showHints = false;
    draw();
    ctrl = new AbortController();
    const me = s.turns[s.turns.length - 1];
    // Only English gets a "how to say it" line; pinyin already is Chinese.
    const needSay = !inChinese(me.text);
    const req = { scenario: s.scenario.id, level: s.level, history: asHistory(s.turns.slice(0, -1)), text: me.text, say: needSay };
    try {
      let r;
      // One automatic retry: the model occasionally answers in the wrong format.
      try {
        r = await talkTurn(req, { signal: ctrl.signal });
      } catch (e) {
        if (e.name === "AbortError") throw e;
        r = await talkTurn(req, { signal: ctrl.signal });
      }
      if (needSay && r.say) me.say = { zh: r.say, py: await toPinyin(r.say) };
      logAnswer(!needSay);
      s.turns.push({ who: "ai", zh: r.zh, py: await toPinyin(r.zh), en: r.en });
      if (pref("talkSpeak", true) && canSpeak() && log.isConnected) speak(r.zh);
    } catch (e) {
      if (e.name === "AbortError") return;
      error = esc(e.message);
    } finally {
      busy = false;
    }
    draw();
  }

  async function hints() {
    const last = s.turns[s.turns.length - 1];
    if (showHints || last.hints) {
      showHints = !showHints;
      return draw();
    }
    hinting = true;
    error = "";
    draw();
    ctrl = new AbortController();
    try {
      const hs = await talkHints({ scenario: s.scenario.id, level: s.level, history: asHistory(s.turns) }, { signal: ctrl.signal });
      last.hints = await Promise.all(hs.map(async (h) => ({ ...h, py: await toPinyin(h.zh) })));
      showHints = true;
    } catch (e) {
      if (e.name === "AbortError") return;
      error = esc(e.message);
    } finally {
      hinting = false;
    }
    draw();
  }

  function send(text) {
    text = text.trim();
    if (!text || busy) return;
    if (/[a-z][1-5]/i.test(text)) text = numbersToMarks(text);
    s.turns.push({ who: "me", text });
    input.value = "";
    preview.textContent = "";
    ask();
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    send(input.value);
  });
  input.addEventListener("input", () => {
    preview.textContent = /[a-z][1-5]/i.test(input.value) ? numbersToMarks(input.value) : "";
  });
  hintBtn.addEventListener("click", hints);
  root.querySelector("#endBtn").addEventListener("click", () => renderReview(root));
  root.querySelectorAll("[data-pref]").forEach((cb) =>
    cb.addEventListener("change", () => {
      setSetting(cb.dataset.pref, cb.checked);
      draw();
    })
  );
  log.addEventListener("click", (e) => {
    const say = e.target.closest("[data-say]");
    if (say) return speak(say.dataset.say);
    const reveal = e.target.closest("[data-reveal]");
    if (reveal) {
      reveal.nextElementSibling.hidden = false;
      reveal.remove();
      return;
    }
    const use = e.target.closest("[data-use]");
    if (use) {
      input.value = use.dataset.use;
      input.focus();
    }
  });

  root.querySelector("#micBtn")?.addEventListener("click", (e) => {
    const btn = e.currentTarget;
    if (rec) return rec.stop();
    stopSpeaking();
    rec = new SR();
    rec.lang = "zh-CN";
    rec.interimResults = true;
    rec.onresult = (ev) => {
      input.value = Array.from(ev.results, (r) => r[0].transcript).join("");
    };
    rec.onend = () => {
      rec = null;
      btn.classList.remove("on");
    };
    rec.onerror = rec.onend;
    btn.classList.add("on");
    rec.start();
  });

  draw();
  // Resume a reply that was interrupted by leaving the tab mid-request.
  if (s.turns[s.turns.length - 1].who === "me") ask();
  else if (s.turns.length === 1 && pref("talkSpeak", true) && canSpeak()) speak(s.turns[0].zh);

  endChat = () => {
    ctrl?.abort();
    rec?.abort();
    endChat = () => {};
  };
}

/* ---------- review ---------- */
function renderReview(root) {
  const s = session;
  endChat();
  stopSpeaking();
  const mine = s.turns.filter((t) => t.who === "me");
  const inZh = mine.filter((t) => inChinese(t.text)).length;
  const says = mine.filter((t) => t.say);
  root.innerHTML = `
    <div class="results">
      <h2>${esc(s.scenario.title)}</h2>
      <div class="score">${inZh}/${mine.length}</div>
      <p class="muted">${mine.length ? "of your messages were in Chinese (characters or pinyin)" : "You didn't send any messages this time."}</p>
      ${
        says.length
          ? `<p class="muted">Phrases to learn — what you said, in Chinese:</p>
             <ul class="missed talk-fixes">${says
               .map((t) => `<li>${esc(t.text)}<br /><b>${esc(t.say.zh)}</b> ${esc(t.say.py)}</li>`)
               .join("")}</ul>`
          : ""
      }
      <div class="cta-row center">
        <button class="btn primary" id="againBtn">Try again</button>
        <a class="btn" href="#/talk">Other scenarios</a>
      </div>
    </div>`;
  root.querySelector("#againBtn").addEventListener("click", () => {
    newSession(s.scenario);
    renderChat(root);
  });
}

export function mount(root, arg) {
  const sc = arg && SCENARIO_BY_ID.get(arg);
  if (!sc) {
    renderHome(root);
    return stopSpeaking;
  }
  if (session?.scenario !== sc) newSession(sc);
  renderChat(root);
  return () => {
    endChat();
    stopSpeaking();
  };
}
