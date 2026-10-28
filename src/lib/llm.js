/* On-device LLM for the Talk tab, run by WebLLM (https://webllm.mlc.ai) on
 * WebGPU inside a Web Worker (llm.worker.js). Nothing is sent to a server: the
 * model is downloaded once (only when the learner asks), kept in the browser's
 * Cache Storage, and works offline after that.
 *
 * The worker (and with it all of WebLLM) is only started when a model is
 * loaded or removed; checking whether a model is downloaded reads Cache
 * Storage directly, so opening the Talk tab costs no network.
 */
import { getSettings, setSetting } from "./store.js";

export const MODELS = {
  standard: { label: "Standard", base: "Qwen3-1.7B", mb: 984, note: "Recommended. Natural, on-topic replies. Needs ~2 GB of GPU memory (most laptops, recent phones)." },
  lite: { label: "Lite", base: "Qwen3-0.6B", mb: 352, note: "Smaller download for older phones, but replies are often off-topic or slip into English." },
};
// Qwen3 models "think" before answering by default; that's slow and not needed here.
const NO_THINK = (choice) => MODELS[choice].base.startsWith("Qwen3");

export const modelChoice = () => (MODELS[getSettings().talkModel] ? getSettings().talkModel : "standard");
export const setModelChoice = (k) => setSetting("talkModel", k);

let gpu;
/** @returns {Promise<null | {f16: boolean}>} null when this browser can't run WebGPU */
export function gpuInfo() {
  gpu ??= (async () => {
    try {
      const adapter = await navigator.gpu?.requestAdapter();
      return adapter ? { f16: adapter.features.has("shader-f16") } : null;
    } catch {
      return null;
    }
  })();
  return gpu;
}

/** Full WebLLM model id for this device (f32 build when the GPU lacks f16). */
async function modelId(choice) {
  const info = await gpuInfo();
  return `${MODELS[choice].base}-${info?.f16 ? "q4f16_1" : "q4f32_1"}-MLC`;
}

/* ---------- worker RPC ---------- */
let worker = null;
let seq = 0;
const pending = new Map();
let progressFn = () => {};

function call(op, args = {}) {
  if (!worker) {
    worker = new Worker(new URL("./llm.worker.js", import.meta.url), { type: "module" });
    worker.onmessage = ({ data }) => {
      if (data.progress) return progressFn(data.progress);
      const p = pending.get(data.id);
      pending.delete(data.id);
      if (data.error !== undefined) p?.reject(new Error(data.error));
      else p?.resolve(data.result);
    };
  }
  const id = ++seq;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    worker.postMessage({ id, op, ...args });
  });
}

/* ---------- cache ---------- */
/* Same check as WebLLM's hasModelInCache: the tensor index and every shard it
 * lists are in the "webllm/model" cache (keys are the Hugging Face URLs). */
export async function isDownloaded(choice) {
  try {
    const base = `https://huggingface.co/mlc-ai/${await modelId(choice)}/resolve/main/`;
    if (!(await caches.has("webllm/model"))) return false;
    const cache = await caches.open("webllm/model");
    const index = await cache.match(base + "tensor-cache.json");
    if (!index) return false;
    const keys = new Set((await cache.keys()).map((r) => r.url));
    return (await index.json()).records.every((r) => keys.has(new URL(r.dataPath, base).href));
  } catch {
    return false;
  }
}

export async function deleteModel(choice) {
  const id = await modelId(choice);
  if (engineId === id) await unload();
  await call("remove", { model: id });
}

/* Metered or data-saver connections, so the UI can warn before a download. */
export function onMeteredNetwork() {
  const c = navigator.connection;
  return !!c && (c.saveData || c.type === "cellular" || /(^|-)2g$/.test(c.effectiveType || ""));
}

/* ---------- engine ---------- */
let engineId = null;
let loading = null;

let engineChoice = null;
export const isLoaded = async (choice) => engineId === (await modelId(choice));

/**
 * Load a model into the worker, downloading it first if it isn't cached.
 * @param {(p: {progress: number, text: string}) => void} onProgress
 */
export async function loadModel(choice, onProgress = () => {}) {
  progressFn = onProgress;
  const id = await modelId(choice);
  if (loading) await loading.catch(() => {});
  if (engineId === id) return;
  // Ask the browser not to evict the model, so it never has to be downloaded twice.
  navigator.storage?.persist?.().catch(() => {});
  engineId = null;
  loading = call("load", { model: id });
  try {
    await loading;
    engineId = id;
    engineChoice = choice;
  } finally {
    loading = null;
  }
}

export async function unload() {
  if (worker) await call("unload");
  engineId = null;
}

/** One structured chat turn. `grammar` is an EBNF grammar (xgrammar syntax)
 * the JSON reply must match. A hand-written grammar rather than a JSON schema,
 * because WebLLM compiles schemas to allow unlimited whitespace and small
 * models can get stuck emitting newlines until they hit max_tokens. */
export async function chatJson(messages, grammar, { signal } = {}) {
  if (!engineId) throw new Error("The AI model isn't loaded.");
  const stop = () => call("interrupt");
  signal?.addEventListener("abort", stop);
  try {
    const text = await call("chat", { messages, grammar, noThink: NO_THINK(engineChoice) });
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    return JSON.parse(firstObject(text));
  } finally {
    signal?.removeEventListener("abort", stop);
  }
}

/* Small models occasionally keep writing after the JSON object closes; keep
 * just the first complete top-level object. */
function firstObject(text) {
  let depth = 0;
  let inStr = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (ch === "\\") i++;
      else if (ch === '"') inStr = false;
    } else if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) return text.slice(text.indexOf("{"), i + 1);
  }
  return text;
}
