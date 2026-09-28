import { useEffect, useState, type ReactNode } from 'react';
import { loadStrongs, type StrongsEntry } from './bible/strongs';

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
export function WordSheet({ word, code: first, count, onClose, onSearch }: {
  word: string;
  code: string;
  count: (code: string) => number; // verses using this word
  onClose: () => void;
  onSearch: (code: string) => void;
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
  const uses = count(code);
  const [lemma, xlit, pron, definition, kjv, derivation] = entry ?? [];

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet word-sheet" role="dialog" aria-modal="true" aria-label={`Word study: ${word}`} onClick={e => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{code === first ? `“${word}”` : 'Root word'}</h2>
          <button className="sheet-close" aria-label="Close" onClick={onClose}>✕</button>
        </div>
        {error && <p className="notice error">{error}</p>}
        {entry === undefined && !error && <p className="notice">Looking up {code}…</p>}
        {entry === null && <p className="notice">No dictionary entry for {code}.</p>}
        {entry && (
          <>
            <div className="lemma-row">
              <span className="lemma" lang={hebrew ? 'he' : 'grc'} dir={hebrew ? 'rtl' : 'ltr'}>{lemma}</span>
              <span className="code">{code} · {hebrew ? 'Hebrew' : 'Greek'}</span>
            </div>
            <p className="xlit">
              {xlit}
              {pron && <span> · say “{pron}”</span>}
            </p>
            {definition && (
              <p>
                <span className="label">Meaning</span>
                {definition}
              </p>
            )}
            {kjv && (
              <p>
                <span className="label">KJV translates it as</span>
                {kjv}
              </p>
            )}
            {derivation && (
              <p>
                <span className="label">Comes from</span>
                <Codes text={derivation} known={c => !!dictionary?.[c]} onCode={setCode} />
              </p>
            )}
          </>
        )}
        {code !== first && <button className="sheet-link" onClick={() => setCode(first)}>← Back to {first}</button>}
        <button className="goto-open" disabled={!uses} onClick={() => onSearch(code)}>
          Every verse with {code} ({uses.toLocaleString()})
        </button>
        <p className="credit">Strong’s dictionary (1894), from Open Scriptures, CC BY-SA</p>
      </div>
    </div>
  );
}
