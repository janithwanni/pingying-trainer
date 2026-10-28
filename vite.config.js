import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "dist",
    target: "es2020",
  },
  // The Talk tab's WebLLM worker (src/lib/llm.worker.js) is an ES module.
  worker: {
    format: "es",
  },
});
