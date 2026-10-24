import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { bookName } from './bible/books';
import type { VerseHit } from './bible/search';
import { t } from './i18n';
import { SENTENCE_COLORS, sentenceRanges } from './noteColors';
import { paragraphsOf } from './words';
import { DISPLAY_CHANNEL, joinRemote, openDisplayWindow, remoteCode, remoteUrl, slideLine, type DisplayMsg, type RemoteState } from './presentLink';
import qrcode from 'qrcode-generator';

/**
 * Present: picked verses, or a note a paragraph at a time, filling the screen in the biggest type that fits, for
 * showing on a livestream or a projector. Verses next to each other show together; others are separate slides
 * (‹ › or tap the sides).
 */
const EVENT = 'vb-present';

// A slide is verses with their reference, or words from a note: its title (title: true) or a paragraph.
// colorFrom: with 🎨 on, the colour of its first sentence, so the colours carry on from slide to slide
export type Slide =
  | { kind: 'verses'; ref: string; verses: VerseHit[] }
  | { kind: 'text'; text: string; title?: boolean; colorFrom?: number };

export function presentSlides(slides: Slide[], at = 0) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { slides, at } }));
}

export function presentVerses(verses: VerseHit[]) {
  presentSlides(verseSlides(verses));
}

/** A note as slides: its title, then each paragraph (a long one is split between sentences, about 45 words a slide). */
export function noteSlides(title: string, text: string, colored: boolean): Slide[] {
  const out: Slide[] = title.trim() ? [{ kind: 'text', text: title.trim(), title: true }] : [];
  let color = 0;
  for (const p of paragraphsOf(text)) {
    for (const chunk of splitLong(p)) {
      out.push({ kind: 'text', text: chunk, colorFrom: colored ? color : undefined });
      color += sentenceRanges(chunk).length;
    }
  }
  return out;
}

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
function splitLong(p: string, most = 45): string[] {
  if (words(p) <= most + 20) return [p];
  const out: string[] = [];
  let cur = '';
  for (const r of sentenceRanges(p)) {
    const sentence = p.slice(r.start, r.end);
    if (cur && words(cur) + words(sentence) > most) {
      out.push(cur);
      cur = sentence;
    } else cur = cur ? `${cur} ${sentence}` : sentence;
  }
  if (cur) out.push(cur);
  return out;
}

export function verseSlides(verses: VerseHit[]): Slide[] {
  const groups: VerseHit[][] = [];
  for (const v of verses) {
    const last = groups[groups.length - 1]?.at(-1);
    if (last && last.book === v.book && last.chapter === v.chapter && v.verse === last.verse + 1) groups[groups.length - 1].push(v);
    else groups.push([v]);
  }
  return groups.map(g => ({
    kind: 'verses' as const,
    ref: `${bookName(g[0].book)} ${g[0].chapter}:${g[0].verse}${g.length > 1 ? `–${g[g.length - 1].verse}` : ''}`,
    verses: g,
  }));
}

/**
 * Listens for presentVerses() and shows the slides over everything. face: in Live mode with the camera on, whether
 * the face bubble stays on while presenting (null otherwise); 📷 turns it off, camera and all, until Present closes.
 */
export function PresentHost({ face, onFace, onShowing }: { face: boolean | null; onFace: () => void; onShowing: (on: boolean) => void }) {
  const [shown, setShown] = useState<Slide[] | null>(null);
  const [at, setAt] = useState(0);
  useEffect(() => {
    const open = (e: Event) => {
      const { slides, at } = (e as CustomEvent<{ slides: Slide[]; at: number }>).detail;
      setShown(slides);
      setAt(at);
    };
    window.addEventListener(EVENT, open);
    return () => window.removeEventListener(EVENT, open);
  }, []);
  const showing = !!shown?.length;
  useEffect(() => onShowing(showing), [showing, onShowing]);
  if (!shown?.length) return null;
  return <Slides slides={shown} at={Math.min(at, shown.length - 1)} onAt={setAt} onClose={() => setShown(null)} face={face} onFace={onFace} />;
}

