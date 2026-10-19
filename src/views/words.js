/* Words tab — the original rapid-recall flashcards, now with saved progress. */
import { VOCAB, CATEGORIES } from "../data/vocab.js";
import { dayNum, getItem, getSettings, getState, isMastered, markSeen, review, setSetting } from "../lib/store.js";
import { canSpeak, speak, stopSpeaking } from "../lib/speech.js";
import { esc, shuffle, onKeys, SPEAKER } from "../lib/util.js";

const SPEEDS = [
  [0, "Manual — I'll flip myself"],
  [5000, "Relaxed — 5s/card"],
  [3000, "Standard — 3s/card"],
  [1500, "Rapid fire — 1.5s/card"],
];

function dueWords() {
  const { items } = getState();
  const today = dayNum();
  return VOCAB.filter((v) => {
    const it = items[v.key];
    return it && (it.c || it.w) && it.d <= today;
  });
}

export function mount(root, initialCat) {
  let activeCat = initialCat === "due" ? "Due" : "All";
  let deck = [];
  let order = [];
  let pos = 0;
  let flipped = false;
  let timer = null;
  let answered = 0;
  let again = 0;
  const settings = getSettings();

  root.innerHTML = `
    <div class="rail" id="catRail"></div>
    <div class="stage">
      <div class="deck-area">
        <div class="progress-track"><div class="progress-fill" id="progressFill"></div></div>
        <div class="card" id="card" tabindex="0">
          <div class="cat-tag" id="catTag">—</div>
          <div class="idx-tag" id="idxTag">0 / 0</div>
          <div class="step-rail">
            <span class="step-pt active">1 · character</span><span class="step-arrow">→</span>
            <span class="step-pt active">2 · pinyin</span><span class="step-arrow">→</span>
            <span class="step-pt" id="step3">3 · meaning</span>
          </div>
          <div class="hanzi" id="hanzi"></div>
          <div class="pinyin" id="pinyinFancy"></div>
          <div class="english hidden" id="english"></div>
          <div class="box-meter" id="boxMeter" aria-hidden="true"></div>
          <div class="flip-hint" id="flipHint">tap card or press space to reveal</div>
          ${canSpeak() ? `<button class="icon-btn card-say" id="sayBtn" aria-label="Play audio">${SPEAKER}</button>` : ""}
        </div>
        <div class="empty hidden" id="emptyDeck">
          <p>No words due right now — nice work.</p>
          <button class="btn primary" id="toAll">Drill all words</button>
        </div>
        <div class="controls">
          <button class="btn ghost" id="btnPrev">&larr; back</button>
          <button class="btn primary" id="btnFlip">flip (space)</button>
          <button class="btn again" id="btnAgain">↻ again (a)</button>
          <button class="btn know" id="btnKnow">✓ know it (k)</button>
          <button class="btn ghost" id="btnShuffle">⤮ shuffle</button>
        </div>
      </div>
      <div class="panel">
        <h3>Sprint speed</h3>
        <div class="speed-opt" id="speedOpts">
          ${SPEEDS.map(([v, l]) => `<label data-v="${v}"><input type="radio" name="spd" value="${v}" />${l}</label>`).join("")}
        </div>
        ${canSpeak() ? `<label class="check"><input type="checkbox" id="autoSpeak" ${settings.autoSpeak ? "checked" : ""}/> Speak each card aloud</label>` : ""}
        <h3>This session</h3>
        <div class="mini-stats">
          <div class="row"><span>Category</span><b id="panelCat"></b></div>
          <div class="row"><span>Cards remaining</span><b id="panelRemaining">0</b></div>
          <div class="row"><span>Mastered here</span><b id="panelMastered">0</b></div>
          <div class="row"><span>Marked again</span><b id="panelAgain">0</b></div>
          <div class="row"><span>Accuracy</span><b id="panelAcc">—</b></div>
        </div>
      </div>
    </div>`;

  const el = (id) => root.querySelector("#" + id);
  const cardEl = el("card");

  function buildRail() {
    const due = dueWords().length;
    const cats = [["Due", due], ["All", VOCAB.length], ...CATEGORIES.map((c) => [c, VOCAB.filter((v) => v.cat === c).length])];
    el("catRail").innerHTML = cats
      .map(
        ([c, n]) =>
          `<button class="chip ${c === activeCat ? "active" : ""} ${c === "Due" ? "due-chip" : ""}" data-cat="${esc(c)}">${c === "Due" ? "⟳ Due" : esc(c)} <span class="ct">${n}</span></button>`
      )
      .join("");
  }
  el("catRail").addEventListener("click", (e) => {
    const chip = e.target.closest("[data-cat]");
    if (chip) setCategory(chip.dataset.cat);
  });

  function setCategory(cat) {
    activeCat = cat;
    deck = cat === "All" ? [...VOCAB] : cat === "Due" ? dueWords() : VOCAB.filter((v) => v.cat === cat);
    order = shuffle([...deck.keys()]);
    pos = 0;
    answered = 0;
    again = 0;
    el("panelCat").textContent = cat === "All" ? "All words" : cat;
    buildRail();
    render();
  }

  const current = () => deck[order[pos]];

  function render() {
    const empty = deck.length === 0;
    cardEl.classList.toggle("hidden", empty);
    el("emptyDeck").classList.toggle("hidden", !empty);
    if (empty) return updateStats();
    const card = current();
    flipped = false;
    el("hanzi").textContent = card.hz;
    el("pinyinFancy").textContent = card.py;
    el("english").textContent = card.en;
    el("english").classList.add("hidden");
    el("flipHint").textContent = "tap card or press space to reveal";
    el("step3").className = "step-pt";
    el("catTag").textContent = card.cat;
    el("idxTag").textContent = pos + 1 + " / " + deck.length;
    el("progressFill").style.width = ((pos + 1) / deck.length) * 100 + "%";
    const it = getItem(card.key);
    const box = it?.c || it?.w ? it.b : -1;
    el("boxMeter").innerHTML = box < 0 ? "<span class='new'>new</span>" : Array.from({ length: 4 }, (_, i) => `<i class="${i < box ? "on" : ""}"></i>`).join("");
    cardEl.classList.toggle("needs-review", !!it?.w && box < 2);
    markSeen(card.key);
    if (getSettings().autoSpeak) speak(card.hz);
    updateStats();
  }

  function flip() {
    if (!deck.length) return;
    flipped = !flipped;
    el("english").classList.toggle("hidden", !flipped);
    el("flipHint").textContent = flipped ? "got it? mark know / again →" : "tap card or press space to reveal";
    el("step3").className = flipped ? "step-pt done" : "step-pt";
  }

  function advance(know) {
    if (!deck.length) return;
    if (know !== undefined) {
      review(current().key, know);
      answered++;
      if (!know) again++;
    }
    pos = (pos + 1) % deck.length;
    if (pos === 0) order = shuffle([...deck.keys()]);
    render();
  }

  function goBack() {
    if (!deck.length) return;
    pos = (pos - 1 + deck.length) % deck.length;
    render();
  }

  function updateStats() {
    el("panelRemaining").textContent = Math.max(0, deck.length - (pos + 1));
    el("panelMastered").textContent = `${deck.filter((v) => isMastered(getItem(v.key))).length} / ${deck.length}`;
    el("panelAgain").textContent = again;
    el("panelAcc").textContent = answered ? Math.round(((answered - again) / answered) * 100) + "%" : "—";
  }

  function setSpeed(ms) {
    setSetting("speed", ms);
    clearInterval(timer);
    root.querySelectorAll("#speedOpts label").forEach((l) => {
      const on = Number(l.dataset.v) === ms;
      l.classList.toggle("active", on);
      l.querySelector("input").checked = on;
    });
    if (ms > 0) timer = setInterval(() => (flipped ? advance(undefined) : flip()), ms);
  }
  root.querySelectorAll("#speedOpts label").forEach((l) => l.addEventListener("click", () => setSpeed(Number(l.dataset.v))));
  el("autoSpeak")?.addEventListener("change", (e) => setSetting("autoSpeak", e.target.checked));

  cardEl.addEventListener("click", (e) => {
    if (e.target.closest("#sayBtn")) return speak(current().hz);
    flip();
  });
  el("btnFlip").addEventListener("click", flip);
  el("btnKnow").addEventListener("click", () => advance(true));
  el("btnAgain").addEventListener("click", () => advance(false));
  el("btnPrev").addEventListener("click", goBack);
  el("toAll").addEventListener("click", () => setCategory("All"));
  el("btnShuffle").addEventListener("click", () => {
    order = shuffle([...deck.keys()]);
    pos = 0;
    render();
  });

  const offKeys = onKeys((e) => {
    if (e.code === "Space") {
      e.preventDefault();
      flip();
    } else if (e.code === "ArrowRight") advance(undefined);
    else if (e.code === "ArrowLeft") goBack();
    else if (e.key === "k" || e.key === "K") advance(true);
    else if (e.key === "a" || e.key === "A") advance(false);
  });

  setCategory(activeCat);
  setSpeed(settings.speed || 0);

  return () => {
    clearInterval(timer);
    offKeys();
    stopSpeaking();
  };
}
