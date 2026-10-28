/* Runs the WebLLM engine off the main thread. All of WebLLM lives in this
 * worker's bundle, so the page only downloads it once, and only when a model
 * is actually loaded. Protocol: {id, op, ...args} in, {id, result | error} out,
 * plus {progress} messages while a model loads.
 */
import { CreateMLCEngine, deleteModelAllInfoInCache } from "@mlc-ai/web-llm";

let engine = null;
const progress = (report) => self.postMessage({ progress: report });

const ops = {
  async load({ model }) {
    if (engine) {
      engine.setInitProgressCallback(progress);
      await engine.reload(model);
    } else {
      engine = await CreateMLCEngine(model, { initProgressCallback: progress });
    }
  },
  async chat({ messages, grammar, noThink }) {
    const r = await engine.chat.completions.create({
      messages,
      temperature: 0.7,
      max_tokens: 300,
      response_format: { type: "grammar", grammar },
      ...(noThink && { extra_body: { enable_thinking: false } }),
    });
    return r.choices[0].message.content;
  },
  interrupt() {
    engine?.interruptGenerate();
  },
  async unload() {
    await engine?.unload();
  },
  async remove({ model }) {
    await deleteModelAllInfoInCache(model);
  },
};

self.onmessage = async ({ data: { id, op, ...args } }) => {
  try {
    self.postMessage({ id, result: await ops[op](args) });
  } catch (e) {
    self.postMessage({ id, error: e?.message || String(e) });
  }
};
