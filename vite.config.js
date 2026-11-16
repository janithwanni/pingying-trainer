import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";

/* Give the service worker the list of built files, so it can cache the whole
 * app (code, styles, fonts) on the first visit and work offline from then on.
 * The cache name is a hash of that list, so every deploy replaces the cache. */
function precacheManifest() {
  let outDir = "dist";
  return {
    name: "precache-manifest",
    apply: "build",
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    writeBundle(_, bundle) {
      // Fonts for scripts the app doesn't use (Cyrillic, Vietnamese) aren't worth caching up front.
      const files = Object.keys(bundle)
        .filter((f) => !/\.map$|index\.html$/.test(f) && !/cyrillic|vietnamese/.test(f))
        .map((f) => "/" + f)
        .sort();
      const version = createHash("sha256").update(files.join("|")).digest("hex").slice(0, 10);
      const path = resolve(outDir, "sw.js");
      const sw = readFileSync(path, "utf8")
        .replace(/const VERSION = "[^"]*";/, `const VERSION = "${version}";`)
        .replace("const ASSETS = [];", `const ASSETS = ${JSON.stringify(files)};`);
      if (!sw.includes(version) || !sw.includes(files[0])) throw new Error("precache-manifest: public/sw.js placeholders not found");
      writeFileSync(path, sw);
    },
  };
}

export default defineConfig({
  build: {
    outDir: "dist",
    target: "es2020",
  },
  plugins: [precacheManifest()],
});
