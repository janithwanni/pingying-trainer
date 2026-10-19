export const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export const sample = (arr, n) => shuffle([...arr]).slice(0, n);
export const pickOne = (arr) => arr[Math.floor(Math.random() * arr.length)];

/** Listen for keys while a view is mounted; returns an unsubscribe fn. */
export function onKeys(handler) {
  const fn = (e) => {
    if (e.target.closest?.("input, textarea") && e.key !== "Enter") return;
    handler(e);
  };
  document.addEventListener("keydown", fn);
  return () => document.removeEventListener("keydown", fn);
}

export const SPEAKER = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4.03v8.05A4.5 4.5 0 0 0 16.5 12zM14 3.23v2.06a7 7 0 0 1 0 13.42v2.06A9 9 0 0 0 14 3.23z"/></svg>`;
