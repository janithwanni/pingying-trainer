# 速成 Mandarin Sprint

Pinyin trainer: rapid-recall word flashcards plus sentence-pattern lessons.
Vanilla JS + Vite. It deploys to Cloudflare Pages, installs to a phone's home
screen (PWA), works offline, and syncs progress through Cloudflare KV on the
free tier.

## Develop

```bash
npm install
npm run dev          # UI only (cloud sync shows as "not set up")
npm run cf:dev       # build + run with Pages Functions and a local KV store
npm run check-data   # check vocab/lesson data (tile counts, tones, duplicates)
```

## Talk tab (on-device AI conversation practice)

The **Talk** tab role-plays everyday situations (café, taxi, directions…) with
a small LLM that runs **inside the app** on the device's GPU, through
[WebLLM](https://webllm.mlc.ai) and WebGPU. No server, API key or account is
involved, and nothing you type leaves the device. Reply in hanzi, pinyin
(`ni3 hao3` is fine) or English, or use the mic where the browser supports
Mandarin speech recognition. The partner answers in Mandarin and suggests
replies, and when you write English it shows how to say that in Chinese.

**Network use**

- The model downloads only when the learner taps *Download* on the Talk tab,
  with a warning on mobile data or data saver. After that it is stored in
  Cache Storage, works offline and uses no data.
  - *Standard* (Qwen3-1.7B, 984 MB) is the default.
  - *Lite* (Qwen3-0.6B, 352 MB) is a smaller option, but its replies are
    noticeably worse.
- The app asks for persistent storage so the browser doesn't evict the model.
  `sw.js` deletes only its own `sprint-*` caches on update, never the
  `webllm/*` model caches.
- WebLLM's code (about 2.2 MB gzipped) lives only in the worker bundle
  (`src/lib/llm.worker.js`) and loads only when a model is loaded. Opening the
  Talk tab checks for a downloaded model by reading Cache Storage directly.
  `pinyin-pro` (about 140 KB gzipped) loads on the first AI reply.

**Requirements:** WebGPU, which means Chrome or Edge on desktop or Android, or
Safari on iOS/macOS 26 or newer. The tab explains this when WebGPU is missing.
Replies take about 6–10 s on an M2 MacBook with the Standard model, and phones
are slower.

**Design notes**

- Pinyin is generated locally with `pinyin-pro`, not by the model. That is
  more accurate and means fewer tokens to generate.
- The model is constrained by a compact EBNF grammar (`talk.js`) rather than a
  JSON schema. WebLLM compiles JSON schemas to allow unlimited whitespace, and
  small models can get stuck emitting newlines until they hit the token limit.
- Models of 0.6–1.7B flagged correct sentences as mistakes in testing, so the
  AI never grades the learner's Chinese. It only translates English input.
- Scenarios live in `src/data/scenarios.js`, and the prompt lives in
  `src/views/talk.js`.

## Deploy to Cloudflare Pages

1. Create the KV namespace for progress sync:
   ```bash
   npx wrangler login
   npm run kv:create
   ```
   Copy the printed `id` into `wrangler.toml` and uncomment the
   `[[kv_namespaces]]` block.
2. Deploy, using either method:
   - **CLI:** `npm run cf:deploy`
   - **Git:** push this folder to GitHub/GitLab, then in Cloudflare go to
     *Workers & Pages → Create → Pages → Connect to Git*. Use build command
     `npm run build` and output directory `dist`. Pages reads `wrangler.toml`
     for the KV binding.

The app still works without the KV binding. Progress is then saved only on
each device.

## Install on a phone

- **iPhone (Safari):** Share → *Add to Home Screen*
- **Android (Chrome):** tap the *Install* banner, or ⋮ → *Install app*

## How it fits together

| Path | What it does |
|---|---|
| `src/data/vocab.js` | ~440 words, keyed by hanzi |
| `src/data/lessons.js` | 15 sentence-pattern lessons, ~100 sentences, split into word tiles |
| `src/lib/store.js` | progress: Leitner spaced repetition, lesson scores, daily activity (localStorage) |
| `src/lib/sync.js` | debounced sync to `/api/progress/:sync-code`, per-item last-write-wins merge |
| `src/lib/pinyin.js` | grades typed pinyin (tone marks or numbers, ü as `v`, 不/一 sandhi tolerated) |
| `src/lib/speech.js` | Mandarin text-to-speech through the browser's built-in voices |
| `src/lib/llm.js`, `src/lib/llm.worker.js`, `src/data/scenarios.js` | Talk tab: on-device LLM (WebLLM in a worker) and role-play scenarios |
| `src/views/*` | Learn path, lesson player, exercises, flashcards, practice, progress |
| `functions/api/progress/[id].js` | Pages Function that reads and writes KV |
| `public/sw.js`, `public/manifest.webmanifest` | offline cache and home-screen install |

**Sync model:** there are no accounts. Each device creates a random sync code
(Progress tab). Entering that code on another device links the two. Anyone who
has the code can read and change that progress, so keep it private. Writes are
debounced to about one per 30 seconds of activity, plus one when the app is
hidden. That keeps usage well inside the KV free tier (1,000 writes per day).

**Adding sentences:** add an `S("我|是|学生", "wǒ|shì|xuésheng", "I am a student.")`
line to a lesson in `src/data/lessons.js`, then run `npm run check-data`.

The original single-file version is kept in `legacy/index.html`.
