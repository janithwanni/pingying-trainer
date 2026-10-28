import "./styles.css";
import { VOCAB } from "./data/vocab.js";
import { ALL_SENTENCES } from "./data/lessons.js";
import { streak, subscribe, summarize } from "./lib/store.js";
import { initSync } from "./lib/sync.js";
import { initPwa } from "./pwa.js";
import * as learn from "./views/learn.js";
import * as lesson from "./views/lesson.js";
import * as words from "./views/words.js";
import * as practice from "./views/practice.js";
import * as progress from "./views/progress.js";
import * as talk from "./views/talk.js";

const ROUTES = { learn, lesson, words, practice, talk, progress };
const TAB_FOR = { lesson: "learn" };

const view = document.getElementById("view");
let cleanup = null;

function route() {
  const [, name = "learn", arg] = location.hash.replace(/^#/, "").split("/");
  const mod = ROUTES[name] || learn;
  const key = ROUTES[name] ? name : "learn";
  cleanup?.();
  cleanup = null;
  view.innerHTML = "";
  cleanup = mod.mount(view, arg ? decodeURIComponent(arg) : undefined) || null;
  document.querySelectorAll(".tabs a").forEach((a) => {
    a.classList.toggle("active", a.dataset.tab === (TAB_FOR[key] || key));
  });
  window.scrollTo({ top: 0 });
}

function renderHeader() {
  const w = summarize("w:");
  const s = summarize("s:");
  document.getElementById("statStreak").textContent = streak();
  document.getElementById("statWords").textContent = w.mastered;
  document.getElementById("statSentences").textContent = s.seen;
  document.getElementById("footCount").textContent = `${VOCAB.length} words · ${ALL_SENTENCES.length} sentences`;
}

window.addEventListener("hashchange", route);
subscribe(renderHeader);
renderHeader();
route();
initSync();
initPwa();
