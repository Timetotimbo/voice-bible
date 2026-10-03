import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { t } from './i18n';
import { clipForgeUrl, leaveForClipForge } from './handoff';
import { normalMp4 } from './mp4fix';
import { paragraphsOf } from './words';
import { slidesOf, startWordsFace, type WordsFace } from './wordsFace';
import { readOnScreen, readScreenPage, type OnScreen, type Page } from './pageWords';
import { canRecordScreen, openFloatingControls, startScreenFace, type BubbleSize, type Corner, type ScreenFace } from './screenFace';

/**
 * Teleprompter: the camera full screen with the note scrolling near the lens, so you can read it while
 * looking at the camera. Record, watch the take, then save it or share it (to TikTok, Instagram, YouTube…).
 * The words on screen aren't in the video.
 */
type Prefs = { wpm: number; size: number; mirror: boolean; countdown: boolean; facing: 'user' | 'environment'; corner: Corner; bubble: BubbleSize; browseView: 'page' | 'verse' };
const PREFS_KEY = 'prompter';
const DEFAULTS: Prefs = { wpm: 130, size: 34, mirror: false, countdown: true, facing: 'user', corner: 'br', bubble: 'm', browseView: 'page' };
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

  // ---- Screen + face (computers only): your screen with your camera in a bubble ----
  const [screen, setScreen] = useState<ScreenFace | null>(null);
  const screenRef = useRef<ScreenFace | null>(null);
  screenRef.current = screen;
  const screenBox = useRef<HTMLDivElement>(null);
  const showScreenOption = useMemo(canRecordScreen, []);
  const layout = () => ({ corner: prefsRef.current.corner, size: prefsRef.current.bubble, mirror: prefsRef.current.facing === 'user' });
  const startScreen = async () => {
    if (!stream.current) return;
    setNote('');
    try {
      const sf = await startScreenFace(stream.current, layout());
      sf.onEnded(() => {
        // "Stop sharing" in the browser's bar: finish the take, back to the camera
        if (recorder.current) stopRecording();
        sf.stop();
        setScreen(null);
      });
      setScreen(sf);
    } catch (e) {
      const name = (e as Error).name;
      if (name !== 'NotAllowedError' && name !== 'AbortError') setNote(t('Couldn’t share the screen: {error}', { error: (e as Error).message }));
    }
  };
  const stopScreen = () => {
    screenRef.current?.stop();
    setScreen(null);
  };
  useEffect(() => {
    const box = screenBox.current;
    if (!screen || !box) return;
    screen.canvas.className = 'prompter-screen';
    box.replaceChildren(screen.canvas);
    return () => screen.canvas.remove();
  }, [screen]);
  useEffect(() => {
    screen?.setLayout(layout());
  }, [screen, prefs.corner, prefs.bubble, prefs.facing]);
  useEffect(() => () => screenRef.current?.stop(), []);
  const floating = useRef<{ close: () => void } | null>(null);

  // ---- Words + face (any device): what you're reading, large, with your face in a circle under it ----
  const [wordsOn, setWordsOn] = useState(false);
  const wordsRef = useRef<WordsFace | null>(null);
  const [wordsFace, setWordsFace] = useState<WordsFace | null>(null);
  const guide = useRef<HTMLDivElement>(null);
  const slides = useMemo(() => paragraphs.map(slidesOf), [paragraphs]);
  // The piece being read: the paragraph at the ▶ line, and how far through it you are
  const currentSlide = () => {
    const lineY = guide.current?.getBoundingClientRect().top ?? 0;
    const ps = Array.from(words.current?.children ?? []) as HTMLElement[];
    let i = 0;
    for (let k = 0; k < ps.length; k++) if (ps[k].getBoundingClientRect().top <= lineY + 4) i = k;
    const parts = slides[i] ?? [''];
    const r = ps[i]?.getBoundingClientRect();
    const through = r && r.height ? Math.max(0, Math.min(0.999, (lineY - r.top) / r.height)) : 0;
    return parts[Math.floor(through * parts.length)] ?? parts[0];
  };
  // Browsing the app while recording: the words on screen instead (looked up 5 times a second)
  const [minimized, setMinimized] = useState(false);
  const minimizedRef = useRef(false);
  minimizedRef.current = minimized;
  const mini = useRef<HTMLDivElement | null>(null);
  const onScreen = useRef<{ at: number; found: OnScreen & { page?: Page } }>({ at: 0, found: { text: '' } });
  const slideNow = (): { title?: string; text: string; page?: Page } => {
    if (!minimizedRef.current) return { text: currentSlide() };
    const now = performance.now();
    const asPage = prefsRef.current.browseView === 'page';
    // The page view scrolls with you, so it's looked at more often
    if (now - onScreen.current.at > (asPage ? 50 : 200)) {
      const page = asPage ? readScreenPage(mini.current) : null;
      const found = page ? { title: page.title, text: '', page } : readOnScreen(mini.current);
      onScreen.current = { at: now, found: found ?? onScreen.current.found };
    }
    return onScreen.current.found;
  };
  const currentSlideRef = useRef(slideNow);
  currentSlideRef.current = slideNow;
  useEffect(() => {
    if (!wordsOn || !camReady || !stream.current) return;
    const wf = startWordsFace(stream.current, () => currentSlideRef.current(), { title, mirror: prefs.facing === 'user' });
    wordsRef.current = wf;
    setWordsFace(wf);
    return () => {
      wf.stop();
      wordsRef.current = null;
      setWordsFace(null);
    };
  }, [wordsOn, camReady, prefs.facing, title]);
  // The small preview shows the canvas itself (put back each time the box appears, e.g. after reviewing a take)
  const thumb = (box: HTMLDivElement | null) => {
    if (!box || !wordsFace || box.firstChild === wordsFace.canvas) return;
    // While browsing, the floating recorder has it, not the hidden teleprompter
    if (minimizedRef.current !== !!box.closest('.prompter-mini')) return;
    wordsFace.canvas.className = 'prompter-thumb-canvas';
    box.replaceChildren(wordsFace.canvas);
  };
  const chooseMode = (m: 'camera' | 'words' | 'screen') => {
    if (m !== 'screen' && screenRef.current) stopScreen();
    setWordsOn(m === 'words');
    if (m === 'screen' && !screenRef.current) startScreen();
  };
  const mode = screen ? 'screen' : wordsOn ? 'words' : 'camera';

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
    const s = screenRef.current?.stream ?? wordsRef.current?.stream ?? stream.current;
    if (!s) return;
    const chunks: Blob[] = [];
    let rec: MediaRecorder;
    try {
      rec = new MediaRecorder(s, { ...(type ? { mimeType: type } : {}), videoBitsPerSecond: screenRef.current || wordsRef.current ? 8_000_000 : 6_000_000 });
    } catch (e) {
      setNote(t('This browser can’t record video: {error}', { error: (e as Error).message }));
      floating.current?.close();
      floating.current = null;
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
    // Recording the screen: a small floating window with your camera and Stop, above whatever you're showing
    if (screenRef.current && stream.current) {
      openFloatingControls(stream.current, { stop: t('Stop') }, () => stopRecording()).then(f => (floating.current = f));
    }
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
    floating.current?.close();
    floating.current = null;
    setRunning(false);
    setRecording(false);
    if (recorder.current && recorder.current.state !== 'inactive') recorder.current.stop();
    recorder.current = null;
    setMinimized(false); // back to the teleprompter to watch the take
  };
  const browse = () => {
    onScreen.current = { at: 0, found: { text: currentSlide() } }; // until something readable is on screen
    setRunning(false);
    setShowSettings(false);
    setMinimized(true);
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
  // Send to ClipForge (at /clipforge/ on this same address): leave the video in storage it can read, then go there
  const [sendState, setSendState] = useState<'' | 'sending' | 'sent'>('');
  const sendToClipForge = async () => {
    const f = file();
    if (!f || !take) return;
    setNote('');
    setSendState('sending');
    try {
      await leaveForClipForge({ file: f, name: take.name, title, script: text, at: Date.now() });
      setSendState('sent');
      stream.current?.getTracks().forEach(tr => tr.stop());
      screenRef.current?.stop();
      location.assign(clipForgeUrl());
    } catch (e) {
      setSendState('');
      setNote(t('Couldn’t pass the video to ClipForge: {error}. Save it instead.', { error: (e as Error).message }));
    }
  };

  const close = () => {
    if (recording) stopRecording();
    if (take && !take.saved && !window.confirm(t('Close without saving this video?'))) return;
    if (take) URL.revokeObjectURL(take.url);
    stopScreen();
    onClose();
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !minimized) close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const [showSettings, setShowSettings] = useState(false);
  const speed = (wpm: number) => setPrefs({ wpm: Math.max(MIN_WPM, Math.min(MAX_WPM, wpm)) });
  const minutes = wordCount / prefs.wpm;

  // The small recorder that floats over the app while you browse
  const camBubble = (v: HTMLVideoElement | null) => {
    if (v && stream.current && v.srcObject !== stream.current) {
      v.srcObject = stream.current;
      v.play().catch(() => {});
    }
  };
  const miniBar = minimized && recording && createPortal(
    <div ref={mini} className="prompter-mini" role="region" aria-label={t('Recording')}>
      {wordsFace ? <div ref={thumb} className="prompter-mini-preview" /> : <video ref={camBubble} className={`prompter-mini-cam ${prefs.facing === 'user' ? 'selfie' : ''}`} playsInline muted autoPlay />}
      <span className="prompter-rec">● {clock(elapsed)}</span>
      <button className="prompter-mini-stop" aria-label={t('Stop recording')} onClick={stopRecording}><span /></button>
      <button className="prompter-mini-back" aria-label={t('Back to the teleprompter')} onClick={() => setMinimized(false)}>⤢</button>
    </div>,
    document.body,
  );

  return createPortal(
    <>
    {miniBar}
    <div className="prompter" role="dialog" aria-modal="true" aria-label={t('Teleprompter')} hidden={minimized}>
      <video ref={video} className={`prompter-cam ${prefs.facing === 'user' ? 'selfie' : ''}`} playsInline muted autoPlay hidden={!!screen && !take} />
      {screen && !take && <div ref={screenBox} className="prompter-cam prompter-screen-box" />}
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
          <div ref={guide} className="prompter-guide" aria-hidden />
          {wordsOn && <div ref={thumb} className="prompter-thumb" aria-label={t('What the video will look like')} />}

          <div className="prompter-top">
            {recording ? (
              <span className="prompter-rec-group">
                <span className="prompter-rec">● {clock(elapsed)}</span>
                <button className="prompter-mode" onClick={browse}>{t('Browse while recording')}</button>
              </span>
            ) : (
              <span className="prompter-info">{t('About {m} min at this speed', { m: Math.max(1, Math.round(minutes)) })}</span>
            )}
            <div className="prompter-modes" role="group" aria-label={t('What to record')}>
              <button className="prompter-mode" onClick={() => chooseMode('camera')} disabled={recording || !camReady} aria-pressed={mode === 'camera'}>
                {t('Camera')}
              </button>
              <button className="prompter-mode" onClick={() => chooseMode('words')} disabled={recording || !camReady} aria-pressed={mode === 'words'}>
                {t('Words + face')}
              </button>
              {showScreenOption && (
                <button className="prompter-mode" onClick={() => chooseMode('screen')} disabled={recording || !camReady} aria-pressed={mode === 'screen'}>
                  {t('Screen + face')}
                </button>
              )}
            </div>
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
              {wordsOn && !screen && (
                <label>
                  {t('While browsing, the video shows')}
                  <select value={prefs.browseView} onChange={e => setPrefs({ browseView: e.target.value as 'page' | 'verse' })}>
                    <option value="page">{t('The page, scrolling with you')}</option>
                    <option value="verse">{t('One verse at a time, big')}</option>
                  </select>
                </label>
              )}
              {screen && (
                <>
                  <label>
                    {t('Face bubble')}
                    <select value={prefs.corner} onChange={e => setPrefs({ corner: e.target.value as Corner })}>
                      <option value="br">{t('Bottom right')}</option>
                      <option value="bl">{t('Bottom left')}</option>
                      <option value="tr">{t('Top right')}</option>
                      <option value="tl">{t('Top left')}</option>
                    </select>
                  </label>
                  <label>
                    {t('Bubble size')}
                    <select value={prefs.bubble} onChange={e => setPrefs({ bubble: e.target.value as BubbleSize })}>
                      <option value="s">{t('Small')}</option>
                      <option value="m">{t('Medium')}</option>
                      <option value="l">{t('Large')}</option>
                    </select>
                  </label>
                </>
              )}
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
                disabled={recording || !!screen}
              >
                ⟲
              </button>
            </div>
            <p className="prompter-hint">
              {wordsOn && !screen
                ? t(recording ? 'The video shows the words at the ▶ line. Tap the text to pause it.' : 'The video shows the words you’re reading at the ▶ line, large, with your face under them (small preview on the right).')
                : screen
                ? t(recording ? 'Recording your screen and face. Stop here, in the small floating window, or with “Stop sharing”.' : 'Press ● to record your screen with your face in the corner. Switch to the window you want to show after the countdown.')
                : t(recording ? 'Tap the text to pause it. Drag it to move back or ahead.' : 'Press ● to record. ▶ scrolls the text to practise.')}
            </p>
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
    </div>
    </>,
    document.body,
  );
}
