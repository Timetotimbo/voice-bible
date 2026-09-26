import { useCallback, useEffect, useRef, useState } from 'react';
import { BOOKS } from './bible/books';
import type { VerseHit } from './bible/search';
import { RECORDED_VOICES, chapterAudio, refSpans, refsAudio, verseStarts } from './recorded';

const synth: SpeechSynthesis | undefined = window.speechSynthesis;

// Audio elements for recorded voices: the chapter being read, and the two reference clip files.
// iPhone only lets an element play later if it was first started from a tap (see unlockAudio).
const makeAudio = () => (typeof Audio === 'undefined' ? null : new Audio());
const mainEl = makeAudio();
const refEls = [makeAudio(), makeAudio()];
const allEls = [mainEl, ...refEls].filter((el): el is HTMLAudioElement => !!el);
const SILENCE = (() => {
  const bytes = new Uint8Array(44 + 800).fill(128); // 0.1 s of 8-bit silence at 8 kHz
  const view = new DataView(bytes.buffer);
  const text = (at: number, s: string) => [...s].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  text(0, 'RIFF'); view.setUint32(4, 36 + 800, true); text(8, 'WAVE'); text(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, 8000, true); view.setUint32(28, 8000, true); view.setUint16(32, 1, true); view.setUint16(34, 8, true);
  text(36, 'data'); view.setUint32(40, 800, true);
  return URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }));
})();
/** Call from a tap so the elements may play later. */
function unlockAudio() {
  for (const el of allEls) {
    if (!el.paused || el.src) continue;
    el.src = SILENCE;
    el.play().then(() => el.pause(), () => {});
  }
}
let endSegment: (() => void) | null = null;
/**
 * Plays `src` from `start` until `end` (or the end of the file). With `keepGoing`, audio keeps running
 * past `end` so the next verse of the same chapter follows without a seek.
 */
function playSegment(el: HTMLAudioElement, src: string, start: number, end: number | undefined, rate: number, keepGoing = false) {
  return new Promise<'done' | 'error'>(resolve => {
    endSegment?.();
    const finish = (result: 'done' | 'error') => {
      el.removeEventListener('timeupdate', tick);
      el.onended = el.onerror = null;
      endSegment = null;
      resolve(result);
    };
    const tick = () => {
      if (end === undefined || el.currentTime < end) return;
      if (!keepGoing) el.pause();
      finish('done');
    };
    endSegment = () => {
      el.pause();
      finish('done');
    };
    const begin = () => {
      if (Math.abs(el.currentTime - start) > 0.3) el.currentTime = start;
      el.defaultPlaybackRate = el.playbackRate = rate;
      if (el.paused) el.play().catch(() => finish('error'));
    };
    el.addEventListener('timeupdate', tick);
    el.onended = () => finish('done');
    el.onerror = () => finish('error');
    if (el.src !== src) {
      el.src = src;
      el.addEventListener('loadedmetadata', begin, { once: true });
      el.load();
    } else begin();
  });
}
const REC = 'rec:';
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
  const recordedVoice = RECORDED_VOICES.find(v => REC + v.id === voiceId);
  const recordedRef = useRef(recordedVoice?.id);
  recordedRef.current = recordedVoice?.id;
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
    run.current++;
    synth?.cancel();
    endSegment?.();
    finish();
  }, [finish]);

  const play = useCallback(
    (verses: VerseHit[], from = 0) => {
      const recorded = recordedRef.current;
      if ((!synth && !recorded) || !verses.length) return;
      const id = ++run.current;
      synth?.cancel();
      endSegment?.();
      queue.current = verses;
      setPlaying(verses);

      const speakRecorded = async (i: number, voiceName: string) => {
        if (id !== run.current) return;
        if (i >= verses.length) {
          if (repeatRef.current) speakRecorded(0, voiceName);
          else finish();
          return;
        }
        index.current = i;
        const verse = verses[i];
        const next = verses[i + 1];
        setCurrent(verse);
        try {
          const starts = await verseStarts(voiceName, verse.book, verse.chapter);
          if (id !== run.current) return;
          if (sayRefsRef.current) {
            const [chapterClip, verseClip] = await refSpans(voiceName, verse);
            if (id !== run.current) return;
            if ((await playSegment(refEls[0]!, refsAudio(voiceName, 'chapters'), ...chapterClip, speedRef.current)) === 'error') throw 0;
            if (id !== run.current) return;
            if ((await playSegment(refEls[1]!, refsAudio(voiceName, 'verses'), ...verseClip, speedRef.current)) === 'error') throw 0;
            if (id !== run.current) return;
          }
          // The next verse follows on in the same recording, so don't stop between them
          const flows = !sayRefsRef.current && next?.book === verse.book && next.chapter === verse.chapter && next.verse === verse.verse + 1;
          const src = chapterAudio(voiceName, verse.book, verse.chapter);
          if ((await playSegment(mainEl!, src, starts[verse.verse - 1], starts[verse.verse], speedRef.current, flows)) === 'error') throw 0;
        } catch {
          // Recording missing or offline: read the rest with the device voice
          if (id !== run.current) return;
          return synth ? speak(i) : finish();
        }
        speakRecorded(i + 1, voiceName);
      };

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
          synth!.speak(u);
        });
      };
      if (recorded) {
        unlockAudio();
        speakRecorded(from, recorded);
      } else speak(from);
    },
    [finish],
  );

  // Queued speech keeps its old rate and voice, so restart the current verse with the new ones
  const restart = useCallback(() => {
    if (queue.current.length) play(queue.current, index.current);
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
      // Recordings can change speed as they play; device speech has to restart
      if (recordedRef.current) allEls.forEach(el => (el.playbackRate = el.defaultPlaybackRate = next));
      else restart();
    },
    [restart],
  );

  const setVoice = useCallback(
    (id: string) => {
      setVoiceIdState(id);
      voiceRef.current = voices.find(v => v.voiceURI === id) ?? defaultVoice(voices);
      recordedRef.current = id.startsWith(REC) ? id.slice(REC.length) : undefined;
      try {
        localStorage.setItem('voice', id);
      } catch {
        // storage unavailable; setting lasts for this visit
      }
      restart();
    },
    [voices, restart],
  );

  /** Plays a short sample (Psalm 23:1) in a device voice or a recorded voice id, stopping any reading first. */
  const preview = useCallback(
    (v: SpeechSynthesisVoice | string) => {
      if (queue.current.length) stop();
      synth?.cancel();
      endSegment?.();
      if (typeof v === 'string') {
        unlockAudio();
        const id = ++run.current;
        verseStarts(v, 18, 23).then(
          starts => id === run.current && void playSegment(mainEl!, chapterAudio(v, 18, 23), starts[0], starts[1], speedRef.current),
          () => {},
        );
        return;
      }
      if (!synth) return;
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
    endSegment?.();
  }, []);

  return { supported: !!synth || !!mainEl, playing, current, repeat, setRepeat, sayRefs, setSayRefs, speed, setSpeed,
    voices, voice, voiceId, recordedVoice, setVoice, preview, refreshVoices, play, stop };
}
