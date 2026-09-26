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

## Natural voices

Recorded voices made with the open [Kokoro](https://github.com/thewh1teagle/kokoro-onnx) model. Record them with:

```sh
uv run scripts/record-kokoro.py            # whole Bible into audio/ (resumable; add --books John,Psalms for a few)
```

Then `sh scripts/upload-audio.sh` sends new recordings to the `voice-bible-audio` Cloudflare R2 bucket (needs `npx wrangler login`). The deploy workflow points `VITE_AUDIO_BASE` at that bucket; without it the voice picker shows device voices only. To try it locally, run `VITE_AUDIO_BASE=https://pub-5a66f38c566346e2a958c9e52686537e.r2.dev/ npm run dev`.

## Deploy

Every push to `main` builds and publishes to GitHub Pages via `.github/workflows/deploy.yml`.

KJV text is public domain.
