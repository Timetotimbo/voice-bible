import { useCallback, useEffect, useRef, useState } from 'react';
import { BOOKS, BOOKS_ES, bookName } from './bible/books';
import type { VerseHit } from './bible/search';
import { RECORDED_VOICES, SPEECH_GAP, SPEECH_LEAD, SPEECH_TAIL, chapterAudio, refSpans, refsAudio, verseStarts } from './recorded';
import { speakingWeight, wordAt, wordSpans, type WordSpan } from './words';

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
// Plays silence on a loop while a device voice reads, so the phone treats the page as playing audio and keeps it
// running with the screen off (speech itself doesn't count)
const keepAliveEl = makeAudio();
function keepAwake(on: boolean) {
  if (!keepAliveEl) return;
  if (on) {
    keepAliveEl.loop = true;
    if (keepAliveEl.src !== SILENCE) keepAliveEl.src = SILENCE;
    keepAliveEl.play().catch(() => {});
  } else keepAliveEl.pause();
}
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
 * past `end` so the next verse of the same chapter follows without a seek. `stopEarly` seconds are
 * taken off `end` when stopping, to finish in the quiet after the last word rather than at the edge of
 * whatever comes next.
 */
function playSegment(el: HTMLAudioElement, src: string, start: number, end: number | undefined, rate: number, keepGoing = false, stopEarly = 0) {
  return new Promise<'done' | 'error'>(resolve => {
    endSegment?.();
    let done = false;
    let timer = 0;
    const finish = (result: 'done' | 'error') => {
      if (done) return;
      done = true;
      clearInterval(timer);
      el.removeEventListener('timeupdate', tick);
      el.onended = el.onerror = null;
      endSegment = null;
      resolve(result);
    };
    const stopAt = end === undefined ? undefined : keepGoing ? end : end - stopEarly;
    const tick = () => {
      if (stopAt === undefined || el.currentTime < stopAt) return;
      if (!keepGoing) el.pause();
      finish('done');
    };
    // timeupdate only comes ~4 times a second, late enough to catch the next word, so check often too. A timer
    // (not animation frames) keeps checking when the screen is off, since the page is playing audio.
    const poll = () => {
      clearInterval(timer);
      timer = window.setInterval(tick, 40);
    };
    endSegment = () => {
      el.pause();
      finish('done');
    };
    const begin = () => {
      if (Math.abs(el.currentTime - start) > 0.3) el.currentTime = start;
      el.defaultPlaybackRate = el.playbackRate = rate;
      if (el.paused) el.play().catch(() => finish('error'));
      poll();
    };
    el.addEventListener('timeupdate', tick);
    el.onended = () => finish('done');
    el.onerror = () => finish('error');
    if (el.src !== src || el.error) {
      el.src = src;
      el.addEventListener('loadedmetadata', begin, { once: true });
      el.load();
    } else begin();
  });
}
const REC = 'rec:';
// Chrome can garbage-collect an utterance mid-speech and never fire its end, which stalls reading, so hold on to them
const speaking = new Set<SpeechSynthesisUtterance>();
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
export const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const ORDINAL: Record<string, string> = { '1': 'First', '2': 'Second', '3': 'Third' };

export type ReadingLanguage = 'en' | 'es';

// "1 Samuel" is "Primero de Samuel" (a book), "1 Juan" is "Primera de Juan" (a letter)
const ORDINAL_ES: Record<string, [string, string]> = { '1': ['Primero', 'Primera'], '2': ['Segundo', 'Segunda'], '3': ['Tercero', 'Tercera'] };

/**
 * "1 John 4:8" → "First John 4, verse 8" (or "Primera de Juan 4, versículo 8") so it isn't read as a time or a
 * list of numbers.
 */
