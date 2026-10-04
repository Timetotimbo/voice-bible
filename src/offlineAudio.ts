import { useEffect, useState } from 'react';
import { CHAPTERS, chapterAudio, refsAudio } from './recorded';

/**
 * Natural voice recordings kept on the phone, so they play offline. They go in the 'vb-audio' cache, which the
 * service worker (scripts/sw-template.js) answers from, seeking included. The whole Bible is about 1.9 GB, so it's
 * saved by book, New Testament or all, as the reader chooses; chapters played on Wi-Fi are kept too.
 */
export const AUDIO_CACHE = 'vb-audio';
export const NEW_TESTAMENT = Array.from({ length: 27 }, (_, i) => 39 + i);
export const WHOLE_BIBLE = Array.from({ length: 66 }, (_, i) => i);
// Measured from the recordings: about 1.6 MB a chapter
const MB_PER_CHAPTER = 1.62;
export const chaptersIn = (books: number[]) => books.reduce((n, b) => n + CHAPTERS[b], 0);
export const aboutMb = (books: number[]) => Math.round(chaptersIn(books) * MB_PER_CHAPTER);
export const sizeText = (mb: number) => (mb >= 1000 ? `${(mb / 1000).toFixed(1)} GB` : `${mb} MB`);
export const canSaveOffline = typeof caches !== 'undefined' && 'serviceWorker' in navigator;

type State = { saved: Set<string>; busy: null | { done: number; total: number; label: string }; error: string };
let state: State = { saved: new Set(), busy: null, error: '' };
const listeners = new Set<(s: State) => void>();
const set = (patch: Partial<State>) => {
  state = { ...state, ...patch };
  listeners.forEach(l => l(state));
};
let stopRequested = false;

/** The recordings saved now (their addresses), and what a download is doing. */
export function useOfflineAudio() {
  const [s, setS] = useState(state);
  useEffect(() => {
    listeners.add(setS);
    void refresh();
    return () => void listeners.delete(setS);
  }, []);
  return s;
}

async function refresh() {
  if (!canSaveOffline) return;
  const c = await caches.open(AUDIO_CACHE);
  set({ saved: new Set((await c.keys()).map(r => r.url)) });
}

export const isSaved = (s: State, voice: string, book: number, chapter: number) => s.saved.has(chapterAudio(voice, book, chapter));
export const savedChapters = (s: State, voice: string, books: number[]) =>
  books.reduce((n, b) => n + Array.from({ length: CHAPTERS[b] }, (_, c) => isSaved(s, voice, b, c + 1)).filter(Boolean).length, 0);

/** Saves these books' chapters (and the reference clips), skipping what's already saved. Can be stopped and resumed. */
export async function saveBooks(voice: string, books: number[], label: string) {
  if (state.busy || !canSaveOffline) return;
  stopRequested = false;
  // Ask the phone not to clear these when space runs low
  try {
    await navigator.storage?.persist?.();
  } catch {
    /* not offered: still saved, just not protected */
  }
  const c = await caches.open(AUDIO_CACHE);
  const have = new Set((await c.keys()).map(r => r.url));
  const json = (mp3: string) => mp3.replace(/\.mp3$/, '.json');
  const todo: string[] = [];
  for (const name of ['chapters', 'verses'] as const) {
    const mp3 = refsAudio(voice, name);
    if (!have.has(mp3)) todo.push(mp3);
    if (!have.has(json(mp3))) todo.push(json(mp3));
  }
  for (const b of books)
    for (let ch = 1; ch <= CHAPTERS[b]; ch++) {
      const mp3 = chapterAudio(voice, b, ch);
      if (!have.has(json(mp3))) todo.push(json(mp3));
      if (!have.has(mp3)) todo.push(mp3);
    }
  const total = todo.length;
  let done = 0;
  set({ busy: { done, total, label }, error: '' });
  const worker = async () => {
    while (todo.length && !stopRequested) {
      const url = todo.shift()!;
      for (let attempt = 1; ; attempt++) {
        try {
          const r = await fetch(url, { mode: 'cors' });
          if (!r.ok) throw new Error(`${r.status}`);
          await c.put(url, r);
          break;
        } catch (e) {
          if (attempt >= 3 || !navigator.onLine) {
            stopRequested = true;
            set({ error: navigator.onLine ? `Couldn’t save a recording (${(e as Error).message}).` : 'The connection dropped.' });
            return;
          }
          await new Promise(r => setTimeout(r, 1500 * attempt));
        }
      }
      done++;
      if (done % 4 === 0 || !todo.length) set({ busy: { done, total, label } });
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  set({ busy: null });
  await refresh();
}

export const stopSaving = () => {
  stopRequested = true;
};

export async function removeSaved() {
  await caches.delete(AUDIO_CACHE);
  await refresh();
}
