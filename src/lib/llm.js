/* Talk tab client for the AI conversation partner, a Pages Function on
 * Cloudflare Workers AI (functions/api/talk.js). The prompt is built on the
 * server from the scenario id, so the client only sends the conversation.
 */
const HISTORY = 4; // most recent messages sent with each turn (the server caps it too)
export const MAX_CHARS = 160; // per message, matches the server

/** @param {{who: "me" | "ai", text: string}[]} history */
const recent = (history) => history.slice(-HISTORY).map(({ who, text }) => ({ who, text: text.slice(0, MAX_CHARS) }));

async function post(body, signal) {
  let res;
  try {
    res = await fetch("/api/talk", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    if (e.name === "AbortError") throw e;
    throw new Error(navigator.onLine === false ? "You're offline. Talk needs an internet connection." : "Couldn't reach the AI partner.");
  }
  const data = await res.json().catch(() => ({}));
  if (res.ok) return data;
  throw new Error(
    {
      "daily-limit": "The AI partner has reached today's free limit. Try again tomorrow.",
      "ai-not-configured": "The AI partner isn't set up on this server (Workers AI binding missing).",
    }[data.error] ||
      (res.status === 404 || res.status === 405
        ? "The AI partner isn't available here. Run the app with `npm run cf:dev` or deploy it to Cloudflare Pages."
        : "The AI partner couldn't answer. Please try again.")
  );
}

/**
 * The partner's next line. `say` asks for how to say the learner's (English)
 * message in Chinese as well.
 * @returns {Promise<{zh: string, en: string, say?: string}>}
 */
export function talkTurn({ scenario, level, history, text, say }, { signal } = {}) {
  return post({ scenario, level, history: recent(history), text: text.slice(0, MAX_CHARS), say }, signal);
}

/** Two replies the learner could say next. @returns {Promise<{zh: string, en: string}[]>} */
export async function talkHints({ scenario, level, history }, { signal } = {}) {
  return (await post({ scenario, level, history: recent(history), hints: true }, signal)).hints || [];
}
