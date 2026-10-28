/* Cloudflare Pages Function — Talk tab conversation partner on Workers AI.
 *   POST /api/talk  { scenario, level, history, text, say }  → { zh, en, say? }
 *   POST /api/talk  { scenario, level, history, hints: true } → { hints: [{zh, en}] }
 * Requires Workers AI bound as AI (see wrangler.toml / README).
 *
 * Built to keep Neuron usage (Workers AI billing) low:
 *  - the prompt is assembled here from a scenario id, so the endpoint can't be
 *    used as a general-purpose LLM, and inputs are length-capped;
 *  - only the last few messages are sent, with short max_tokens;
 *  - replies are plain labelled lines rather than JSON (output tokens cost
 *    ~7x input tokens), Qwen3's thinking is switched off, and reply
 *    suggestions are only generated when the learner taps Hint;
 *  - pinyin is added on the client, never generated.
 */
import { LEVELS, SCENARIO_BY_ID } from "../../src/data/scenarios.js";

// Best Chinese per Neuron of the Workers AI catalog (Oct 2026); override with
// the TALK_MODEL environment variable.
const MODEL = "@cf/qwen/qwen3-30b-a3b-fp8";
const HISTORY = 4; // most recent messages accepted / sent to the model
const MAX_CHARS = 160; // per message

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

const str = (v) => typeof v === "string" && v.trim().length > 0 && v.length <= MAX_CHARS;

function system(sc, L) {
  return `Role-play for a ${L.label.toLowerCase()} learner of Mandarin. You are ${sc.role}. The user is the learner, playing themself; their task: ${sc.goal}
Only ever speak as ${sc.role}, never as the user. Reply to what the user just said, then move the conversation forward.
Speak only simple Chinese (${L.hsk}): 1–2 ${L.style}, usually ending with a question.`;
}

// Qwen3 "thinks" before answering unless told not to; that would be billed as
// output tokens. Strip the (empty) think block it still emits.
const clean = (t) =>
  String(t || "")
    .replace(/<think>[\s\S]*?<\/think>/g, "")
    .replace(/\/no_think/g, "")
    .trim();
const field = (text, label) => text.match(new RegExp(`^${label}:\\s*(.+)$`, "mi"))?.[1].trim() || "";

export async function onRequestPost({ request, env }) {
  if (!env.AI) return json({ error: "ai-not-configured" }, 503);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad-json" }, 400);
  }
  const sc = SCENARIO_BY_ID.get(body.scenario);
  const L = LEVELS[body.level];
  const history = Array.isArray(body.history) ? body.history.slice(-HISTORY) : null;
  if (!sc || !L || !history || !history.every((m) => (m.who === "me" || m.who === "ai") && str(m.text)))
    return json({ error: "bad-request" }, 400);
  if (!body.hints && !str(body.text)) return json({ error: "bad-request" }, 400);

  const messages = [
    { role: "system", content: system(sc, L) },
    // "Learner:" makes it explicit who said what; without it the model often
    // answered short learner lines by repeating them as its own.
    ...history.map((m) => (m.who === "me" ? { role: "user", content: `Learner: ${m.text}` } : { role: "assistant", content: m.text })),
  ];
  let maxTokens;
  if (body.hints) {
    messages.push({
      role: "user",
      content: `(Out of character.) Give 2 different short Chinese replies that I, the learner, could say next to you, one per line, as:
1. <Chinese> | <English>
2. <Chinese> | <English> /no_think`,
    });
    maxTokens = 80;
  } else {
    // Quote the exact line, or the model may translate an earlier learner message.
    const ask = body.say ? `\nSAY: <simple Chinese translation of "${body.text}">` : "";
    messages.push({
      role: "user",
      content: `Learner: ${body.text}\n\n(Reply as ${sc.role}, in this exact format:${ask}\nZH: <your reply, Chinese characters only>\nEN: <English translation of ZH>) /no_think`,
    });
    maxTokens = 120;
  }

  let out;
  try {
    out = await env.AI.run(
      env.TALK_MODEL || MODEL,
      { messages, max_tokens: maxTokens, temperature: 0.7, top_p: 0.8, presence_penalty: 0.8 },
      // Optional AI Gateway (analytics, rate limits, caching) when configured.
      env.AI_GATEWAY ? { gateway: { id: env.AI_GATEWAY } } : undefined
    );
  } catch (e) {
    const detail = String(e?.message || e).slice(0, 200);
    // 4006: the account's daily free Neuron allocation is used up.
    if (/4006|daily free allocation/i.test(detail)) return json({ error: "daily-limit" }, 429);
    return json({ error: "ai-failed", detail }, 502);
  }
  const text = clean(out?.response ?? out?.choices?.[0]?.message?.content);
  const usage = out?.usage;

  if (body.hints) {
    const hints = text
      .split("\n")
      .map((l) => l.replace(/^\s*\d+[.)]\s*/, "").split("|").map((s) => s.trim()))
      .filter(([zh, en]) => zh && en && /[一-鿿]/.test(zh))
      .slice(0, 2)
      .map(([zh, en]) => ({ zh, en }));
    return json({ hints, usage });
  }
  const zh = field(text, "ZH");
  if (!/[一-鿿]/.test(zh)) return json({ error: "no-chinese", detail: text.slice(0, 200) }, 502);
  const say = body.say ? field(text, "SAY") : "";
  return json({ zh, en: field(text, "EN"), say: /[一-鿿]/.test(say) ? say : undefined, usage });
}
