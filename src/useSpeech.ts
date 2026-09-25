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

/**
 * Keeps the microphone listening (restarting after the browser's silence timeouts)
 * and reports each final phrase. Starts automatically; browsers that require a tap
 * first (iOS Safari) land in 'idle' and start on the next start() call.
 */
export function useSpeech(onPhrase: (text: string) => void) {
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
      r.lang = 'en-US';
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
        if (wanted.current && !document.hidden) {
          // Browsers end recognition after silence; pick it back up
          setTimeout(() => {
            if (!wanted.current) return;
            try {
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
    start();
    // Pause while the tab is in the background and resume on return
    const onVisibility = () => {
      if (document.hidden) rec.current?.stop();
      else if (wanted.current) start();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      wanted.current = false;
      rec.current?.abort();
    };
  }, [start]);

  return { status, interim, start, stop };
}
