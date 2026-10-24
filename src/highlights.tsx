import { useEffect, useMemo, useState } from 'react';
import { bookName, bookNames } from './bible/books';
import type { Reference, VerseHit } from './bible/search';
import { loadTranslation } from './bible/translations';
import { t } from './i18n';

/**
 * Highlights: verses marked in one of five colours, shown behind the verse in the chapter, and all together in
 * Verse Lists → Highlights. Kept on this device (and in a backup) as {"book.chapter.verse": colour}.
 */
export const COLORS = ['yellow', 'green', 'blue', 'pink', 'purple'] as const;
export type HighlightColor = (typeof COLORS)[number];
type Marks = Record<string, HighlightColor>;

const KEY = 'vb_highlights';
const EVENT = 'vb-highlights';
const keyOf = (v: { book: number; chapter: number; verse: number }) => `${v.book}.${v.chapter}.${v.verse}`;

function load(): Marks {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}');
  } catch {
    return {};
  }
}

/** Colours the verses, or takes their highlight off (null). */
export function setHighlight(verses: VerseHit[], color: HighlightColor | null) {
  const marks = load();
  for (const v of verses) {
    if (color) marks[keyOf(v)] = color;
    else delete marks[keyOf(v)];
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(marks));
  } catch {
    // just for now
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: marks }));
}

export function useHighlights() {
  const [marks, setMarks] = useState(load);
  useEffect(() => {
    const on = (e: Event) => setMarks((e as CustomEvent<Marks>).detail);
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  return { marks, colorOf: (v: { book: number; chapter: number; verse: number }) => marks[keyOf(v)] };
}

/** 🖍 in the bar of picked verses: the five colours, and ✕ to take the highlight off. */
export function HighlightButton({ verses, onDone }: { verses: VerseHit[]; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  if (!open) return <button onClick={() => setOpen(true)}>{t('🖍 Highlight')}</button>;
  return (
    <span className="hl-palette" role="group" aria-label={t('Highlight colour')}>
      {COLORS.map(c => (
        <button key={c} className={`hl-swatch hl-${c}`} aria-label={t(c)} title={t(c)} onClick={() => { setHighlight(verses, c); setOpen(false); onDone(); }} />
      ))}
      <button className="hl-swatch hl-off" aria-label={t('Remove highlight')} title={t('Remove highlight')} onClick={() => { setHighlight(verses, null); setOpen(false); onDone(); }}>✕</button>
    </span>
  );
}

/** Every highlighted verse, in Bible order, with a colour filter. Tap one to open it in its chapter. */
export function HighlightsSheet({ onGo, onClose }: { onGo: (ref: Reference) => void; onClose: () => void }) {
  const { marks } = useHighlights();
  const [only, setOnly] = useState<HighlightColor | null>(null);
  const [bible, setBible] = useState<string[][][] | null>(null);
  useEffect(() => {
    loadTranslation(bookNames()[0] !== 'Genesis' ? 'rv1909' : 'kjv').then(setBible, () => {});
  }, []);
  const list = useMemo(
    () => Object.entries(marks)
      .map(([k, color]) => {
        const [book, chapter, verse] = k.split('.').map(Number);
        return { book, chapter, verse, color };
      })
      .filter(h => !only || h.color === only)
      .sort((a, b) => a.book - b.book || a.chapter - b.chapter || a.verse - b.verse),
    [marks, only],
  );
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet compare" role="dialog" aria-modal="true" aria-label={t('Highlights')} onClick={e => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{t('Highlights')}</h2>
          <button className="sheet-close" aria-label={t('Close')} onClick={onClose}>✕</button>
        </div>
        <div className="hl-palette hl-filter" role="radiogroup" aria-label={t('Highlight colour')}>
          <button role="radio" aria-checked={!only} className={`hl-all${!only ? ' on' : ''}`} onClick={() => setOnly(null)}>{t('All')}</button>
          {COLORS.map(c => (
            <button key={c} role="radio" aria-checked={only === c} className={`hl-swatch hl-${c}${only === c ? ' on' : ''}`} aria-label={t(c)} onClick={() => setOnly(c)} />
          ))}
        </div>
        {!list.length && <p className="notice">{t('No highlights yet. Pick verses in a chapter and tap 🖍 Highlight.')}</p>}
        <ul className="sheet-list">
          {list.map(h => (
            <li key={`${h.book}.${h.chapter}.${h.verse}`}>
              <button className={`sheet-item hl-row hl-${h.color}`} onClick={() => onGo({ book: h.book, chapter: h.chapter, verseStart: h.verse })}>
                <b className="related-ref">{bookName(h.book)} {h.chapter}:{h.verse}</b> {bible?.[h.book]?.[h.chapter - 1]?.[h.verse - 1] ?? ''}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
