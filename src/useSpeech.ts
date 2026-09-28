import { useCallback, useEffect, useRef, useState } from 'react';

// Web Speech API isn't in TypeScript's DOM lib yet
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

const Recognition: (new () => SpeechRecognitionLike) | undefined =
  (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;

export type SpeechStatus = 'unsupported' | 'idle' | 'listening' | 'blocked';

// Safari (and every browser on iPhone and iPad) can ask for the microphone each time listening starts,
// so there the mic only listens when tapped instead of restarting itself.
const ua = navigator.userAgent;
export const TAP_TO_TALK =
  /iPad|iPhone|iPod/.test(ua) ||
  (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) || // iPad asking for the desktop site
  (/Safari/.test(ua) && !/Chrome|Chromium|CriOS|Edg|Android/.test(ua));

/**
 * Keeps the microphone listening (restarting after the browser's silence timeouts)
 * and reports each final phrase. Starts automatically, except with TAP_TO_TALK, where each
 * start() listens until the browser stops and then waits for the next tap.
 */
export function useSpeech(onPhrase: (text: string) => void, language: 'en' | 'es' = 'en') {
  // Listen in the language of the Bible being read
  const speechLang = language === 'es' ? 'es-ES' : 'en-US';
  const speechLangRef = useRef(speechLang);
  speechLangRef.current = speechLang;
  const [status, setStatus] = useState<SpeechStatus>(Recognition ? 'idle' : 'unsupported');
  const [interim, setInterim] = useState('');
  const wanted = useRef(false);
  const rec = useRef<SpeechRecognitionLike | null>(null);
  const onPhraseRef = useRef(onPhrase);
  onPhraseRef.current = onPhrase;

  const start = useCallback(() => {
    if (!Recognition) return;
    wanted.current = true;
    if (!rec.current) {
      const r = new Recognition();
      r.continuous = true;
      r.interimResults = true;
      r.onstart = () => setStatus('listening');
      r.onresult = e => {
        let partial = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const res = e.results[i];
          const text = res[0].transcript.trim();
          if (res.isFinal) {
            if (text) onPhraseRef.current(text);
          } else {
            partial += text + ' ';
          }
        }
        setInterim(partial.trim());
      };
      r.onerror = e => {
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
          wanted.current = false;
          setStatus('blocked');
        }
      };
      r.onend = () => {
        setInterim('');
        if (TAP_TO_TALK) wanted.current = false;
        if (wanted.current && !document.hidden) {
          // Browsers end recognition after silence; pick it back up
          setTimeout(() => {
            if (!wanted.current) return;
            try {
              r.lang = speechLangRef.current;
              r.start();
            } catch {
              setStatus('idle');
            }
          }, 300);
        } else {
          setStatus(s => (s === 'blocked' ? s : 'idle'));
        }
      };
      rec.current = r;
    }
    rec.current.lang = speechLangRef.current;
    try {
      rec.current.start();
    } catch {
      // already running
    }
  }, []);

  const stop = useCallback(() => {
    wanted.current = false;
    rec.current?.stop();
    setStatus('idle');
  }, []);

  useEffect(() => {
    if (!TAP_TO_TALK) start();
    // Pause while the tab is in the background and resume on return
    const onVisibility = () => {
      if (document.hidden) rec.current?.stop();
      else if (wanted.current && !TAP_TO_TALK) start();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      wanted.current = false;
      rec.current?.abort();
    };
  }, [start]);

  // Switching language while listening: stop, and the automatic restart listens in the new one
  useEffect(() => {
    if (status === 'listening') rec.current?.stop();
  }, [speechLang]);

  return { status, interim, start, stop };
}
