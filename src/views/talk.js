/* Talk tab — role-play conversations with an AI model that runs on the device
 * (see lib/llm.js). The partner replies in Chinese + English and offers reply
 * suggestions; when the learner writes English or pinyin it also shows how to
 * say that in Chinese. Pinyin is added locally with pinyin-pro rather than
 * generated, which is both faster and more accurate.
 *
 * Small on-device models can't reliably judge a learner's grammar (in testing
 * they flagged correct sentences), so they're only asked to translate, never
 * to grade. The session lives at module level so switching tabs doesn't lose
 * the conversation.
 */
import { SCENARIOS, SCENARIO_BY_ID } from "../data/scenarios.js";
import {
  MODELS, chatJson, deleteModel, gpuInfo, isDownloaded, isLoaded, loadModel, modelChoice, onMeteredNetwork, setModelChoice,
} from "../lib/llm.js";
import { getSettings, logAnswer, setSetting } from "../lib/store.js";
import { canSpeak, speak, stopSpeaking } from "../lib/speech.js";
import { looksLikePinyin, numbersToMarks } from "../lib/pinyin.js";
import { esc, SPEAKER } from "../lib/util.js";

const HISTORY = 10; // most recent messages sent to the model, plus the system prompt
const LEVELS = {
  beginner: { label: "Beginner", hsk: "HSK 1–2", style: "very short, simple sentences" },
  elementary: { label: "Elementary", hsk: "HSK 1–3", style: "short, natural sentences" },
};
const SR = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : undefined;

/* Compact JSON with no free whitespace and no raw newlines in strings:
 * {"say_zh":"…",  ← only when the learner wrote English
 *  "reply_zh":"…","reply_en":"…","suggestions":[{"zh":"…","en":"…"},{"zh":"…","en":"…"}]} */
const GRAMMAR_BASE = String.raw`
str ::= "\"" char* "\""
char ::= [^"\\\r\n] | "\\" ["\\/nt]
line ::= "{\"zh\":" str ",\"en\":" str "}"
reply ::= "\"reply_zh\":" str ",\"reply_en\":" str ",\"suggestions\":[" line "," line "]}"`;
const grammarFor = (needSay) => `root ::= "{" ${needSay ? String.raw`"\"say_zh\":" str ","` : ""} reply` + GRAMMAR_BASE;
const hasHanzi = (t) => /[\u4e00-\u9fff]/.test(t || "");
const inChinese = (t) => hasHanzi(t) || looksLikePinyin(t);

/** @type {null | {scenario: object, level: string, turns: object[]}} */
let session = null;
let endChat = () => {}; // aborts the open chat's request / mic
/* Model download/load progress, kept here so it survives leaving the tab. */
let dl = null; // { choice, progress: 0-1, text, error }
let onDl = () => {};

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

function startLoad(choice) {
  dl = { choice, progress: 0, text: "Starting…" };
  onDl();
  return loadModel(choice, ({ progress, text }) => {
    dl = { choice, progress, text };
    onDl();
  })
    .then(() => {
      dl = null;
      onDl();
    })
    .catch((e) => {
      dl = { choice, progress: 0, error: e.message || String(e) };
      onDl();
      throw e;
    });
}

function systemPrompt(sc, lvl) {
  const L = LEVELS[lvl];
  return `你在一个中文口语练习里扮演角色，对方是刚开始学中文的外国人。只说很简单的中文（${L.hsk}）。
You are ${sc.role}, talking with a ${L.label.toLowerCase()} learner of Mandarin (the learner). Their task: ${sc.goal}

Answer every learner message with JSON:
- say_zh (only when asked for): how the learner should say their English message in Chinese — same speaker, same meaning ("I…" stays 我…), simple and natural.
- reply_zh: what you say next, staying in character. Chinese characters only (no English, no pinyin), 1–2 ${L.style}, usually ending with a question.
- reply_en: English translation of reply_zh.
- suggestions: 2 different short answers the LEARNER could give to your reply_zh, in Chinese, with English.`;
}

function modelMessages(s) {
  const msgs = s.turns.map((t) =>
    t.who === "me" ? { role: "user", content: t.text } : { role: "assistant", content: JSON.stringify({ reply_zh: t.zh, reply_en: t.en }) }
  );
  return [{ role: "system", content: systemPrompt(s.scenario, s.level) }, ...msgs.slice(-HISTORY)];
}

function newSession(sc) {
  const o = sc.opener;
  session = { scenario: sc, level: level(), turns: [{ who: "ai", zh: o.zh, py: o.py, en: o.en, suggestions: [] }] };
}

