import "@fontsource-variable/nunito/wght.css";
import "./styles.css";
import { VOCAB } from "./data/vocab.js";
import { ALL_SENTENCES } from "./data/lessons.js";
import { dailyGoal, getState, streak, subscribe, todayStats } from "./lib/store.js";
import { initGame, levelFor } from "./lib/game.js";
import { initSync } from "./lib/sync.js";
import { initPwa } from "./pwa.js";
import * as learn from "./views/learn.js";
import * as lesson from "./views/lesson.js";
import * as words from "./views/words.js";
import * as practice from "./views/practice.js";
import * as progress from "./views/progress.js";
import * as talk from "./views/talk.js";
import * as tones from "./views/tones.js";

const ROUTES = { learn, lesson, words, practice, tones, talk, progress };
const TAB_FOR = { lesson: "learn", words: "practice", tones: "practice" };

const view = document.getElementById("view");
let cleanup = null;

function safeDecode(s) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function route() {
  const [, name = "learn", arg] = location.hash.replace(/^#/, "").split("/");
  const mod = ROUTES[name] || learn;
  const key = ROUTES[name] ? name : "learn";
  try {
    cleanup?.();
  } catch (e) {
    console.error(e);
  }
  cleanup = null;
  document.body.classList.remove("in-drill");
  view.innerHTML = "";
  view.className = "view-" + key;
  try {
    cleanup = mod.mount(view, arg ? safeDecode(arg) : undefined) || null;
  } catch (e) {
    // A broken screen shouldn't leave a blank page: progress is already saved.
    console.error(e);
    view.innerHTML = `<div class="empty" role="alert">
      <p>Something went wrong showing this screen. Your progress is saved.</p>
      <div class="cta-row center"><a class="btn primary" href="#/learn">Back to Learn</a>
      <button class="btn" id="reloadBtn">Reload the app</button></div></div>`;
    view.querySelector("#reloadBtn").addEventListener("click", () => location.reload());
  }
  document.querySelectorAll(".tabs a").forEach((a) => {
    const on = a.dataset.tab === (TAB_FOR[key] || key);
    a.classList.toggle("active", on);
    if (on) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  window.scrollTo({ top: 0 });
}

function renderHeader() {
  const days = streak();
  const day = todayStats();
  const goal = dailyGoal();
  document.getElementById("statStreak").textContent = days;
  document.getElementById("chipStreak").classList.toggle("cold", !day.n);
  document.getElementById("statXp").textContent = day.x;
  document.getElementById("chipXp").classList.toggle("full", day.x >= goal);
  document.getElementById("chipXp").setAttribute("aria-label", `${day.x} of ${goal} XP today`);
  document.getElementById("statLevel").textContent = levelFor(getState().xp).level;
  document.getElementById("footCount").textContent = `${VOCAB.length} words · ${ALL_SENTENCES.length} sentences`;
}

window.addEventListener("hashchange", route);
subscribe(renderHeader);
renderHeader();
route();
initGame();
initSync();
initPwa();
