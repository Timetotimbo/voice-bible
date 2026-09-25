import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { BOOKS } from './bible/books';
import {
  buildIndex, formatReference, highlightPattern, parseReference, searchVerses,
  type BibleText, type Reference, type VerseHit,
} from './bible/search';
import { TRANSLATIONS, loadTranslation, type TranslationId } from './bible/translations';
import { useLibrary, type VerseRef } from './useLibrary';
import { SPEEDS, describeVoice, useReader, voiceName } from './useReader';
import { useSpeech } from './useSpeech';

type View =
  | { kind: 'home' }
  | { kind: 'search'; query: string; hits: VerseHit[] }
  | { kind: 'list'; id: string }
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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const library = useLibrary();
  const [sheet, setSheet] = useState<null | 'browse' | VerseRef[]>(null);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [toast, setToast] = useState('');
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  // Pause the mic while reading aloud so it doesn't hear the reader and start new searches
  const micWasOn = useRef(false);
  const speechRef = useRef<ReturnType<typeof useSpeech> | null>(null);
  const reader = useReader(() => {
    if (micWasOn.current) {
      micWasOn.current = false;
      speechRef.current?.start();
    }
  });
  const readAloud = (verses: VerseHit[]) => {
    if (speechRef.current?.status === 'listening') {
      micWasOn.current = true;
      speechRef.current.stop();
    }
    reader.play(verses);
  };

  useEffect(() => {
    setBible(null);
    loadTranslation(translation).then(setBible, e => setLoadError(String(e.message ?? e)));
  }, [translation]);

  const index = useMemo(() => (bible ? buildIndex(bible) : null), [bible]);
  const abbrev = TRANSLATIONS.find(t => t.id === translation)!.abbrev;

  /** Resets paging, selection and playback, then shows `next` (if given). */
  const openView = useCallback(
    (next: View | null) => {
      setShown(PAGE);
      setSelected(new Set());
      reader.stop();
      window.scrollTo({ top: 0 });
      if (next) setView(next);
    },
    [reader.stop],
  );

  const run = useCallback(
    (raw: string) => {
      const input = raw.trim().replace(FILLER, '');
      if (!input) return;
      if (!bible || !index) {
        pending.current = input; // run once the text finishes loading
        return;
      }
      library.remember(input);
      openView(null);
      const ref = parseReference(input, bible);
      if (ref) setView({ kind: 'chapter', ref });
      else setView({ kind: 'search', query: input, hits: searchVerses(index, input) });
    },
    [bible, index, openView, library.remember],
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
  speechRef.current = speech;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    run(typed);
  };

  const toggle = (key: string) =>
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const savedList = view.kind === 'list' ? library.lists.find(l => l.id === view.id) : undefined;
  const savedHits = useMemo(
    () =>
      savedList && bible
        ? savedList.verses.flatMap(([book, chapter, verse]) => {
            const text = bible[book]?.[chapter - 1]?.[verse - 1];
            return text ? [{ book, chapter, verse, text }] : [];
          })
        : [],
    [savedList, bible],
  );

  return (
    <div className="app">
      <header className="top">
        <h1>
          <span className="cross" aria-hidden>✝</span> Voice Bible
        </h1>
        <button
          className="library-btn"
          aria-label="Reading voice"
          onClick={() => {
            // Pause the mic so voice samples aren't heard as searches
            if (speech.status === 'listening') {
              micWasOn.current = true;
              speech.stop();
            }
            setVoiceOpen(true);
          }}
        >
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M4 9h4l5-4v14l-5-4H4Z" />
            <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />
          </svg>
        </button>
        <button className="library-btn" aria-label="History and saved lists" onClick={() => setSheet('browse')}>
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1Z" />
          </svg>
        </button>
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
            title={<>{view.hits.length ? `${view.hits.length.toLocaleString()} verse${view.hits.length === 1 ? '' : 's'}` : 'No verses'} with “{view.query}”</>}
            hits={view.hits}
            query={view.query}
            shown={shown}
            abbrev={abbrev}
            onMore={() => setShown(s => s + PAGE)}
            onOpen={hit => {
              reader.stop();
              setView({ kind: 'chapter', ref: { book: hit.book, chapter: hit.chapter, verseStart: hit.verse }, from: view });
            }}
            reader={reader}
            readAloud={readAloud}
            selected={selected}
            onToggle={toggle}
            selectionActions={picked => (
              <button onClick={() => setSheet(picked.map(toRef))}>Save to list</button>
            )}
            onClearSelection={() => setSelected(new Set())}
          />
        )}

        {view.kind === 'list' && bible && savedList && (
          <SearchResults
            title={<>{savedList.name} <small>{savedHits.length} verse{savedHits.length === 1 ? '' : 's'}</small></>}
            hits={savedHits}
            shown={savedHits.length}
            abbrev={abbrev}
            onMore={() => {}}
            onOpen={hit => {
              reader.stop();
              setView({ kind: 'chapter', ref: { book: hit.book, chapter: hit.chapter, verseStart: hit.verse }, from: view });
            }}
            reader={reader}
            readAloud={readAloud}
            selected={selected}
            onToggle={toggle}
            selectionActions={picked => (
              <button
                onClick={() => {
                  library.removeFromList(savedList.id, picked.map(toRef));
                  setSelected(new Set());
                }}
              >
                Remove from list
              </button>
            )}
            onClearSelection={() => setSelected(new Set())}
            empty="This list is empty. Search, check verses, then tap “Save to list”."
          />
        )}

        {view.kind === 'chapter' && bible && (
          <Chapter
            bible={bible}
            view={view}
            abbrev={abbrev}
            onNavigate={ref => {
              reader.stop();
              setView({ kind: 'chapter', ref, from: view.from });
            }}
            onBack={view.from ? () => { reader.stop(); setView(view.from!); } : undefined}
            reader={reader}
            readAloud={readAloud}
          />
        )}
      </main>

      <footer className="version">Voice Bible v{__APP_VERSION__}</footer>

      {sheet && (
        <LibrarySheet
          library={library}
          saving={Array.isArray(sheet) ? sheet : null}
          onClose={() => setSheet(null)}
          onRun={q => {
            setSheet(null);
            setTyped(q);
            run(q);
          }}
          onOpenList={id => {
            setSheet(null);
            openView({ kind: 'list', id });
          }}
          onSaved={name => {
            setSheet(null);
            setSelected(new Set());
            setToast(`Saved to “${name}”`);
          }}
        />
      )}
      {voiceOpen && (
        <VoiceSheet
          reader={reader}
          onClose={() => {
            setVoiceOpen(false);
            if (!reader.playing && micWasOn.current) {
              micWasOn.current = false;
              speech.start();
            }
          }}
        />
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
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

const hitKey = (h: VerseHit) => `${h.book}-${h.chapter}-${h.verse}`;

const toRef = (h: VerseHit): VerseRef => [h.book, h.chapter, h.verse];

function SearchResults({
  title, hits, query, shown, abbrev, onMore, onOpen, reader, readAloud, selected, onToggle,
  selectionActions, onClearSelection, empty,
}: {
  title: ReactNode;
  hits: VerseHit[];
  query?: string;
  shown: number;
  abbrev: string;
  onMore: () => void;
  onOpen: (hit: VerseHit) => void;
  reader: ReturnType<typeof useReader>;
  readAloud: (verses: VerseHit[]) => void;
  selected: Set<string>;
  onToggle: (key: string) => void;
  selectionActions: (picked: VerseHit[]) => ReactNode;
  onClearSelection: () => void;
  empty?: string;
}) {
  const pattern = useMemo(() => (query ? highlightPattern(query) : null), [query]);
  const n = hits.length;
  const picked = hits.filter(h => selected.has(hitKey(h)));
  const queue = picked.length ? picked : hits;
  const current = reader.current && hitKey(reader.current);
  const currentEl = useRef<HTMLLIElement>(null);

  useEffect(() => {
    currentEl.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [current]);

  return (
    <section className={reader.supported && n ? `has-player ${picked.length ? 'selecting' : ''}` : ''}>
      <h2 className="result-title">{title}</h2>
      {!n && empty && <p className="notice">{empty}</p>}
      <ol className="verses">
        {hits.slice(0, shown).map(hit => {
          const key = hitKey(hit);
          const isSelected = selected.has(key);
          const isCurrent = key === current;
          return (
            <li key={key} ref={isCurrent ? currentEl : undefined} className={`verse-card ${isCurrent ? 'reading' : ''} ${isSelected ? 'selected' : ''}`}>
              <button className="verse-body" onClick={() => onOpen(hit)}>
                <span className="ref">{BOOKS[hit.book]} {hit.chapter}:{hit.verse} <small>{abbrev}</small></span>
                <span className="text"><Highlight text={hit.text} pattern={pattern} /></span>
              </button>
              {reader.supported && (
                <div className="verse-actions">
                  <button
                    className="icon-btn"
                    aria-label={isCurrent ? 'Stop' : `Play ${BOOKS[hit.book]} ${hit.chapter}:${hit.verse}`}
                    onClick={() => (isCurrent ? reader.stop() : readAloud([hit]))}
                  >
                    {isCurrent ? '■' : '▶'}
                  </button>
                  <button
                    className={`select-btn ${isSelected ? 'on' : ''}`}
                    aria-label={isSelected ? 'Unselect verse' : 'Select verse'}
                    aria-pressed={isSelected}
                    onClick={() => onToggle(key)}
                  >
                    {isSelected ? '✓' : ''}
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {shown < n && (
        <button className="more" onClick={onMore}>
          Show more ({(n - shown).toLocaleString()} left)
        </button>
      )}

      {reader.supported && n > 0 && (
        <div className="player">
          {picked.length > 0 && (
            <div className="selection-bar">
              <span>{picked.length} selected</span>
              {selectionActions(picked)}
              <button onClick={onClearSelection}>Clear</button>
            </div>
          )}
          {reader.playing ? (
            <button className="player-main" onClick={reader.stop}>
              ■ Stop{reader.current && ` · ${BOOKS[reader.current.book]} ${reader.current.chapter}:${reader.current.verse}`}
            </button>
          ) : (
            <button className="player-main" onClick={() => readAloud(queue)}>
              ▶ {picked.length ? `Play ${picked.length} selected` : n === 1 ? 'Play verse' : `Play all ${n.toLocaleString()}`}
            </button>
          )}
          <PlayerControls reader={reader} />
        </div>
      )}
    </section>
  );
}

function Chapter({ bible, view, abbrev, onNavigate, onBack, reader, readAloud }: {
  bible: BibleText;
  view: Extract<View, { kind: 'chapter' }>;
  abbrev: string;
  onNavigate: (ref: Reference) => void;
  onBack?: () => void;
  reader: ReturnType<typeof useReader>;
  readAloud: (verses: VerseHit[]) => void;
}) {
  const { book, chapter, verseStart, verseEnd } = view.ref;
  const verses = bible[book][chapter - 1];
  const first = useRef<HTMLLIElement>(null);
  const inRange = (v: number) => verseStart !== undefined && v >= verseStart && v <= (verseEnd ?? verseStart);

  useEffect(() => {
    first.current?.scrollIntoView({ block: 'center' });
  }, [book, chapter, verseStart]);

  const all: VerseHit[] = verses.map((text, i) => ({ book, chapter, verse: i + 1, text }));
  const asked = all.filter(h => inRange(h.verse));
  const askedLabel = verseStart && asked.length
    ? `${chapter}:${asked[0].verse}${asked.length > 1 ? `-${asked[asked.length - 1].verse}` : ''}`
    : '';
  const reading = reader.current?.book === book && reader.current.chapter === chapter ? reader.current.verse : null;
  const readingEl = useRef<HTMLLIElement>(null);
  useEffect(() => {
    readingEl.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [reading]);

  const prev = chapter > 1 ? { book, chapter: chapter - 1 } : book > 0 ? { book: book - 1, chapter: bible[book - 1].length } : null;
  const next = chapter < bible[book].length ? { book, chapter: chapter + 1 } : book < bible.length - 1 ? { book: book + 1, chapter: 1 } : null;

  return (
    <section className={reader.supported ? `has-player ${askedLabel ? 'selecting' : ''}` : ''}>
      {onBack && <button className="back" onClick={onBack}>← Back</button>}
      <h2 className="result-title">
        {formatReference(view.ref)} <small>{abbrev}</small>
      </h2>
      <ol className="chapter">
        {verses.map((text, i) => {
          const v = i + 1;
          const hit = inRange(v);
          return (
            <li
              key={v}
              ref={v === reading ? readingEl : v === verseStart ? first : undefined}
              className={`${hit ? 'hit' : ''} ${v === reading ? 'reading' : ''}`}
            >
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

      {reader.supported && (
        <div className="player">
          {reader.playing ? (
            <button className="player-main" onClick={reader.stop}>
              ■ Stop{reader.current && ` · ${reader.current.chapter}:${reader.current.verse}`}
            </button>
          ) : (
            askedLabel ? (
              <div className="play-choice">
                <button className="player-main" onClick={() => readAloud(asked)}>▶ Play {askedLabel}</button>
                <button className="player-alt" onClick={() => readAloud(all)}>▶ Whole chapter</button>
              </div>
            ) : (
              <button className="player-main" onClick={() => readAloud(all)}>▶ Play chapter</button>
            )
          )}
          <PlayerControls reader={reader} />
        </div>
      )}
    </section>
  );
}

function LibrarySheet({ library, saving, onClose, onRun, onOpenList, onSaved }: {
  library: ReturnType<typeof useLibrary>;
  saving: VerseRef[] | null; // verses waiting to be saved, or null when just browsing
  onClose: () => void;
  onRun: (query: string) => void;
  onOpenList: (id: string) => void;
  onSaved: (listName: string) => void;
}) {
  const [tab, setTab] = useState<'history' | 'lists'>(saving || !library.history.length ? 'lists' : 'history');
  const [newName, setNewName] = useState('');
  const { history, lists } = library;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const createList = (e: FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    library.addToList(saving ?? [], { name });
    setNewName('');
    if (saving) onSaved(name);
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={saving ? 'Save to list' : 'History and lists'} onClick={e => e.stopPropagation()}>
        <div className="sheet-head">
          {saving ? (
            <h2>Save {saving.length} verse{saving.length === 1 ? '' : 's'} to…</h2>
          ) : (
            <div className="tabs" role="tablist">
              <button role="tab" aria-selected={tab === 'history'} className={tab === 'history' ? 'on' : ''} onClick={() => setTab('history')}>History</button>
              <button role="tab" aria-selected={tab === 'lists'} className={tab === 'lists' ? 'on' : ''} onClick={() => setTab('lists')}>Lists</button>
            </div>
          )}
          <button className="sheet-close" aria-label="Close" onClick={onClose}>✕</button>
        </div>

        {!saving && tab === 'history' && (
          <>
            {!history.length && <p className="notice">Your searches will show up here.</p>}
            <ul className="sheet-list">
              {history.map(q => (
                <li key={q}>
                  <button className="sheet-item" onClick={() => onRun(q)}>{q}</button>
                  <button className="sheet-x" aria-label={`Remove “${q}” from history`} onClick={() => library.forget(q)}>✕</button>
                </li>
              ))}
            </ul>
            {history.length > 0 && (
              <button className="sheet-link" onClick={() => confirm('Clear all search history?') && library.clearHistory()}>
                Clear history
              </button>
            )}
          </>
        )}

        {(saving || tab === 'lists') && (
          <>
            <form className="new-list" onSubmit={createList}>
              <input placeholder="New list name" value={newName} onChange={e => setNewName(e.target.value)} aria-label="New list name" />
              <button type="submit" disabled={!newName.trim()}>{saving ? 'Save' : 'Create'}</button>
            </form>
            {!lists.length && !saving && <p className="notice">Check verses in your results, then tap “Save to list”.</p>}
            <ul className="sheet-list">
              {lists.map(l => (
                <li key={l.id}>
                  <button
                    className="sheet-item"
                    onClick={() => {
                      if (!saving) return onOpenList(l.id);
                      library.addToList(saving, { id: l.id });
                      onSaved(l.name);
                    }}
                  >
                    {l.name} <small>{l.verses.length}</small>
                  </button>
                  {!saving && (
                    <>
                      <button
                        className="sheet-x"
                        aria-label={`Rename ${l.name}`}
                        onClick={() => {
                          const name = prompt('Rename list', l.name)?.trim();
                          if (name) library.renameList(l.id, name);
                        }}
                      >
                        ✎
                      </button>
                      <button
                        className="sheet-x"
                        aria-label={`Delete ${l.name}`}
                        onClick={() => confirm(`Delete the list “${l.name}”?`) && library.deleteList(l.id)}
                      >
                        ✕
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

function VoiceSheet({ reader, onClose }: { reader: ReturnType<typeof useReader>; onClose: () => void }) {
  const { voices, voice, voiceId, setVoice, preview, refreshVoices } = reader;
  const hasMan = voices.some(v => describeVoice(v).startsWith('Man'));
  const [checking, setChecking] = useState(!voices.length);

  // Ask the device again while the picker is open; some only list voices after a moment
  useEffect(() => {
    if (voices.length) return setChecking(false);
    let tries = 0;
    const poll = setInterval(() => {
      if (refreshVoices() || ++tries >= 12) {
        clearInterval(poll);
        setChecking(false);
      }
    }, 250);
    return () => clearInterval(poll);
  }, [voices.length, refreshVoices]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Reading voice" onClick={e => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>Reading voice</h2>
          <button className="sheet-close" aria-label="Close" onClick={onClose}>✕</button>
        </div>
        {!voices.length && (
          <p className="notice">
            {checking ? 'Looking for voices…' : (
              <>
                This browser didn’t share its list of voices, so the app reads with your device’s default voice.
                If you added Voice Bible to your home screen, try opening it in Safari or Chrome instead.
              </>
            )}
          </p>
        )}
        <ul className="sheet-list" role="radiogroup">
          {voices.map(v => {
            const on = v === voice;
            return (
              <li key={v.voiceURI} className={on ? 'on' : ''}>
                <button className="sheet-item voice-item" role="radio" aria-checked={on} onClick={() => setVoice(v.voiceURI)}>
                  <span className="check" aria-hidden>{on ? '✓' : ''}</span>
                  {voiceName(v)} <small>{describeVoice(v)}</small>
                </button>
                <button className="sheet-x" aria-label={`Hear ${voiceName(v)}`} onClick={() => preview(v)}>▶</button>
              </li>
            );
          })}
        </ul>
        {voiceId && (
          <button className="sheet-link" onClick={() => setVoice('')}>Use the default voice</button>
        )}
        <p className="voice-help">
          {hasMan ? 'Voices come from your device.' : 'No man’s voice was found on this device.'} To add more voices and accents:
          <br />iPhone: Settings → Accessibility → Spoken Content → Voices → English
          <br />Android: Settings → Text-to-speech → Google → Install voice data → English
        </p>
      </div>
    </div>
  );
}

/** Repeat, Refs and speed buttons shared by every play bar. */
function PlayerControls({ reader }: { reader: ReturnType<typeof useReader> }) {
  return (
    <>
      <button
        className={`repeat ${reader.repeat ? 'on' : ''}`}
        aria-pressed={reader.repeat}
        aria-label="Repeat"
        title={reader.repeat ? 'Repeat is on' : 'Repeat is off'}
        onClick={() => reader.setRepeat(r => !r)}
      >
        ⟳
      </button>
      <button
        className={`repeat ${reader.sayRefs ? 'on' : ''}`}
        aria-pressed={reader.sayRefs}
        aria-label="Read chapter and verse before each verse"
        title={reader.sayRefs ? 'Reading chapter and verse' : 'Reading words only'}
        onClick={() => reader.setSayRefs(!reader.sayRefs)}
      >
        Refs
      </button>
      <button
        className="speed"
        aria-label={`Reading speed ${reader.speed} times. Tap to change`}
        title="Reading speed"
        onClick={() => reader.setSpeed(SPEEDS[(SPEEDS.indexOf(reader.speed) + 1) % SPEEDS.length])}
      >
        {reader.speed}×
      </button>
    </>
  );
}
