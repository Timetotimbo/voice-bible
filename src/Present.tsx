import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { bookName } from './bible/books';
import type { VerseHit } from './bible/search';
import { t } from './i18n';
import { SENTENCE_COLORS, sentenceRanges } from './noteColors';
import { paragraphsOf } from './words';

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

function Slides({ slides, at, onAt, onClose, face, onFace }: {
  slides: Slide[];
  at: number;
  onAt: (i: number) => void;
  onClose: () => void;
  face: boolean | null;
  onFace: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const text = useRef<HTMLDivElement>(null);
  const slide = slides[at];
  const go = useCallback((d: number) => onAt(Math.max(0, Math.min(slides.length - 1, at + d))), [at, slides.length, onAt]);

  // The biggest font size where the words fit the screen, found by halving the gap
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

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') go(1);
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') go(-1);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [go, onClose]);

  return (
    <div className="present" role="dialog" aria-modal="true" aria-label={slide.kind === 'verses' ? slide.ref : t('Present')}>
      <div
        className="present-box"
        ref={box}
        onClick={e => {
          if (slides.length < 2) return;
          const r = e.currentTarget.getBoundingClientRect();
          go(e.clientX < r.left + r.width / 3 ? -1 : 1);
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
      <div className="present-bar">
        {slides.length > 1 && (
          <>
            <button aria-label={t('Previous')} disabled={at === 0} onClick={() => go(-1)}>‹</button>
            <span>{at + 1} / {slides.length}</span>
            <button aria-label={t('Next')} disabled={at === slides.length - 1} onClick={() => go(1)}>›</button>
          </>
        )}
        {face !== null && (
          <button className="present-cam" aria-pressed={face} onClick={onFace}>{t(face ? '📷 Hide me' : '📷 Show me')}</button>
        )}
        <button aria-label={t('Close')} onClick={onClose}>✕</button>
      </div>
    </div>
  );
}
