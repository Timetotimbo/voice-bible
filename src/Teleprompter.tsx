import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { t } from './i18n';
import { normalMp4 } from './mp4fix';
import { paragraphsOf } from './words';

/**
 * Teleprompter: the camera full screen with the note scrolling near the lens, so you can read it while
 * looking at the camera. Record, watch the take, then save it or share it (to TikTok, Instagram, YouTube…).
 * The words on screen aren't in the video.
 */
type Prefs = { wpm: number; size: number; mirror: boolean; countdown: boolean; facing: 'user' | 'environment' };
const PREFS_KEY = 'prompter';
const DEFAULTS: Prefs = { wpm: 130, size: 34, mirror: false, countdown: true, facing: 'user' };
const MIN_WPM = 60;
const MAX_WPM = 260;

function loadPrefs(): Prefs {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') };
  } catch {
    return DEFAULTS;
  }
}

/** The best video format this browser can record: MP4 (Android Chrome, iPhone), else WebM. */
export function recordingType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const types = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  return types.find(m => MediaRecorder.isTypeSupported?.(m)) ?? '';
}

/** A safe file name from the note's title. */
export function videoFileName(title: string, type: string): string {
  const base = title.trim().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'voice-bible';
  return `${base}-${new Date().toLocaleDateString('en-CA')}.${type.includes('mp4') ? 'mp4' : 'webm'}`;
}

// ClipForge (captions, word animations, auto-reframe) takes the video in a new tab
const CLIPFORGE = 'https://clipforge.eefavorbooks.com';

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

type Take = { url: string; blob: Blob; name: string; saved: boolean };

