import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { bookAbbrev, bookName } from './bible/books';
import type { VerseHit } from './bible/search';
import { loadStrongs, type Rendering, type StrongsEntry } from './bible/strongs';
import { n as plural, t } from './i18n';

/** Makes "from H433 (אֱלוֹהַּ)" in a derivation tappable, to follow a word back to its root. */
function Codes({ text, known, onCode }: { text: string; known: (code: string) => boolean; onCode: (code: string) => void }) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(/\b[HG]\d+\b/g)) {
    if (!known(m[0])) continue; // e.g. G5689 is a grammar code, not a word
    parts.push(text.slice(last, m.index));
    parts.push(<button key={m.index} className="ref-link" onClick={() => onCode(m[0])}>{m[0]}</button>);
    last = m.index! + m[0].length;
  }
  parts.push(text.slice(last));
  return <>{parts}</>;
}

/** Word study: the Hebrew or Greek word behind an English word, from Strong's dictionary. */
export function WordSheet({ word, code: first, where, versesWith, renderingsOf, onClose, onSearch, onRendering, notes, onAddToNote }: {
  word: string;
  code: string;
  where?: string; // the verse the word was tapped in, e.g. "John 3:16"
  notes: { id: string; title: string }[];
  onAddToNote: (noteId: string | null, text: string, word: string) => void; // null = a new note
  versesWith: (code: string) => VerseHit[]; // every verse using a word
  renderingsOf: (code: string) => Rendering[]; // the English words it's translated as
  onClose: () => void;
  onSearch: (code: string, book?: number) => void; // list the verses, or just those in one book
  onRendering: (code: string, rendering: Rendering) => void; // list the verses translating it one way
}) {
  const [code, setCode] = useState(first); // can move to a root word
  const [dictionary, setDictionary] = useState<Record<string, StrongsEntry> | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    loadStrongs().then(setDictionary, e => setError(String(e.message ?? e)));
  }, []);
  const entry = dictionary ? dictionary[code] ?? null : undefined; // undefined while loading

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const hebrew = code.startsWith('H');
  const verses = useMemo(() => versesWith(code), [versesWith, code]);
  const renderings = useMemo(() => renderingsOf(code), [renderingsOf, code]);
  const uses = verses.length;
  // Verses per book, in Bible order
  const byBook = useMemo(() => {
    const counts = new Map<number, number>();
    for (const v of verses) counts.set(v.book, (counts.get(v.book) ?? 0) + 1);
    return [...counts];
  }, [verses]);
  const [lemma, xlit, pron, definition, kjv, derivation] = entry ?? [];
  const [choosingNote, setChoosingNote] = useState(false);

  /** This word study written out, for a note. */
  const asText = () =>
    [
      `“${word}”${where ? ` (${where})` : ''}: ${code} ${lemma ?? ''} (${[xlit, pron && `“${pron}”`].filter(Boolean).join(', ')}), ${t(hebrew ? 'Hebrew' : 'Greek')}`,
      definition && t('Meaning: {text}', { text: definition }),
      kjv && t('KJV translates it as: {text}', { text: kjv }),
      derivation && t('Comes from: {text}', { text: derivation }),
      byBook.length && plural('Used in {n} verse: {books}', 'Used in {n} verses: {books}', uses, { books: byBook.map(([b, n]) => `${bookAbbrev(b)} ${n}`).join(' · ') }),
      renderings.length && t('Translated as: {words}', { words: renderings.map(r => `${r.word} ${r.count.toLocaleString()}`).join(' · ') }),
    ]
      .filter(Boolean)
      .join('\n');

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet word-sheet" role="dialog" aria-modal="true" aria-label={t('Word study: {word}', { word })} onClick={e => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{code === first ? `“${word}”` : t('Root word')}</h2>
          <button className="sheet-close" aria-label={t('Close')} onClick={onClose}>✕</button>
        </div>
        {error && <p className="notice error">{error}</p>}
        {entry === undefined && !error && <p className="notice">{t('Looking up {code}…', { code })}</p>}
        {entry === null && <p className="notice">{t('No dictionary entry for {code}.', { code })}</p>}
        {entry && (
          <>
            <div className="lemma-row">
              <span className="lemma" lang={hebrew ? 'he' : 'grc'} dir={hebrew ? 'rtl' : 'ltr'}>{lemma}</span>
              <span className="code">{code} · {t(hebrew ? 'Hebrew' : 'Greek')}</span>
            </div>
            <p className="xlit">
              {xlit}
              {pron && <span>{t(' · say “{pron}”', { pron })}</span>}
            </p>
            {definition && (
              <p>
                <span className="label">{t('Meaning')}</span>
                {definition}
              </p>
            )}
            {kjv && (
              <p>
                <span className="label">{t('KJV translates it as')}</span>
                {kjv}
              </p>
            )}
            {derivation && (
              <p>
                <span className="label">{t('Comes from')}</span>
                <Codes text={derivation} known={c => !!dictionary?.[c]} onCode={setCode} />
              </p>
            )}
          </>
        )}
        {code !== first && <button className="sheet-link" onClick={() => setCode(first)}>{t('← Back to {code}', { code: first })}</button>}
        {entry && !choosingNote && (
          <button className="goto-open add-note" onClick={() => setChoosingNote(true)}>{t('Add to note')}</button>
        )}
        {entry && choosingNote && (
          <div className="choose-note">
            <h3 className="sheet-sub">{t('Add to which note?')}</h3>
            <ul className="sheet-list">
              <li>
                <button className="sheet-item new-chat" onClick={() => onAddToNote(null, asText(), word)}>{t('+ New note')}</button>
              </li>
              {notes.map(n => (
                <li key={n.id}>
                  <button className="sheet-item" onClick={() => onAddToNote(n.id, asText(), word)}>{n.title}</button>
                </li>
              ))}
            </ul>
            <button className="sheet-link" onClick={() => setChoosingNote(false)}>{t('Cancel')}</button>
          </div>
        )}
        <button className="goto-open" disabled={!uses} onClick={() => onSearch(code)}>
          {t('Every verse with {code} ({n})', { code, n: uses })}
        </button>
        {byBook.length > 0 && (
          <>
            <h3 className="sheet-sub">{t('Where it’s used')} <small>{t('verses per book')}</small></h3>
            <div className="book-counts">
              {byBook.map(([book, n]) => (
                <button key={book} aria-label={t('{n} in {book}', { n, book: bookName(book) })} onClick={() => onSearch(code, book)}>
                  {bookAbbrev(book)} <b>{n}</b>
                </button>
              ))}
            </div>
          </>
        )}
        {renderings.length > 0 && (
          <>
            <h3 className="sheet-sub">{t('Translated as')} <small>{t('times, most used first')}</small></h3>
            <div className="book-counts">
              {renderings.map(r => (
                <button key={r.word} aria-label={t('{word}, {n} times', { word: r.word, n: r.count })} onClick={() => onRendering(code, r)}>
                  {r.word} <b>{r.count.toLocaleString()}</b>
                </button>
              ))}
            </div>
          </>
        )}
        <p className="credit">{t('Strong’s dictionary (1894), from Open Scriptures, CC BY-SA')}</p>
      </div>
    </div>
  );
}
