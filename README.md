# Voice Bible

A mobile-friendly Bible you search by voice. The microphone turns on when the page loads: say a word or phrase to see every verse containing it, or say a reference like "John 3:16" or "Psalm 23" to open it.

**Live site:** https://timetotimbo.github.io/voice-bible/

## Run locally

```sh
npm install
npm run dev
```

Voice input needs HTTPS or `localhost`, and works in Chrome (Android/desktop) and Safari (iPhone). iPhone requires one tap on the mic before it listens.

## Adding a translation

1. Add a JSON file to `public/bibles/` shaped as 66 books → chapters → verse strings, in canonical order (see `scripts/build-kjv.py`).
2. List it in `src/bible/translations.ts`.

## Deploy

Every push to `main` builds and publishes to GitHub Pages via `.github/workflows/deploy.yml`.

KJV text is public domain.