export function Teleprompter({ title, text, onClose }: { title: string; text: string; onClose: () => void }) {
  const [prefs, setPrefsState] = useState(loadPrefs);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const setPrefs = (patch: Partial<Prefs>) =>
    setPrefsState(p => {
      const next = { ...p, ...patch };
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      } catch {
        /* private mode: just not remembered */
      }
      return next;
    });

  const paragraphs = useMemo(() => paragraphsOf(text), [text]);
  const wordCount = useMemo(() => text.split(/\s+/).filter(Boolean).length, [text]);

  // ---- Camera ----
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [camError, setCamError] = useState('');
  const [camReady, setCamReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setCamReady(false);
    (async () => {
      try {
        stream.current?.getTracks().forEach(tr => tr.stop());
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: prefs.facing, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        if (cancelled) return s.getTracks().forEach(tr => tr.stop());
        stream.current = s;
        if (video.current) {
          video.current.srcObject = s;
          await video.current.play().catch(() => {});
        }
        setCamError('');
        setCamReady(true);
      } catch (e) {
        const name = (e as Error).name;
        setCamError(
          name === 'NotAllowedError'
            ? t('Camera or microphone blocked. Allow them for this site in the browser’s settings, then try again.')
            : name === 'NotFoundError'
              ? t('No camera found on this device.')
              : t('The camera couldn’t start: {error}', { error: (e as Error).message }),
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [prefs.facing]);
  useEffect(() => () => stream.current?.getTracks().forEach(tr => tr.stop()), []);

  // Keep the screen on while the teleprompter is open
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const wl = (navigator as Navigator & { wakeLock?: { request: (k: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock;
    const get = () => wl?.request('screen').then(l => (lock = l)).catch(() => {});
    get();
    const again = () => document.visibilityState === 'visible' && get();
    document.addEventListener('visibilitychange', again);
    return () => {
      document.removeEventListener('visibilitychange', again);
      lock?.release().catch(() => {});
    };
  }, []);

  // ---- Scrolling ----
  const scroller = useRef<HTMLDivElement>(null);
  const words = useRef<HTMLDivElement>(null);
  const [running, setRunning] = useState(false);
  const held = useRef(false); // a finger is on the text
  useEffect(() => {
    if (!running) return;
    const el = scroller.current;
    if (!el) return;
    let raf = 0;
    let last = performance.now();
    let pos = el.scrollTop;
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (held.current || Math.abs(el.scrollTop - pos) > 2) pos = el.scrollTop; // moved by hand: carry on from there
      else {
        // Words per minute → pixels: the text's height per word, so it's right for any text size
        const perWord = (words.current?.offsetHeight ?? 0) / Math.max(1, wordCount);
        pos += ((prefsRef.current.wpm / 60) * perWord) * dt;
        el.scrollTop = pos;
        if (pos >= el.scrollHeight - el.clientHeight - 1) {
          setRunning(false);
          return;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, wordCount]);
  const toTop = () => {
    if (scroller.current) scroller.current.scrollTop = 0;
  };
  // A tap on the text pauses or carries on; a drag moves it
  const tap = useRef<{ y: number; at: number } | null>(null);

  // ---- Recording ----
  const recorder = useRef<MediaRecorder | null>(null);
  const [recording, setRecording] = useState(false);
  const [count, setCount] = useState(0); // 3, 2, 1 before recording
  const [elapsed, setElapsed] = useState(0);
  const [take, setTake] = useState<Take | null>(null);
  const [preparing, setPreparing] = useState(false); // making the recording into a normal MP4
  const [note, setNote] = useState('');
  const type = useMemo(recordingType, []);

  useEffect(() => {
    if (!recording) return;
    const t0 = performance.now();
    const iv = setInterval(() => setElapsed((performance.now() - t0) / 1000), 250);
    return () => clearInterval(iv);
  }, [recording]);

  const begin = () => {
    const s = stream.current;
    if (!s) return;
    const chunks: Blob[] = [];
    let rec: MediaRecorder;
    try {
      rec = new MediaRecorder(s, { ...(type ? { mimeType: type } : {}), videoBitsPerSecond: 6_000_000 });
    } catch (e) {
      setNote(t('This browser can’t record video: {error}', { error: (e as Error).message }));
      return;
    }
    rec.ondataavailable = e => e.data.size && chunks.push(e.data);
    rec.onstop = async () => {
      const blobType = rec.mimeType || type || 'video/webm';
      setPreparing(true);
      // Rewrite the phone's MP4 so its length is right in the gallery (it records in pieces)
      const blob = await normalMp4(new Blob(chunks, { type: blobType.split(';')[0] }));
      setPreparing(false);
      setTake({ url: URL.createObjectURL(blob), blob, name: videoFileName(title, blobType), saved: false });
    };
    rec.start(1000);
    recorder.current = rec;
    setElapsed(0);
    setRecording(true);
    setRunning(true);
  };
  const startRecording = () => {
    setNote('');
    setRunning(false);
    if (!prefs.countdown) return begin();
    let n = 3;
    setCount(n);
    const iv = setInterval(() => {
      n -= 1;
      if (n > 0) return setCount(n);
      clearInterval(iv);
      setCount(0);
      begin();
    }, 1000);
  };
  const stopRecording = () => {
    setRunning(false);
    setRecording(false);
    if (recorder.current && recorder.current.state !== 'inactive') recorder.current.stop();
    recorder.current = null;
  };
  // Stop cleanly if the teleprompter is closed mid-take
  useEffect(() => () => recorder.current?.stop(), []);

  const discardTake = () => {
    if (take) URL.revokeObjectURL(take.url);
    setTake(null);
    setNote('');
    setSendState('');
  };
  const save = () => {
    if (!take) return;
    const a = document.createElement('a');
    a.href = take.url;
    a.download = take.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTake({ ...take, saved: true });
  };
  const file = () => (take ? new File([take.blob], take.name, { type: take.blob.type }) : null);
  const canShare = useMemo(() => {
    try {
      return !!navigator.canShare?.({ files: [new File([''], 'a.mp4', { type: 'video/mp4' })] });
    } catch {
      return false;
    }
  }, []);
  const share = async () => {
    const f = file();
    if (!f || !take) return;
    try {
      await navigator.share({ files: [f], title: title || 'Voice Bible' });
      setTake({ ...take, saved: true });
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setNote(t('Couldn’t share the video: {error}. Save it instead.', { error: (e as Error).message }));
    }
  };
  // Send to ClipForge: open it, wait for it to say it's ready, then pass the file across (only to ClipForge's address)
  const [sendState, setSendState] = useState<'' | 'sending' | 'sent'>('');
  const stopListening = useRef<(() => void) | null>(null);
  useEffect(() => () => stopListening.current?.(), []);
  const sendToClipForge = () => {
    const f = file();
    if (!f || !take) return;
    stopListening.current?.();
    setNote('');
    const w = window.open(`${CLIPFORGE}/?from=voicebible`, '_blank');
    if (!w) return setNote(t('The browser blocked the new tab. Allow pop-ups for this site, or save the video and upload it in ClipForge.'));
    setSendState('sending');
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== CLIPFORGE || e.source !== w) return;
      if (e.data?.type === 'clipforge-ready') w.postMessage({ type: 'voicebible-video', file: f, name: take.name, title, script: text }, CLIPFORGE);
      else if (e.data?.type === 'clipforge-got') {
        stopListening.current?.();
        setSendState('sent');
        setTake(tk => (tk ? { ...tk, saved: true } : tk));
      }
    };
    const timer = setTimeout(() => {
      stopListening.current?.();
      setSendState('');
      setNote(t('ClipForge didn’t answer. Save the video, then upload it in ClipForge.'));
    }, 30000);
    window.addEventListener('message', onMessage);
    stopListening.current = () => {
      window.removeEventListener('message', onMessage);
      clearTimeout(timer);
      stopListening.current = null;
    };
  };

  const close = () => {
    if (recording) stopRecording();
    if (take && !take.saved && !window.confirm(t('Close without saving this video?'))) return;
    if (take) URL.revokeObjectURL(take.url);
    onClose();
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const [showSettings, setShowSettings] = useState(false);
  const speed = (wpm: number) => setPrefs({ wpm: Math.max(MIN_WPM, Math.min(MAX_WPM, wpm)) });
  const minutes = wordCount / prefs.wpm;

  return createPortal(
    <div className="prompter" role="dialog" aria-modal="true" aria-label={t('Teleprompter')}>
      <video ref={video} className={`prompter-cam ${prefs.facing === 'user' ? 'selfie' : ''}`} playsInline muted autoPlay />
      {camError && <p className="prompter-error">{camError}</p>}

      {!take && (
        <>
          <div
            ref={scroller}
            className="prompter-scroll"
            style={{ fontSize: prefs.size }}
            onPointerDown={e => {
              held.current = true;
              tap.current = { y: e.clientY, at: performance.now() };
            }}
            onPointerUp={e => {
              held.current = false;
              const tp = tap.current;
              tap.current = null;
              if (tp && Math.abs(e.clientY - tp.y) < 8 && performance.now() - tp.at < 400) setRunning(r => !r);
            }}
            onPointerCancel={() => {
              held.current = false;
              tap.current = null;
            }}
          >
            <div ref={words} className={`prompter-words ${prefs.mirror ? 'mirror' : ''}`}>
              {paragraphs.length ? paragraphs.map((p, i) => <p key={i}>{p}</p>) : <p className="prompter-empty">{t('This note is empty. Write something to read first.')}</p>}
            </div>
          </div>
          <div className="prompter-guide" aria-hidden />

          <div className="prompter-top">
            {recording ? (
              <span className="prompter-rec">● {clock(elapsed)}</span>
            ) : (
              <span className="prompter-info">{t('About {m} min at this speed', { m: Math.max(1, Math.round(minutes)) })}</span>
            )}
            <button className="prompter-icon" aria-label={t('Teleprompter settings')} aria-expanded={showSettings} onClick={() => setShowSettings(s => !s)}>
              ⚙
            </button>
          </div>

          {showSettings && (
            <div className="prompter-settings">
              <label>
                {t('Text size')}
                <input type="range" min={20} max={64} step={2} value={prefs.size} onChange={e => setPrefs({ size: +e.target.value })} />
              </label>
              <label className="prompter-check">
                <input type="checkbox" checked={prefs.countdown} onChange={e => setPrefs({ countdown: e.target.checked })} />
                {t('3-second countdown')}
              </label>
              <label className="prompter-check">
                <input type="checkbox" checked={prefs.mirror} onChange={e => setPrefs({ mirror: e.target.checked })} />
                {t('Mirror the text (for a teleprompter glass)')}
              </label>
            </div>
          )}

          {count > 0 && <div className="prompter-count" aria-live="assertive">{count}</div>}
          {preparing && <div className="prompter-count prompter-preparing" aria-live="polite">{t('Preparing the video…')}</div>}
          {note && <p className="prompter-error">{note}</p>}

          <div className="prompter-bottom">
            <div className="prompter-speed">
              <button aria-label={t('Slower')} onClick={() => speed(prefs.wpm - 10)}>−</button>
              <label>
                <span>{t('Speed {wpm} words a minute', { wpm: prefs.wpm })}</span>
                <input type="range" min={MIN_WPM} max={MAX_WPM} step={5} value={prefs.wpm} onChange={e => speed(+e.target.value)} aria-label={t('Speed')} />
              </label>
              <button aria-label={t('Faster')} onClick={() => speed(prefs.wpm + 10)}>+</button>
            </div>
            <div className="prompter-controls">
              <button className="prompter-icon" aria-label={t('Close')} onClick={close}>✕</button>
              <button className="prompter-icon" aria-label={t('Back to the top')} onClick={toTop} disabled={recording}>⤒</button>
              <button
                className={`prompter-record ${recording ? 'on' : ''}`}
                aria-label={t(recording ? 'Stop recording' : 'Record')}
                onClick={recording ? stopRecording : startRecording}
                disabled={!camReady || count > 0}
              >
                <span />
              </button>
              <button className="prompter-icon" aria-label={t(running ? 'Pause scrolling' : 'Start scrolling')} onClick={() => setRunning(r => !r)}>
                {running ? '❚❚' : '▶'}
              </button>
              <button
                className="prompter-icon"
                aria-label={t('Switch camera')}
                onClick={() => setPrefs({ facing: prefs.facing === 'user' ? 'environment' : 'user' })}
                disabled={recording}
              >
                ⟲
              </button>
            </div>
            <p className="prompter-hint">{t(recording ? 'Tap the text to pause it. Drag it to move back or ahead.' : 'Press ● to record. ▶ scrolls the text to practise.')}</p>
          </div>
        </>
      )}

      {take && (
        <div className="prompter-review">
          <video className="prompter-take" src={take.url} controls playsInline />
          {note && <p className="prompter-error">{note}</p>}
          <div className="prompter-actions">
            {canShare && <button className="primary" onClick={share}>{t('Share')}</button>}
            <button className={canShare ? '' : 'primary'} onClick={save}>{t('Save video')}</button>
            <button className="clipforge" onClick={sendToClipForge} disabled={sendState === 'sending'}>
              {t(sendState === 'sending' ? 'Opening ClipForge…' : 'Send to ClipForge')}
            </button>
            <button onClick={() => (take.saved || window.confirm(t('Delete this video and record again?'))) && discardTake()}>{t('Record again')}</button>
            <button onClick={close}>{t('Done')}</button>
          </div>
          <p className="prompter-hint">
            {sendState === 'sent'
              ? t('Sent to ClipForge. Add captions there, then export.')
              : t('Share sends it to TikTok, Instagram, YouTube, WhatsApp and other apps on your phone. ClipForge adds captions and effects.')}
          </p>
        </div>
      )}
    </div>,
    document.body,
  );
}