/* ---------- home: on-device model + scenario picker ---------- */
function renderHome(root) {
  const lvl = level();
  root.innerHTML = `
    <div class="lesson-head">
      <div class="lesson-kicker">Conversation practice · on-device AI</div>
      <h2>Talk it through</h2>
    </div>
    <p class="muted talk-lede">Role-play everyday situations with an AI partner that runs entirely on this device,
    offline once it's downloaded. Reply in characters, pinyin (<code>ni3 hao3</code> works) or English. Your partner
    answers in Mandarin, shows how to say your English or pinyin in Chinese, and suggests what to say next.</p>

    <div class="model-panel" id="modelPanel"><div class="llm-status"><span class="dot"></span><span>Checking this device…</span></div></div>

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
  const panel = root.querySelector("#modelPanel");
  onDl = () => panel.isConnected && renderModelPanel(panel);
  renderModelPanel(panel);
}

async function renderModelPanel(panel) {
  if (!(await gpuInfo())) {
    panel.innerHTML = `<div class="llm-status bad"><span class="dot"></span><span>This browser can't run the on-device AI because
      it needs <b>WebGPU</b>. Try Chrome or Edge on a computer or Android, or Safari on iOS/macOS 26 or newer.</span></div>`;
    return;
  }
  const choice = modelChoice();
  const have = {};
  for (const k of Object.keys(MODELS)) have[k] = await isDownloaded(k).catch(() => false);
  const ready = await isLoaded(choice);
  if (!panel.isConnected) return;
  const m = MODELS[choice];

  let status;
  if (dl && !dl.error) {
    status = `<div class="llm-status"><span class="dot"></span><span>${have[dl.choice] ? "Loading" : "Downloading"} ${MODELS[dl.choice].label} model…
      ${Math.round(dl.progress * 100)}%<br /><small>${esc(dl.text)}</small></span></div>
      <div class="progress-track"><div class="progress-fill" style="width:${dl.progress * 100}%"></div></div>`;
  } else if (dl?.error) {
    status = `<div class="llm-status bad"><span class="dot"></span><span>Couldn't load the model: ${esc(dl.error)}</span></div>
      <div class="cta-row"><button class="btn primary" data-dl>Try again</button></div>`;
  } else if (ready) {
    status = `<div class="llm-status ok"><span class="dot"></span><span>Ready · <b>${m.label}</b> model loaded, no network needed. Pick a scenario below.</span></div>`;
  } else if (have[choice]) {
    status = `<div class="llm-status ok"><span class="dot"></span><span><b>${m.label}</b> model is downloaded and loads from this device when you start a chat.</span></div>`;
  } else {
    status = `<div class="llm-status warn"><span class="dot"></span><span>Download the <b>${m.label}</b> model once (${m.mb} MB). After that, Talk works offline
      and uses no data.${onMeteredNetwork() ? " <b>You seem to be on mobile data or data saver, so Wi-Fi is recommended.</b>" : ""}</span></div>
      <div class="cta-row"><button class="btn primary" data-dl>Download ${m.label} · ${m.mb} MB</button></div>`;
  }

  panel.innerHTML = `
    <div class="model-opts" role="radiogroup" aria-label="AI model">
      ${Object.entries(MODELS)
        .map(
          ([k, M]) => `
        <button class="model-opt ${k === choice ? "active" : ""}" data-model="${k}" role="radio" aria-checked="${k === choice}" ${dl && !dl.error ? "disabled" : ""}>
          <span class="mo-head"><b>${M.label}</b><span>${have[k] ? "✓ on device" : `${M.mb} MB`}</span></span>
          <small>${M.note}</small>
        </button>`
        )
        .join("")}
    </div>
    ${status}
    ${
      Object.values(have).some(Boolean) && !(dl && !dl.error)
        ? `<p class="muted model-manage">${Object.keys(MODELS)
            .filter((k) => have[k])
            .map((k) => `<button class="link-btn" data-del="${k}">Remove ${MODELS[k].label} (${MODELS[k].mb} MB)</button>`)
            .join(" · ")}</p>`
        : ""
    }`;

  panel.querySelectorAll("[data-model]").forEach((b) =>
    b.addEventListener("click", () => {
      setModelChoice(b.dataset.model);
      dl = null;
      renderModelPanel(panel);
    })
  );
  panel.querySelector("[data-dl]")?.addEventListener("click", () => startLoad(choice).catch(() => {}));
  panel.querySelectorAll("[data-del]").forEach((b) =>
    b.addEventListener("click", async () => {
      const k = b.dataset.del;
      if (!confirm(`Remove the ${MODELS[k].label} model from this device? You'd need to download it again (${MODELS[k].mb} MB) to use it.`)) return;
      b.disabled = true;
      await deleteModel(k).catch(() => {});
      renderModelPanel(panel);
    })
  );
}