function spokenReference(v: VerseHit, language: ReadingLanguage): string {
  if (language === 'es') {
    const book = BOOKS_ES[v.book].replace(/^([123]) /, (_, n) => `${ORDINAL_ES[n][v.book < 39 ? 0 : 1]} de `);
    return `${book} ${v.chapter}, versículo ${v.verse}.`;
  }
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

const speaks = (v: SpeechSynthesisVoice, language: ReadingLanguage) =>
  language === 'es' ? /^es\b/i.test(lang(v)) || /spanish|español/i.test(v.name) : /^en\b/i.test(lang(v)) || /english/i.test(v.name);

/** Voices on this device for the language (or every voice, if none say they speak it), sorted by accent then name. */
function voicesFor(language: ReadingLanguage): SpeechSynthesisVoice[] {
  const all = (synth?.getVoices() ?? []).filter(v => !NOVELTY.test(v.name));
  const matching = all.filter(v => speaks(v, language));
  return (matching.length ? matching : all).sort((a, b) => lang(a).localeCompare(lang(b)) || a.name.localeCompare(b.name));
}

function defaultVoice(voices: SpeechSynthesisVoice[], language: ReadingLanguage = 'en'): SpeechSynthesisVoice | undefined {
  const preferred = language === 'es' ? ['es-US', 'es-MX', 'es-ES'] : ['en-US'];
  for (const code of preferred) {
    const found = voices.find(v => lang(v) === code && v.localService) ?? voices.find(v => lang(v) === code);
    if (found) return found;
  }
  return voices[0];
}

const ACCENTS: [RegExp, string][] = [
  [/scotland|gbsct/i, 'Scottish'],
  [/es-ES/i, 'Spain'],
  [/es-MX/i, 'Mexican'],
  [/es-US/i, 'US Spanish'],
  [/es-/i, 'Latin American'],
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
const MEN = /\b(male|jorge|juan|diego|carlos|pablo|enrique|alvaro|raul|andres|david|mark|guy|george|ryan|brian|christopher|eric|roger|steffan|andrew|aaron|alex|daniel|fred|arthur|gordon|lee|oliver|rishi|thomas|tom|ralph|junior|nathan|reed|rocko|grandpa|eddy|liam|connor|mitchell|william|prabhat|ravi|luke|tony|evan|james|matthew|justin|joey|russell|geraint|brandon|davis|jason|kai|christopher)\b/i;
const WOMEN = /\b(female|monica|paulina|helena|laura|sabina|lucia|elvira|dalia|marisol|paloma|zira|aria|jenny|michelle|ana|emma|hazel|susan|libby|sonia|natasha|clara|samantha|karen|moira|tessa|veena|fiona|victoria|allison|ava|serena|kate|stephanie|martha|catherine|nicky|sandy|shelley|grandma|kathy|flo|neerja|heera|leah|joanna|salli|kimberly|ivy|amy|olivia|emily|isla|nicole|raveena|aditi|ayanda|molly|sara|jane|nancy|amber|ashley|cora|elizabeth|monica|linda|heather|google us english)\b/i;

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
/** Reads verses aloud. `language` is the Bible's: Spanish uses Spanish device voices (the recordings are English). */
export function useReader(onDone: () => void, language: ReadingLanguage = 'en') {
  const languageRef = useRef(language);
  languageRef.current = language;
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
  const [voices, setVoices] = useState(() => voicesFor(language));
  const refreshVoices = useCallback(() => {
    const next = voicesFor(language);
    setVoices(prev => (prev.length === next.length && prev.every((v, i) => v === next[i]) ? prev : next));
    return next.length;
  }, [language]);
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
  // Chosen voice (by voiceURI), remembered per device and per language; '' = automatic
  const voiceKey = language === 'en' ? 'voice' : `voice-${language}`;
  const savedVoice = useCallback(() => {
    try {
      return localStorage.getItem(voiceKey) ?? '';
    } catch {
      return '';
    }
  }, [voiceKey]);
  const [voiceId, setVoiceIdState] = useState(savedVoice);
  useEffect(() => setVoiceIdState(savedVoice()), [savedVoice]);
  const voice = voices.find(v => v.voiceURI === voiceId) ?? defaultVoice(voices, language);
  const voiceRef = useRef(voice);
  voiceRef.current = voice;
  // The recordings are of the English KJV
  const recordedVoice = language === 'en' ? RECORDED_VOICES.find(v => REC + v.id === voiceId) : undefined;
  const recordedRef = useRef(recordedVoice?.id);
  recordedRef.current = recordedVoice?.id;
  const run = useRef(0); // bumps on every play/stop so callbacks from a cancelled run are ignored
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const queue = useRef<VerseHit[]>([]);
  const index = useRef(0); // verse being read, so a speed or voice change can restart it

  // The word being said, as a character range in the verse being read
  const [word, setWord] = useState<{ start: number; end: number } | null>(null);
  const wordStart = useRef(-1);
  const showWord = useCallback((w: WordSpan | null) => {
    if ((w?.start ?? -1) === wordStart.current) return;
    wordStart.current = w?.start ?? -1;
    setWord(w && { start: w.start, end: w.end });
  }, []);
  // While speech plays, `track` runs every frame to move the word along
  const frame = useRef(0);
  const follow = useCallback((track: () => void) => {
    cancelAnimationFrame(frame.current);
    const loop = () => {
      track();
      frame.current = requestAnimationFrame(loop);
    };
    loop();
  }, []);
  const unfollow = useCallback(() => cancelAnimationFrame(frame.current), []);
  // Device voices that report each word get exact highlighting; for the rest, seconds per unit of
  // speakingWeight at normal speed, learned from how long each phrase takes
  const hasBoundaries = useRef(false);
  const secondsPerWeight = useRef(0.07);

  // When reading last moved on; the watchdog picks up again if it stalls
  const lastProgress = useRef(0);

  const finish = useCallback(() => {
    keepAwake(false);
    queue.current = [];
    unfollow();
    showWord(null);
    setPlaying(null);
    setCurrent(null);
    onDoneRef.current();
  }, [unfollow, showWord]);

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
        showWord(null);
        lastProgress.current = Date.now();
        for (let attempt = 1; ; attempt++) try {
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
          const spans = wordSpans(verse.text);
          const from = starts[verse.verse - 1] + SPEECH_LEAD;
          follow(() => {
            const el = mainEl!;
            if (el.src !== src || el.seeking) return;
            const to = starts[verse.verse] !== undefined ? starts[verse.verse] - SPEECH_TAIL : el.duration - SPEECH_GAP;
            if (el.currentTime >= from && to > from) showWord(wordAt(spans, (el.currentTime - from) / (to - from)));
          });
          // Stop in the quiet after the verse (it lasts SPEECH_TAIL + SPEECH_LEAD before the next one's words)
          const result = await playSegment(mainEl!, src, starts[verse.verse - 1], starts[verse.verse], speedRef.current, flows, SPEECH_TAIL - 0.15);
          unfollow();
          if (result === 'error') throw 0;
          break;
        } catch {
          unfollow();
          if (id !== run.current) return;
          // A dropped connection often comes back: try this verse again a few times, waiting a little longer each time
          if (attempt < 4) {
            await wait(3000 * attempt);
            if (id !== run.current) return;
            continue;
          }
          // Recording missing or still offline: read the rest with the device voice
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
        const pieces = chunks(verse.text);
        // Where each piece sits in the verse, so a word reported within a piece can be found in the verse
        let pos = 0;
        const offsets = pieces.map(c => {
          const at = verse.text.indexOf(c, pos);
          pos = at < 0 ? pos : at + c.length;
          return Math.max(at, 0);
        });
        const parts = [...(sayRefsRef.current ? [{ text: spokenReference(verse, languageRef.current), at: -1 }] : []), ...pieces.map((text, k) => ({ text, at: offsets[k] }))];
        parts.forEach(({ text, at }, j) => {
          const u = new SpeechSynthesisUtterance(text);
          const voice = voiceRef.current;
          if (voice) u.voice = voice;
          u.lang = voice?.lang ?? (languageRef.current === 'es' ? 'es-ES' : 'en-US');
          u.rate = 0.95 * speedRef.current;
          const spans = at < 0 ? [] : wordSpans(verse.text, at, at + text.length);
          let began = 0;
          u.onstart = () => {
            lastProgress.current = Date.now();
            if (id !== run.current) return;
            if (j === 0) setCurrent(verse);
            showWord(spans[0] ?? null);
            began = performance.now();
            if (!hasBoundaries.current && spans.length) {
              const seconds = speakingWeight(text) * secondsPerWeight.current / u.rate;
              follow(() => showWord(wordAt(spans, (performance.now() - began) / 1000 / seconds)));
            }
          };
          u.onboundary = e => {
            if (id !== run.current || at < 0 || (e.name && e.name !== 'word')) return;
            hasBoundaries.current = true;
            unfollow();
            const c = at + e.charIndex;
            showWord(spans.filter(s => s.start <= c).pop() ?? null);
          };
          const ended = () => {
            speaking.delete(u);
            unfollow();
            const took = (performance.now() - began) / 1000;
            // Learn this voice's pace from whole phrases, ignoring blips
            if (began && at >= 0 && took > 0.5) {
              secondsPerWeight.current = 0.7 * secondsPerWeight.current + 0.3 * (took * u.rate / speakingWeight(text));
            }
          };
          u.onend = () => {
            ended();
            if (j === parts.length - 1 && id === run.current) speak(i + 1);
          };
          if (j === parts.length - 1) {
            u.onerror = e => {
              ended();
              // 'interrupted'/'canceled' come from our own stop(); anything else, move on
              if (e.error !== 'interrupted' && e.error !== 'canceled') speak(i + 1);
            };
          }
          speaking.add(u);
          lastProgress.current = Date.now();
          synth!.speak(u);
        });
      };
      if (recorded) {
        keepAwake(false);
        unlockAudio();
        speakRecorded(from, recorded);
      } else {
        keepAwake(true);
        speak(from);
      }
    },
    [finish, follow, unfollow, showWord],
  );

  // Queued speech keeps its old rate and voice, so restart the current verse with the new ones
  // All-night repeats: if nothing has moved for a while (a lost phrase, a stalled recording), carry on from this verse
  useEffect(() => {
    if (!playing) return;
    let times = allEls.map(el => el.currentTime);
    const check = setInterval(() => {
      const now = allEls.map(el => el.currentTime);
      if (now.some((t, k) => t !== times[k])) lastProgress.current = Date.now();
      times = now;
      if (queue.current.length && Date.now() - lastProgress.current > 45_000) {
        lastProgress.current = Date.now();
        play(queue.current, index.current);
      }
    }, 5000);
    return () => clearInterval(check);
  }, [playing, play]);

  // Keep the screen awake while reading, so the phone doesn't put the page to sleep partway through the night
  useEffect(() => {
    if (!playing || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let done = false;
    const get = () => {
      if (document.visibilityState !== 'visible') return;
      navigator.wakeLock.request('screen').then(
        l => {
          if (done) l.release();
          else lock = l;
        },
        () => {}, // not allowed (battery saver, etc.): read on without it
      );
    };
    get();
    // The lock is dropped when the page is hidden; take it again on return
    const onVisible = () => (!lock || lock.released) && get();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      done = true;
      document.removeEventListener('visibilitychange', onVisible);
      lock?.release();
    };
  }, [playing]);

  // Lock-screen and notification controls, which also tell the phone this is audio meant to keep playing
  useEffect(() => {
    const session = navigator.mediaSession;
    if (!session) return;
    if (!current) {
      session.playbackState = 'none';
      return;
    }
    session.metadata = new MediaMetadata({
      title: `${bookName(current.book)} ${current.chapter}:${current.verse}`,
      artist: 'Voice Bible',
      album: current.text.slice(0, 80),
    });
    session.playbackState = 'playing';
  }, [current]);
  useEffect(() => {
    const session = navigator.mediaSession;
    if (!session) return;
    const actions: MediaSessionAction[] = ['pause', 'stop'];
    for (const a of actions) {
      try {
        session.setActionHandler(a, stop);
      } catch {
        // action not supported here
      }
    }
    return () => actions.forEach(a => {
      try {
        session.setActionHandler(a, null);
      } catch {
        // ignore
      }
    });
  }, [stop]);

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
      voiceRef.current = voices.find(v => v.voiceURI === id) ?? defaultVoice(voices, language);
      recordedRef.current = id.startsWith(REC) ? id.slice(REC.length) : undefined;
      try {
        localStorage.setItem(voiceKey, id);
      } catch {
        // storage unavailable; setting lasts for this visit
      }
      restart();
    },
    [voices, restart, language, voiceKey],
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

  return { supported: !!synth || !!mainEl, language, playing, current, word, repeat, setRepeat, sayRefs, setSayRefs, speed, setSpeed,
    voices, voice, voiceId, recordedVoice, setVoice, preview, refreshVoices, play, stop };
}
