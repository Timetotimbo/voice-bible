import { useCallback, useEffect, useRef, useState } from 'react';
import { BOOKS } from './bible/books';
import type { VerseHit } from './bible/search';

const synth: SpeechSynthesis | undefined = window.speechSynthesis;
export const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const ORDINAL: Record<string, string> = { '1': 'First', '2': 'Second', '3': 'Third' };

/** "1 John 4:8" → "First John 4, verse 8" so it isn't read as a time or a list of numbers. */
function spokenReference(v: VerseHit): string {
  const book = BOOKS[v.book].replace(/^([123]) /, (_, n) => `${ORDINAL[n]} `).replace(/^Psalms$/, 'Psalm');
  return `${book} ${v.chapter}, verse ${v.verse}.`;
}

/** Short utterances: some browsers cut off speech that runs longer than ~15 seconds. */
function chunks(text: string): string[] {
  return text.match(/[^.;:?!]+[.;:?!]*/g)?.map(s => s.trim()).filter(Boolean) ?? [text];
}

function pickVoice(): SpeechSynthesisVoice | undefined {
  const voices = synth?.getVoices() ?? [];
  const english = voices.filter(v => v.lang.replace('_', '-').startsWith('en'));
  return english.find(v => v.lang === 'en-US' && v.localService) ?? english.find(v => v.lang === 'en-US') ?? english[0];
}

/**
 * Reads a list of verses aloud in order, optionally repeating the list.
 * `onDone` fires when playback finishes or is stopped.
 */
export function useReader(onDone: () => void) {
  const [playing, setPlaying] = useState<VerseHit[] | null>(null);
  const [current, setCurrent] = useState<VerseHit | null>(null);
  const [repeat, setRepeat] = useState(false);
  const repeatRef = useRef(repeat);
  repeatRef.current = repeat;
  // Whether to announce "John 3, verse 16" before each verse; remembered per device
  const [sayRefs, setSayRefsState] = useState(() => {
    try {
      return localStorage.getItem('sayRefs') !== 'off';
    } catch {
      return true;
    }
  });
  const sayRefsRef = useRef(sayRefs);
  sayRefsRef.current = sayRefs;
  const setSayRefs = useCallback((on: boolean) => {
    setSayRefsState(on);
    try {
      localStorage.setItem('sayRefs', on ? 'on' : 'off');
    } catch {
      // storage unavailable; setting lasts for this visit
    }
  }, []);
  // Reading speed multiplier; remembered per device
  const [speed, setSpeedState] = useState(() => {
    try {
      const saved = Number(localStorage.getItem('speed'));
      return SPEEDS.includes(saved) ? saved : 1;
    } catch {
      return 1;
    }
  });
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const run = useRef(0); // bumps on every play/stop so callbacks from a cancelled run are ignored
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const finish = useCallback(() => {
    setPlaying(null);
    setCurrent(null);
    onDoneRef.current();
  }, []);

  const stop = useCallback(() => {
    if (!synth) return;
    run.current++;
    synth.cancel();
    finish();
  }, [finish]);

  const queue = useRef<VerseHit[]>([]);
  const index = useRef(0); // verse being read, so a speed change can restart it

  const play = useCallback(
    (verses: VerseHit[], from = 0) => {
      if (!synth || !verses.length) return;
      const id = ++run.current;
      synth.cancel();
      queue.current = verses;
      setPlaying(verses);
      const voice = pickVoice();

      const speak = (i: number) => {
        if (id !== run.current) return;
        if (i >= verses.length) {
          if (repeatRef.current) speak(0);
          else finish();
          return;
        }
        index.current = i;
        const verse = verses[i];
        const parts = [...(sayRefsRef.current ? [spokenReference(verse)] : []), ...chunks(verse.text)];
        parts.forEach((text, j) => {
          const u = new SpeechSynthesisUtterance(text);
          if (voice) u.voice = voice;
          u.lang = voice?.lang ?? 'en-US';
          u.rate = 0.95 * speedRef.current;
          if (j === 0) u.onstart = () => id === run.current && setCurrent(verse);
          if (j === parts.length - 1) {
            u.onend = () => speak(i + 1);
            u.onerror = e => {
              // 'interrupted'/'canceled' come from our own stop(); anything else, move on
              if (e.error !== 'interrupted' && e.error !== 'canceled') speak(i + 1);
            };
          }
          synth.speak(u);
        });
      };
      speak(from);
    },
    [finish],
  );

  const setSpeed = useCallback(
    (next: number) => {
      setSpeedState(next);
      speedRef.current = next;
      try {
        localStorage.setItem('speed', String(next));
      } catch {
        // storage unavailable; setting lasts for this visit
      }
      // Queued speech keeps its old rate, so restart the current verse at the new one
      if (synth?.speaking) play(queue.current, index.current);
    },
    [play],
  );

  useEffect(() => () => {
    run.current++;
    synth?.cancel();
  }, []);

  return { supported: !!synth, playing, current, repeat, setRepeat, sayRefs, setSayRefs, speed, setSpeed, play, stop };
}
