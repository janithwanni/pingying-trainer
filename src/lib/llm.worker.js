/* Runs the WebLLM engine off the main thread. All of WebLLM lives in this
 * worker's bundle, so the page only downloads it once, and only when a model
 * is actually loaded. Protocol: {id, op, ...args} in, {id, result | error} out,
 * plus {progress} messages while a model loads.
 */
import { CreateMLCEngine, deleteModelAllInfoInCache } from "@mlc-ai/web-llm";

let engine = null;
const progress = (report) => self.postMessage({ progress: report });

const ops = {
  async load({ model, chatOpts }) {
    if (engine) {
      engine.setInitProgressCallback(progress);
      await engine.reload(model, chatOpts);
    } else {
      engine = await CreateMLCEngine(model, { initProgressCallback: progress }, chatOpts);
    }
  },
  async chat({ messages, grammar, sampling, noThink }) {
    for (;;) {
      try {
        const r = await engine.chat.completions.create({
          messages,
          temperature: 0.7,
          max_tokens: 300,
          ...sampling,
          response_format: { type: "grammar", grammar },
          ...(noThink && { extra_body: { enable_thinking: false } }),
        });
        return r.choices[0].message.content;
      } catch (e) {
        // Prompt longer than the context window: drop the oldest message after
        // the system prompt and try again (keep at least the latest message).
        if (e?.name !== "ContextWindowSizeExceededError" || messages.length <= 2) throw e;
        messages = [messages[0], ...messages.slice(2)];
      }
    }
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
