# 速成 Mandarin Sprint

Pinyin trainer: rapid-recall word flashcards plus sentence-pattern lessons.
Vanilla JS + Vite. It deploys to Cloudflare Pages, installs to a phone's home
screen (PWA), works offline, and syncs progress through Cloudflare KV on the
free tier.

## Develop

```bash
npm install
npm run dev          # UI only (cloud sync shows as "not set up", Talk tab unavailable)
npm run cf:dev       # build + run with Pages Functions, a local KV store and Workers AI
npm run check-data   # check vocab/lesson data (tile counts, tones, duplicates)
```

## Talk tab (AI conversation practice)

The **Talk** tab role-plays everyday situations (café, taxi, directions…) with
an AI partner running on [Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/)
through a Pages Function (`functions/api/talk.js`). Reply in hanzi, pinyin
(`ni3 hao3` is fine) or English, or use the mic where the browser supports
Mandarin speech recognition. The partner answers in Mandarin, and when you
write English it shows how to say that in Chinese. *Hint* suggests two replies.
The rest of the app still works offline; Talk needs a connection.

**Setup:** `wrangler.toml` binds Workers AI as `AI`, which Pages picks up on
deploy. `npm run cf:dev` uses the same binding, and local calls count against
your account's Neurons. Optional environment variables for the Pages project:

| Variable | Effect |
|---|---|
| `TALK_MODEL` | Use another Workers AI chat model (default `@cf/qwen/qwen3-30b-a3b-fp8`) |
| `AI_GATEWAY` | Route calls through an [AI Gateway](https://developers.cloudflare.com/ai-gateway/) with that id, for analytics and rate limiting |

**Neuron use:** a message costs about 1.7 Neurons (~220 input tokens and ~27
output tokens), and so does a *Hint*. The free allocation of 10,000 Neurons a
day covers roughly 5,000–6,000 messages. To keep it low:

- **Model:** Qwen3-30B-A3B has the best Chinese per Neuron in the catalog.
  Granite-4.0-micro costs about 60% less but broke the format and spoke as the
  customer in testing.
- **Prompt and inputs:** the server builds the prompt from a scenario id, so
  the endpoint can't be used as a general LLM. Messages are capped at 160
  characters, with the last 4 kept as history.
- **Output format:** replies are plain labelled lines (`ZH:` / `EN:` /
  `SAY:`) rather than JSON, with `max_tokens` 120. Output tokens cost about
  6.6× input tokens.
- **Thinking:** Qwen3's thinking is switched off with `/no_think`.
- **Done on the device:** pinyin (`pinyin-pro`), scenario openers and the
  review screen use no AI. Suggestions are only generated when *Hint* is
  tapped.
- **Daily limit:** when the free allocation runs out, the app says so
  instead of failing silently.

**Design notes**

- The AI never grades the learner's Chinese. Small models flagged correct
  sentences as mistakes in testing, so it only translates English input.
- Learner turns are labelled `Learner:` and the `SAY:` line quotes the exact
  message. Without these the model sometimes repeated the learner's line as
  its own, or translated an earlier message.
- Scenarios and levels live in `src/data/scenarios.js`, and the prompt lives
  in `functions/api/talk.js`.

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
     for the KV and Workers AI bindings.

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
| `src/views/talk.js`, `src/lib/llm.js`, `src/data/scenarios.js` | Talk tab: chat UI, `/api/talk` client, role-play scenarios |
| `functions/api/talk.js` | Pages Function that builds the prompt and calls Workers AI |
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