/** One slide in the biggest type that fits its box. onTap: tapping the left third goes back, the rest forward. */
export function SlideView({ slide, onTap }: { slide: Slide; onTap?: (by: number) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const text = useRef<HTMLDivElement>(null);

  // The biggest font size where the words fit the box, found by halving the gap
  const fit = useCallback(() => {
    const b = box.current, el = text.current;
    if (!b || !el) return;
    let lo = 14, hi = 220;
    while (hi - lo > 1) {
      const mid = (lo + hi) / 2;
      el.style.fontSize = `${mid}px`;
      if (el.scrollHeight <= b.clientHeight && el.scrollWidth <= b.clientWidth) lo = mid;
      else hi = mid;
    }
    el.style.fontSize = `${lo}px`;
  }, []);
  useLayoutEffect(fit, [fit, slide]);
  useEffect(() => {
    const ro = new ResizeObserver(fit);
    if (box.current) ro.observe(box.current);
    document.fonts?.ready.then(fit);
    return () => ro.disconnect();
  }, [fit]);

  return (
    <div
      className="present-box"
      ref={box}
      onClick={e => {
        if (!onTap) return;
        const r = e.currentTarget.getBoundingClientRect();
        onTap(e.clientX < r.left + r.width / 3 ? -1 : 1);
      }}
    >
      <div className="present-text" ref={text}>
        {slide.kind === 'verses' ? (
          <>
            <p>
              {slide.verses.map(v => (
                <span key={v.verse}>
                  {slide.verses.length > 1 && <sup>{v.verse}</sup>}
                  {v.text}{' '}
                </span>
              ))}
            </p>
            <p className="present-ref">{slide.ref}</p>
          </>
        ) : (
          <p className={slide.title ? 'present-title' : undefined}>
            {slide.colorFrom === undefined
              ? slide.text
              : sentenceRanges(slide.text).map((r, i) => (
                <span key={r.start} className={`sc${(slide.colorFrom! + i) % SENTENCE_COLORS}`}>{slide.text.slice(r.start, r.end)} </span>
              ))}
          </p>
        )}
      </div>
    </div>
  );
}

const remember = (key: string, on: boolean) => {
  try {
    localStorage.setItem(key, on ? '1' : '');
  } catch {
    // just for now
  }
};
const remembered = (key: string) => {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
};
const clock = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const desktop = typeof matchMedia === 'function' && matchMedia('(pointer: fine)').matches;

function Slides({ slides, at, onAt, onClose, face, onFace }: {
  slides: Slide[];
  at: number;
  onAt: (i: number) => void;
  onClose: () => void;
  face: boolean | null;
  onFace: () => void;
}) {
  const slide = slides[at];
  const go = useCallback((d: number) => onAt(Math.max(0, Math.min(slides.length - 1, at + d))), [at, slides.length, onAt]);
  const goRef = useRef(go);
  goRef.current = go;
  // Banner: a strip across the bottom, like a lower third on TV, with the app still showing above it
  const [banner, setBanner] = useState(() => remembered('vb_present_banner'));
  useEffect(() => remember('vb_present_banner', banner), [banner]);

  // Second screen: a window showing only the slide; this one becomes the presenter view (next slide, timer)
  const [display, setDisplay] = useState(false);
  const channel = useRef<BroadcastChannel | null>(null);
  const state = useRef({ slides, at });
  state.current = { slides, at };
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const ch = new BroadcastChannel(DISPLAY_CHANNEL);
    channel.current = ch;
    ch.onmessage = (e: MessageEvent<DisplayMsg | { type: 'bye' }>) => {
      if (e.data.type === 'hello') {
        setDisplay(true);
        ch.postMessage({ type: 'state', ...state.current } satisfies DisplayMsg);
      } else if (e.data.type === 'go') goRef.current(e.data.by);
      else if (e.data.type === 'bye') setDisplay(false);
    };
    ch.postMessage({ type: 'state', ...state.current } satisfies DisplayMsg); // a display window already open picks it up
    return () => {
      ch.postMessage({ type: 'closed' } satisfies DisplayMsg);
      ch.close();
      channel.current = null;
    };
  }, []);
  useEffect(() => channel.current?.postMessage({ type: 'state', slides, at } satisfies DisplayMsg), [slides, at]);

  // Phone remote: on once it's been set up on this device; the QR code opens the remote on the phone
  const [remoteOn, setRemoteOn] = useState(() => remembered('vb_remote_on'));
  const [qr, setQr] = useState(false);
  const [phone, setPhone] = useState(false); // a phone has joined
  const link = useRef<Awaited<ReturnType<typeof joinRemote>> | null>(null);
  const remoteState = (): RemoteState => {
    const { slides: ss, at: i } = state.current;
    return { at: i, total: ss.length, now: slideLine(ss[i]).slice(0, 400), next: slideLine(ss[i + 1]).slice(0, 200) };
  };
  useEffect(() => {
    remember('vb_remote_on', remoteOn);
    if (!remoteOn) return;
    let gone = false;
    joinRemote(remoteCode(), {
      go: (p: { by: number }) => goRef.current(p.by),
      hello: () => {
        setPhone(true);
        link.current?.send('state', remoteState());
      },
    }).then(l => {
      if (gone) return l.leave();
      link.current = l;
      l.send('state', remoteState());
    }).catch(() => setRemoteOn(false));
    return () => {
      gone = true;
      link.current?.send('state', { at: 0, total: 0, now: '', next: '' } satisfies RemoteState);
      const l = link.current;
      link.current = null;
      setTimeout(() => l?.leave(), 300); // let the last message go
    };
  }, [remoteOn]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { link.current?.send('state', remoteState()); }, [slides, at]); // eslint-disable-line react-hooks/exhaustive-deps

  // The presenter's timer, from when Present opened
  const [started] = useState(() => Date.now());
  const [, tick] = useState(0);
  useEffect(() => {
    if (!display && !phone) return;
    const id = setInterval(() => tick(n => n + 1), 1000);
    return () => clearInterval(id);
  }, [display, phone]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') qr ? setQr(false) : onClose();
      else if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') go(1);
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') go(-1);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [go, onClose, qr]);

  const next = slides[at + 1];
  return (
    <div className={`present${banner ? ' banner' : ''}`} role="dialog" aria-modal={!banner} aria-label={slide.kind === 'verses' ? slide.ref : t('Present')}>
      {display && !banner && (
        <div className="present-next">
          <b>{t('On the second screen')}</b> · {next ? <>{t('Next:')} {slideLine(next).slice(0, 120)}</> : t('This is the last slide')}
        </div>
      )}
      <SlideView slide={slide} onTap={slides.length > 1 ? go : undefined} />
      <div className="present-bar">
        {(display || phone) && <span className="present-clock">⏱ {clock(Date.now() - started)}</span>}
        <button className={`present-opt${banner ? ' on' : ''}`} aria-pressed={banner} title={t('Banner: a strip across the bottom, with the app above it')} onClick={() => setBanner(!banner)}>
          {t(banner ? '⬒ Banner' : '⬒ Full')}
        </button>
        {desktop && 'BroadcastChannel' in window && (
          <button className={`present-opt${display ? ' on' : ''}`} title={t('Show the slides in their own window, for a TV or projector; this one shows what’s next')} onClick={openDisplayWindow}>
            {t('🖥 Second screen')}
          </button>
        )}
        <button className={`present-opt${remoteOn ? ' on' : ''}`} title={t('Use your phone as the remote')} onClick={() => { setRemoteOn(true); setQr(true); }}>
          {t(phone ? '📱 Remote on' : '📱 Remote')}
        </button>
        {face !== null && (
          <button className="present-cam" aria-pressed={face} onClick={onFace}>{t(face ? '📷 Hide me' : '📷 Show me')}</button>
        )}
        {slides.length > 1 && (
          <span className="present-nav">
            <button aria-label={t('Previous')} disabled={at === 0} onClick={() => go(-1)}>‹</button>
            <span>{at + 1} / {slides.length}</span>
            <button aria-label={t('Next')} disabled={at === slides.length - 1} onClick={() => go(1)}>›</button>
          </span>
        )}
        <button aria-label={t('Close')} onClick={onClose}>✕</button>
      </div>
      {qr && <RemoteQr phone={phone} onOff={() => { setRemoteOn(false); setPhone(false); setQr(false); }} onClose={() => setQr(false)} />}
    </div>
  );
}

