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
