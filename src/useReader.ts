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

const lang = (v: SpeechSynthesisVoice) => (v.lang || '').replace('_', '-');

// Apple's novelty voices (sound effects, singing) aren't useful for reading Scripture
const NOVELTY = /^(Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Good News|Jester|Organ|Pipe Organ|Superstar|Trinoids|Whisper|Wobble|Zarvox|Deranged|Hysterical)\b/i;

const isEnglish = (v: SpeechSynthesisVoice) => /^en\b/i.test(lang(v)) || /english/i.test(v.name);

/** English voices installed on this device (or every voice, if none say they're English), sorted by accent then name. */
function englishVoices(): SpeechSynthesisVoice[] {
  const all = (synth?.getVoices() ?? []).filter(v => !NOVELTY.test(v.name));
  const english = all.filter(isEnglish);
  return (english.length ? english : all).sort((a, b) => lang(a).localeCompare(lang(b)) || a.name.localeCompare(b.name));
}

function defaultVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  return voices.find(v => v.lang === 'en-US' && v.localService) ?? voices.find(v => v.lang === 'en-US') ?? voices[0];
}

const ACCENTS: [RegExp, string][] = [
  [/scotland|gbsct/i, 'Scottish'],
  [/-US/i, 'American'],
  [/-GB/i, 'British'],
  [/-AU/i, 'Australian'],
  [/-IN/i, 'Indian'],
  [/-IE/i, 'Irish'],
  [/-ZA/i, 'South African'],
  [/-NZ/i, 'New Zealand'],
  [/-CA/i, 'Canadian'],
];
// Browsers don't report a voice's gender, so go by the common voice names
const MEN = /\b(male|david|mark|guy|george|ryan|brian|christopher|eric|roger|steffan|andrew|aaron|alex|daniel|fred|arthur|gordon|lee|oliver|rishi|thomas|tom|ralph|junior|nathan|reed|rocko|grandpa|eddy|liam|connor|mitchell|william|prabhat|ravi|luke|tony|evan|james|matthew|justin|joey|russell|geraint|brandon|davis|jason|kai|christopher)\b/i;
const WOMEN = /\b(female|zira|aria|jenny|michelle|ana|emma|hazel|susan|libby|sonia|natasha|clara|samantha|karen|moira|tessa|veena|fiona|victoria|allison|ava|serena|kate|stephanie|martha|catherine|nicky|sandy|shelley|grandma|kathy|flo|neerja|heera|leah|joanna|salli|kimberly|ivy|amy|olivia|emily|isla|nicole|raveena|aditi|ayanda|molly|sara|jane|nancy|amber|ashley|cora|elizabeth|monica|linda|heather|google us english)\b/i;

/** "Man · British", "Woman · American", or just the accent when gender is unknown. */
export function describeVoice(v: SpeechSynthesisVoice): string {
  const accent = ACCENTS.find(([re]) => re.test(lang(v)))?.[1] ?? lang(v);
  const who = /female/i.test(v.name) ? 'Woman' : MEN.test(v.name) ? 'Man' : WOMEN.test(v.name) ? 'Woman' : '';
  return who ? `${who} · ${accent}` : accent;
}

/** Friendly name: "Microsoft David - English (United States)" → "David". */
export function voiceName(v: SpeechSynthesisVoice): string {
  return v.name.replace(/^(Microsoft|Google|Apple)\s+/i, '').replace(/\s*[-(].*$/, '').replace(/\s+Online$/i, '') || v.name;
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

  // Voices load asynchronously in most browsers
  // Voices load late on many phones, and some never fire 'voiceschanged', so also poll for a few seconds
  const [voices, setVoices] = useState(englishVoices);
  const refreshVoices = useCallback(() => {
    const next = englishVoices();
    setVoices(prev => (prev.length === next.length && prev.every((v, i) => v === next[i]) ? prev : next));
    return next.length;
  }, []);
  useEffect(() => {
    if (!synth) return;
    synth.addEventListener?.('voiceschanged', refreshVoices);
    let tries = 0;
    const poll = setInterval(() => {
      if (refreshVoices() || ++tries >= 20) clearInterval(poll);
    }, 250);
    return () => {
      clearInterval(poll);
      synth.removeEventListener?.('voiceschanged', refreshVoices);
    };
  }, [refreshVoices]);
  // Chosen voice (by voiceURI), remembered per device; '' = automatic
  const [voiceId, setVoiceIdState] = useState(() => {
    try {
      return localStorage.getItem('voice') ?? '';
    } catch {
      return '';
    }
  });
  const voice = voices.find(v => v.voiceURI === voiceId) ?? defaultVoice(voices);
  const voiceRef = useRef(voice);
  voiceRef.current = voice;
  const run = useRef(0); // bumps on every play/stop so callbacks from a cancelled run are ignored
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const queue = useRef<VerseHit[]>([]);
  const index = useRef(0); // verse being read, so a speed or voice change can restart it

  const finish = useCallback(() => {
    queue.current = [];
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

  const play = useCallback(
    (verses: VerseHit[], from = 0) => {
      if (!synth || !verses.length) return;
      const id = ++run.current;
      synth.cancel();
      queue.current = verses;
      setPlaying(verses);

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
          const voice = voiceRef.current;
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

  // Queued speech keeps its old rate and voice, so restart the current verse with the new ones
  const restart = useCallback(() => {
    if (queue.current.length && synth?.speaking) play(queue.current, index.current);
  }, [play]);

  const setSpeed = useCallback(
    (next: number) => {
      setSpeedState(next);
      speedRef.current = next;
      try {
        localStorage.setItem('speed', String(next));
      } catch {
        // storage unavailable; setting lasts for this visit
      }
      restart();
    },
    [restart],
  );

  const setVoice = useCallback(
    (id: string) => {
      setVoiceIdState(id);
      voiceRef.current = voices.find(v => v.voiceURI === id) ?? defaultVoice(voices);
      try {
        localStorage.setItem('voice', id);
      } catch {
        // storage unavailable; setting lasts for this visit
      }
      restart();
    },
    [voices, restart],
  );

  /** Speaks a short sample in `v`, stopping any reading first. */
  const preview = useCallback(
    (v: SpeechSynthesisVoice) => {
      if (!synth) return;
      if (queue.current.length) stop();
      synth.cancel();
      const u = new SpeechSynthesisUtterance('The Lord is my shepherd; I shall not want.');
      u.voice = v;
      u.lang = v.lang;
      u.rate = 0.95 * speedRef.current;
      synth.speak(u);
    },
    [stop],
  );

  useEffect(() => () => {
    run.current++;
    synth?.cancel();
  }, []);

  return { supported: !!synth, playing, current, repeat, setRepeat, sayRefs, setSayRefs, speed, setSpeed,
    voices, voice, voiceId, setVoice, preview, refreshVoices, play, stop };
}