function RemoteQr({ phone, onOff, onClose }: { phone: boolean; onOff: () => void; onClose: () => void }) {
  const url = remoteUrl(remoteCode());
  const svg = useMemo(() => {
    const q = qrcode(0, 'M');
    q.addData(url);
    q.make();
    return q.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
  }, [url]);
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet remote-qr" role="dialog" aria-modal="true" aria-label={t('Phone remote')} onClick={e => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{t('Phone remote')}</h2>
          <button className="sheet-close" aria-label={t('Close')} onClick={onClose}>✕</button>
        </div>
        <p className="voice-help">{t('Scan this with your phone’s camera. Its ‹ › buttons move the slides here, and it shows the slide you’re on and the next one. The link stays the same, so you can save it on your phone.')}</p>
        <div className="qr-box" dangerouslySetInnerHTML={{ __html: svg }} />
        <p className="qr-url">{url}</p>
        <p className="notice">{t(phone ? '✓ A phone is connected' : 'Waiting for your phone…')}</p>
        <div className="live-actions">
          <button onClick={onOff}>{t('Turn off the remote')}</button>
          <button className="primary" onClick={onClose}>{t('Done')}</button>
        </div>
      </div>
    </div>
  );
}

/** The second screen: just the slide, kept in step with the window presenting it. Opened with ?display=1. */
export function PresentDisplay() {
  const [shown, setShown] = useState<{ slides: Slide[]; at: number } | null>(null);
  const [full, setFull] = useState(!!document.fullscreenElement);
  useEffect(() => {
    document.title = t('Voice Bible · Second screen');
    const ch = new BroadcastChannel(DISPLAY_CHANNEL);
    ch.onmessage = (e: MessageEvent<DisplayMsg>) => {
      if (e.data.type === 'state') setShown({ slides: e.data.slides, at: e.data.at });
      else if (e.data.type === 'closed') setShown(null);
    };
    ch.postMessage({ type: 'hello' } satisfies DisplayMsg);
    const bye = () => ch.postMessage({ type: 'bye' });
    const key = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') ch.postMessage({ type: 'go', by: 1 } satisfies DisplayMsg);
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') ch.postMessage({ type: 'go', by: -1 } satisfies DisplayMsg);
      else if (e.key === 'f') document.documentElement.requestFullscreen?.().catch(() => {});
    };
    const fs = () => setFull(!!document.fullscreenElement);
    addEventListener('pagehide', bye);
    addEventListener('keydown', key);
    document.addEventListener('fullscreenchange', fs);
    return () => {
      bye();
      ch.close();
      removeEventListener('pagehide', bye);
      removeEventListener('keydown', key);
      document.removeEventListener('fullscreenchange', fs);
    };
  }, []);
  const slide = shown?.slides[shown.at];
  return (
    <div className="present present-display" onDoubleClick={() => document.documentElement.requestFullscreen?.().catch(() => {})}>
      {slide ? <SlideView slide={slide} /> : <div className="present-box"><p className="notice">{t('Second screen: waiting for Present…')}</p></div>}
      {!full && (
        <button className="display-full" onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})}>
          {t('⛶ Full screen (or press F). Drag this window to the TV first.')}
        </button>
      )}
    </div>
  );
}
