import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type TouchEvent as ReactTouchEvent, type ReactNode } from 'react';
import { BOOKS } from './bible/books';
import {
  buildIndex, formatReference, highlightPattern, parseReference, searchVerses, wordsPattern, type SearchMode,
  type BibleText, type Reference, type VerseHit,
} from './bible/search';
import { TRANSLATIONS, loadTranslation, type TranslationId } from './bible/translations';
import { renderingsOf, strongsCode, tagsOf, versesWithCode, type Tag } from './bible/strongs';
import { WordSheet } from './WordSheet';
import { useLibrary, type VerseList, type VerseRef } from './useLibrary';
import { RECORDED_VOICES, describeRecorded } from './recorded';
import { listLink, sharedListInLink } from './share';
import { ChatView } from './Chat';
import { ImportChats } from './ImportChats';
import { useDragOrder } from './useDragOrder';
import { useChats, type Chat } from './useChats';
import { SPEEDS, describeVoice, useReader, voiceName } from './useReader';
import { TAP_TO_TALK, useSpeech } from './useSpeech';

type View =
  | { kind: 'home' }
  // strongs: a Strong's number search, maybe narrowed to one book or one way the KJV translates it
  | { kind: 'search'; query: string; hits: VerseHit[]; strongs?: string; inBook?: number; asWord?: string }
  | { kind: 'list'; id: string }
  | { kind: 'chapter'; ref: Reference }
  | { kind: 'chat'; id: string };

const PAGE = 50;
const FILLER = /^(search( for)?|find|look up|show( me)?|go to|read|open)\s+/i;

function Highlight({ text, pattern }: { text: string; pattern: RegExp | null }): ReactNode {
  if (!pattern) return text;
  return text.split(pattern).map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : part));
}

/**
 * Verse text whose translated words can be tapped to study the Hebrew or Greek behind them. Without
 * `onWord` (inside something already tappable) it only highlights the words translating `mark`.
 */
function TaggedText({ text, tags, mark, onWord }: {
  text: string;
  tags: Tag[];
  mark?: string; // a Strong's number to highlight
  onWord?: (word: string, code: string) => void;
}) {
  const parts: ReactNode[] = [];
  let at = 0;
  tags.forEach(([start, end, code], i) => {
    parts.push(text.slice(at, start));
    const word = text.slice(start, end);
    parts.push(
      !onWord ? (
        code === mark ? <mark key={i}>{word}</mark> : word
      ) : <button
        key={i}
        className={`sw ${code === mark ? 'hit' : ''}`}
        onClick={e => {
          e.stopPropagation(); // don't also select the verse
          onWord(word, code);
        }}
      >
        {word}
      </button>,
    );
    at = end;
  });
  parts.push(text.slice(at));
  return <>{parts}</>;
}

/** Verse text with the word being read aloud marked. */
function ReadingText({ text, word }: { text: string; word: { start: number; end: number } }) {
  return (
    <>
      {text.slice(0, word.start)}
      <mark className="word-now">{text.slice(word.start, word.end)}</mark>
      {text.slice(word.end)}
    </>
  );
}

