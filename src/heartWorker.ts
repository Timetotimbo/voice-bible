/// <reference lib="webworker" />
/**
 * Heart for notes: the Kokoro model (the one Heart's Bible recordings were made with) running on the phone, so
 * notes and chats can be read in Heart's voice too. It turns one piece of text at a time into a WAV, off the main
 * thread. The q4f16 model (about 155 MB) keeps up with reading aloud where the smaller ones run at half speed.
 */
import { KokoroTTS, env } from 'kokoro-js';
// The ONNX runtime's engine, served with the app (the runtime would otherwise fetch it from a CDN, not offline)
import ortWasm from '../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm?url';
import ortMjs from '../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs?url';

const MODEL = 'onnx-community/Kokoro-82M-v1.0-ONNX';
let tts: Promise<KokoroTTS> | null = null;

type In = { type: 'load' } | { type: 'say'; id: number; text: string } | { type: 'cancel'; below: number };
const post = (m: unknown, transfer: Transferable[] = []) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(m, transfer);

const load = () =>
  (tts ??= (() => {
    const at = (u: string) => new URL(u, self.location.href).href;
    env.wasmPaths = { wasm: at(ortWasm), mjs: at(ortMjs) } as unknown as string;
    const seen = new Map<string, [number, number]>();
    return KokoroTTS.from_pretrained(MODEL, {
      dtype: 'q4f16',
      device: 'wasm',
      progress_callback: (p: { status: string; file?: string; loaded?: number; total?: number }) => {
        if (p.status !== 'progress' || !p.file) return;
        seen.set(p.file, [p.loaded ?? 0, p.total ?? 0]);
        const [loaded, total] = [...seen.values()].reduce((a, v) => [a[0] + v[0], a[1] + v[1]], [0, 0]);
        post({ type: 'progress', loaded, total });
      },
    });
  })().catch(e => {
    tts = null;
    throw e;
  }));

// One at a time (the model can't run twice at once); requests made before a cancel are dropped
let chain: Promise<unknown> = Promise.resolve();
let cancelBelow = 0;

self.onmessage = (e: MessageEvent<In>) => {
  const m = e.data;
  if (m.type === 'cancel') {
    cancelBelow = m.below;
    return;
  }
  if (m.type === 'load') {
    load().then(
      () => post({ type: 'ready' }),
      err => post({ type: 'error', message: String(err?.message ?? err) }),
    );
    return;
  }
  chain = chain.then(async () => {
    if (m.id < cancelBelow) return post({ type: 'error', id: m.id, message: 'canceled' });
    try {
      const audio = await (await load()).generate(m.text, { voice: 'af_heart' });
      const wav = audio.toWav();
      post({ type: 'audio', id: m.id, wav }, [wav]);
    } catch (err) {
      post({ type: 'error', id: m.id, message: String((err as Error)?.message ?? err) });
    }
  });
};
