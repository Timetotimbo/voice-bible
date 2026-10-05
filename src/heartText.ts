import { useEffect, useState } from 'react';

/**
 * Heart for notes: a one-time download (about 160 MB) of the voice model, kept on the phone, after which notes and
 * chats are read in Heart's voice as real audio, so they keep playing with the screen off or another app open,
 * and offline. The model runs in a worker (src/heartWorker.ts); each paragraph comes back as a WAV.
 */
export const HEART_TEXT_MB = 160;
const SAVED_KEY = 'heartText';
export const canHeartText = typeof Worker !== 'undefined' && typeof WebAssembly !== 'undefined';

type State = { saved: boolean; busy: null | { loaded: number; total: number }; ready: boolean; error: string };
let state: State = { saved: readSaved(), busy: null, ready: false, error: '' };
function readSaved() {
  try {
    return localStorage.getItem(SAVED_KEY) === '1';
  } catch {
    return false;
  }
}
const listeners = new Set<(s: State) => void>();
const set = (patch: Partial<State>) => {
  state = { ...state, ...patch };
  listeners.forEach(l => l(state));
};
export const heartTextSaved = () => state.saved;

export function useHeartText() {
  const [s, setS] = useState(state);
  useEffect(() => {
    listeners.add(setS);
    return () => void listeners.delete(setS);
  }, []);
  return s;
}

let worker: Worker | null = null;
let loading: Promise<void> | null = null;
let nextId = 0;
const waiting = new Map<number, { resolve: (url: string) => void; reject: (e: Error) => void }>();

function start() {
  if (worker) return worker;
  worker = new Worker(new URL('./heartWorker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (e: MessageEvent) => {
    const m = e.data;
    if (m.type === 'progress') set({ busy: { loaded: m.loaded, total: m.total } });
    else if (m.type === 'audio') {
      waiting.get(m.id)?.resolve(URL.createObjectURL(new Blob([m.wav], { type: 'audio/wav' })));
      waiting.delete(m.id);
    } else if (m.type === 'error' && m.id !== undefined) {
      waiting.get(m.id)?.reject(new Error(m.message));
      waiting.delete(m.id);
    }
  };
  return worker;
}

/** Loads the model (downloading it the first time). */
export function loadHeartText(): Promise<void> {
  if (state.ready) return Promise.resolve();
  return (loading ??= new Promise<void>((resolve, reject) => {
    const w = start();
    set({ busy: state.saved ? null : { loaded: 0, total: 0 }, error: '' });
    const done = (e: MessageEvent) => {
      if (e.data.type === 'ready') {
        w.removeEventListener('message', done);
        try {
          localStorage.setItem(SAVED_KEY, '1');
        } catch {
          /* still works this time */
        }
        set({ saved: true, ready: true, busy: null });
        resolve();
      } else if (e.data.type === 'error' && e.data.id === undefined) {
        w.removeEventListener('message', done);
        loading = null;
        set({ busy: null, error: navigator.onLine ? 'Couldn’t download the voice.' : 'The connection dropped.' });
        reject(new Error(e.data.message));
      }
    };
    w.addEventListener('message', done);
    // The worker itself didn't start (blocked, or no connection on first use)
    w.onerror = e => {
      e.preventDefault();
      done(new MessageEvent('message', { data: { type: 'error', message: e.message || 'worker' } }));
      worker?.terminate();
      worker = null;
    };
    w.postMessage({ type: 'load' });
  }));
}

/** One paragraph in Heart's voice: an object URL of a WAV (revoke it when done). */
export async function heartSay(text: string): Promise<string> {
  await loadHeartText();
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    waiting.set(id, { resolve, reject });
    worker!.postMessage({ type: 'say', id, text });
  });
}

/** Drops the pieces asked for so far that haven't been made yet (reading stopped or moved on). */
export function heartCancel() {
  if (!worker) return;
  worker.postMessage({ type: 'cancel', below: nextId + 1 });
}

/** Forgets the model: the files go, and notes go back to the phone's voice. */
export async function removeHeartText() {
  worker?.terminate();
  worker = null;
  loading = null;
  waiting.forEach(w => w.reject(new Error('removed')));
  waiting.clear();
  try {
    localStorage.removeItem(SAVED_KEY);
  } catch {
    /* nothing saved */
  }
  try {
    await caches.delete('transformers-cache');
    await caches.delete('vb-heart');
  } catch {
    /* no caches here */
  }
  set({ saved: false, ready: false, busy: null, error: '' });
}
