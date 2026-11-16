/* The game layer: levels, daily quests and badges, all derived from the
 * progress store. initGame() watches the store and celebrates what's new. */
import { LESSONS } from "../data/lessons.js";
import { SCENARIOS } from "../data/scenarios.js";
import {
  awardBadge, bestStreak, claimQuest, dailyGoal, dayKey, getPhrases, getState, isToday, streak, subscribe,
  summarize, talkId, todayStats, toneId, XP,
} from "./store.js";
import { confetti, sound, toast } from "./fx.js";

/* ---------- levels ---------- */
// Level L starts at 100·(L−1)² XP: quick early wins, then a steady climb.
const TITLES = ["Newcomer", "Newcomer", "Explorer", "Explorer", "Talker", "Talker", "Talker", "Storyteller", "Storyteller", "Storyteller", "Storyteller", "Smooth talker"];
const startOf = (level) => 100 * (level - 1) ** 2;
export function levelFor(xp) {
  const level = Math.floor(Math.sqrt(Math.max(0, xp) / 100)) + 1;
  const from = startOf(level);
  const to = startOf(level + 1);
  return {
    level,
    title: TITLES[Math.min(level, TITLES.length) - 1],
    into: xp - from,
    need: to - from,
    pct: Math.round(((xp - from) / (to - from)) * 100),
  };
}

/* ---------- derived counts ---------- */
export function counts(state = getState()) {
  const { lessons } = state;
  return {
    lessons: LESSONS.filter((l) => lessons[l.id]?.done).length,
    perfect: LESSONS.filter((l) => lessons[l.id]?.best >= 90).length,
    chats: SCENARIOS.filter((sc) => lessons[talkId(sc.id)]?.done).length,
    lessonsToday: LESSONS.filter((l) => isToday(lessons[l.id]?.t)).length,
    toneDrills: ["ear", "pairs", "sounds"].filter((d) => lessons[toneId(d)]?.done).length,
    words: summarize("w:").mastered,
    phrases: getPhrases().length,
    streak: Math.max(streak(), bestStreak()),
  };
}

/* ---------- daily quests ---------- */
// The daily goal is always quest one; two more rotate by date.
const POOL = [
  { id: "speak", bit: 2, ico: "🎙", text: "Say 6 sentences out loud", target: 6, value: (d) => d.s },
  { id: "talk", bit: 4, ico: "💬", text: "Send 4 replies in Talk", target: 4, value: (d) => d.t },
  { id: "lesson", bit: 8, ico: "📘", text: "Finish a lesson", target: 1, value: (d, c) => c.lessonsToday },
  { id: "tones", bit: 16, ico: "🎵", text: "Answer 15 tone questions", target: 15, value: (d) => d.o },
  { id: "sharp", bit: 32, ico: "🎯", text: "Get 20 answers right", target: 20, value: (d) => d.ok },
];
const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

export function questsFor(key = dayKey()) {
  const goal = dailyGoal();
  const a = hash(key) % POOL.length;
  const b = (a + 1 + (hash(key + "b") % (POOL.length - 1))) % POOL.length;
  const d = todayStats();
  const c = counts();
  return [{ id: "goal", bit: 1, ico: "⚡", text: `Earn ${goal} XP`, target: goal, value: (day) => day.x }, POOL[a], POOL[b]].map((q) => {
    const have = Math.min(q.value(d, c) || 0, q.target);
    return { ...q, have, done: have >= q.target, claimed: !!(d.q & q.bit) };
  });
}

/* ---------- badges ---------- */
export const BADGES = [
  { id: "first-lesson", ico: "🌱", name: "First steps", how: "Finish your first lesson", test: (c) => c.lessons >= 1 },
  { id: "lessons-5", ico: "📗", name: "Unit one down", how: "Finish 5 lessons", test: (c) => c.lessons >= 5 },
  { id: "lessons-15", ico: "📚", name: "Bookworm", how: "Finish 15 lessons", test: (c) => c.lessons >= 15 },
  { id: "lessons-all", ico: "🎓", name: "Graduate", how: "Finish every lesson", test: (c) => c.lessons >= LESSONS.length },
  { id: "perfect", ico: "⭐", name: "Three stars", how: "Score 90% or more in a lesson", test: (c) => c.perfect >= 1 },
  { id: "first-chat", ico: "💬", name: "Ice breaker", how: "Complete your first conversation", test: (c) => c.chats >= 1 },
  { id: "chats-5", ico: "🗣", name: "Chatterbox", how: "Complete 5 different conversations", test: (c) => c.chats >= 5 },
  { id: "chats-all", ico: "🌏", name: "Ready for anything", how: "Complete every conversation", test: (c) => c.chats >= SCENARIOS.length },
  { id: "streak-3", ico: "🔥", name: "Warming up", how: "Keep a 3-day streak", test: (c) => c.streak >= 3 },
  { id: "streak-7", ico: "🔥", name: "On fire", how: "Keep a 7-day streak", test: (c) => c.streak >= 7 },
  { id: "streak-30", ico: "🏆", name: "Unstoppable", how: "Keep a 30-day streak", test: (c) => c.streak >= 30 },
  { id: "tones", ico: "🎵", name: "Good ear", how: "Score 80% in a tone drill", test: (c) => c.toneDrills >= 1 },
  { id: "tones-all", ico: "🎼", name: "Perfect pitch", how: "Score 80% in all three listening drills", test: (c) => c.toneDrills >= 3 },
  { id: "words-50", ico: "🧠", name: "Word hoard", how: "Master 50 words", test: (c) => c.words >= 50 },
  { id: "phrases-10", ico: "📒", name: "My own words", how: "Save 10 phrases from Talk", test: (c) => c.phrases >= 10 },
  { id: "xp-1000", ico: "⚡", name: "Powered up", how: "Earn 1,000 XP", test: (c, s) => s.xp >= 1000 },
];

/* ---------- watching for things to celebrate ---------- */
let busy = false;
function check({ quiet = false } = {}) {
  if (busy) return; // our own rewards change the store too
  busy = true;
  try {
    const state = getState();
    const c = counts(state);
    for (const b of BADGES) {
      if (!state.badges[b.id] && b.test(c, state) && awardBadge(b.id) && !quiet) {
        toast({ ico: b.ico, title: `Badge earned: ${b.name}`, text: b.how });
        sound("badge");
      }
    }
    for (const q of questsFor()) {
      if (q.done && !q.claimed && claimQuest(q.bit) && !quiet) {
        toast({ ico: q.ico, title: q.id === "goal" ? "Daily goal reached!" : "Quest complete", text: `${q.text} · +${XP.questBonus} XP` });
        sound("badge");
        if (q.id === "goal") confetti();
      }
    }
    const lvl = levelFor(getState().xp).level;
    if (lastLevel && lvl > lastLevel && !quiet) {
      const title = levelFor(getState().xp).title;
      const fresh = title !== levelFor(100 * (lvl - 2) ** 2).title; // a new rank, not just a new number
      toast({ ico: "🎉", title: `Level ${lvl}!`, text: fresh ? `New rank: ${title}.` : "Keep it up!" });
      sound("level");
      confetti();
    }
    lastLevel = lvl;
  } finally {
    busy = false;
  }
}
let lastLevel = 0;

export function initGame() {
  // Anything already earned before this session (older versions, another
  // device) is recorded without fanfare.
  check({ quiet: true });
  subscribe(() => check());
}
