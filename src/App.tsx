import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { BOOKS } from './bible/books';
import {
  buildIndex, formatReference, highlightPattern, parseReference, searchVerses,
  type BibleText, type Reference, type VerseHit,
} from './bible/search';
import { TRANSLATIONS, loadTranslation, type TranslationId } from './bible/translations';
import { useSpeech } from './useSpeech';

type View =
  | { kind: 'home' }
  | { kind: 'search'; query: string; hits: VerseHit[] }
  | { kind: 'chapter'; ref: Reference; from?: View };

const PAGE = 50;
const FILLER = /^(search( for)?|find|look up|show( me)?|go to|read|open)\s+/i;

function Highlight({ text, pattern }: { text: string; pattern: RegExp | null }): ReactNode {
  if (!pattern) return text;
  return text.split(pattern).map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : part));
}

export default function App() {
  const [translation, setTranslation] = useState<TranslationId>('kjv');
  const [bible, setBible] = useState<BibleText | null>(null);
  const [loadError, setLoadError] = useState('');
  const [view, setView] = useState<View>({ kind: 'home' });
  const [shown, setShown] = useState(PAGE);
  const [typed, setTyped] = useState('');
  const pending = useRef<string | null>(null);

  useEffect(() => {
    setBible(null);
    loadTranslation(translation).then(setBible, e => setLoadError(String(e.message ?? e)));
  }, [translation]);

  const index = useMemo(() => (bible ? buildIndex(bible) : null), [bible]);
  const abbrev = TRANSLATIONS.find(t => t.id === translation)!.abbrev;

  const run = useCallback(
    (raw: string) => {
      const input = raw.trim().replace(FILLER, '');
      if (!input) return;
      if (!bible || !index) {
        pending.current = input; // run once the text finishes loading
        return;
      }
      setShown(PAGE);
      window.scrollTo({ top: 0 });
      const ref = parseReference(input, bible);
      if (ref) setView({ kind: 'chapter', ref });
      else setView({ kind: 'search', query: input, hits: searchVerses(index, input) });
    },
    [bible, index],
  );

  useEffect(() => {
    if (index && pending.current) {
      run(pending.current);
      pending.current = null;
    }
  }, [index, run]);

  const speech = useSpeech(text => {
    setTyped(text);
    run(text);
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    run(typed);
  };

  return (
    <div className="app">
      <header className="top">
        <h1>
          <span className="cross" aria-hidden>✝</span> Voice Bible
        </h1>
        <select
          aria-label="Translation"
          value={translation}
          onChange={e => setTranslation(e.target.value as TranslationId)}
        >
          {TRANSLATIONS.map(t => (
            <option key={t.id} value={t.id}>{t.abbrev}</option>
          ))}
        </select>
      </header>

      <MicPanel speech={speech} />

      <form className="search" onSubmit={onSubmit}>
        <input
          type="search"
          inputMode="search"
          placeholder="Or type a word, phrase or John 3:16"
          value={typed}
          onChange={e => setTyped(e.target.value)}
        />
        <button type="submit">Search</button>
      </form>

      <main>
        {loadError && <p className="notice error">{loadError}. Check your connection and reload.</p>}
        {!bible && !loadError && <p className="notice">Loading the {abbrev} Bible…</p>}

        {view.kind === 'home' && bible && (
          <div className="home">
            <p>Say a word or phrase like <em>“faith”</em> or <em>“love your enemies”</em> to find every verse that contains it.</p>
            <p>Say a reference like <em>“John 3:16”</em> or <em>“Psalm 23”</em> to open it.</p>
          </div>
        )}

        {view.kind === 'search' && (
          <SearchResults
            view={view}
            shown={shown}
            abbrev={abbrev}
            onMore={() => setShown(s => s + PAGE)}
            onOpen={hit =>
              setView({ kind: 'chapter', ref: { book: hit.book, chapter: hit.chapter, verseStart: hit.verse }, from: view })
            }
          />
        )}

        {view.kind === 'chapter' && bible && (
          <Chapter
            bible={bible}
            view={view}
            abbrev={abbrev}
            onNavigate={ref => setView({ kind: 'chapter', ref, from: view.from })}
            onBack={view.from ? () => setView(view.from!) : undefined}
          />
        )}
      </main>
    </div>
  );
}

function MicPanel({ speech }: { speech: ReturnType<typeof useSpeech> }) {
  const { status, interim, start, stop } = speech;
  const listening = status === 'listening';
  const message = {
    listening: 'Listening… just speak',
    idle: 'Tap the mic to start listening',
    blocked: 'Microphone is blocked. Allow it in your browser’s site settings, then tap the mic.',
    unsupported: 'Voice search isn’t available in this browser. Use Chrome on Android or Safari on iPhone, or type below.',
  }[status];

  return (
    <section className="mic">
      <button
        className={`mic-button ${listening ? 'on' : ''}`}
        onClick={listening ? stop : start}
        disabled={status === 'unsupported'}
        aria-label={listening ? 'Stop listening' : 'Start listening'}
        aria-pressed={listening}
      >
        <svg viewBox="0 0 24 24" aria-hidden>
          <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z" />
        </svg>
      </button>
      <p className="mic-status" aria-live="polite">{interim ? `“${interim}”` : message}</p>
    </section>
  );
}

function SearchResults({ view, shown, abbrev, onMore, onOpen }: {
  view: Extract<View, { kind: 'search' }>;
  shown: number;
  abbrev: string;
  onMore: () => void;
  onOpen: (hit: VerseHit) => void;
}) {
  const pattern = useMemo(() => highlightPattern(view.query), [view.query]);
  const n = view.hits.length;
  return (
    <section>
      <h2 className="result-title">
        {n ? `${n.toLocaleString()} verse${n === 1 ? '' : 's'}` : 'No verses'} with “{view.query}”
      </h2>
      <ol className="verses">
        {view.hits.slice(0, shown).map(hit => (
          <li key={`${hit.book}-${hit.chapter}-${hit.verse}`}>
            <button className="verse-card" onClick={() => onOpen(hit)}>
              <span className="ref">{BOOKS[hit.book]} {hit.chapter}:{hit.verse} <small>{abbrev}</small></span>
              <span className="text"><Highlight text={hit.text} pattern={pattern} /></span>
            </button>
          </li>
        ))}
      </ol>
      {shown < n && (
        <button className="more" onClick={onMore}>
          Show more ({(n - shown).toLocaleString()} left)
        </button>
      )}
    </section>
  );
}

function Chapter({ bible, view, abbrev, onNavigate, onBack }: {
  bible: BibleText;
  view: Extract<View, { kind: 'chapter' }>;
  abbrev: string;
  onNavigate: (ref: Reference) => void;
  onBack?: () => void;
}) {
  const { book, chapter, verseStart, verseEnd } = view.ref;
  const verses = bible[book][chapter - 1];
  const first = useRef<HTMLLIElement>(null);
  const inRange = (v: number) => verseStart !== undefined && v >= verseStart && v <= (verseEnd ?? verseStart);

  useEffect(() => {
    first.current?.scrollIntoView({ block: 'center' });
  }, [book, chapter, verseStart]);

  const prev = chapter > 1 ? { book, chapter: chapter - 1 } : book > 0 ? { book: book - 1, chapter: bible[book - 1].length } : null;
  const next = chapter < bible[book].length ? { book, chapter: chapter + 1 } : book < bible.length - 1 ? { book: book + 1, chapter: 1 } : null;

  return (
    <section>
      {onBack && <button className="back" onClick={onBack}>← Back to results</button>}
      <h2 className="result-title">
        {formatReference(view.ref)} <small>{abbrev}</small>
      </h2>
      <ol className="chapter">
        {verses.map((text, i) => {
          const v = i + 1;
          const hit = inRange(v);
          return (
            <li key={v} ref={v === verseStart ? first : undefined} className={hit ? 'hit' : ''}>
              <sup>{v}</sup> {text}
            </li>
          );
        })}
      </ol>
      <nav className="pager">
        <button disabled={!prev} onClick={() => prev && onNavigate(prev)}>
          ← {prev && `${BOOKS[prev.book]} ${prev.chapter}`}
        </button>
        <button disabled={!next} onClick={() => next && onNavigate(next)}>
          {next && `${BOOKS[next.book]} ${next.chapter}`} →
        </button>
      </nav>
    </section>
  );
}
