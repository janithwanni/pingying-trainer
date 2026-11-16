/* Shared chrome for anything played as a round (lessons, reviews, tone
 * drills): the top bar with quit, progress and combo, focus mode that hides
 * the app's navigation, and the results screen. */
import { bao } from "../lib/mascot.js";
import { sound } from "../lib/fx.js";
import { esc } from "../lib/util.js";

export const endFocus = () => document.body.classList.remove("in-drill");

export function createDrill(root, { onQuit, quitLabel = "Quit" }) {
  document.body.classList.add("in-drill");
  root.innerHTML = `
    <div class="drill-top">
      <button class="icon-btn" id="quitBtn" aria-label="${esc(quitLabel)}">✕</button>
      <div class="progress-track" role="progressbar" aria-label="Progress" aria-valuemin="0" aria-valuemax="100"><div class="progress-fill" id="drillFill"></div></div>
      <span class="combo" id="combo" hidden></span>
      <span class="drill-count" id="drillCount"></span>
    </div>
    <div id="exRoot"></div>`;
  root.querySelector("#quitBtn").addEventListener("click", onQuit);
  const fill = root.querySelector("#drillFill");
  const comboEl = root.querySelector("#combo");
  let combo = 0;
  let best = 0;
  return {
    exRoot: root.querySelector("#exRoot"),
    progress(done, total) {
      const pct = total ? (done / total) * 100 : 0;
      fill.style.width = pct + "%";
      fill.parentElement.setAttribute("aria-valuenow", Math.round(pct));
      root.querySelector("#drillCount").textContent = `${Math.min(done + 1, total)}/${total}`;
    },
    /** Track answers in a row; returns the current combo. */
    mark(ok) {
      combo = ok ? combo + 1 : 0;
      best = Math.max(best, combo);
      comboEl.hidden = combo < 2;
      if (combo >= 2) {
        comboEl.textContent = `🔥 ${combo}`;
        comboEl.classList.remove("bump");
        void comboEl.offsetWidth; // restart the animation
        comboEl.classList.add("bump");
      }
      if (ok && combo > 0 && combo % 5 === 0) sound("combo");
      return combo;
    },
    bestCombo: () => best,
  };
}

/** Results screen markup; the caller wires up its own buttons. */
export function resultsHtml({ mood = "cheer", title, big, stars, lines = [], xp, combo, extra = "", buttons }) {
  return `
    <div class="results">
      <div class="results-bao pop">${bao(mood, 120)}</div>
      <h2>${esc(title)}</h2>
      ${stars ? `<div class="stars" aria-label="${stars} of 3 stars">${[1, 2, 3].map((i) => `<span class="star ${i <= stars ? "on" : ""}" style="animation-delay:${i * 0.18}s">★</span>`).join("")}</div>` : ""}
      <div class="result-stats">
        <div class="result-stat main"><b>${esc(big.value)}</b><span>${esc(big.label)}</span></div>
        ${xp ? `<div class="result-stat xp"><b>+${xp}</b><span>XP earned</span></div>` : ""}
        ${combo >= 3 ? `<div class="result-stat hot"><b>🔥 ${combo}</b><span>best combo</span></div>` : ""}
      </div>
      ${lines.map((l) => `<p class="muted">${l}</p>`).join("")}
      ${extra}
      <div class="cta-row center">${buttons}</div>
    </div>`;
}
