/* Tones & sounds trainer.
 *   #/tones          the four tones, plus the drills
 *   #/tones/ear      hear a syllable, pick its tone
 *   #/tones/pairs    hear a two-syllable word, pick both tones
 *   #/tones/sounds   hear one of two look-alike sounds, pick which
 *   #/tones/mirror   say a syllable and see your pitch against the tone's shape
 * Listening drills use the device's Mandarin voice; the mirror uses the
 * microphone and never sends or stores audio.
 */
import { PAIRS, SHAPES, SOUNDS, SYLLABLES, TONES } from "../data/tones.js";
import { XP, addXp, getState, logAnswer, recordDrill, toneId } from "../lib/store.js";
import { canSpeak, speak, stopSpeaking } from "../lib/speech.js";
import { canRecord, classifyTone, record, toContour } from "../lib/pitch.js";
import { buzz, confetti, sound } from "../lib/fx.js";
import { bao } from "../lib/mascot.js";
import { esc, pickOne, sample, shuffle, SPEAKER } from "../lib/util.js";
import { createDrill, endFocus, resultsHtml } from "./drill.js";

const ROUND = 10;

/* ---------- drawing ---------- */
const W = 100;
const H = 60;
const xy = ([t, h]) => `${(6 + t * (W - 12)).toFixed(1)},${(H - 6 - h * (H - 12)).toFixed(1)}`;
const shapePath = (tone) => "M" + SHAPES[tone].map(xy).join(" L");
/** The pitch shape of a tone as a small chart. */
export const toneGlyph = (tone, cls = "") =>
  `<svg class="tone-glyph ${cls}" viewBox="0 0 ${W} ${H}" aria-hidden="true"><path d="${shapePath(tone)}" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const DRILLS = [
  { id: "ear", ico: "👂", title: "Which tone?", sub: "Hear one syllable, pick its tone", needsVoice: true },
  { id: "pairs", ico: "🎶", title: "Tone pairs", sub: "Two syllables, two tones — how words really sound", needsVoice: true },
  { id: "sounds", ico: "👄", title: "Tricky sounds", sub: "zh or z? x or sh? u or ü?", needsVoice: true },
  { id: "mirror", ico: "🎙", title: "Tone mirror", sub: "Say it and see the shape of your own voice", needsMic: true },
];

/* ---------- hub ---------- */
function hub(root) {
  endFocus();
  const { lessons } = getState();
  const voice = canSpeak();
  root.innerHTML = `
    <a class="back-link" href="#/practice">← Practice</a>
    <div class="hero-row">
      <div class="hero-bao">${bao("think", 84)}</div>
      <div class="lesson-head">
        <div class="lesson-kicker">Pronunciation</div>
        <h2>Tones &amp; sounds</h2>
        <p class="muted">In Mandarin the melody of a syllable is part of the word: <b lang="zh">mā</b> is “mother”,
        <b lang="zh">mǎ</b> is “horse”. Train your ear first — your voice follows.</p>
      </div>
    </div>
    ${voice ? "" : `<div class="llm-status warn"><span class="dot"></span><span>This device has no Mandarin voice installed, so the listening drills can't play audio. The tone mirror still works.</span></div>`}

    <h3 class="section-title">The four tones${voice ? " · tap to hear" : ""}</h3>
    <div class="tone-chart">
      ${TONES.map(
        (t) => `
        <button class="tone-card t${t.n}" data-say="${t.hz}" ${voice ? "" : "disabled"}>
          ${toneGlyph(t.n)}
          <span class="tone-py">${t.py}</span>
          <span class="tone-name">${t.name} · ${t.shape}</span>
          <span class="tone-tip">${esc(t.tip)}</span>
        </button>`
      ).join("")}
    </div>
    <p class="muted">There's also a light, short <b>neutral tone</b> with no mark (the second <i>ma</i> in <span lang="zh">妈妈 māma</span>).</p>

    <h3 class="section-title">Train</h3>
    <div class="drill-grid">
      ${DRILLS.map((d) => {
        const rec = lessons[toneId(d.id)];
        const off = (d.needsVoice && !voice) || (d.needsMic && !canRecord());
        return `
        <a class="drill-card ${off ? "off" : ""}" ${off ? 'aria-disabled="true"' : `href="#/tones/${d.id}"`}>
          <span class="drill-ico" aria-hidden="true">${d.ico}</span>
          <span class="drill-main"><b>${d.title}</b><small>${d.sub}</small></span>
          ${rec?.runs && d.id !== "mirror" ? `<span class="scene-tag ${rec.done ? "done" : "ready"}">best ${rec.best}%</span>` : ""}
        </a>`;
      }).join("")}
    </div>

    <h3 class="section-title">Two rules worth knowing</h3>
    <ul class="plain-list muted">
      <li><b>Two 3rd tones in a row:</b> the first one rises like a 2nd tone. <span lang="zh">你好</span> is written
      <i>nǐ hǎo</i> but said <i>ní hǎo</i>.</li>
      <li><b><span lang="zh">不</span> and <span lang="zh">一</span> change:</b> before a 4th tone they become 2nd tone —
      <i>bú shì</i>, <i>yí ge</i>. The lessons already write them the way they're spoken.</li>
    </ul>`;
  root.querySelectorAll("[data-say]").forEach((b) => b.addEventListener("click", () => speak(b.dataset.say, 0.7)));
}

/* ---------- listening rounds ---------- */
const toneBtn = (n, attrs = "") => `
  <button class="tone-btn t${n}" data-tone="${n}" ${attrs}>
    ${toneGlyph(n)}<b>${n}</b><small>${TONES[n - 1].shape}</small>
  </button>`;
const listenRow = (text) => `
  <div class="listen-row">
    <button class="btn primary big-say" data-say="${esc(text)}">${SPEAKER} Play</button>
    <button class="btn ghost" data-say="${esc(text)}" data-rate="0.5">🐢 Slow</button>
  </div>`;

/* Each question type renders itself into `el` and calls answer(ok, reveal html). */
const QUESTIONS = {
  ear: {
    title: "Which tone do you hear?",
    make: () => sample(SYLLABLES, ROUND),
    render(el, q, answer) {
      el.innerHTML = `${listenRow(q.hz)}<div class="tone-opts">${[1, 2, 3, 4].map((n) => toneBtn(n)).join("")}</div>`;
      el.querySelectorAll("[data-tone]").forEach((b) =>
        b.addEventListener("click", () => {
          const ok = Number(b.dataset.tone) === q.tone;
          el.querySelectorAll("[data-tone]").forEach((x) => {
            x.disabled = true;
            if (Number(x.dataset.tone) === q.tone) x.classList.add("right");
          });
          if (!ok) b.classList.add("wrong");
          answer(ok, `<b lang="zh">${q.hz}</b> <span class="t${q.tone} tone-ink">${q.py}</span> — ${TONES[q.tone - 1].name}, ${TONES[q.tone - 1].shape}`);
        })
      );
      return q.hz;
    },
  },
  pairs: {
    title: "Pick the tone of each syllable",
    make: () => sample(PAIRS, ROUND),
    render(el, q, answer) {
      const picked = [0, 0];
      el.innerHTML = `${listenRow(q.hz)}
        ${[0, 1]
          .map(
            (i) => `<div class="pair-row"><span class="pair-label">${i ? "2nd" : "1st"} syllable</span>
            <div class="tone-opts small" data-row="${i}">${[1, 2, 3, 4].map((n) => toneBtn(n)).join("")}</div></div>`
          )
          .join("")}
        <button class="btn primary wide" id="pairCheck" disabled>Check</button>`;
      const check = el.querySelector("#pairCheck");
      el.querySelectorAll("[data-row]").forEach((row) =>
        row.addEventListener("click", (e) => {
          const b = e.target.closest("[data-tone]");
          if (!b || b.disabled) return;
          picked[row.dataset.row] = Number(b.dataset.tone);
          row.querySelectorAll("[data-tone]").forEach((x) => x.classList.toggle("picked", x === b));
          check.disabled = !(picked[0] && picked[1]);
        })
      );
      check.addEventListener("click", () => {
        check.remove();
        el.querySelectorAll("[data-row]").forEach((row) => {
          const want = q.tones[row.dataset.row];
          row.querySelectorAll("[data-tone]").forEach((x) => {
            const n = Number(x.dataset.tone);
            x.disabled = true;
            if (n === want) x.classList.add("right");
            else if (x.classList.contains("picked")) x.classList.add("wrong");
          });
        });
        answer(picked[0] === q.tones[0] && picked[1] === q.tones[1], `<b lang="zh">${q.hz}</b> ${q.py} — tones ${q.tones[0]} + ${q.tones[1]}`);
      });
      return q.hz;
    },
  },
  sounds: {
    title: "Which one do you hear?",
    make: () => sample(SOUNDS, ROUND).map((p) => ({ ...p, said: pickOne(["a", "b"]) })),
    render(el, q, answer) {
      const opts = shuffle(["a", "b"]);
      el.innerHTML = `${listenRow(q[q.said].hz)}
        <p class="sound-focus">${esc(q.focus)}</p>
        <div class="sound-opts">${opts.map((k) => `<button class="sound-btn" data-k="${k}">${q[k].py}</button>`).join("")}</div>`;
      el.querySelectorAll("[data-k]").forEach((b) =>
        b.addEventListener("click", () => {
          const ok = b.dataset.k === q.said;
          el.querySelectorAll("[data-k]").forEach((x) => {
            x.disabled = true;
            if (x.dataset.k === q.said) x.classList.add("right");
          });
          if (!ok) b.classList.add("wrong");
          const hear = (k) => `<button class="chip" data-say="${q[k].hz}">${SPEAKER} ${q[k].py} <span lang="zh">${q[k].hz}</span></button>`;
          answer(ok, `${esc(q.tip)}<div class="compare">Compare: ${hear("a")} ${hear("b")}</div>`);
        })
      );
      return q[q.said].hz;
    },
  },
};

function round(root, id) {
  const kind = QUESTIONS[id];
  const queue = kind.make();
  const total = queue.length;
  let n = 0;
  let right = 0;
  let timer = null;
  const hud = createDrill(root, {
    quitLabel: "End round",
    onQuit: () => {
      clearTimeout(timer);
      location.hash = "#/tones";
    },
  });
  hud.exRoot.addEventListener("click", (e) => {
    const say = e.target.closest("[data-say]");
    if (say) speak(say.dataset.say, say.dataset.rate ? Number(say.dataset.rate) : 0.8);
  });

  function next() {
    hud.progress(n, total);
    const q = queue[n];
    if (!q) return finish();
    hud.exRoot.innerHTML = `<div class="ex tone-ex"><div class="ex-kind">${kind.title}</div><div class="ex-body"></div><div class="ex-foot"></div></div>`;
    const foot = hud.exRoot.querySelector(".ex-foot");
    const text = kind.render(hud.exRoot.querySelector(".ex-body"), q, (ok, reveal) => {
      logAnswer(ok, { tone: true });
      hud.mark(ok);
      sound(ok ? "right" : "wrong");
      if (!ok) buzz(60);
      n++;
      if (ok) right++;
      hud.exRoot.querySelector(".ex").classList.add("answered", ok ? "is-ok" : "is-bad");
      foot.innerHTML = `
        <div class="feedback ${ok ? "correct" : "wrong"}">
          <div class="fb-title">${ok ? "✓ Nice ear!" : "✗ Not quite"}</div>
          <div class="fb-note">${reveal}</div>
          <button class="btn primary wide" data-continue>Continue</button>
        </div>`;
      const cont = foot.querySelector("[data-continue]");
      cont.addEventListener("click", () => {
        clearTimeout(timer);
        next();
      });
      cont.focus({ preventScroll: true });
      // Right answers move on by themselves to keep the rhythm; wrong ones wait.
      if (ok) timer = setTimeout(next, 1100);
    });
    timer = setTimeout(() => speak(text, 0.8), 300);
  }

  function finish() {
    endFocus();
    const pct = Math.round((right / total) * 100);
    const bonus = pct === 100 ? 20 : 0;
    recordDrill(id, pct);
    if (bonus) addXp(bonus);
    if (pct >= 80) {
      sound("done");
      confetti(pct === 100 ? 70 : 30);
    }
    root.innerHTML = resultsHtml({
      mood: pct >= 80 ? "cheer" : pct >= 50 ? "happy" : "calm",
      title: pct === 100 ? "Perfect round!" : pct >= 80 ? "Great ear!" : "Round done",
      stars: pct >= 90 ? 3 : pct >= 70 ? 2 : 1,
      big: { value: `${right}/${total}`, label: "correct" },
      xp: right * XP.right + (total - right) * XP.wrong + bonus,
      combo: hud.bestCombo(),
      lines: [pct >= 80 ? "Ears like these make speaking easier." : "Tones take repetition — every round sharpens your ear."],
      buttons: `<button class="btn primary" id="againBtn">Play again</button><a class="btn" href="#/tones">All drills</a>`,
    });
    root.querySelector("#againBtn").addEventListener("click", () => round(root, id));
  }
  next();
  return () => clearTimeout(timer);
}

/* ---------- tone mirror ---------- */
function mirror(root) {
  endFocus();
  let q = pickOne(SYLLABLES);
  let rec = null;
  let alive = true;

  function draw(contour, verdict = null) {
    // The learner's contour is centred on their own median pitch, ±7 semitones.
    const mine = contour?.length
      ? "M" + contour.map((st, i) => xy([i / (contour.length - 1), Math.min(1, Math.max(0, 0.5 + st / 14))])).join(" L")
      : "";
    root.querySelector("#mirrorChart").innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" class="mirror-svg t${q.tone}" role="img" aria-label="Pitch chart: target tone ${q.tone}${verdict ? `, yours looked like tone ${verdict.tone}` : ""}">
        ${[0.25, 0.5, 0.75].map((y) => `<line x1="4" x2="${W - 4}" y1="${H * y}" y2="${H * y}" class="grid"/>`).join("")}
        <path d="${shapePath(q.tone)}" class="target"/>
        ${mine ? `<path d="${mine}" class="mine"/>` : ""}
      </svg>
      <div class="mirror-legend"><span class="t${q.tone} tone-ink">┅ target</span>${mine ? "<span>━ you</span>" : ""}</div>`;
  }

  function show() {
    root.innerHTML = `
      <a class="back-link" href="#/tones">← Tones &amp; sounds</a>
      <div class="lesson-head"><div class="lesson-kicker">Tone mirror</div><h2>Say it, see it</h2></div>
      <div class="ex mirror">
        <div class="mirror-word">
          <span class="mirror-hz" lang="zh">${q.hz}</span>
          <span class="mirror-py t${q.tone} tone-ink">${q.py}</span>
          <span class="muted">${TONES[q.tone - 1].name} · ${TONES[q.tone - 1].shape}</span>
        </div>
        <div id="mirrorChart"></div>
        <p class="muted mirror-msg" id="mirrorMsg" aria-live="polite">${esc(TONES[q.tone - 1].tip)}</p>
        <div class="cta-row center">
          ${canSpeak() ? `<button class="btn" id="hearBtn">${SPEAKER} Listen</button>` : ""}
          <button class="btn primary big-say" id="recBtn">🎙 Record</button>
          <button class="btn ghost" id="nextBtn">Next →</button>
        </div>
      </div>
      <p class="muted talk-note">Your voice is analysed on this device and never leaves it. The shape is a guide, not a grade —
      quiet rooms and a steady voice work best.</p>`;
    draw(null);
    const msg = root.querySelector("#mirrorMsg");
    const recBtn = root.querySelector("#recBtn");
    root.querySelector("#hearBtn")?.addEventListener("click", () => speak(q.hz, 0.7));
    root.querySelector("#nextBtn").addEventListener("click", () => {
      rec?.stop();
      q = pickOne(SYLLABLES.filter((s) => s !== q));
      show();
    });
    recBtn.addEventListener("click", async () => {
      if (rec) return rec.stop();
      stopSpeaking();
      recBtn.classList.add("on");
      recBtn.textContent = "● Listening…";
      msg.textContent = `Say “${q.py}” now.`;
      const mine = (rec = record());
      let pitches = null;
      try {
        pitches = await mine.promise;
      } catch {
        msg.textContent = "The microphone isn't available. Allow microphone access for this site and try again.";
      }
      if (rec === mine) rec = null;
      if (!alive || !recBtn.isConnected) return;
      recBtn.classList.remove("on");
      recBtn.textContent = "🎙 Record again";
      if (!pitches) return;
      const contour = toContour(pitches);
      const verdict = classifyTone(contour);
      if (!verdict) {
        msg.textContent = "Couldn't hear a clear note — try again a little louder and longer.";
        return;
      }
      draw(contour, verdict);
      const ok = verdict.tone === q.tone;
      logAnswer(ok, { tone: true });
      sound(ok ? "right" : "tap");
      msg.innerHTML = ok
        ? `<b class="ok-ink">That's a ${TONES[q.tone - 1].name}!</b> Your pitch followed the shape.`
        : `That looked more like a <b>${TONES[verdict.tone - 1].name}</b> (${TONES[verdict.tone - 1].shape}). ${esc(TONES[q.tone - 1].tip)}`;
    });
  }
  show();
  return () => {
    alive = false;
    rec?.stop();
  };
}

export function mount(root, arg) {
  let off = () => {};
  if (QUESTIONS[arg] && canSpeak()) off = round(root, arg);
  else if (arg === "mirror" && canRecord()) off = mirror(root);
  else hub(root);
  return () => {
    off();
    stopSpeaking();
    endFocus();
  };
}
