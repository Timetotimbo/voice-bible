import type { VerseHit } from './bible/search';

/**
 * Natural voices recorded ahead of time with the open Kokoro model: one MP3 per chapter, plus the
 * second each verse starts at, so single verses play by seeking within the chapter.
 * Layout under AUDIO_BASE: VOICE/BOOK/CHAPTER.mp3 + .json, and VOICE/refs/{chapters,verses}.mp3 + .json.
 */
export const AUDIO_BASE: string = import.meta.env.VITE_AUDIO_BASE ?? '';

export interface RecordedVoice {
  id: string;
  name: string;
  man: boolean;
  british: boolean;
}

export const RECORDED_VOICES: RecordedVoice[] = AUDIO_BASE ? [{ id: 'af_heart', name: 'Heart', man: false, british: false }] : [];

export const describeRecorded = (v: RecordedVoice) => `${v.man ? 'Man' : 'Woman'} · ${v.british ? 'British' : 'American'}`;

// Chapters per book, to find a chapter's clip in refs/chapters
const CHAPTERS = [
  50, 40, 27, 36, 34, 24, 21, 4, 31, 24, 22, 25, 29, 36, 10, 13, 10, 42, 150, 31, 12, 8, 66, 52, 5, 48, 12, 14, 3, 9, 1, 4, 7,
  3, 3, 3, 2, 14, 4, 28, 16, 24, 21, 28, 16, 16, 13, 6, 6, 4, 4, 5, 3, 6, 4, 3, 1, 13, 5, 5, 3, 5, 1, 1, 1, 22,
];

const url = (path: string) => new URL(path, new URL(AUDIO_BASE, location.href)).href;
export const chapterAudio = (voice: string, book: number, chapter: number) => url(`${voice}/${book + 1}/${chapter}.mp3`);
export const refsAudio = (voice: string, name: 'chapters' | 'verses') => url(`${voice}/refs/${name}.mp3`);

const json = new Map<string, Promise<unknown>>();
function getJson<T>(path: string): Promise<T> {
  const href = url(path);
  let hit = json.get(href);
  if (!hit) {
    hit = fetch(href).then(r => {
      if (!r.ok) throw new Error(`${r.status} ${href}`);
      return r.json();
    });
    hit.catch(() => json.delete(href));
    json.set(href, hit);
  }
  return hit as Promise<T>;
}

/** Second at which each verse of the chapter starts. */
export const verseStarts = (voice: string, book: number, chapter: number) =>
  getJson<number[]>(`${voice}/${book + 1}/${chapter}.json`);

/** [start, end] seconds of "John 3," in refs/chapters and "verse 16." in refs/verses. */
export async function refSpans(voice: string, v: VerseHit): Promise<[[number, number], [number, number]]> {
  const [chapters, verses] = await Promise.all([
    getJson<[number, number][]>(`${voice}/refs/chapters.json`),
    getJson<[number, number][]>(`${voice}/refs/verses.json`),
  ]);
  const index = CHAPTERS.slice(0, v.book).reduce((a, b) => a + b, 0) + v.chapter - 1;
  return [chapters[index], verses[v.verse - 1]];
}
