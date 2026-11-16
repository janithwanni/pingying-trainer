import { test } from "node:test";
import assert from "node:assert/strict";
import { onRequestPost as talk, rateLimited } from "../functions/api/talk.js";
import { onRequestGet as getProgress, onRequestPut as putProgress } from "../functions/api/progress/[id].js";

const URL_TALK = "https://app.example/api/talk";
let ipSeq = 0;
const post = (body, headers = {}) =>
  new Request(URL_TALK, {
    method: "POST",
    // A fresh address per request keeps the rate limiter out of unrelated tests.
    headers: { "content-type": "application/json", "cf-connecting-ip": `10.0.0.${++ipSeq}`, ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
const ai = (response, seen = {}) => ({
  run: async (model, input, opts) => {
    Object.assign(seen, { model, input, opts });
    if (response instanceof Error) throw response;
    return { response };
  },
});
const turn = { scenario: "cafe", level: "beginner", history: [{ who: "ai", text: "你好！你想喝什么？" }], text: "I want tea", say: true };

test("talk: returns the partner's line, its translation and how to say the learner's English", async () => {
  const seen = {};
  const res = await talk({ request: post(turn), env: { AI: ai("<think>\n</think>\nSAY: 我要茶。\nZH: 好的！大杯还是小杯？\nEN: Sure! Large or small?", seen) } });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { zh: "好的！大杯还是小杯？", en: "Sure! Large or small?", say: "我要茶。" });
  assert.match(seen.input.messages[0].content, /barista/);
  assert.match(seen.input.messages.at(-1).content, /Learner: I want tea/);
  assert.equal(seen.opts, undefined);
});

test("talk: uses the configured model and AI Gateway", async () => {
  const seen = {};
  await talk({ request: post(turn), env: { AI: ai("ZH: 好。\nEN: OK.", seen), TALK_MODEL: "@cf/x/y", AI_GATEWAY: "gw" } });
  assert.equal(seen.model, "@cf/x/y");
  assert.deepEqual(seen.opts, { gateway: { id: "gw" } });
});

test("talk: parses hints", async () => {
  const res = await talk({
    request: post({ scenario: "cafe", level: "beginner", history: turn.history, hints: true }),
    env: { AI: ai("1. 我要一杯茶。 | I'd like a tea.\n2) 我想喝咖啡。 | I'd like coffee.\n3. only english | x") },
  });
  assert.deepEqual(await res.json(), {
    hints: [
      { zh: "我要一杯茶。", en: "I'd like a tea." },
      { zh: "我想喝咖啡。", en: "I'd like coffee." },
    ],
  });
});

test("talk: rejects bad input before calling the model", async () => {
  const env = { AI: { run: () => assert.fail("model must not be called") } };
  const status = async (body, headers) => (await talk({ request: post(body, headers), env })).status;
  assert.equal(await status("{not json"), 400);
  assert.equal(await status("null"), 400);
  assert.equal(await status({ ...turn, scenario: "nope" }), 400);
  assert.equal(await status({ ...turn, level: "expert" }), 400);
  assert.equal(await status({ ...turn, text: "x".repeat(161) }), 400);
  assert.equal(await status({ ...turn, history: [{ who: "system", text: "hi" }] }), 400);
  assert.equal(await status({ ...turn, pad: "x".repeat(5000) }), 413);
  assert.equal(await status(turn, { origin: "https://evil.example" }), 403);
  assert.equal((await talk({ request: post(turn), env: {} })).status, 503);
});

test("talk: same-origin requests are allowed", async () => {
  const res = await talk({ request: post(turn, { origin: "https://app.example" }), env: { AI: ai("ZH: 好。\nEN: OK.") } });
  assert.equal(res.status, 200);
});

test("talk: model failures don't leak details", async () => {
  const quiet = console.error;
  console.error = () => {};
  try {
    let res = await talk({ request: post(turn), env: { AI: ai(new Error("secret account detail")) } });
    assert.equal(res.status, 502);
    assert.deepEqual(await res.json(), { error: "ai-failed" });
    res = await talk({ request: post(turn), env: { AI: ai(new Error("4006: you have used up your daily free allocation")) } });
    assert.equal(res.status, 429);
    assert.deepEqual(await res.json(), { error: "daily-limit" });
    res = await talk({ request: post(turn), env: { AI: ai("Sorry, I can only answer in English.") } });
    assert.deepEqual(await res.json(), { error: "no-chinese" });
  } finally {
    console.error = quiet;
  }
});

test("talk: one address is limited per minute, and the window resets", async () => {
  const ip = "203.0.113.9";
  for (let i = 0; i < 20; i++) assert.equal(rateLimited(ip, 1000), false);
  assert.equal(rateLimited(ip, 1000), true);
  assert.equal(rateLimited("203.0.113.10", 1000), false);
  assert.equal(rateLimited(ip, 62_000), false);
});

function kv() {
  const m = new Map();
  return { m, get: async (k) => m.get(k) ?? null, put: async (k, v, opts) => void m.set(k, v) || (m.opts = opts) };
}
const ID = "abcdefgh23456789abcdefgh";
const put = (body, headers = {}) => new Request("https://app.example/api/progress/" + ID, { method: "PUT", headers, body });

test("progress: round-trips a profile and sets an expiry", async () => {
  const env = { PROGRESS: kv() };
  assert.equal((await getProgress({ params: { id: ID }, env })).status, 204);
  const profile = JSON.stringify({ v: 1, items: {}, lessons: {}, days: {}, phrases: {}, updatedAt: 5 });
  const res = await putProgress({ params: { id: ID }, env, request: put(profile) });
  assert.deepEqual(await res.json(), { ok: true, updatedAt: 5 });
  assert.ok(env.PROGRESS.m.opts.expirationTtl > 0);
  const back = await getProgress({ params: { id: ID }, env });
  assert.equal(await back.text(), profile);
  assert.equal(back.headers.get("cache-control"), "no-store");
});

test("progress: rejects bad ids, shapes and oversized bodies", async () => {
  const env = { PROGRESS: kv() };
  const status = async (id, body, headers) => (await putProgress({ params: { id }, env, request: put(body, headers) })).status;
  assert.equal(await status("short", "{}"), 400);
  assert.equal(await status("../../etc/passwd-aaaaaaaa", "{}"), 400);
  assert.equal(await status(ID, "{oops"), 400);
  assert.equal(await status(ID, JSON.stringify({ v: 1, items: [], lessons: {}, days: {} })), 400);
  assert.equal(await status(ID, JSON.stringify({ v: 1, items: {}, lessons: {}, days: {}, pad: "x".repeat(300 * 1024) })), 413);
  assert.equal(env.PROGRESS.m.size, 0);
  assert.equal((await getProgress({ params: { id: ID }, env: {} })).status, 503);
});
