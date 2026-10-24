import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { bookName } from './bible/books';
import type { VerseHit } from './bible/search';
import { t } from './i18n';

/**
 * Present: the picked verses filling the screen in the biggest type that fits, for showing on a livestream or
 * a projector. Verses next to each other show together; others are separate slides (‹ › or tap the sides).
 */
const EVENT = 'vb-present';

export function presentVerses(verses: VerseHit[]) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: verses }));
}

type Slide = { ref: string; verses: VerseHit[] };

function slides(verses: VerseHit[]): Slide[] {
  const groups: VerseHit[][] = [];
  for (const v of verses) {
    const last = groups[groups.length - 1]?.at(-1);
    if (last && last.book === v.book && last.chapter === v.chapter && v.verse === last.verse + 1) groups[groups.length - 1].push(v);
    else groups.push([v]);
  }
  return groups.map(g => ({
    ref: `${bookName(g[0].book)} ${g[0].chapter}:${g[0].verse}${g.length > 1 ? `–${g[g.length - 1].verse}` : ''}`,
    verses: g,
  }));
}

/** Listens for presentVerses() and shows the slides over everything. */
export function PresentHost() {
  const [shown, setShown] = useState<Slide[] | null>(null);
  const [at, setAt] = useState(0);
  useEffect(() => {
    const open = (e: Event) => {
      setShown(slides((e as CustomEvent<VerseHit[]>).detail));
      setAt(0);
    };
    window.addEventListener(EVENT, open);
    return () => window.removeEventListener(EVENT, open);
  }, []);
  if (!shown?.length) return null;
  return <Slides slides={shown} at={Math.min(at, shown.length - 1)} onAt={setAt} onClose={() => setShown(null)} />;
}

function Slides({ slides, at, onAt, onClose }: { slides: Slide[]; at: number; onAt: (i: number) => void; onClose: () => void }) {
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
    <div className="present" role="dialog" aria-modal="true" aria-label={slide.ref}>
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
          <p>
            {slide.verses.map(v => (
              <span key={v.verse}>
                {slide.verses.length > 1 && <sup>{v.verse}</sup>}
                {v.text}{' '}
              </span>
            ))}
          </p>
          <p className="present-ref">{slide.ref}</p>
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
        <button aria-label={t('Close')} onClick={onClose}>✕</button>
      </div>
    </div>
  );
}