export default function App() {
  const [translation, setTranslationState] = useState<TranslationId>(() => {
    try {
      const saved = localStorage.getItem('translation');
      return TRANSLATIONS.find(t => t.id === saved)?.id ?? 'kjv';
    } catch {
      return 'kjv';
    }
  });
  const setTranslation = (id: TranslationId) => {
    setTranslationState(id);
    try {
      localStorage.setItem('translation', id);
    } catch {
      // storage unavailable; lasts for this visit
    }
  };
  // Word study: the tapped word and its Strong's number
  const [studyWord, setStudyWord] = useState<{ word: string; code: string } | null>(null);
  const [bible, setBible] = useState<BibleText | null>(null);
  const [loadError, setLoadError] = useState('');
  const [view, setView] = useState<View>({ kind: 'home' });
  const [shown, setShown] = useState(PAGE);
  const [typed, setTyped] = useState('');
  const pending = useRef<string | null>(null);
  // Search for all the words in any order, or only the exact phrase; picked under the search box
  const [searchMode, setSearchModeState] = useState<SearchMode>(() => {
    try {
      return localStorage.getItem('searchMode') === 'exact' ? 'exact' : 'words';
    } catch {
      return 'words';
    }
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const library = useLibrary();
  const chats = useChats();
  const [importing, setImporting] = useState(false);
  const [sheet, setSheet] = useState<null | 'browse' | VerseRef[] | { verses: VerseRef[]; from: string }>(null);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [gotoOpen, setGotoOpen] = useState(false);
  // Brief message near the top; one about a list can be tapped to open it
  const [toast, setToastState] = useState<{ text: string; listId?: string } | null>(null);
  const setToast = (text: string, listId?: string) => setToastState(text ? { text, listId } : null);
  const newVersion = useNewVersion();
  // A list someone shared, from the link this page was opened with
  const [incoming, setIncoming] = useState(() => sharedListInLink());
  useEffect(() => {
    const onHash = () => setIncoming(sharedListInLink());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const closeIncoming = () => {
    history.replaceState(null, '', location.pathname + location.search);
    setIncoming(null);
  };
  useEffect(() => {
    if (!toast) return;
    // Longer when it can be tapped, so there's time to
    const t = setTimeout(() => setToastState(null), toast.listId ? 4000 : 2500);
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
      // Turning it back on by itself would make Apple devices ask for the microphone again
      micWasOn.current = !TAP_TO_TALK;
      speechRef.current.stop();
    }
    reader.play(verses);
  };

  useEffect(() => {
    setBible(null);
    loadTranslation(translation).then(setBible, e => setLoadError(String(e.message ?? e)));
  }, [translation]);

  const index = useMemo(() => (bible ? buildIndex(bible) : null), [bible]);
  const studyVerses = useCallback((code: string) => (bible ? versesWithCode(bible, code) : []), [bible]);
  const studyRenderings = useCallback((code: string) => (bible ? renderingsOf(bible, code) : []), [bible]);
  const abbrev = TRANSLATIONS.find(t => t.id === translation)!.abbrev;

  const shownChapter = useRef<{ book: number; chapter: number } | null>(null); // where the chapter page is, for the picker to start at
  // Screens to go back to, newest last. Each also sits in the browser history, so the phone's own
  // back gesture steps back through them instead of leaving the app.
  const viewRef = useRef(view);
  viewRef.current = view;
  const shownRef = useRef(shown);
  shownRef.current = shown;
  const backStack = useRef<{ view: View; shown: number; scrollY: number }[]>([]);
  const [canGoBack, setCanGoBack] = useState(false);
  const restoreScroll = useRef<number | null>(null);
  useEffect(() => {
    history.scrollRestoration = 'manual';
    const onPop = () => {
      const entry = backStack.current.pop();
      setCanGoBack(backStack.current.length > 0);
      if (!entry) return;
      setSelected(new Set());
      reader.stop();
      setShown(entry.shown);
      setView(entry.view);
      restoreScroll.current = entry.scrollY;
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [reader.stop]);
  useLayoutEffect(() => {
    if (restoreScroll.current === null) return;
    window.scrollTo({ top: restoreScroll.current });
    restoreScroll.current = null;
  }, [view]);

  /** Shows `next`, remembering this screen for Back. Resets paging, selection and playback. */
  const openView = useCallback(
    (next: View) => {
      let here = viewRef.current;
      // A chapter page may have been swiped to another chapter; come back to the one on screen
      if (here.kind === 'chapter' && shownChapter.current &&
          (shownChapter.current.book !== here.ref.book || shownChapter.current.chapter !== here.ref.chapter)) {
        here = { kind: 'chapter', ref: { ...shownChapter.current } };
      }
      backStack.current.push({ view: here, shown: shownRef.current, scrollY: window.scrollY });
      history.pushState({ voiceBible: backStack.current.length }, '');
      setCanGoBack(true);
      setShown(PAGE);
      setSelected(new Set());
      reader.stop();
      window.scrollTo({ top: 0 });
      setView(next);
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
      const code = strongsCode(input);
      if (code && !tagsOf(bible)) {
        // Strong's numbers live in the KJV + Strong's text; switch to it and search once it's loaded
        pending.current = input;
        setTranslation('kjvs');
        return;
      }
      library.remember(input);
      if (code) return openView({ kind: 'search', query: code, hits: versesWithCode(bible, code), strongs: code });
      const ref = parseReference(input, bible);
      openView(ref ? { kind: 'chapter', ref } : { kind: 'search', query: input, hits: searchVerses(index, input, searchMode) });
    },
    [bible, index, openView, library.remember, searchMode],
  );

  const setSearchMode = (mode: SearchMode) => {
    setSearchModeState(mode);
    try {
      localStorage.setItem('searchMode', mode);
    } catch {
      // storage unavailable; lasts for this visit
    }
    // Redo the search on screen the new way
    if (view.kind === 'search' && !view.strongs && index) {
      setSelected(new Set());
      setView({ ...view, hits: searchVerses(index, view.query, mode) });
    }
  };

  useEffect(() => {
    if (index && pending.current) {
      run(pending.current);
      pending.current = null;
    }
  }, [index, run]);

  // While a chat is open, what's said goes into the chat box instead of starting a search
  const speakIntoChat = useRef<((text: string) => void) | null>(null);
  const speech = useSpeech(text => {
    if (viewRef.current.kind === 'chat' && speakIntoChat.current) return speakIntoChat.current(text);
    setTyped(text);
    run(text);
  });
  speechRef.current = speech;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    // Put the keyboard (and the search pop-up) away so the results can be seen
    (document.activeElement as HTMLElement | null)?.blur();
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
              micWasOn.current = !TAP_TO_TALK;
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
          placeholder="Word or John 3:16"
          value={typed}
          onChange={e => setTyped(e.target.value)}
        />
        <button type="button" className="goto-btn" aria-label="Go to a book, chapter and verse" onClick={() => setGotoOpen(true)}>
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5Zm0 0V19.5" />
          </svg>
        </button>
        <button type="submit">Search</button>
      </form>
      {/* Always showing, so it's clear which way searches work */}
      <div className="search-mode" role="radiogroup" aria-label="Search for">
        {([['words', 'All words'], ['exact', 'Exact phrase']] as const).map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={searchMode === mode}
            className={searchMode === mode ? 'on' : ''}
            // If the keyboard is up, keep it up: choosing shouldn't take focus from the search box
            onMouseDown={e => e.preventDefault()}
            onClick={() => setSearchMode(mode)}
          >
            {label}
          </button>
        ))}
      </div>

      <main>
        {canGoBack && view.kind !== 'home' && <button className="back" onClick={() => history.back()}>← Back</button>}
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
            strongs={view.strongs}
            tagsFor={hit => tagsOf(bible)?.[hit.book]?.[hit.chapter - 1]?.[hit.verse - 1]}
            title={
              <>
                {view.hits.length ? `${view.hits.length.toLocaleString()} verse${view.hits.length === 1 ? '' : 's'}` : 'No verses'} with “{view.query}”
                {view.inBook !== undefined && ` in ${BOOKS[view.inBook]}`}
                {view.asWord && <> as “{view.asWord}”</>}
              </>
            }
            hits={view.hits}
            query={view.query}
            shown={shown}
            abbrev={abbrev}
            onMore={() => setShown(s => s + PAGE)}
            onOpen={hit => openView({ kind: 'chapter', ref: { book: hit.book, chapter: hit.chapter, verseStart: hit.verse } })}
            reader={reader}
            readAloud={readAloud}
            selected={selected}
            onToggle={toggle}
            onSelectAll={() => setSelected(new Set(view.hits.map(hitKey)))}
            selectionActions={picked => (
              <>
                <button
                  className="quick-save"
                  onClick={() => {
                    // Add to the list named like the search ("John"), creating it the first time
                    const name = view.query;
                    const list = library.lists.find(l => l.name.toLowerCase() === name.toLowerCase());
                    const id = library.addToList(picked.map(toRef), list ? { id: list.id } : { name });
                    setSelected(new Set());
                    setToast(`Saved ${picked.length.toLocaleString()} to “${list?.name ?? name}”`, id);
                  }}
                >
                  Save to “{view.query}”
                </button>
                <button onClick={() => setSheet(picked.map(toRef))}>Other list…</button>
              </>
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
            onOpen={hit => openView({ kind: 'chapter', ref: { book: hit.book, chapter: hit.chapter, verseStart: hit.verse } })}
            reader={reader}
            readAloud={readAloud}
            selected={selected}
            onToggle={toggle}
            onSelectAll={() => setSelected(new Set(savedHits.map(hitKey)))}
            selectionActions={picked => (
              <>
                <button onClick={() => setSheet({ verses: picked.map(toRef), from: savedList.id })}>Copy to list…</button>
                <button
                  onClick={() => {
                    library.removeFromList(savedList.id, picked.map(toRef));
                    setSelected(new Set());
                  }}
                >
                  Remove
                </button>
              </>
            )}
            onClearSelection={() => setSelected(new Set())}
            empty="This list is empty. Search, check verses, then tap “Save to list”."
          />
        )}

        {view.kind === 'chat' && bible && (() => {
          const chat = chats.chats.find(c => c.id === view.id);
          return chat ? (
            <ChatView
              key={chat.id}
              chat={chat}
              bible={bible}
              settings={chats.settings}
              setSettings={chats.setSettings}
              setMessages={chats.setMessages}
              onOpenRef={ref => openView({ kind: 'chapter', ref })}
              speechInput={speakIntoChat}
            />
          ) : (
            <p className="notice">This chat was deleted.</p>
          );
        })()}

        {view.kind === 'chapter' && bible && (
          <Chapter
            key={`${view.ref.book}-${view.ref.chapter}-${view.ref.verseStart}`}
            bible={bible}
            view={view}
            abbrev={abbrev}
            reader={reader}
            readAloud={readAloud}
            selected={selected}
            onToggle={toggle}
            onSave={picked => setSheet(picked.map(toRef))}
            onClearSelection={() => setSelected(new Set())}
            onShown={place => (shownChapter.current = place)}
            onWord={(word, code) => setStudyWord({ word, code })}
            onPick={() => setGotoOpen(true)}
          />
        )}
      </main>

      <footer className="version">Voice Bible v{__APP_VERSION__}</footer>

      {sheet && (
        <LibrarySheet
          library={library}
          saving={sheet === 'browse' ? null : Array.isArray(sheet) ? sheet : sheet.verses}
          hideList={typeof sheet === 'object' && !Array.isArray(sheet) ? sheet.from : undefined}
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
          onSaved={(name, id, count) => {
            setSheet(null);
            setSelected(new Set());
            setToast(`Saved ${count.toLocaleString()} to “${name}”`, id);
          }}
          chats={chats.chats}
          onOpenChat={id => {
            setSheet(null);
            openView({ kind: 'chat', id });
          }}
          onNewChat={() => {
            setSheet(null);
            openView({ kind: 'chat', id: chats.newChat() });
          }}
          onDeleteChat={chats.deleteChat}
          onMoveChat={chats.moveChat}
          onImportChats={() => {
            setSheet(null);
            setImporting(true);
          }}
          onShare={list => {
            const url = listLink(list.name, list.verses);
            // The phone's share menu (text, email…) where there is one; otherwise copy the link
            if (navigator.share) {
              navigator.share({ title: list.name, text: `“${list.name}”: ${list.verses.length} verses from Voice Bible`, url }).catch(() => {});
            } else {
              navigator.clipboard?.writeText(url).then(() => setToast('Link copied'), () => prompt('Copy this link', url));
            }
          }}
        />
      )}
      {incoming && (
        <SharedListSheet
          incoming={incoming}
          existing={library.lists.find(l => l.name.toLowerCase() === incoming.name.toLowerCase())}
          onClose={closeIncoming}
          onAdd={existing => {
            const id = library.addToList(incoming.verses, existing ? { id: existing.id } : { name: incoming.name });
            closeIncoming();
            setSheet(null);
            openView({ kind: 'list', id });
            setToast(existing ? `Added to “${existing.name}”` : `Added “${incoming.name}”`);
          }}
        />
      )}
      {gotoOpen && bible && (
        <GotoSheet
          bible={bible}
          start={view.kind === 'chapter' ? { ...view.ref, ...shownChapter.current } : null}
          onClose={() => setGotoOpen(false)}
          onGo={ref => {
            setGotoOpen(false);
            library.remember(formatReference(ref));
            openView({ kind: 'chapter', ref });
          }}
        />
      )}
      {importing && (
        <ImportChats
          existing={chats.chats}
          onClose={() => setImporting(false)}
          onImport={list => {
            chats.importChats(list);
            setImporting(false);
            if (list.length === 1) openView({ kind: 'chat', id: list[0].id });
            else setSheet('browse');
            setToast(`Imported ${list.length} chat${list.length === 1 ? '' : 's'}`);
          }}
        />
      )}
      {studyWord && bible && (
        <WordSheet
          word={studyWord.word}
          code={studyWord.code}
          versesWith={studyVerses}
          renderingsOf={studyRenderings}
          onRendering={(code, r) => {
            setStudyWord(null);
            setTyped(code);
            library.remember(code);
            openView({ kind: 'search', query: code, strongs: code, asWord: r.word, hits: r.verses });
          }}
          onClose={() => setStudyWord(null)}
          onSearch={(code, book) => {
            setStudyWord(null);
            setTyped(code);
            if (book === undefined) return run(code);
            library.remember(code);
            openView({ kind: 'search', query: code, strongs: code, inBook: book, hits: studyVerses(code).filter(h => h.book === book) });
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
      {toast && (toast.listId ? (
        <button
          className="toast toast-link"
          onClick={() => {
            const id = toast.listId!;
            setToastState(null);
            openView({ kind: 'list', id });
          }}
        >
          <span className="toast-text">{toast.text}</span>
          <span className="toast-open">Open ›</span>
        </button>
      ) : (
        <div className="toast" role="status">{toast.text}</div>
      ))}
      {newVersion && (
        <button className="toast update" onClick={() => location.reload()}>
          New version {newVersion} — tap to update
        </button>
      )}
    </div>
  );
}

/** The version number the site has now, if it's newer than the one running (phones can keep an old copy). */
function useNewVersion() {
  const [latest, setLatest] = useState('');
  useEffect(() => {
    const check = () => {
      if (document.visibilityState !== 'visible') return;
      fetch(`${import.meta.env.BASE_URL}version.json`, { cache: 'no-store' })
        .then(r => (r.ok ? r.json() : null))
        .then(v => v?.version && v.version !== __APP_VERSION__ && setLatest(v.version), () => {});
    };
    check();
    document.addEventListener('visibilitychange', check);
    return () => document.removeEventListener('visibilitychange', check);
  }, []);
  return latest;
}

function MicPanel({ speech }: { speech: ReturnType<typeof useSpeech> }) {
  const { status, interim, start, stop } = speech;
  const listening = status === 'listening';
  const message = {
    listening: TAP_TO_TALK ? 'Listening… say a word or verse' : 'Listening… just speak',
    idle: TAP_TO_TALK ? 'Tap the mic, then speak' : 'Tap the mic to start listening',
    blocked: TAP_TO_TALK
      ? 'Microphone is blocked. In Safari tap aA › Website Settings › Microphone › Allow, then tap the mic.'
      : 'Microphone is blocked. Allow it in your browser’s site settings, then tap the mic.',
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
  onSelectAll, selectionActions, onClearSelection, empty, strongs, tagsFor,
}: {
  title: ReactNode;
  strongs?: string; // a Strong's number search: mark the words that translate it
  tagsFor?: (hit: VerseHit) => Tag[] | undefined;
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
  onSelectAll: () => void;
  selectionActions: (picked: VerseHit[]) => ReactNode;
  onClearSelection: () => void;
  empty?: string;
}) {
  const pattern = useMemo(() => (query ? highlightPattern(query) : null), [query]);
  const loosePattern = useMemo(() => (query ? wordsPattern(query) : null), [query]);
  const n = hits.length;
  const picked = hits.filter(h => selected.has(hitKey(h)));
  const queue = picked.length ? picked : hits;
  const current = reader.current && hitKey(reader.current);
  const currentEl = useRef<HTMLLIElement>(null);

  useEffect(() => {
    currentEl.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [current]);

  return (
    <section className={reader.supported && n ? `has-player ${picked.length || n > 1 ? 'selecting' : ''}` : ''}>
      <h2 className="result-title">{title}</h2>
      {!n && empty && <p className="notice">{empty}</p>}
      <ol className="verses">
        {hits.slice(0, shown).map((hit, i) => {
          const key = hitKey(hit);
          const isSelected = selected.has(key);
          const isCurrent = key === current;
          return (
            <Fragment key={key}>
              {hit.loose && !hits[i - 1]?.loose && (
                <li className="loose-divider">{i ? 'Also: verses with all these words' : 'No exact phrase. Verses with all these words'}</li>
              )}
              <li ref={isCurrent ? currentEl : undefined} className={`verse-card ${isCurrent ? 'reading' : ''} ${isSelected ? 'selected' : ''}`}>
                <button className="verse-body" onClick={() => onOpen(hit)}>
                  <span className="ref">{BOOKS[hit.book]} {hit.chapter}:{hit.verse} <small>{abbrev}</small></span>
                  <span className="text">
                    {isCurrent && reader.word ? (
                      <ReadingText text={hit.text} word={reader.word} />
                    ) : strongs && tagsFor?.(hit) ? (
                      <TaggedText text={hit.text} tags={tagsFor(hit)!} mark={strongs} />
                    ) : (
                      <Highlight text={hit.text} pattern={hit.loose ? loosePattern : pattern} />
                    )}
                  </span>
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
            </Fragment>
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
          {/* In the bar pinned to the bottom, so it's in reach however far down a long search you are */}
          {picked.length > 0 ? (
            <div className="selection-bar">
              <span>{picked.length.toLocaleString()} selected</span>
              {selectionActions(picked)}
              {picked.length < n && <button onClick={onSelectAll}>All</button>}
              <button onClick={onClearSelection}>Clear</button>
            </div>
          ) : n > 1 && (
            <div className="selection-bar">
              <button onClick={onSelectAll}>Select all {n.toLocaleString()}</button>
            </div>
          )}
          {reader.playing ? (
            <button className="player-main" onClick={reader.stop}>
              ■ Stop · <StopDetail reader={reader} full />
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

function Chapter({
  bible, view, abbrev, reader, readAloud, selected, onToggle, onSave, onClearSelection, onShown, onPick, onWord,
}: {
  bible: BibleText;
  view: Extract<View, { kind: 'chapter' }>;
  abbrev: string;
  reader: ReturnType<typeof useReader>;
  readAloud: (verses: VerseHit[]) => void;
  selected: Set<string>;
  onToggle: (key: string) => void;
  onSave: (picked: VerseHit[]) => void;
  onClearSelection: () => void;
  onShown: (place: { book: number; chapter: number }) => void;
  onPick: () => void;
  onWord: (word: string, code: string) => void;
}) {
  const { book, chapter, verseStart, verseEnd } = view.ref;
  // Every chapter of the Bible in order, for swiping to the one before or after and reading on
  const chapters = useMemo(() => bible.flatMap((chs, b) => chs.map((_, c) => ({ book: b, chapter: c + 1 }))), [bible]);
  const indexOf = (b: number, c: number) => chapters.findIndex(x => x.book === b && x.chapter === c);
  const main = indexOf(book, chapter);
  const versesOf = (i: number): VerseHit[] =>
    bible[chapters[i].book][chapters[i].chapter - 1].map((text, v) => ({ ...chapters[i], verse: v + 1, text }));
  const name = (i: number) => `${BOOKS[chapters[i].book]} ${chapters[i].chapter}`;

  // The chapter on screen; starts at the one asked for, then changes with swipes
  const [shownAt, setShownAt] = useState(main);
  const [slide, setSlide] = useState<'' | 'from-right' | 'from-left'>('');
  const onMain = shownAt === main;
  const inRange = (v: number) => onMain && verseStart !== undefined && v >= verseStart && v <= (verseEnd ?? verseStart);

  const show = (i: number) => {
    if (i < 0 || i >= chapters.length || i === shownAt) return;
    setSlide(i > shownAt ? 'from-right' : 'from-left');
    setShownAt(i);
    onClearSelection();
    window.scrollTo({ top: 0 });
  };

  const first = useRef<HTMLLIElement>(null);
  useEffect(() => {
    first.current?.scrollIntoView({ block: 'center' });
  }, [book, chapter, verseStart]);
  useEffect(() => {
    onShown(chapters[shownAt]);
  }, [shownAt]);

  const all = versesOf(shownAt);
  const tags = tagsOf(bible)?.[chapters[shownAt].book]?.[chapters[shownAt].chapter - 1];
  const asked = onMain ? all.filter(h => inRange(h.verse)) : [];
  const askedLabel = verseStart && asked.length
    ? `${chapter}:${asked[0].verse}${asked.length > 1 ? `-${asked[asked.length - 1].verse}` : ''}`
    : '';
  const picked = all.filter(h => selected.has(hitKey(h))); // always in chapter order
  /** A chapter and everything after it, so reading carries on (just the chapter while Repeat is on). */
  const onward = (i: number) => (reader.repeat ? versesOf(i) : chapters.slice(i).flatMap((_, j) => versesOf(i + j)));

  const readingKey = reader.current ? hitKey(reader.current) : null;
  const readingAt = reader.current ? indexOf(reader.current.book, reader.current.chapter) : -1;
  useEffect(() => {
    // Reading has moved on to the next chapter: turn the page with it
    if (readingAt >= 0 && readingAt !== shownAt) show(readingAt);
  }, [readingAt]);
  const readingEl = useRef<HTMLLIElement>(null);
  useEffect(() => {
    readingEl.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [readingKey]);

  // Swipe left for the next chapter, right for the one before
  const touch = useRef<{ x: number; y: number; lastX: number; lastY: number } | null>(null);
  const onTouchStart = (e: ReactTouchEvent) => {
    const t = e.touches[0];
    // Swipes from the screen edge are the phone's own back gesture
    touch.current = e.touches.length === 1 && t.clientX > 30 && t.clientX < window.innerWidth - 30
      ? { x: t.clientX, y: t.clientY, lastX: t.clientX, lastY: t.clientY }
      : null;
  };
  const onTouchMove = (e: ReactTouchEvent) => {
    if (!touch.current) return;
    touch.current.lastX = e.touches[0].clientX;
    touch.current.lastY = e.touches[0].clientY;
  };
  // Some browsers cancel the touch partway through a swipe; judge it by where the finger last was
  const onTouchEnd = () => {
    const t = touch.current;
    touch.current = null;
    if (!t) return;
    const dx = t.lastX - t.x;
    const dy = t.lastY - t.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > 1.5 * Math.abs(dy)) show(shownAt + (dx < 0 ? 1 : -1));
  };

  const prev = shownAt > 0 ? shownAt - 1 : null;
  const next = shownAt < chapters.length - 1 ? shownAt + 1 : null;

  return (
    <section
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
      className={`swipe-area ${reader.supported ? `has-player ${picked.length ? 'picking' : askedLabel ? 'selecting' : ''}` : ''}`}
    >
      <div key={shownAt} className={slide}>
        <h2 className="result-title">
          <button className="title-pick" onClick={onPick} aria-label="Choose another book, chapter or verse">
            {onMain ? formatReference(view.ref) : name(shownAt)} <small>{abbrev} ▾</small>
          </button>
        </h2>
        <p className="chapter-hint">
          {tags ? 'Tap a word to study the Hebrew or Greek. ' : reader.supported ? 'Tap verses to choose which ones to play. ' : ''}
          Swipe left or right for the next or previous chapter.
        </p>
        <ol className="chapter">
          {all.map(h => {
            const v = h.verse;
            const key = hitKey(h);
            const isSelected = selected.has(key);
            return (
              <li
                key={v}
                ref={key === readingKey ? readingEl : onMain && v === verseStart ? first : undefined}
                className={`${inRange(v) ? 'hit' : ''} ${key === readingKey ? 'reading' : ''} ${isSelected ? 'selected' : ''}`}
                {...(reader.supported && {
                  role: 'button',
                  tabIndex: 0,
                  'aria-pressed': isSelected,
                  onClick: () => onToggle(key),
                  onKeyDown: (e: ReactKeyboardEvent) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onToggle(key);
                    }
                  },
                })}
              >
                <sup>{isSelected ? '✓' : ''}{v}</sup>{' '}
                {key === readingKey && reader.word ? (
                  <ReadingText text={h.text} word={reader.word} />
                ) : tags?.[v - 1] ? (
                  <TaggedText text={h.text} tags={tags[v - 1]} onWord={onWord} />
                ) : (
                  h.text
                )}
              </li>
            );
          })}
        </ol>
      </div>
      <nav className="pager">
        <button disabled={prev === null} onClick={() => prev !== null && show(prev)}>
          ← {prev !== null && name(prev)}
        </button>
        <button disabled={next === null} onClick={() => next !== null && show(next)}>
          {next !== null && name(next)} →
        </button>
      </nav>

      {reader.supported && (
        <div className="player">
          {picked.length > 0 && (
            <div className="selection-bar">
              <span>{picked.length} selected</span>
              <button onClick={() => onSave(picked)}>Save to list</button>
              <button onClick={onClearSelection}>Clear</button>
            </div>
          )}
          {reader.playing ? (
            <button className="player-main" onClick={reader.stop}>
              ■ Stop · <StopDetail reader={reader} />
            </button>
          ) : picked.length || askedLabel ? (
            <div className="play-choice">
              {picked.length ? (
                <button className="player-main" onClick={() => readAloud(picked)}>▶ Play {picked.length}</button>
              ) : (
                <button className="player-main" onClick={() => readAloud(asked)}>▶ Play {askedLabel}</button>
              )}
              <button className="player-alt" onClick={() => readAloud(onward(shownAt))}>▶ Whole chapter</button>
            </div>
          ) : (
            <button className="player-main" onClick={() => readAloud(onward(shownAt))}>▶ Play chapter</button>
          )}
          <PlayerControls reader={reader} />
        </div>
      )}
    </section>
  );
}

const WHEEL_ROW = 40; // px per row in a picker wheel

/** A scroll wheel: spin it and the row that settles in the middle band is chosen. Tapping a row spins to it. */
function Wheel({ label, items, index, onChange }: { label: string; items: string[]; index: number; onChange: (i: number) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const settle = useRef<ReturnType<typeof setTimeout>>();
  useLayoutEffect(() => {
    // Line the wheel up with the chosen row (on open, or when a shorter list pulls it back in range)
    const w = el.current;
    if (w && Math.round(w.scrollTop / WHEEL_ROW) !== index) w.scrollTop = index * WHEEL_ROW;
  }, [index, items.length]);
  useEffect(() => () => clearTimeout(settle.current), []);
  const onScroll = () => {
    clearTimeout(settle.current);
    settle.current = setTimeout(() => {
      const w = el.current;
      if (!w) return;
      const i = Math.max(0, Math.min(items.length - 1, Math.round(w.scrollTop / WHEEL_ROW)));
      if (i !== index) onChange(i);
    }, 120);
  };
  return (
    <div className="wheel">
      <div className="wheel-label">{label}</div>
      <div className="wheel-scroll" ref={el} onScroll={onScroll} role="listbox" aria-label={label}>
        {items.map((item, i) => (
          <button
            key={item}
            role="option"
            aria-selected={i === index}
            className={i === index ? 'on' : ''}
            onClick={() => el.current?.scrollTo({ top: i * WHEEL_ROW, behavior: 'smooth' })}
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Book · Chapter · Verse wheels for jumping straight to a place. Verse "All" opens the whole chapter. */
function GotoSheet({ bible, start, onClose, onGo }: {
  bible: BibleText;
  start: { book: number; chapter: number; verseStart?: number } | null;
  onClose: () => void;
  onGo: (ref: Reference) => void;
}) {
  const [book, setBook] = useState(start?.book ?? 0);
  const [chapter, setChapter] = useState(start?.chapter ?? 1);
  const [verse, setVerse] = useState(start?.verseStart ?? 0); // 0 = All
  const chapterCount = bible[book].length;
  const ch = Math.min(chapter, chapterCount);
  const verseCount = bible[book][ch - 1].length;
  const v = Math.min(verse, verseCount);
  const chapterItems = useMemo(() => Array.from({ length: chapterCount }, (_, i) => String(i + 1)), [chapterCount]);
  const verseItems = useMemo(() => ['All', ...Array.from({ length: verseCount }, (_, i) => String(i + 1))], [verseCount]);
  const ref: Reference = { book, chapter: ch, ...(v ? { verseStart: v } : {}) };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Go to" onClick={e => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>Go to</h2>
          <button className="sheet-close" aria-label="Close" onClick={onClose}>✕</button>
        </div>
        <div className="wheels">
          <Wheel label="Book" items={BOOKS} index={book} onChange={setBook} />
          <Wheel label="Chapter" items={chapterItems} index={ch - 1} onChange={i => setChapter(i + 1)} />
          <Wheel label="Verse" items={verseItems} index={v} onChange={setVerse} />
        </div>
        <button className="goto-open" onClick={() => onGo(ref)}>Open {formatReference(ref)}</button>
      </div>
    </div>
  );
}

/** Asks before adding a list that arrived in a shared link. */
function SharedListSheet({ incoming, existing, onClose, onAdd }: {
  incoming: { name: string; verses: VerseRef[] };
  existing: VerseList | undefined;
  onClose: () => void;
  onAdd: (existing: VerseList | undefined) => void;
}) {
  const n = incoming.verses.length;
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Shared list" onClick={e => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>Shared list</h2>
          <button className="sheet-close" aria-label="Close" onClick={onClose}>✕</button>
        </div>
        <p className="shared-name">“{incoming.name}” <small>{n.toLocaleString()} verse{n === 1 ? '' : 's'}</small></p>
        {existing && <p className="notice">You already have a list called “{existing.name}”. Its verses will be added to it.</p>}
        <button className="goto-open" onClick={() => onAdd(existing)}>{existing ? 'Add to my list' : 'Add list'}</button>
        <button className="sheet-link" onClick={onClose}>Not now</button>
      </div>
    </div>
  );
}

function LibrarySheet({
  library, saving, hideList, onClose, onRun, onOpenList, onSaved, onShare, chats, onOpenChat, onNewChat, onDeleteChat,
  onImportChats, onMoveChat,
}: {
  library: ReturnType<typeof useLibrary>;
  saving: VerseRef[] | null; // verses waiting to be saved, or null when just browsing
  hideList?: string; // the list the verses are being copied from
  onClose: () => void;
  onRun: (query: string) => void;
  onOpenList: (id: string) => void;
  onSaved: (listName: string, listId: string, count: number) => void;
  onShare: (list: VerseList) => void;
  chats: Chat[];
  onOpenChat: (id: string) => void;
  onNewChat: () => void;
  onDeleteChat: (id: string) => void;
  onImportChats: () => void;
  onMoveChat: (id: string, to: number) => void;
}) {
  const [tab, setTab] = useState<'history' | 'lists'>('lists');
  const [newName, setNewName] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null); // list waiting for "Sure?"
  // The ChatGPT section folds away so a long run of chats doesn't push the lists down; remembered per device
  const [chatsOpen, setChatsOpenState] = useState(() => {
    try {
      return localStorage.getItem('chatsOpen') === '1';
    } catch {
      return false;
    }
  });
  const setChatsOpen = (open: boolean) => {
    setChatsOpenState(open);
    try {
      localStorage.setItem('chatsOpen', open ? '1' : '0');
    } catch {
      // storage unavailable; lasts while the panel is open
    }
  };
  const { history } = library;
  const lists = library.lists.filter(l => l.id !== hideList);

  // Lists and chats can be dragged into order by their ⠿ handles
  const listDrag = useDragOrder(lists.map(l => l.id), library.moveList);
  const chatDrag = useDragOrder(chats.map(c => c.id), onMoveChat);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const createList = (e: FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    const id = library.addToList(saving ?? [], { name });
    setNewName('');
    if (saving) onSaved(name, id, saving.length);
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={saving ? 'Save to list' : 'History and lists'} onClick={e => e.stopPropagation()}>
        <div className="sheet-head">
          {saving ? (
            <h2>Save {saving.length} verse{saving.length === 1 ? '' : 's'} to…</h2>
          ) : (
            <div className="tabs" role="tablist">
              <button role="tab" aria-selected={tab === 'lists'} className={tab === 'lists' ? 'on' : ''} onClick={() => setTab('lists')}>Lists</button>
              <button role="tab" aria-selected={tab === 'history'} className={tab === 'history' ? 'on' : ''} onClick={() => setTab('history')}>History</button>
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

        {!saving && tab === 'lists' && (
          <>
            <div className="section-head">
              <button className="section-toggle" aria-expanded={chatsOpen} onClick={() => setChatsOpen(!chatsOpen)}>
                <span className="chevron" aria-hidden>{chatsOpen ? '▾' : '▸'}</span> ChatGPT
                {chats.length > 0 && <small>{chats.length}</small>}
              </button>
              <button className="section-new" onClick={onNewChat}>+ New</button>
            </div>
            {chatsOpen && (
              <ul className="sheet-list">
                <li>
                  <button className="sheet-item new-chat" onClick={onImportChats}>⇩ Import from ChatGPT</button>
                </li>
                {chats.map((c, i) => deleting === `chat:${c.id}` ? (
                  <li key={c.id} className="confirm-row" role="alertdialog" aria-label={`Delete chat ${c.title}?`}>
                    <span>Delete this chat?</span>
                    <button
                      className="danger"
                      onClick={() => {
                        onDeleteChat(c.id);
                        setDeleting(null);
                      }}
                    >
                      Delete
                    </button>
                    <button onClick={() => setDeleting(null)} autoFocus>Cancel</button>
                  </li>
                ) : (
                  <li key={c.id} {...chatDrag.rowProps(c.id, i)}>
                    {chats.length > 1 && <button {...chatDrag.handleProps(c.id, i, c.title)}>⠿</button>}
                    <button className="sheet-item" onClick={() => onOpenChat(c.id)}>{c.title}</button>
                    <button className="sheet-x" aria-label={`Delete chat ${c.title}`} onClick={() => setDeleting(`chat:${c.id}`)}>✕</button>
                  </li>
                ))}
              </ul>
            )}
            <h3 className="sheet-sub">Lists</h3>
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
              {lists.map((l, i) => deleting === l.id ? (
                <li key={l.id} className="confirm-row" role="alertdialog" aria-label={`Delete ${l.name}?`}>
                  <span>Delete “{l.name}”?</span>
                  <button
                    className="danger"
                    onClick={() => {
                      library.deleteList(l.id);
                      setDeleting(null);
                    }}
                  >
                    Delete
                  </button>
                  <button onClick={() => setDeleting(null)} autoFocus>Cancel</button>
                </li>
              ) : (
                <li key={l.id} {...listDrag.rowProps(l.id, i)}>
                  {!saving && lists.length > 1 && <button {...listDrag.handleProps(l.id, i, l.name)}>⠿</button>}
                  <button
                    className="sheet-item"
                    onClick={() => {
                      if (!saving) return onOpenList(l.id);
                      library.addToList(saving, { id: l.id });
                      onSaved(l.name, l.id, saving.length);
                    }}
                  >
                    {l.name} <small>{l.verses.length}</small>
                  </button>
                  {!saving && (
                    <>
                      <button className="sheet-x" aria-label={`Share ${l.name}`} disabled={!l.verses.length} onClick={() => onShare(l)}>
                        <svg className="share-icon" viewBox="0 0 24 24" aria-hidden>
                          <circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" />
                          <path d="M8.2 10.8 15.8 6.2M8.2 13.2l7.6 4.6" />
                        </svg>
                      </button>
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
                      <button className="sheet-x list-delete" aria-label={`Delete ${l.name}`} onClick={() => setDeleting(l.id)}>
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
  const { voices, voice, voiceId, recordedVoice, setVoice, preview, refreshVoices } = reader;
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
        {RECORDED_VOICES.length > 0 && (
          <>
            <h3 className="sheet-sub">Natural voices</h3>
            <ul className="sheet-list" role="radiogroup" aria-label="Natural voices">
              {RECORDED_VOICES.map(v => {
                const on = recordedVoice === v;
                return (
                  <li key={v.id} className={on ? 'on' : ''}>
                    <button className="sheet-item voice-item" role="radio" aria-checked={on} onClick={() => setVoice(`rec:${v.id}`)}>
                      <span className="check" aria-hidden>{on ? '✓' : ''}</span>
                      {v.name} <small>{describeRecorded(v)}</small>
                    </button>
                    <button className="sheet-x" aria-label={`Hear ${v.name}`} onClick={() => preview(v.id)}>▶</button>
                  </li>
                );
              })}
            </ul>
            <p className="voice-help">Recorded voices that sound human. They stream over the internet.</p>
          </>
        )}

        <h3 className="sheet-sub">Device voices</h3>
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
            const on = !recordedVoice && v === voice;
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

/** "John 3:16" (or "3:16" within a chapter) for the verse being read. */
function StopDetail({ reader, full }: { reader: ReturnType<typeof useReader>; full?: boolean }) {
  const c = reader.current;
  if (!c) return null;
  return <>{full ? `${BOOKS[c.book]} ` : ''}{c.chapter}:{c.verse}</>;
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
