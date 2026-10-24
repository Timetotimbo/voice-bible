import { useEffect, useState } from 'react';
import { bookName, bookNames } from './bible/books';
import type { BibleText, VerseHit } from './bible/search';
import { loadTranslation } from './bible/translations';
import { t } from './i18n';
import { presentVerses } from './Present';
import { addToRunSheet } from './RunSheet';

/**
 * Compare: the picked verses side by side in several Bibles. Besides the app's own, three public-domain
 * translations live in public/compare/; they're fetched the first time Compare opens, then kept on the phone.
 */
const EVENT = 'vb-compare';
const MOST = 12; // verses at once, so a big pick doesn't fill the screen with thousands of lines

const OTHERS = [
  { abbrev: 'BSB', name: 'Berean Standard Bible', file: 'compare/bsb.json' },
  { abbrev: 'ASV', name: 'American Standard Version (1901)', file: 'compare/asv.json' },
  { abbrev: 'YLT', name: "Young's Literal Translation", file: 'compare/ylt.json' },
];
const cache = new Map<string, Promise<BibleText>>();
const load = (file: string) => {
  if (!cache.has(file)) {
    cache.set(file, fetch(import.meta.env.BASE_URL + file).then(r => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    }));
  }
  return cache.get(file)!;
};

export function compareVerses(verses: VerseHit[]) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: verses }));
}

type Column = { abbrev: string; name: string; text: BibleText | null; failed?: boolean };

