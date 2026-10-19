/* Cloud sync to Cloudflare KV via the Pages Function at /api/progress/:id.
 *
 * No accounts: each device gets a random sync code (~119 bits). Entering the
 * same code on another device links them. Writes are debounced so a normal
 * study session costs only a few KV writes (free tier: 1,000 writes/day).
 */
import { getState, mergeIn, setChangeHook } from "./store.js";

const ID_KEY = "pinyin-sprint:sync-id";
const PUSHED_KEY = "pinyin-sprint:last-pushed";
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const DEBOUNCE_MS = 30000;
export const CODE_RE = /^[a-z0-9]{16,64}$/;

let status = "idle"; // idle | syncing | synced | offline | unavailable | error
let lastSyncAt = 0;
let timer = null;
const listeners = new Set();

function setStatus(s) {
  status = s;
  if (s === "synced") lastSyncAt = Date.now();
  listeners.forEach((fn) => fn(status));
}
export const getStatus = () => ({ status, lastSyncAt });
export function onStatus(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function genId() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

export function getSyncId() {
  let id = null;
  try {
    id = localStorage.getItem(ID_KEY);
  } catch {}
  if (!id || !CODE_RE.test(id)) {
    id = genId();
    try {
      localStorage.setItem(ID_KEY, id);
    } catch {}
  }
  return id;
}

export const formatCode = (id) => id.match(/.{1,4}/g).join("-");
export const normalizeCode = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

const lastPushed = () => Number(localStorage.getItem(PUSHED_KEY) || 0);
const setLastPushed = (t) => {
  try {
    localStorage.setItem(PUSHED_KEY, String(t));
  } catch {}
};
const isDirty = () => getState().updatedAt > lastPushed();
const url = () => `/api/progress/${getSyncId()}`;

async function pull() {
  const res = await fetch(url(), { cache: "no-store" });
  if (res.status === 204) return null;
  const isJson = res.headers.get("content-type")?.includes("json");
  // No JSON back (e.g. plain `vite dev`, no Functions) → treat sync as unavailable.
  if (res.status === 503 || !isJson) throw Object.assign(new Error("unavailable"), { unavailable: true });
  if (!res.ok) throw new Error("pull " + res.status);
  return res.json();
}

async function push({ keepalive = false } = {}) {
  const s = getState();
  const res = await fetch(url(), {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(s),
    keepalive,
  });
  if (res.status === 503) throw Object.assign(new Error("unavailable"), { unavailable: true });
  if (!res.ok) throw new Error("push " + res.status);
  setLastPushed(s.updatedAt);
}

let inflight = null;
export function syncNow() {
  if (inflight) return inflight;
  inflight = (async () => {
    clearTimeout(timer);
    if (!navigator.onLine) return setStatus("offline");
    setStatus("syncing");
    try {
      const wasDirty = isDirty();
      const remote = await pull();
      if (remote) {
        mergeIn(remote, { silent: true });
        // Nothing new locally → remote already holds everything we have.
        if (!wasDirty) setLastPushed(getState().updatedAt);
      }
      if (!remote || isDirty()) await push();
      setStatus("synced");
    } catch (e) {
      setStatus(e.unavailable ? "unavailable" : navigator.onLine ? "error" : "offline");
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** Overwrite the cloud copy with local state (used after "reset progress"). */
export async function forcePush() {
  try {
    await push();
    setStatus("synced");
  } catch (e) {
    setStatus(e.unavailable ? "unavailable" : "error");
  }
}

export async function linkCode(code) {
  const id = normalizeCode(code);
  if (!CODE_RE.test(id)) throw new Error("That code doesn't look right.");
  localStorage.setItem(ID_KEY, id);
  localStorage.setItem(PUSHED_KEY, "0");
  await syncNow();
}

function schedule() {
  if (status === "unavailable") return;
  clearTimeout(timer);
  timer = setTimeout(syncNow, DEBOUNCE_MS);
}

export function initSync() {
  setChangeHook(schedule);
  syncNow();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && isDirty() && status !== "unavailable") {
      clearTimeout(timer);
      push({ keepalive: true }).catch(() => {});
    } else if (document.visibilityState === "visible") {
      syncNow();
    }
  });
  window.addEventListener("online", syncNow);
  window.addEventListener("offline", () => setStatus("offline"));
}
