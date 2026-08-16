# Lingaloo — language word collector

A mobile-first **Progressive Web App** for collecting and reviewing vocabulary in multiple languages. Every word you add automatically pulls its dictionary definition into the app — no API key required.

## Features

- ✨ **Add words in 25+ languages** — English, Spanish, French, German, Italian, Portuguese, Russian, Japanese, Chinese, Korean, Arabic, and more.
- 🔍 **Auto dictionary lookup** — definitions are fetched automatically:
  - **English** → free [DictionaryAPI](https://dictionaryapi.dev) (phonetics, audio pronunciation, example sentences, synonyms)
  - **Other languages** → English [Wiktionary](https://en.wiktionary.org) (English meaning of the foreign word) + [MyMemory](https://mymemory.translated.net) translation
- 🔄 **Flashcard review** with spaced repetition — "Again / Hard / Good / Easy" scheduling.
- 📚 **Library** — browse, search, and filter your whole collection by language.
- 💾 **Offline & private** — everything is stored locally in your browser (IndexedDB). No account, no server, no data leaves your device.
- 📱 **Installable** — add it to your phone's home screen and it runs like a native app.

## Develop

```bash
npm install
npm run dev       # local dev server
npm run build     # production build -> dist/
npm run preview   # serve the production build locally
```

## Deploy (pick one)

The app is a static site — the `dist/` folder is all you need to host. **HTTPS is required** for install-to-home-screen and offline support to work.

### Option A — free static host (easiest, recommended)

- **Netlify Drop**: go to https://app.netlify.com/drop and drag the `dist/` folder in. Done — instant HTTPS + URL.
- **Vercel**: `npx vercel --prod` inside this folder, or import the repo.
- **Cloudflare Pages / GitHub Pages**: upload the `dist/` contents.

### Option B — self-host on your VPS

```bash
# install caddy (auto-HTTPS)
sudo apt install -y caddy

# point it at the dist folder
# /etc/caddy/Caddyfile:
#   yourdomain.com { root * /opt/data/vocab-app/dist; file_server }

sudo systemctl reload caddy
```

Then open the URL on your phone → browser menu → **"Add to Home Screen"**.

## Data model

Each saved word: `{ id, word, language, phonetic, audio, definitions[], translation, note, source, level, nextReview, createdAt }`

- `level` 0–5 (spaced-repetition mastery)
- `nextReview` timestamp decides when a word shows up in Review