/** Listens for compareVerses() and shows them in every translation. */
export function CompareHost() {
  const [verses, setVerses] = useState<VerseHit[] | null>(null);
  const [cols, setCols] = useState<Column[]>([]);
  useEffect(() => {
    const open = (e: Event) => setVerses((e as CustomEvent<VerseHit[]>).detail.slice(0, MOST));
    window.addEventListener(EVENT, open);
    return () => window.removeEventListener(EVENT, open);
  }, []);
  useEffect(() => {
    if (!verses) return;
    const all = [{ abbrev: 'KJV', name: 'King James Version', get: () => loadTranslation('kjv') }, ...OTHERS.map(o => ({ ...o, get: () => load(o.file) }))];
    setCols(all.map(c => ({ abbrev: c.abbrev, name: c.name, text: null })));
    all.forEach((c, i) =>
      c.get().then(
        text => setCols(cs => cs.map((x, j) => (j === i ? { ...x, text } : x))),
        () => setCols(cs => cs.map((x, j) => (j === i ? { ...x, failed: true } : x))),
      ),
    );
  }, [verses]);
  if (!verses?.length) return null;
  const close = () => setVerses(null);
  return (
    <div className="sheet-backdrop" onClick={close}>
      <div className="sheet compare" role="dialog" aria-modal="true" aria-label={t('Compare')} onClick={e => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{t('Compare')}</h2>
          <button className="sheet-close" aria-label={t('Close')} onClick={close}>✕</button>
        </div>
        {verses.map(v => (
          <section key={`${v.book}-${v.chapter}-${v.verse}`} className="compare-verse">
            <h3>{bookName(v.book)} {v.chapter}:{v.verse}</h3>
            {cols.map(c => (
              <p key={c.abbrev} title={c.name}>
                <b>{c.abbrev}</b>{' '}
                {c.failed ? <span className="muted">{t('Couldn’t load it. Check your connection.')}</span>
                  : !c.text ? <span className="muted">…</span>
                  : c.text[v.book]?.[v.chapter - 1]?.[v.verse - 1] || <span className="muted">{t('(not in this translation)')}</span>}
              </p>
            ))}
          </section>
        ))}
        <p className="voice-help">{t('BSB, ASV and YLT are public domain. They download the first time you compare, then work offline.')}</p>
      </div>
    </div>
  );
}

/**
 * Related verses: each picked verse's cross references (OpenBible.info, CC-BY: the most-voted, up to 10), in the
 * Bible being read in the app's language. Pick some to present or line up on the run sheet.
 */
const RELATED = 'vb-related';
export function relatedVerses(verses: VerseHit[]) {
  window.dispatchEvent(new CustomEvent(RELATED, { detail: verses.slice(0, 5) }));
}
let xrefs: Promise<Record<string, number[]>> | null = null;
const loadXrefs = () => (xrefs ??= fetch(import.meta.env.BASE_URL + 'compare/xrefs.json').then(r => {
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}).catch(e => {
  xrefs = null;
  throw e;
}));

type Related = { from: VerseHit; refs: { hits: VerseHit[]; label: string }[] };

export function RelatedHost() {
  const [verses, setVerses] = useState<VerseHit[] | null>(null);
  const [found, setFound] = useState<Related[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  useEffect(() => {
    const open = (e: Event) => setVerses((e as CustomEvent<VerseHit[]>).detail);
    window.addEventListener(RELATED, open);
    return () => window.removeEventListener(RELATED, open);
  }, []);
  useEffect(() => {
    if (!verses) return;
    setFound(null);
    setFailed(false);
    setPicked(new Set());
    const spanish = bookNames()[0] !== 'Genesis';
    Promise.all([loadXrefs(), loadTranslation(spanish ? 'rv1909' : 'kjv')]).then(([x, bible]) => {
      setFound(verses.map(from => {
        const flat = x[`${from.book}.${from.chapter}.${from.verse}`] ?? [];
        const refs: Related['refs'] = [];
        for (let i = 0; i < flat.length; i += 4) {
          const [book, chapter, verse, end] = flat.slice(i, i + 4);
          const hits = Array.from({ length: end - verse + 1 }, (_, k) => ({ book, chapter, verse: verse + k, text: bible[book]?.[chapter - 1]?.[verse - 1 + k] ?? '' })).filter(h => h.text);
          if (hits.length) refs.push({ hits, label: `${bookName(book)} ${chapter}:${verse}${end > verse ? `–${end}` : ''}` });
        }
        return { from, refs };
      }));
    }, () => setFailed(true));
  }, [verses]);
  if (!verses?.length) return null;
  const close = () => setVerses(null);
  const chosen = (found ?? []).flatMap(r => r.refs).filter(r => picked.has(r.label)).flatMap(r => r.hits);
  const toggle = (label: string) => setPicked(p => {
    const next = new Set(p);
    if (!next.delete(label)) next.add(label);
    return next;
  });
  return (
    <div className="sheet-backdrop" onClick={close}>
      <div className="sheet compare" role="dialog" aria-modal="true" aria-label={t('Related verses')} onClick={e => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{t('Related verses')}</h2>
          <button className="sheet-close" aria-label={t('Close')} onClick={close}>✕</button>
        </div>
        {failed && <p className="notice">{t('Couldn’t load it. Check your connection.')}</p>}
        {!found && !failed && <p className="notice">…</p>}
        {found?.map(r => (
          <section key={`${r.from.book}-${r.from.chapter}-${r.from.verse}`} className="compare-verse">
            <h3>{t('Related to {ref}', { ref: `${bookName(r.from.book)} ${r.from.chapter}:${r.from.verse}` })}</h3>
            {!r.refs.length && <p className="muted">{t('No cross references for this verse.')}</p>}
            {r.refs.map(x => (
              <label key={x.label} className="related-row">
                <input type="checkbox" checked={picked.has(x.label)} onChange={() => toggle(x.label)} />
                <span><b className="related-ref">{x.label}</b> {x.hits.map(h => h.text).join(' ')}</span>
              </label>
            ))}
          </section>
        ))}
        <p className="voice-help">{t('Cross references from OpenBible.info (CC-BY), the ones most people found related.')}</p>
        <div className="live-actions">
          <span className="related-count">{t('{n} selected', { n: chosen.length })}</span>
          <button disabled={!chosen.length} onClick={() => { addToRunSheet({ kind: 'verses', verses: chosen }); close(); }}>{t('+ Run sheet')}</button>
          <button className="primary" disabled={!chosen.length} onClick={() => { close(); presentVerses(chosen); }}>{t('Present')}</button>
        </div>
      </div>
    </div>
  );
}