/* ---------- chat ---------- */
function renderChat(root) {
  endChat();
  const s = session;
  let ctrl = null;
  let rec = null;
  let ready = false;
  let gate = ""; // shown instead of the composer while the model isn't usable

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
          <input class="py-input" id="talkText" placeholder="Reply in 汉字, pinyin or English…" lang="zh" enterkeyhint="send" />
          ${SR ? `<button type="button" class="icon-btn mic" id="micBtn" aria-label="Speak your reply" title="Speak (Mandarin)">🎙</button>` : ""}
          <button class="btn primary" id="sendBtn">Send</button>
        </div>
        <div class="talk-actions">
          <button type="button" class="btn ghost" id="hintBtn">💡 Hint</button>
          <button type="button" class="btn ghost" id="endBtn">End &amp; review</button>
        </div>
      </form>
      <p class="muted talk-note">Replies come from a small on-device AI model and can contain mistakes.</p>
    </div>`;

  const log = root.querySelector("#talkLog");
  const form = root.querySelector("#talkForm");
  const input = root.querySelector("#talkText");
  const preview = root.querySelector("#talkPreview");
  const sendBtn = root.querySelector("#sendBtn");
  let showHints = false;
  let busy = false;
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
          last && showHints && t.suggestions?.length
            ? `<div class="hints">${t.suggestions
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
      (gate ? `<div class="msg err">${gate}</div>` : "") +
      (error ? `<div class="msg err">${error} <button class="btn" id="retryBtn">Retry</button></div>` : "");
    const last = s.turns[s.turns.length - 1];
    root.querySelector("#hintBtn").disabled = busy || last.who !== "ai" || !last.suggestions?.length;
    sendBtn.disabled = busy || !ready;
    log.querySelector("#retryBtn")?.addEventListener("click", ask);
    log.lastElementChild?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  async function ask() {
    error = "";
    busy = true;
    showHints = false;
    draw();
    ctrl = new AbortController();
    try {
      const me = s.turns[s.turns.length - 1];
      // Only English gets a "how to say it" line; pinyin already is Chinese (and
      // small models convert pinyin to characters unreliably).
      const needSay = me.who === "me" && !inChinese(me.text);
      // Small models occasionally answer in English or emit broken JSON; one retry fixes most of it.
      let r;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          r = await chatJson(modelMessages(s), grammarFor(needSay), { signal: ctrl.signal });
        } catch (e) {
          if (e.name === "AbortError" || attempt) throw e;
          continue;
        }
        if (hasHanzi(r.reply_zh)) break;
      }
      if (!hasHanzi(r.reply_zh)) throw new Error("The model didn't answer in Chinese.");
      if (needSay) {
        me.say = hasHanzi(r.say_zh) ? { zh: r.say_zh, py: await toPinyin(r.say_zh) } : null;
      }
      if (me.who === "me") logAnswer(!needSay);
      const suggestions = await Promise.all(
        (r.suggestions || []).filter((h) => hasHanzi(h.zh)).map(async (h) => ({ zh: h.zh, en: h.en, py: await toPinyin(h.zh) }))
      );
      s.turns.push({ who: "ai", zh: r.reply_zh, py: await toPinyin(r.reply_zh), en: r.reply_en, suggestions });
      if (pref("talkSpeak", true) && canSpeak() && log.isConnected) speak(r.reply_zh);
    } catch (e) {
      if (e.name === "AbortError") return;
      error = esc(e.message || "Something went wrong with the AI model.");
    } finally {
      busy = false;
    }
    draw();
  }

  function send(text) {
    text = text.trim();
    if (!text || busy || !ready) return;
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
  root.querySelector("#hintBtn").addEventListener("click", () => {
    showHints = !showHints;
    draw();
  });
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

  /* Bring the model up from this device's cache. Never downloads from here:
   * the download is always an explicit choice on the Talk home screen. */
  async function prepare() {
    const choice = modelChoice();
    if (!(await gpuInfo())) {
      gate = `This browser can't run the on-device AI (WebGPU is needed). <a href="#/talk">More info</a>`;
    } else if (!(await isLoaded(choice))) {
      if (!dl && !(await isDownloaded(choice))) {
        gate = `Download the AI model first (${MODELS[choice].mb} MB, one time). <a class="btn primary" href="#/talk">Go to download</a>`;
      } else {
        onDl = () => {
          gate = dl && !dl.error ? `Loading AI model… ${Math.round(dl.progress * 100)}%` : gate;
          draw();
        };
        onDl();
        try {
          await (dl ? loadModel(choice, (p) => ((dl = { choice, ...p }), onDl())) : startLoad(choice));
        } catch (e) {
          gate = `Couldn't load the AI model: ${esc(e.message || String(e))} <a href="#/talk">Back</a>`;
          draw();
          return;
        }
      }
    }
    if (gate && !(await isLoaded(choice))) return draw();
    gate = "";
    ready = true;
    draw();
    // Resume a reply that was interrupted by leaving the tab mid-request.
    if (s.turns[s.turns.length - 1].who === "me") ask();
    else if (s.turns.length === 1 && pref("talkSpeak", true) && canSpeak()) speak(s.turns[0].zh);
  }

  draw();
  prepare();

  endChat = () => {
    ctrl?.abort();
    rec?.abort();
    onDl = () => {};
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
    return () => {
      onDl = () => {};
      stopSpeaking();
    };
  }
  if (session?.scenario !== sc) newSession(sc);
  renderChat(root);
  return () => {
    endChat();
    stopSpeaking();
  };
}
