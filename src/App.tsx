import { createPortal } from 'react-dom';
import { Fragment, createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type TouchEvent as ReactTouchEvent, type ReactNode } from 'react';
import { bookName, bookNames, setBookLanguage } from './bible/books';
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
import { shareVerses, versesAsText } from './shareVerses';
import { ImportChats } from './ImportChats';
import { NoteView } from './NoteView';
import { noteTitle, useNotes, type Note } from './useNotes';
import { useDragOrder } from './useDragOrder';
import { THEMES, savedTheme, setTheme, type ThemeId } from './theme';
import { useChats, type Chat } from './useChats';
import { describeBackup, makeBackup, restoreBackup } from './backup';
import { SPEEDS, describeVoice, useReader, voiceName } from './useReader';
import { ReadingText, type Listen } from './ReadAloud';
import { TAP_TO_TALK, useSpeech } from './useSpeech';
import { n, setUiLanguage, t, uiLanguage } from './i18n';
import { Teleprompter } from './Teleprompter';

type View =
  | { kind: 'home' }
  // strongs: a Strong's number search, maybe narrowed to one book or one way the KJV translates it
  | { kind: 'search'; query: string; hits: VerseHit[]; strongs?: string; inBook?: number; asWord?: string }
  | { kind: 'list'; id: string }
  // fromList: opened from a verse in a list, so verses around it can be added to that list beside it
  | { kind: 'chapter'; ref: Reference; fromList?: { id: string; anchor: VerseRef } }
  | { kind: 'chat'; id: string }
  | { kind: 'note'; id: string }
  // The Verse Lists, Notes and Chat tabs' own pages
  | { kind: 'lists' }
  | { kind: 'notes' }
  | { kind: 'chats' };

/** The tabs along the bottom, and which one each screen belongs to. */
type Tab = 'read' | 'search' | 'lists' | 'notes' | 'chat';
const tabOf = (v: View): Tab =>
  v.kind === 'chapter' ? 'read'
  : v.kind === 'search' || v.kind === 'home' ? 'search'
  : v.kind === 'list' || v.kind === 'lists' ? 'lists'
  : v.kind === 'note' || v.kind === 'notes' ? 'notes'
  : 'chat';
const TAB_ICONS: Record<Tab, ReactNode> = {
  read: <path d="M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5Zm0 0v13" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  lists: <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1Z" />,
  notes: <><path d="M5 4h10l4 4v12H5Z" /><path d="M15 4v4h4M8 12h8M8 16h6" /></>,
  chat: <path d="M4 5h16v11H9l-5 4Z" />,
};
const TABS: { id: Tab; name: string; es?: string }[] = [
  { id: 'read', name: 'Read' },
  { id: 'search', name: 'Search' },
  { id: 'lists', name: 'Verse Lists', es: 'Listas' },
  { id: 'notes', name: 'Notes' },
  { id: 'chat', name: 'Chat' },
];
// The layout before v2 (v1.49), which ⚙ Settings › Classic layout brings back; shared with the parts that differ
const ClassicContext = createContext(false);
const savedClassic = () => {
  try {
    return localStorage.getItem('layout') === 'classic';
  } catch {
    return false;
  }
};
// This copy is the one being tried out at /preview/
const PREVIEW = import.meta.env.BASE_URL.includes('preview');

/** The chapter last read, to open the app on (Psalm 23 the first time). */
function lastRead(): Reference {
  try {
    const saved = JSON.parse(localStorage.getItem('lastRead') ?? 'null');
    if (saved && Number.isInteger(saved.book) && Number.isInteger(saved.chapter)) return { book: saved.book, chapter: saved.chapter };
  } catch {
    // nothing saved
  }
  return { book: 18, chapter: 23 };
}

const PAGE = 50;
const FILLER = /^(search( for)?|find|look up|show( me)?|go to|read|open|busca(r)?|encuentra|abre|abrir|lee(r)?|ir a|ve a)\s+/i;

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
// The app's own address, to share (not the page's, which may be a test copy)
const APP_URL = 'https://voicebible.eefavorbooks.com/';

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
  const language = TRANSLATIONS.find(t => t.id === translation)!.lang;
  setBookLanguage(language); // book names on screen follow the Bible's language
  setUiLanguage(language); // and so do the app's words
  // Word study: the tapped word and its Strong's number
  // The teleprompter sits over the whole app (not inside the note), so a recording carries on while you browse
  const [prompter, setPrompter] = useState<{ title: string; text: string; at: number } | null>(null);
  const [studyWord, setStudyWord] = useState<{ word: string; code: string; verse?: VerseHit } | null>(null);
  const [bible, setBible] = useState<BibleText | null>(null);
  const [loadError, setLoadError] = useState('');
  // The app opens on the chapter last read, like an open book
  const [classic, setClassicState] = useState(savedClassic);
  const [view, setView] = useState<View>(() => (savedClassic() ? { kind: 'home' } : { kind: 'chapter', ref: lastRead() }));
  const [settingsOpen, setSettingsOpen] = useState(false);
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
  const notes = useNotes();
  const [importing, setImporting] = useState(false);
  const [sheet, setSheet] = useState<null | 'browse' | VerseRef[] | { verses: VerseRef[]; from: string }>(null);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [gotoOpen, setGotoOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [theme, setThemeState] = useState<ThemeId>(savedTheme);
  // Instructions on screen ("Tap the mic…", "Say a word…"); the switch under the title hides them, per device
  const [hints, setHintsState] = useState(() => {
    try {
      return localStorage.getItem('hints') !== 'off';
    } catch {
      return true;
    }
  });
  const setHints = (on: boolean) => {
    setHintsState(on);
    try {
      localStorage.setItem('hints', on ? 'on' : 'off');
    } catch {
      // storage unavailable; lasts for this visit
    }
  };
  // Brief message near the top; one about a list can be tapped to open it
  // Verses on their way into a note, while the note picker is open
  const [toNote, setToNote] = useState<{ verses: VerseHit[]; title: string } | null>(null);
  const [toast, setToastState] = useState<{ text: string; listId?: string; noteId?: string } | null>(null);
  const setToast = (text: string, listId?: string, noteId?: string) => setToastState(text ? { text, listId, noteId } : null);
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
    const t = setTimeout(() => setToastState(null), toast.listId || toast.noteId ? 4000 : 2500);
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
  }, language);
  const pauseMic = () => {
    if (speechRef.current?.status === 'listening') {
      // Turning it back on by itself would make Apple devices ask for the microphone again
      micWasOn.current = !TAP_TO_TALK;
      speechRef.current.stop();
    }
  };
  const readAloud = (verses: VerseHit[]) => {
    pauseMic();
    reader.play(verses);
  };
  const listen: Listen = (paragraphs, title, from) => {
    pauseMic();
    reader.playText(paragraphs, title, from);
  };

  useEffect(() => {
    setBible(null);
    loadTranslation(translation).then(setBible, e => setLoadError(String(e.message ?? e)));
  }, [translation]);

  const index = useMemo(() => (bible ? buildIndex(bible) : null), [bible]);
  const studyVerses = useCallback((code: string) => (bible ? versesWithCode(bible, code) : []), [bible]);
  const noteChangers = useRef(new Map<string, (change: Partial<Pick<Note, 'title' | 'text'>>) => void>());
  const noteChanger = (id: string) => {
    let f = noteChangers.current.get(id);
    if (!f) noteChangers.current.set(id, (f = change => notes.updateNote(id, change)));
    return f;
  };
  const shareSelected = async (verses: VerseHit[]) => {
    const result = await shareVerses(verses, abbrev);
    if (result === 'copied') setToast(n('Copied the verse to paste into a text or email', 'Copied {n} verses to paste into a text or email', verses.length));
    if (result === 'failed') setToast(t('Couldn’t share from this browser'));
  };
  /** Sends a list's link by the phone's share menu, or copies it. */
  const shareList = (list: VerseList) => {
    const url = listLink(list.name, list.verses);
    if (navigator.share) {
      navigator.share({ title: list.name, text: t('“{list}”: {n} verses from Voice Bible', { list: list.name, n: list.verses.length }), url }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(url).then(() => setToast(t('Link copied')), () => prompt(t('Copy this link'), url));
    }
  };
  const studyRenderings = useCallback((code: string) => (bible ? renderingsOf(bible, code) : []), [bible]);
  const abbrev = TRANSLATIONS.find(t => t.id === translation)!.abbrev;
  /** Sends the app's link to someone (the phone's share menu), or copies it where there's no share menu. */
  const shareApp = () => {
    const text = t('Voice Bible: speak a word, phrase or verse and find it in the Bible, and listen to it read aloud.');
    if (navigator.share) navigator.share({ title: 'Voice Bible', text, url: APP_URL }).catch(() => {});
    else navigator.clipboard?.writeText(APP_URL).then(() => setToast(t('Link copied: {url}', { url: APP_URL })), () => setToast(APP_URL));
  };

  const shownChapter = useRef<{ book: number; chapter: number } | null>(null); // where the chapter page is, for the picker to start at
  const onChapterShown = (place: { book: number; chapter: number }) => {
    shownChapter.current = place;
    try {
      localStorage.setItem('lastRead', JSON.stringify(place));
    } catch {
      // storage unavailable; opens on Psalm 23 next time
    }
  };
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

  const setClassic = (on: boolean) => {
    setClassicState(on);
    try {
      localStorage.setItem('layout', on ? 'classic' : 'new');
    } catch {
      // storage unavailable; lasts for this visit
    }
    // The classic layout has no pages for the tabs; start it on its search page
    if (on && (view.kind === 'lists' || view.kind === 'notes' || view.kind === 'chats')) setView({ kind: 'home' });
  };

  // Each tab comes back to where it was left; tapping the tab you're on goes to its first page
  const tabViews = useRef<Partial<Record<Tab, View>>>({});
  tabViews.current[tabOf(view)] = view;
  const goTab = (tab: Tab) => {
    const here = tabOf(view);
    const root: View =
      tab === 'read' ? { kind: 'chapter', ref: shownChapter.current ?? lastRead() }
      : tab === 'search' ? { kind: 'home' }
      : tab === 'lists' ? { kind: 'lists' }
      : tab === 'notes' ? { kind: 'notes' }
      : { kind: 'chats' };
    const next = here === tab || tab === 'read' ? root : tabViews.current[tab] ?? root;
    if (here === tab && tab === 'read') return;
    openView(next);
  };

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

  // While a chat or note is open, what's said goes into it instead of starting a search
  const speakInto = useRef<((text: string) => void) | null>(null);
  // A spoken search waits a moment for the rest of the sentence: phones send "heaven", then "and earth"
  const spokenSearch = useRef<{ words: string; timer?: ReturnType<typeof setTimeout> }>({ words: '' });
  const speech = useSpeech(newWords => {
    if ((viewRef.current.kind === 'chat' || viewRef.current.kind === 'note') && speakInto.current) return speakInto.current(newWords);
    const pending = spokenSearch.current;
    pending.words = `${pending.words} ${newWords}`.trim();
    setTyped(pending.words);
    clearTimeout(pending.timer);
    pending.timer = setTimeout(() => {
      const words = pending.words;
      pending.words = '';
      run(words);
    }, 750);
  }, language);
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
    <ClassicContext.Provider value={classic}>
    <div className={`app ${classic ? 'classic' : 'v2'}`}>
      {classic ? (
        <>
        <header className="top">
          <h1>
            <span className="cross" aria-hidden>✝</span> Voice Bible
          </h1>
          <button
            className="library-btn"
            aria-label={t('Reading voice')}
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
          <button className="library-btn" aria-label={t('Colours')} onClick={() => setThemeOpen(true)}>
            <svg viewBox="0 0 24 24" aria-hidden>
              <path d="M12 3a9 9 0 0 0 0 18c1.1 0 1.8-.9 1.8-1.9 0-.5-.2-.9-.5-1.3-.3-.3-.5-.8-.5-1.3 0-1 .8-1.8 1.8-1.8H17a4 4 0 0 0 4-4c0-4.2-4-7.7-9-7.7Z" />
              <circle cx="7.5" cy="11.5" r="1.2" /><circle cx="10" cy="7.5" r="1.2" /><circle cx="14.5" cy="7.5" r="1.2" />
            </svg>
          </button>
          <button className="library-btn" aria-label={t('History and saved lists')} onClick={() => setSheet('browse')}>
            <svg viewBox="0 0 24 24" aria-hidden>
              <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1Z" />
            </svg>
          </button>
          <button className="library-btn" aria-label={t('Settings')} onClick={() => setSettingsOpen(true)}>
            <svg viewBox="0 0 24 24" aria-hidden>
              <circle cx="12" cy="12" r="3" />
              <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
            </svg>
          </button>
          <select
            aria-label={t('Translation')}
            value={translation}
            onChange={e => setTranslation(e.target.value as TranslationId)}
          >
            {TRANSLATIONS.map(tr => (
              <option key={tr.id} value={tr.id}>{tr.abbrev}</option>
            ))}
          </select>
        </header>

        <label className="hints-switch">
          <input type="checkbox" role="switch" checked={hints} onChange={e => setHints(e.target.checked)} />
          <span className="slider" aria-hidden />
          {t('Hints')}
        </label>

        <ClassicMicPanel speech={speech} hints={hints} />

        {/* A note is for writing: keep the page to the note (the mic above still shows dictation) */}
        {view.kind !== 'note' && (
          <>
            <form className="search" onSubmit={onSubmit}>
              <input
                type="search"
                inputMode="search"
                placeholder={t('Word or John 3:16')}
                value={typed}
                onChange={e => setTyped(e.target.value)}
              />
              <button type="button" className="goto-btn" aria-label={t('Go to a book, chapter and verse')} onClick={() => setGotoOpen(true)}>
                <svg viewBox="0 0 24 24" aria-hidden>
                  <path d="M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5Zm0 0V19.5" />
                </svg>
              </button>
              <button type="submit">{t('Search')}</button>
            </form>
            {/* Always showing, so it's clear which way searches work */}
            <div className="search-mode" role="radiogroup" aria-label={t('Search for')}>
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
                  {t(label)}
                </button>
              ))}
            </div>
          </>
        )}
        </>
      ) : (
        <>
        <header className="top">
          <div className="head">
            <h1>
              <span className="cross" aria-hidden>✝</span> <span className="title-text">Voice Bible</span>
              {PREVIEW && <small className="test-badge">{t('Test version')}</small>}
            </h1>
            <select className="tr-chip" aria-label={t('Translation')} value={translation} onChange={e => setTranslation(e.target.value as TranslationId)}>
              {TRANSLATIONS.map(tr => (
                <option key={tr.id} value={tr.id}>{tr.abbrev}</option>
              ))}
            </select>
            <button className="round-btn" aria-label={t('Settings')} onClick={() => setSettingsOpen(true)}>
              <svg viewBox="0 0 24 24" aria-hidden>
                <circle cx="12" cy="12" r="3" />
                <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
              </svg>
            </button>
          </div>
          {/* A note is for writing: keep the page to the note (it has its own Dictate) */}
          {view.kind !== 'note' && (
            <form className="search" onSubmit={onSubmit} role="search">
              <input
                type="search"
                inputMode="search"
                enterKeyHint="search"
                placeholder={speech.status === 'listening' ? t('Listening…') : t('Word or John 3:16')}
                value={typed}
                onChange={e => setTyped(e.target.value)}
                aria-label={t('Search the Bible')}
              />
              <button
                type="button"
                className={`mic-btn ${speech.status === 'listening' ? 'on' : ''}`}
                onClick={speech.status === 'listening' ? speech.stop : speech.start}
                disabled={speech.status === 'unsupported'}
                aria-label={t(speech.status === 'listening' ? 'Stop listening' : 'Speak a search')}
                aria-pressed={speech.status === 'listening'}
              >
                <svg viewBox="0 0 24 24" aria-hidden>
                  <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z" />
                </svg>
              </button>
            </form>
          )}
          <MicStatus speech={speech} hints={hints} />
        </header>
        </>
      )}

      <main>
        {canGoBack && (classic
          ? view.kind !== 'home'
          : view.kind === 'list' || view.kind === 'note' || view.kind === 'chat' || (view.kind === 'chapter' && !!view.fromList)) && (
          <button className="back" onClick={() => history.back()}>{t('← Back')}</button>
        )}
        {loadError && <p className="notice error">{t('{error}. Check your connection and reload.', { error: loadError })}</p>}
        {!bible && !loadError && <p className="notice">{t('Loading the {bible} Bible…', { bible: abbrev })}</p>}

        {view.kind === 'home' && classic && bible && hints && (
          <div className="home">
            <p>{t('Say a word or phrase like')} <em>{t('“faith”')}</em> {t('or')} <em>{t('“love your enemies”')}</em> {t('to find every verse that contains it.')}</p>
            <p>{t('Say a reference like')} <em>{t('“John 3:16”')}</em> {t('or')} <em>{t('“Psalm 23”')}</em> {t('to open it.')}</p>
          </div>
        )}
        {view.kind === 'home' && !classic && (
          <section className="search-home">
            <SearchModeSwitch mode={searchMode} onChange={setSearchMode} />
            {hints && <p className="hint">{t('Say a word, a phrase or a verse like “John 3:16”. Tap the mic, or type above.')}</p>}
            {library.history.length > 0 && (
              <>
                <h3 className="sheet-sub">{t('Recent')}</h3>
                <div className="recent">
                  {library.history.map(q => (
                    <button key={q} onClick={() => {
                      setTyped(q);
                      run(q);
                    }}>{q}</button>
                  ))}
                </div>
                <button className="sheet-link" onClick={() => confirm(t('Clear all search history?')) && library.clearHistory()}>{t('Clear history')}</button>
              </>
            )}
          </section>
        )}

        {view.kind === 'search' && !view.strongs && !classic && <SearchModeSwitch mode={searchMode} onChange={setSearchMode} />}
        {view.kind === 'search' && (
          <SearchResults
            onShare={shareSelected}
            strongs={view.strongs}
            tagsFor={hit => tagsOf(bible)?.[hit.book]?.[hit.chapter - 1]?.[hit.verse - 1]}
            title={
              <>
                {view.hits.length ? n('{n} verse with “{q}”', '{n} verses with “{q}”', view.hits.length, { q: view.query }) : t('No verses with “{q}”', { q: view.query })}
                {view.inBook !== undefined && t(' in {book}', { book: bookName(view.inBook) })}
                {view.asWord && t(' as “{word}”', { word: view.asWord })}
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
                    setToast(t('Saved {n} to “{list}”', { n: picked.length, list: list?.name ?? name }), id);
                  }}
                >
                  {t('Save to “{q}”', { q: view.query })}
                </button>
                <button onClick={() => setSheet(picked.map(toRef))}>{t('Other list…')}</button>
                <button onClick={() => setToNote({ verses: picked, title: view.query })}>{t('To note…')}</button>
              </>
            )}
            onClearSelection={() => setSelected(new Set())}
          />
        )}

        {view.kind === 'list' && bible && savedList && (
          <SearchResults
            onShare={shareSelected}
            title={
              <span className="list-title">
                <ListName name={savedList.name} onRename={name => library.renameList(savedList.id, name)} />
                <small>{n('{n} verse', '{n} verses', savedHits.length)}</small>
              </span>
            }
            hits={savedHits}
            shown={savedHits.length}
            onMoveVerse={(hit, to) => {
              // `to` counts the verses shown; a verse missing from this translation isn't shown, so go by the verse there
              const there = savedHits[to];
              const at = there ? savedList.verses.findIndex(v => v[0] === there.book && v[1] === there.chapter && v[2] === there.verse) : savedList.verses.length - 1;
              library.moveVerse(savedList.id, toRef(hit), at);
            }}
            abbrev={abbrev}
            onMore={() => {}}
            onOpen={hit =>
              openView({
                kind: 'chapter',
                ref: { book: hit.book, chapter: hit.chapter, verseStart: hit.verse },
                fromList: { id: savedList.id, anchor: toRef(hit) },
              })
            }
            reader={reader}
            readAloud={readAloud}
            selected={selected}
            onToggle={toggle}
            onSelectAll={() => setSelected(new Set(savedHits.map(hitKey)))}
            selectionActions={picked => (
              <>
                <button onClick={() => setSheet({ verses: picked.map(toRef), from: savedList.id })}>{t('Copy to list…')}</button>
                <button onClick={() => setToNote({ verses: picked, title: savedList.name })}>{t('To note…')}</button>
                <button
                  onClick={() => {
                    library.removeFromList(savedList.id, picked.map(toRef));
                    setSelected(new Set());
                  }}
                >
                  {t('Remove')}
                </button>
              </>
            )}
            onClearSelection={() => setSelected(new Set())}
            empty={t('This list is empty. Search, check verses, then tap “Save to list”.')}
          />
        )}

        {view.kind === 'note' && (() => {
          const note = notes.notes.find(n => n.id === view.id);
          return note ? (
            <NoteView
              key={note.id}
              onTeleprompter={(title, text) => setPrompter({ title, text, at: Date.now() })}
              note={note}
              onChange={noteChanger(note.id)}
              reader={reader}
              listen={listen}
              speechInput={speakInto}
              listening={speech.status === 'listening'}
              interim={speech.interim}
              onDictate={on => (on ? speech.start() : speech.stop())}
              lists={library.lists}
              chats={chats.chats}
              listText={list =>
                bible
                  ? versesAsText(
                      list.verses.flatMap(([b, c, v]) => (bible[b]?.[c - 1]?.[v - 1] ? [{ book: b, chapter: c, verse: v, text: bible[b][c - 1][v - 1] }] : [])),
                      abbrev,
                    )
                  : ''
              }
              versesText={verses => versesAsText(verses, abbrev)}
              chapterOf={(book, chapter) => (bible?.[book]?.[chapter - 1] ?? []).map((text, i) => ({ book, chapter, verse: i + 1, text }))}
              findVerses={q => {
                if (!bible || !index) return { verses: [], picked: [] };
                const ref = parseReference(q, bible);
                if (ref) {
                  // The whole chapter, with the verses asked for already ticked
                  const chapter = bible[ref.book][ref.chapter - 1].map((text, i) => ({ book: ref.book, chapter: ref.chapter, verse: i + 1, text }));
                  const from = ref.verseStart ?? 0;
                  const to = ref.verseEnd ?? from;
                  return { verses: chapter, picked: from ? chapter.filter(v => v.verse >= from && v.verse <= to) : [] };
                }
                return { verses: searchVerses(index, q, searchMode), picked: [] };
              }}
              onShare={text => {
                if (navigator.share) navigator.share({ text }).catch(() => {});
                else navigator.clipboard?.writeText(text).then(() => setToast(t('Note copied')), () => setToast(t('Couldn’t share from this browser')));
              }}
            />
          ) : (
            <p className="notice">{t('This note was deleted.')}</p>
          );
        })()}

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
              speechInput={speakInto}
              reader={reader}
              listen={listen}
            />
          ) : (
            <p className="notice">{t('This chat was deleted.')}</p>
          );
        })()}

        {view.kind === 'lists' && (
          <ListsPage
            library={library}
            onOpen={id => openView({ kind: 'list', id })}
            onShare={shareList}
          />
        )}
        {view.kind === 'notes' && (
          <NotesPage
            notes={notes.notes}
            onOpen={id => openView({ kind: 'note', id })}
            onNew={() => openView({ kind: 'note', id: notes.newNote() })}
            onDelete={notes.deleteNote}
            onMove={notes.moveNote}
          />
        )}
        {view.kind === 'chats' && (
          <ChatsPage
            chats={chats.chats}
            onOpen={id => openView({ kind: 'chat', id })}
            onNew={() => openView({ kind: 'chat', id: chats.newChat() })}
            onImport={() => setImporting(true)}
            onDelete={chats.deleteChat}
            onMove={chats.moveChat}
          />
        )}

        {view.kind === 'chapter' && bible && (
          <Chapter
            onShare={shareSelected}
            aroundList={(() => {
              const from = view.fromList && library.lists.find(l => l.id === view.fromList!.id);
              if (!from) return undefined;
              const anchor = view.fromList!.anchor;
              const label = `${anchor[1]}:${anchor[2]}`;
              return {
                name: from.name,
                label,
                inList: new Set(from.verses.filter(v => v[0] === anchor[0] && v[1] === anchor[1]).map(v => v[2])),
                onAdd: (picked: VerseHit[]) => {
                  const added = library.addAround(from.id, anchor, picked.map(toRef));
                  setSelected(new Set());
                  setToast(
                    added ? t('Added {n} around {ref} in “{list}”', { n: added, ref: label, list: from.name }) : t('Those are already in “{list}”', { list: from.name }),
                    from.id,
                  );
                },
              };
            })()}
            key={`${view.ref.book}-${view.ref.chapter}-${view.ref.verseStart}`}
            bible={bible}
            view={view}
            abbrev={abbrev}
            reader={reader}
            readAloud={readAloud}
            selected={selected}
            onToggle={toggle}
            onSave={picked => setSheet(picked.map(toRef))}
            onToNote={picked => setToNote({ verses: picked, title: `${bookName(view.ref.book)} ${view.ref.chapter}` })}
            onClearSelection={() => setSelected(new Set())}
            onShown={onChapterShown}
            onWord={(word, code, verse) => setStudyWord({ word, code, verse })}
            onPick={() => setGotoOpen(true)}
            hints={hints}
          />
        )}
      </main>

      {prompter && <Teleprompter key={prompter.at} title={prompter.title} text={prompter.text} onClose={() => setPrompter(null)} />}
      {classic && hints && <footer className="version">Voice Bible v{__APP_VERSION__}</footer>}
      {!classic && <nav className="tabbar" aria-label={t('Sections')}>
        {TABS.map(tb => (
          <button key={tb.id} className={tabOf(view) === tb.id ? 'on' : ''} aria-current={tabOf(view) === tb.id ? 'page' : undefined} onClick={() => goTab(tb.id)}>
            <svg viewBox="0 0 24 24" aria-hidden>{TAB_ICONS[tb.id]}</svg>
            <span>{tb.es && uiLanguage() === 'es' ? tb.es : t(tb.name)}</span>
          </button>
        ))}
      </nav>}

      {settingsOpen && (
        <div className="sheet-backdrop" onClick={() => setSettingsOpen(false)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-label={t('Settings')} onClick={e => e.stopPropagation()}>
            <div className="sheet-head">
              <h2>{t('Settings')}</h2>
              <button className="sheet-close" aria-label={t('Close')} onClick={() => setSettingsOpen(false)}>✕</button>
            </div>
            <button className="set-row" onClick={() => {
              setSettingsOpen(false);
              if (speech.status === 'listening') {
                micWasOn.current = !TAP_TO_TALK;
                speech.stop();
              }
              setVoiceOpen(true);
            }}>
              <span>{t('Reading voice')}</span>
              <small>{reader.recordedVoice ? reader.recordedVoice.name : reader.voice ? voiceName(reader.voice) : ''} ›</small>
            </button>
            <button className="set-row" onClick={() => {
              setSettingsOpen(false);
              setThemeOpen(true);
            }}>
              <span>{t('Colours')}</span>
              <small>{t(THEMES.find(th => th.id === theme)?.name ?? '')} ›</small>
            </button>
            <label className="set-row">
              <span>{t('Hints')}<small className="set-sub">{t('Short instructions on each screen')}</small></span>
              <input type="checkbox" role="switch" className="switch" checked={hints} onChange={e => setHints(e.target.checked)} />
            </label>
            <label className="set-row">
              <span>{t('Classic layout')}<small className="set-sub">{t('The look before version 2: no tabs, the big mic, and the bookmark menu')}</small></span>
              <input type="checkbox" role="switch" className="switch" checked={classic} onChange={e => setClassic(e.target.checked)} />
            </label>
            <button className="set-row" onClick={shareApp}>
              <span>{t('Share Voice Bible')}</span>
              <small>voicebible.eefavorbooks.com ›</small>
            </button>
            <Backup />
            <p className="voice-help">Voice Bible v{__APP_VERSION__}{PREVIEW && ` · ${t('Test version')}`}</p>
          </div>
        </div>
      )}

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
            setToast(t('Saved {n} to “{list}”', { n: count, list: name }), id);
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
          notes={notes.notes}
          onOpenNote={id => {
            setSheet(null);
            openView({ kind: 'note', id });
          }}
          onNewNote={() => {
            setSheet(null);
            openView({ kind: 'note', id: notes.newNote() });
          }}
          onDeleteNote={notes.deleteNote}
          onMoveNote={notes.moveNote}
          onImportChats={() => {
            setSheet(null);
            setImporting(true);
          }}
          onShare={shareList}
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
            setToast(existing ? t('Added to “{list}”', { list: existing.name }) : t('Added “{list}”', { list: incoming.name }));
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
      {toNote && (
        <NotePicker
          count={toNote.verses.length}
          notes={notes.notes}
          onClose={() => setToNote(null)}
          onPick={noteId => {
            // At the end of the note, written out with references, like Insert in a note
            const id = noteId ?? notes.newNote();
            const current = notes.notes.find(n => n.id === id);
            const title = current ? noteTitle(current) : toNote.title;
            notes.updateNote(id, {
              ...(noteId ? {} : { title }),
              text: [current?.text.trimEnd(), versesAsText(toNote.verses, abbrev)].filter(Boolean).join('\n\n'),
            });
            setToNote(null);
            setSelected(new Set());
            setToast(n('Added the verse to “{note}”', 'Added {n} verses to “{note}”', toNote.verses.length, { note: title }), undefined, id);
          }}
        />
      )}
      {themeOpen && (
        <div className="sheet-backdrop" onClick={() => setThemeOpen(false)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-label={t('Colours')} onClick={e => e.stopPropagation()}>
            <div className="sheet-head">
              <h2>{t('Colours')}</h2>
              <button className="sheet-close" aria-label={t('Close')} onClick={() => setThemeOpen(false)}>✕</button>
            </div>
            {[THEMES.filter(th => !('neon' in th)), THEMES.filter(th => 'neon' in th)].map((group, g) => (
            <Fragment key={g}>
            {g > 0 && <h3 className="sheet-sub">{t('Neon')}</h3>}
            <div className="themes" role="radiogroup" aria-label={t(g ? 'Neon colour theme' : 'Colour theme')}>
              {group.map(th => (
                <button
                  key={th.id}
                  role="radio"
                  aria-checked={theme === th.id}
                  className={`theme-choice ${theme === th.id ? 'on' : ''}`}
                  onClick={() => {
                    setTheme(th.id);
                    setThemeState(th.id);
                  }}
                >
                  <span
                    className="swatch"
                    style={{
                      background:
                        'wheel' in th
                          ? `conic-gradient(${th.wheel.join(', ')}, ${th.wheel[0]})`
                          : `linear-gradient(135deg, ${th.swatch[0]} 50%, ${th.swatch[1]} 50%)`,
                    }}
                    aria-hidden
                  />
                  {t(th.name)}
                </button>
              ))}
            </div>
            </Fragment>
            ))}
          </div>
        </div>
      )}
      {importing && (
        <ImportChats
          existing={chats.chats}
          onClose={() => setImporting(false)}
          onImport={list => {
            chats.importChats(list);
            setImporting(false);
            if (list.length === 1) openView({ kind: 'chat', id: list[0].id });
            else openView({ kind: 'chats' });
            setToast(n('Imported {n} chat', 'Imported {n} chats', list.length));
          }}
        />
      )}
      {studyWord && bible && (
        <WordSheet
          word={studyWord.word}
          code={studyWord.code}
          where={studyWord.verse && `${bookName(studyWord.verse.book)} ${studyWord.verse.chapter}:${studyWord.verse.verse}`}
          notes={notes.notes.map(n => ({ id: n.id, title: noteTitle(n) }))}
          onAddToNote={(noteId, text, word) => {
            const id = noteId ?? notes.newNote();
            const current = notes.notes.find(n => n.id === id);
            notes.updateNote(id, {
              ...(noteId ? {} : { title: t('Word study: {word}', { word }) }),
              text: [current?.text.trimEnd(), text].filter(Boolean).join('\n\n'),
            });
            setStudyWord(null);
            setToast(t('Added to “{list}”', { list: current ? noteTitle(current) : t('Word study: {word}', { word }) }), undefined, id);
          }}
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
      {toast && (toast.listId || toast.noteId ? (
        <button
          className="toast toast-link"
          onClick={() => {
            const { listId, noteId } = toast;
            setToastState(null);
            openView(listId ? { kind: 'list', id: listId } : { kind: 'note', id: noteId! });
          }}
        >
          <span className="toast-text">{toast.text}</span>
          <span className="toast-open">{t('Open ›')}</span>
        </button>
      ) : (
        <div className="toast" role="status">{toast.text}</div>
      ))}
      {newVersion && (
        <button className="toast update" onClick={() => location.reload()}>
          {t('New version {v} — tap to update', { v: newVersion })}
        </button>
      )}
    </div>
    </ClassicContext.Provider>
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

/** Classic layout: the big mic. Without hints, only what it hears and problems (blocked, unsupported) show beneath it. */
function ClassicMicPanel({ speech, hints }: { speech: ReturnType<typeof useSpeech>; hints: boolean }) {
  const { status, interim, start, stop } = speech;
  const listening = status === 'listening';
  const message = {
    listening: TAP_TO_TALK ? t('Listening… say a word or verse') : t('Listening… just speak'),
    idle: TAP_TO_TALK ? t('Tap the mic, then speak') : t('Tap the mic to start listening'),
    blocked: TAP_TO_TALK
      ? t('Microphone is blocked. In Safari tap aA › Website Settings › Microphone › Allow, then tap the mic.')
      : t('Microphone is blocked. Allow it in your browser’s site settings, then tap the mic.'),
    unsupported: t('Voice search isn’t available in this browser. Use Chrome on Android or Safari on iPhone, or type below.'),
  }[status];

  return (
    <section className="mic">
      <button
        className={`mic-button ${listening ? 'on' : ''}`}
        onClick={listening ? stop : start}
        disabled={status === 'unsupported'}
        aria-label={t(listening ? 'Stop listening' : 'Start listening')}
        aria-pressed={listening}
      >
        <svg viewBox="0 0 24 24" aria-hidden>
          <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z" />
        </svg>
      </button>
      <p className="mic-status" aria-live="polite">
        {interim ? `“${interim}”` : hints || status === 'blocked' || status === 'unsupported' ? message : ''}
      </p>
    </section>
  );
}

/** Under the search bar: what the mic is hearing, and problems. "Listening…" is a hint, so it hides with them. */
function MicStatus({ speech, hints }: { speech: ReturnType<typeof useSpeech>; hints: boolean }) {
  const { status, interim } = speech;
  const message =
    interim ? `“${interim}”`
    : status === 'listening' && hints ? (TAP_TO_TALK ? t('Listening… say a word or verse') : t('Listening… just speak'))
    : status === 'blocked' ? (TAP_TO_TALK
      ? t('Microphone is blocked. In Safari tap aA › Website Settings › Microphone › Allow, then tap the mic.')
      : t('Microphone is blocked. Allow it in your browser’s site settings, then tap the mic.'))
    : status === 'unsupported' && hints ? t('Voice search isn’t available in this browser. Use Chrome on Android or Safari on iPhone, or type below.')
    : '';
  return message ? <p className="mic-status" aria-live="polite">{message}</p> : null;
}

/** All words (any order) or the exact phrase. */
function SearchModeSwitch({ mode, onChange }: { mode: SearchMode; onChange: (mode: SearchMode) => void }) {
  return (
    <div className="search-mode" role="radiogroup" aria-label={t('Search for')}>
      {([['words', 'All words'], ['exact', 'Exact phrase']] as const).map(([m, label]) => (
        <button key={m} type="button" role="radio" aria-checked={mode === m} className={mode === m ? 'on' : ''} onMouseDown={e => e.preventDefault()} onClick={() => onChange(m)}>
          {t(label)}
        </button>
      ))}
    </div>
  );
}

/** A tab's page title, with Edit / Done when its rows can be reordered or deleted. */
function PageHead({ title, editing, onEdit }: { title: string; editing?: boolean; onEdit?: () => void }) {
  return (
    <div className="page-head">
      <h2>{title}</h2>
      {onEdit && <button className="text-btn" onClick={onEdit}>{t(editing ? 'Done' : 'Edit')}</button>}
    </div>
  );
}

/** The Verse Lists tab. Edit shows the drag handles, rename, share and delete. */
function ListsPage({ library, onOpen, onShare }: {
  library: ReturnType<typeof useLibrary>;
  onOpen: (id: string) => void;
  onShare: (list: VerseList) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const drag = useDragOrder(library.lists.map(l => l.id), library.moveList);
  const create = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    library.addToList([], { name: name.trim() });
    setName('');
    setCreating(false);
  };
  return (
    <section className="tab-page">
      <PageHead title={t('Verse Lists')} editing={editing} onEdit={library.lists.length ? () => setEditing(!editing) : undefined} />
      {creating ? (
        <form className="new-list" onSubmit={create}>
          <input placeholder={t('New list name')} aria-label={t('New list name')} value={name} onChange={e => setName(e.target.value)} autoFocus />
          <button type="submit" disabled={!name.trim()}>{t('Create')}</button>
          <button type="button" className="new-list-cancel" aria-label={t('Cancel')} onClick={() => setCreating(false)}>✕</button>
        </form>
      ) : (
        <button className="new-row" onClick={() => setCreating(true)}>{t('+ New list')}</button>
      )}
      {!library.lists.length && <p className="notice">{t('Tap + New, or check verses in your results and tap “Save to list”.')}</p>}
      <ul className="sheet-list">
        {library.lists.map((l, i) => deleting === l.id ? (
          <li key={l.id} className="confirm-row" role="alertdialog" aria-label={t('Delete {name}?', { name: l.name })}>
            <span>{t('Delete “{name}”?', { name: l.name })}</span>
            <button className="danger" onClick={() => {
              library.deleteList(l.id);
              setDeleting(null);
            }}>{t('Delete')}</button>
            <button onClick={() => setDeleting(null)} autoFocus>{t('Cancel')}</button>
          </li>
        ) : (
          <li key={l.id} {...(editing ? drag.rowProps(l.id, i) : {})}>
            {editing && library.lists.length > 1 && <button {...drag.handleProps(l.id, i, l.name)}>⠿</button>}
            <button className="sheet-item" onClick={() => onOpen(l.id)}>
              {l.name} <small>{l.verses.length}</small>
            </button>
            {editing ? (
              <>
                <button className="sheet-x" aria-label={t('Rename {name}', { name: l.name })} onClick={() => {
                  const next = prompt(t('Rename list'), l.name)?.trim();
                  if (next) library.renameList(l.id, next);
                }}>✎</button>
                <button className="sheet-x list-delete" aria-label={t('Delete {name}', { name: l.name })} onClick={() => setDeleting(l.id)}>✕</button>
              </>
            ) : (
              <button className="sheet-x" aria-label={t('Share {name}', { name: l.name })} disabled={!l.verses.length} onClick={() => onShare(l)}>
                <svg className="share-icon" viewBox="0 0 24 24" aria-hidden>
                  <circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" />
                  <path d="M8.2 10.8 15.8 6.2M8.2 13.2l7.6 4.6" />
                </svg>
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The Notes tab. */
function NotesPage({ notes, onOpen, onNew, onDelete, onMove }: {
  notes: Note[];
  onOpen: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onMove: (id: string, to: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const drag = useDragOrder(notes.map(n => n.id), onMove);
  return (
    <section className="tab-page">
      <PageHead title={t('Notes')} editing={editing} onEdit={notes.length ? () => setEditing(!editing) : undefined} />
      <button className="new-row" onClick={onNew}>{t('+ New note')}</button>
      {!notes.length && <p className="notice">{t('Thoughts and sermons. Tap + New, then type or dictate.')}</p>}
      <ul className="sheet-list">
        {notes.map((n, i) => deleting === n.id ? (
          <li key={n.id} className="confirm-row" role="alertdialog" aria-label={t('Delete note {name}?', { name: noteTitle(n) })}>
            <span>{t('Delete this note?')}</span>
            <button className="danger" onClick={() => {
              onDelete(n.id);
              setDeleting(null);
            }}>{t('Delete')}</button>
            <button onClick={() => setDeleting(null)} autoFocus>{t('Cancel')}</button>
          </li>
        ) : (
          <li key={n.id} {...(editing ? drag.rowProps(n.id, i) : {})}>
            {editing && notes.length > 1 && <button {...drag.handleProps(n.id, i, noteTitle(n))}>⠿</button>}
            <button className="sheet-item note-row" onClick={() => onOpen(n.id)}>
              <span>{noteTitle(n)}</span>
              {n.text.trim() && <small>{n.text.trim().replace(/\s+/g, ' ').slice(0, 90)}</small>}
            </button>
            {editing && <button className="sheet-x" aria-label={t('Delete note {name}', { name: noteTitle(n) })} onClick={() => setDeleting(n.id)}>✕</button>}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The Chat tab: ChatGPT conversations. */
function ChatsPage({ chats, onOpen, onNew, onImport, onDelete, onMove }: {
  chats: Chat[];
  onOpen: (id: string) => void;
  onNew: () => void;
  onImport: () => void;
  onDelete: (id: string) => void;
  onMove: (id: string, to: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const drag = useDragOrder(chats.map(c => c.id), onMove);
  return (
    <section className="tab-page">
      <PageHead title="ChatGPT" editing={editing} onEdit={chats.length ? () => setEditing(!editing) : undefined} />
      <button className="new-row" onClick={onNew}>{t('+ New chat')}</button>
      <button className="new-row quiet" onClick={onImport}>{t('⇩ Import from ChatGPT')}</button>
      {!chats.length && <p className="notice">{t('No chats yet.')}</p>}
      <ul className="sheet-list">
        {chats.map((c, i) => deleting === c.id ? (
          <li key={c.id} className="confirm-row" role="alertdialog" aria-label={t('Delete chat {name}?', { name: c.title })}>
            <span>{t('Delete this chat?')}</span>
            <button className="danger" onClick={() => {
              onDelete(c.id);
              setDeleting(null);
            }}>{t('Delete')}</button>
            <button onClick={() => setDeleting(null)} autoFocus>{t('Cancel')}</button>
          </li>
        ) : (
          <li key={c.id} {...(editing ? drag.rowProps(c.id, i) : {})}>
            {editing && chats.length > 1 && <button {...drag.handleProps(c.id, i, c.title)}>⠿</button>}
            <button className="sheet-item" onClick={() => onOpen(c.id)}>{c.title}</button>
            {editing && <button className="sheet-x" aria-label={t('Delete chat {name}', { name: c.title })} onClick={() => setDeleting(c.id)}>✕</button>}
          </li>
        ))}
      </ul>
    </section>
  );
}

const hitKey = (h: VerseHit) => `${h.book}-${h.chapter}-${h.verse}`;

const toRef = (h: VerseHit): VerseRef => [h.book, h.chapter, h.verse];

function SearchResults({
  title, hits, query, shown, abbrev, onMore, onOpen, reader, readAloud, selected, onToggle,
  onSelectAll, selectionActions, onClearSelection, empty, strongs, tagsFor, onShare, onMoveVerse,
}: {
  onMoveVerse?: (hit: VerseHit, to: number) => void; // a saved list: drag a verse by its handle to reorder
  title: ReactNode;
  strongs?: string; // a Strong's number search: mark the words that translate it
  tagsFor?: (hit: VerseHit) => Tag[] | undefined;
  onShare: (verses: VerseHit[]) => void; // text or email the selected verses
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
  const classic = useContext(ClassicContext);
  const count = hits.length;
  const picked = hits.filter(h => selected.has(hitKey(h)));
  const queue = picked.length ? picked : hits;
  const current = reader.current && hitKey(reader.current);
  const currentEl = useRef<HTMLLIElement | null>(null);

  useEffect(() => {
    currentEl.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [current]);

  // Reordering a list's verses: each card gets a ⠿ handle (not while choosing verses)
  const keys = hits.slice(0, shown).map(hitKey);
  const verseDrag = useDragOrder(keys, (key, to) => {
    const hit = hits.find(h => hitKey(h) === key);
    if (hit) onMoveVerse?.(hit, to);
  });
  const movable = !!onMoveVerse && keys.length > 1 && !picked.length;
  // The card's own ref and class, plus the drag's (it measures the rows and slides them aside)
  const cardProps = (key: string, i: number, isCurrent: boolean, cls: string) => {
    if (!movable) return { ref: isCurrent ? currentEl : undefined, className: cls };
    const d = verseDrag.rowProps(key, i);
    return {
      ref: (el: HTMLLIElement | null) => {
        d.ref(el);
        if (isCurrent) currentEl.current = el;
      },
      className: `${cls} movable ${d.className}`,
      style: d.style,
    };
  };
  const handle = (hit: VerseHit, i: number) =>
    movable && (
      <button
        {...verseDrag.handleProps(hitKey(hit), i, `${bookName(hit.book)} ${hit.chapter}:${hit.verse}`)}
        aria-label={t('Move {ref} (drag, or arrow keys)', { ref: `${bookName(hit.book)} ${hit.chapter}:${hit.verse}` })}
        onClick={e => e.stopPropagation()} // moving, not opening
      >
        ⠿
      </button>
    );

  return (
    <section className={reader.supported && count ? `has-player ${picked.length || count > 1 ? 'selecting' : ''}` : ''}>
      <h2 className="result-title">{title}</h2>
      {!count && empty && <p className="notice">{empty}</p>}
      <ol className="verses">
        {hits.slice(0, shown).map((hit, i) => {
          const key = hitKey(hit);
          const isSelected = selected.has(key);
          const isCurrent = key === current;
          return (
            <Fragment key={key}>
              {hit.loose && !hits[i - 1]?.loose && (
                <li className="loose-divider">{t(i ? 'Also: verses with all these words' : 'No exact phrase. Verses with all these words')}</li>
              )}
              {classic ? (
                <li {...cardProps(key, i, isCurrent, `verse-card ${isCurrent ? 'reading' : ''} ${isSelected ? 'selected' : ''}`)}>
                  <button className="verse-body" onClick={() => onOpen(hit)}>
                    <span className="ref">{bookName(hit.book)} {hit.chapter}:{hit.verse} <small>{abbrev}</small></span>
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
                        aria-label={isCurrent ? t('Stop') : t('Play {ref}', { ref: `${bookName(hit.book)} ${hit.chapter}:${hit.verse}` })}
                        onClick={() => (isCurrent ? reader.stop() : readAloud([hit]))}
                      >
                        {isCurrent ? '■' : '▶'}
                      </button>
                      <button
                        className={`select-btn ${isSelected ? 'on' : ''}`}
                        aria-label={t(isSelected ? 'Unselect verse' : 'Select verse')}
                        aria-pressed={isSelected}
                        onClick={() => onToggle(key)}
                      >
                        {isSelected ? '✓' : ''}
                      </button>
                    </div>
                  )}
                  {handle(hit, i)}
                </li>
              ) : (
                <li
                  {...cardProps(key, i, isCurrent, `verse-card ${isCurrent ? 'reading' : ''} ${isSelected ? 'selected' : ''}`)}
                  role="button"
                  tabIndex={0}
                  aria-label={t('Open {ref} in its chapter', { ref: `${bookName(hit.book)} ${hit.chapter}:${hit.verse}` })}
                  // Tapping a verse opens its chapter; while choosing verses, it chooses instead
                  onClick={() => (picked.length ? onToggle(key) : onOpen(hit))}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (picked.length) onToggle(key);
                      else onOpen(hit);
                    }
                  }}
                >
                  <button
                    className="tick"
                    aria-label={t(isSelected ? 'Unselect verse' : 'Select verse')}
                    aria-pressed={isSelected}
                    onClick={e => {
                      e.stopPropagation(); // choosing, not opening
                      onToggle(key);
                    }}
                  >
                    {isSelected ? '✓' : ''}
                  </button>
                  <div className="verse-body">
                    <span className="ref">
                      {bookName(hit.book)} {hit.chapter}:{hit.verse} <small>{abbrev} ›</small>
                    </span>
                    <span className="text">
                      {isCurrent && reader.word ? (
                        <ReadingText text={hit.text} word={reader.word} />
                      ) : strongs && tagsFor?.(hit) ? (
                        <TaggedText text={hit.text} tags={tagsFor(hit)!} mark={strongs} />
                      ) : (
                        <Highlight text={hit.text} pattern={hit.loose ? loosePattern : pattern} />
                      )}
                    </span>
                  </div>
                  {handle(hit, i)}
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>
      {shown < count && (
        <button className="more" onClick={onMore}>
          {t('Show more ({n} left)', { n: count - shown })}
        </button>
      )}

      {reader.supported && count > 0 && (
        <div className="player">
          {/* In the bar pinned to the bottom, so it's in reach however far down a long search you are */}
          {picked.length > 0 ? (
            <div className="selection-bar">
              <span>{t('{n} selected', { n: picked.length })}</span>
              {selectionActions(picked)}
              <button onClick={() => onShare(picked)}>{t('Share')}</button>
              {picked.length < count && <button onClick={onSelectAll}>{t('All')}</button>}
              <button onClick={onClearSelection}>{t('Clear')}</button>
            </div>
          ) : count > 1 && (
            <div className="selection-bar">
              <button onClick={onSelectAll}>{t('Select all {n}', { n: count })}</button>
            </div>
          )}
          {reader.playing ? (
            <button className="player-main" onClick={reader.stop}>
              {t('■ Stop · ')}<StopDetail reader={reader} full />
            </button>
          ) : (
            <button className="player-main" onClick={() => readAloud(queue)}>
              ▶ {picked.length ? t('Play {n} selected', { n: picked.length }) : count === 1 ? t('Play verse') : t('Play all {n}', { n: count })}
            </button>
          )}
          <PlayerControls reader={reader} />
        </div>
      )}
    </section>
  );
}

function Chapter({
  bible, view, abbrev, reader, readAloud, selected, onToggle, onSave, onToNote, onClearSelection, onShown, onPick, onWord, onShare, aroundList, hints,
}: {
  hints: boolean; // show the "Tap a word… Swipe…" line
  bible: BibleText;
  view: Extract<View, { kind: 'chapter' }>;
  abbrev: string;
  reader: ReturnType<typeof useReader>;
  readAloud: (verses: VerseHit[]) => void;
  selected: Set<string>;
  onToggle: (key: string) => void;
  onSave: (picked: VerseHit[]) => void;
  onToNote: (picked: VerseHit[]) => void; // add the chosen verses to a note
  onClearSelection: () => void;
  onShown: (place: { book: number; chapter: number }) => void;
  onPick: () => void;
  onWord: (word: string, code: string, verse: VerseHit) => void;
  onShare: (verses: VerseHit[]) => void;
  // Opened from a list: add the chosen verses beside the verse opened (verses already in the list are marked)
  aroundList?: { name: string; label: string; inList: Set<number>; onAdd: (picked: VerseHit[]) => void };
}) {
  const classic = useContext(ClassicContext);
  const { book, chapter, verseStart, verseEnd } = view.ref;
  // Every chapter of the Bible in order, for swiping to the one before or after and reading on
  const chapters = useMemo(() => bible.flatMap((chs, b) => chs.map((_, c) => ({ book: b, chapter: c + 1 }))), [bible]);
  const indexOf = (b: number, c: number) => chapters.findIndex(x => x.book === b && x.chapter === c);
  const main = indexOf(book, chapter);
  const versesOf = (i: number): VerseHit[] =>
    bible[chapters[i].book][chapters[i].chapter - 1].map((text, v) => ({ ...chapters[i], verse: v + 1, text }));
  const name = (i: number) => `${bookName(chapters[i].book)} ${chapters[i].chapter}`;

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
        {classic ? (
          <h2 className="result-title">
            <button className="title-pick" onClick={onPick} aria-label={t('Choose another book, chapter or verse')}>
              {onMain ? formatReference(view.ref) : name(shownAt)} <small>{abbrev} ▾</small>
            </button>
          </h2>
        ) : (
          <div className="book-head">
            <div className="book-name">{bookName(chapters[shownAt].book)}</div>
            <div className="book-num">{chapters[shownAt].chapter}</div>
            {onMain && verseStart !== undefined && <div className="book-sub">{formatReference(view.ref)}</div>}
            <button className="goto-chip" onClick={onPick} aria-label={t('Choose another book, chapter or verse')}>
              {abbrev} · {t('Go to ▾')}
            </button>
          </div>
        )}
        {hints && <p className="chapter-hint">
          {aroundList && onMain
            ? t('Tap verses around {ref} to add them to “{list}”. ', { ref: aroundList.label, list: aroundList.name })
            : tags ? t('Tap a word to study the Hebrew or Greek. ') : reader.supported ? t('Tap verses to choose which ones to play. ') : ''}
          {t('Swipe left or right for the next or previous chapter.')}
        </p>}
        <ol className="chapter">
          {all.map(h => {
            const v = h.verse;
            const key = hitKey(h);
            const isSelected = selected.has(key);
            return (
              <li
                key={v}
                ref={key === readingKey ? readingEl : onMain && v === verseStart ? first : undefined}
                className={`${inRange(v) ? 'hit' : ''} ${key === readingKey ? 'reading' : ''} ${isSelected ? 'selected' : ''} ${
                  aroundList && onMain && aroundList.inList.has(v) ? 'in-list' : ''
                }`}
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
                  <TaggedText text={h.text} tags={tags[v - 1]} onWord={(word, code) => onWord(word, code, h)} />
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
              <span>{t('{n} selected', { n: picked.length })}</span>
              {aroundList && onMain && <button onClick={() => aroundList.onAdd(picked)}>{t('Add around {ref}', { ref: aroundList.label })}</button>}
              <button onClick={() => onSave(picked)}>{t(aroundList && onMain ? 'Other list…' : 'Save to list')}</button>
              <button onClick={() => onToNote(picked)}>{t('To note…')}</button>
              <button onClick={() => onShare(picked)}>{t('Share')}</button>
              <button onClick={onClearSelection}>{t('Clear')}</button>
            </div>
          )}
          {reader.playing ? (
            <button className="player-main" onClick={reader.stop}>
              {t('■ Stop · ')}<StopDetail reader={reader} />
            </button>
          ) : picked.length || askedLabel ? (
            <div className="play-choice">
              {picked.length ? (
                <button className="player-main" onClick={() => readAloud(picked)}>▶ {t('Play {n}', { n: picked.length })}</button>
              ) : (
                <button className="player-main" onClick={() => readAloud(asked)}>▶ {t('Play {ref}', { ref: askedLabel })}</button>
              )}
              <button className="player-alt" onClick={() => readAloud(onward(shownAt))}>▶ {t('Whole chapter')}</button>
            </div>
          ) : (
            <button className="player-main" onClick={() => readAloud(onward(shownAt))}>▶ {t('Play chapter')}</button>
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
  const verseItems = useMemo(() => [t('All'), ...Array.from({ length: verseCount }, (_, i) => String(i + 1))], [verseCount]);
  const ref: Reference = { book, chapter: ch, ...(v ? { verseStart: v } : {}) };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={t('Go to')} onClick={e => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{t('Go to')}</h2>
          <button className="sheet-close" aria-label={t('Close')} onClick={onClose}>✕</button>
        </div>
        <div className="wheels">
          <Wheel label={t('Book')} items={bookNames()} index={book} onChange={setBook} />
          <Wheel label={t('Chapter')} items={chapterItems} index={ch - 1} onChange={i => setChapter(i + 1)} />
          <Wheel label={t('Verse')} items={verseItems} index={v} onChange={setVerse} />
        </div>
        <button className="goto-open" onClick={() => onGo(ref)}>{t('Open {ref}', { ref: formatReference(ref) })}</button>
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
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={t('Shared list')} onClick={e => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{t('Shared list')}</h2>
          <button className="sheet-close" aria-label={t('Close')} onClick={onClose}>✕</button>
        </div>
        <p className="shared-name">“{incoming.name}” <small>{n('{n} verse', '{n} verses', incoming.verses.length)}</small></p>
        {existing && <p className="notice">{t('You already have a list called “{list}”. Its verses will be added to it.', { list: existing.name })}</p>}
        <button className="goto-open" onClick={() => onAdd(existing)}>{t(existing ? 'Add to my list' : 'Add list')}</button>
        <button className="sheet-link" onClick={onClose}>{t('Not now')}</button>
      </div>
    </div>
  );
}

type SectionKey = 'lists' | 'notes' | 'chats';
const SECTIONS: SectionKey[] = ['lists', 'notes', 'chats'];
// The buttons across the top of the bookmark sheet: the first three open and jump to their section
const LIBRARY_TABS = [
  { id: 'lists', name: 'Verse Lists', es: 'Listas' }, // "Listas de versículos" is too long for a tab
  { id: 'notes', name: 'Notes' },
  { id: 'chats', name: 'ChatGPT' },
  { id: 'history', name: 'History' },
] as const;
type LibraryTab = (typeof LIBRARY_TABS)[number]['id'];

/** An open/closed section, remembered on this device. */
function useFolded(key: string, openByDefault: boolean) {
  const [open, setOpenState] = useState(() => {
    try {
      const saved = localStorage.getItem(key);
      return saved === null ? openByDefault : saved === '1';
    } catch {
      return openByDefault;
    }
  });
  const setOpen = (next: boolean) => {
    setOpenState(next);
    try {
      localStorage.setItem(key, next ? '1' : '0');
    } catch {
      // storage unavailable; lasts while the panel is open
    }
  };
  return [open, setOpen] as const;
}

function LibrarySheet({
  library, saving, hideList, onClose, onRun, onOpenList, onSaved, onShare, chats, onOpenChat, onNewChat, onDeleteChat,
  onImportChats, onMoveChat, notes, onOpenNote, onNewNote, onDeleteNote, onMoveNote,
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
  notes: Note[];
  onOpenNote: (id: string) => void;
  onNewNote: () => void;
  onDeleteNote: (id: string) => void;
  onMoveNote: (id: string, to: number) => void;
}) {
  // The tab last used, remembered per device; the sheet opens there
  const [tab, setTabState] = useState<LibraryTab>(() => {
    try {
      const saved = localStorage.getItem('libraryTab');
      return LIBRARY_TABS.some(t => t.id === saved) ? (saved as LibraryTab) : 'lists';
    } catch {
      return 'lists';
    }
  });
  // A section to bring into view once it has opened
  const [jumpTo, setJumpTo] = useState<SectionKey | null>(tab === 'history' ? null : tab);
  const sectionsEl = useRef<HTMLDivElement>(null);
  const setTab = (next: LibraryTab) => {
    setTabState(next);
    try {
      localStorage.setItem('libraryTab', next);
    } catch {
      // storage unavailable; lasts while the sheet is open
    }
    if (next === 'history') return;
    // Notes and ChatGPT tabs open their section (Verse Lists too) and scroll to it
    ({ lists: setListsOpen, notes: setNotesOpen, chats: setChatsOpen })[next](true);
    setJumpTo(next);
  };
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false); // the new-list box, shown by + New
  const [deleting, setDeleting] = useState<string | null>(null); // list waiting for "Sure?"
  // The ChatGPT and Lists sections fold away to save space; each is remembered per device
  const [chatsOpen, setChatsOpen] = useFolded('chatsOpen', false);
  const [notesOpen, setNotesOpen] = useFolded('notesOpen', false);
  // The order of the Lists, Notes and ChatGPT sections, remembered per device
  const [sectionOrder, setSectionOrder] = useState<SectionKey[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('sectionOrder') ?? '[]');
      return SECTIONS.every(k => saved.includes(k)) && saved.length === SECTIONS.length ? saved : SECTIONS;
    } catch {
      return SECTIONS;
    }
  });
  const moveSection = (key: string, to: number) => {
    const next = sectionOrder.filter(k => k !== key);
    next.splice(to, 0, key as SectionKey);
    setSectionOrder(next);
    try {
      localStorage.setItem('sectionOrder', JSON.stringify(next));
    } catch {
      // storage unavailable; lasts while the panel is open
    }
  };
  const sectionDrag = useDragOrder(sectionOrder, moveSection);
  const [listsOpen, setListsOpen] = useFolded('listsOpen', true);
  const { history } = library;
  const lists = library.lists.filter(l => l.id !== hideList);
  useEffect(() => {
    if (!jumpTo) return;
    sectionsEl.current?.querySelector(`[data-section="${jumpTo}"]`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    setJumpTo(null);
  }, [jumpTo, tab]);

  // Lists and chats can be dragged into order by their ⠿ handles
  const listDrag = useDragOrder(lists.map(l => l.id), library.moveList);
  const chatDrag = useDragOrder(chats.map(c => c.id), onMoveChat);
  const noteDrag = useDragOrder(notes.map(n => n.id), onMoveNote);

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
    setCreating(false);
    if (saving) onSaved(name, id, saving.length);
  };

  const listsBody = (
    <>
      {/* Saving always offers a new list; otherwise the box appears with the header's + New */}
      {(saving || creating) && (
        <form className="new-list" onSubmit={createList}>
          <input
            placeholder={t('New list name')}
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Escape' && !saving && (e.stopPropagation(), setCreating(false))}
            aria-label={t('New list name')}
            autoFocus={creating}
          />
          <button type="submit" disabled={!newName.trim()}>{t(saving ? 'Save' : 'Create')}</button>
          {!saving && (
            <button type="button" className="new-list-cancel" aria-label={t('Cancel')} onClick={() => setCreating(false)}>✕</button>
          )}
        </form>
      )}
      {!lists.length && !saving && !creating && <p className="notice">{t('Tap + New, or check verses in your results and tap “Save to list”.')}</p>}
      <ul className="sheet-list">
        {lists.map((l, i) => deleting === l.id ? (
          <li key={l.id} className="confirm-row" role="alertdialog" aria-label={t('Delete {name}?', { name: l.name })}>
            <span>{t('Delete “{name}”?', { name: l.name })}</span>
            <button
              className="danger"
              onClick={() => {
                library.deleteList(l.id);
                setDeleting(null);
              }}
            >
              {t('Delete')}
            </button>
            <button onClick={() => setDeleting(null)} autoFocus>{t('Cancel')}</button>
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
                <button className="sheet-x" aria-label={t('Share {name}', { name: l.name })} disabled={!l.verses.length} onClick={() => onShare(l)}>
                  <svg className="share-icon" viewBox="0 0 24 24" aria-hidden>
                    <circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" />
                    <path d="M8.2 10.8 15.8 6.2M8.2 13.2l7.6 4.6" />
                  </svg>
                </button>
                <button
                  className="sheet-x"
                  aria-label={t('Rename {name}', { name: l.name })}
                  onClick={() => {
                    const name = prompt(t('Rename list'), l.name)?.trim();
                    if (name) library.renameList(l.id, name);
                  }}
                >
                  ✎
                </button>
                <button className="sheet-x list-delete" aria-label={t('Delete {name}', { name: l.name })} onClick={() => setDeleting(l.id)}>
                  ✕
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
    </>
  );

  // Section headers get a ⠿ handle to drag the whole section up or down
  const handle = (key: SectionKey, label: string) =>
    <button {...sectionDrag.handleProps(key, sectionOrder.indexOf(key), t('{name} section', { name: t(label) }))}>⠿</button>;
  const sections: Record<SectionKey, ReactNode> = {
    lists: (
      <>
        <div className="section-head">
          {handle('lists', 'Verse Lists')}
          <button className="section-toggle" aria-expanded={listsOpen} onClick={() => setListsOpen(!listsOpen)}>
            <span className="chevron" aria-hidden>{listsOpen ? '▾' : '▸'}</span> {t('Verse Lists')}
            {lists.length > 0 && <small>{lists.length}</small>}
          </button>
          <button
            className="section-new"
            onClick={() => {
              setListsOpen(true);
              setCreating(true);
            }}
          >
            {t('+ New')}
          </button>
        </div>
        {listsOpen && listsBody}
      </>
    ),
    notes: (
      <>
        <div className="section-head">
          {handle('notes', 'Notes')}
          <button className="section-toggle" aria-expanded={notesOpen} onClick={() => setNotesOpen(!notesOpen)}>
            <span className="chevron" aria-hidden>{notesOpen ? '▾' : '▸'}</span> {t('Notes')}
            {notes.length > 0 && <small>{notes.length}</small>}
          </button>
          <button className="section-new" onClick={onNewNote}>{t('+ New')}</button>
        </div>
        {notesOpen && (
          <ul className="sheet-list">
            {!notes.length && <li className="notice">{t('Thoughts and sermons. Tap + New, then type or dictate.')}</li>}
            {notes.map((n, i) => deleting === `note:${n.id}` ? (
              <li key={n.id} className="confirm-row" role="alertdialog" aria-label={t('Delete note {name}?', { name: noteTitle(n) })}>
                <span>{t('Delete this note?')}</span>
                <button
                  className="danger"
                  onClick={() => {
                    onDeleteNote(n.id);
                    setDeleting(null);
                  }}
                >
                  {t('Delete')}
                </button>
                <button onClick={() => setDeleting(null)} autoFocus>{t('Cancel')}</button>
              </li>
            ) : (
              <li key={n.id} {...noteDrag.rowProps(n.id, i)}>
                {notes.length > 1 && <button {...noteDrag.handleProps(n.id, i, noteTitle(n))}>⠿</button>}
                <button className="sheet-item" onClick={() => onOpenNote(n.id)}>{noteTitle(n)}</button>
                <button className="sheet-x" aria-label={t('Delete note {name}', { name: noteTitle(n) })} onClick={() => setDeleting(`note:${n.id}`)}>✕</button>
              </li>
            ))}
          </ul>
        )}
      </>
    ),
    chats: (
      <>
        <div className="section-head">
          {handle('chats', 'ChatGPT')}
          <button className="section-toggle" aria-expanded={chatsOpen} onClick={() => setChatsOpen(!chatsOpen)}>
            <span className="chevron" aria-hidden>{chatsOpen ? '▾' : '▸'}</span> ChatGPT
            {chats.length > 0 && <small>{chats.length}</small>}
          </button>
          <button className="section-new" onClick={onNewChat}>{uiLanguage() === 'es' ? '+ Nuevo' : t('+ New')}</button>
        </div>
        {chatsOpen && (
          <ul className="sheet-list">
            <li>
              <button className="sheet-item new-chat" onClick={onImportChats}>{t('⇩ Import from ChatGPT')}</button>
            </li>
            {chats.map((c, i) => deleting === `chat:${c.id}` ? (
              <li key={c.id} className="confirm-row" role="alertdialog" aria-label={t('Delete chat {name}?', { name: c.title })}>
                <span>{t('Delete this chat?')}</span>
                <button
                  className="danger"
                  onClick={() => {
                    onDeleteChat(c.id);
                    setDeleting(null);
                  }}
                >
                  {t('Delete')}
                </button>
                <button onClick={() => setDeleting(null)} autoFocus>{t('Cancel')}</button>
              </li>
            ) : (
              <li key={c.id} {...chatDrag.rowProps(c.id, i)}>
                {chats.length > 1 && <button {...chatDrag.handleProps(c.id, i, c.title)}>⠿</button>}
                <button className="sheet-item" onClick={() => onOpenChat(c.id)}>{c.title}</button>
                <button className="sheet-x" aria-label={t('Delete chat {name}', { name: c.title })} onClick={() => setDeleting(`chat:${c.id}`)}>✕</button>
              </li>
            ))}
          </ul>
        )}
      </>
    ),
  };
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={t(saving ? 'Save to list' : 'History and lists')} onClick={e => e.stopPropagation()}>
        <div className="sheet-head">
          {saving ? (
            <h2>{n('Save {n} verse to…', 'Save {n} verses to…', saving.length)}</h2>
          ) : (
            <div className="tabs" role="tablist">
              {LIBRARY_TABS.map(tb => (
                <button key={tb.id} role="tab" aria-selected={tab === tb.id} className={tab === tb.id ? 'on' : ''} onClick={() => setTab(tb.id)}>
                  {'es' in tb && uiLanguage() === 'es' ? tb.es : t(tb.name)}
                </button>
              ))}
            </div>
          )}
          <button className="sheet-close" aria-label={t('Close')} onClick={onClose}>✕</button>
        </div>

        {!saving && tab === 'history' && (
          <>
            {!history.length && <p className="notice">{t('Your searches will show up here.')}</p>}
            <ul className="sheet-list">
              {history.map(q => (
                <li key={q}>
                  <button className="sheet-item" onClick={() => onRun(q)}>{q}</button>
                  <button className="sheet-x" aria-label={t('Remove “{q}” from history', { q })} onClick={() => library.forget(q)}>✕</button>
                </li>
              ))}
            </ul>
            {history.length > 0 && (
              <button className="sheet-link" onClick={() => confirm(t('Clear all search history?')) && library.clearHistory()}>
                {t('Clear history')}
              </button>
            )}
          </>
        )}

        {/* Saving verses always shows the lists, to pick one */}
        {saving && listsBody}

        {/* Lists, Notes and ChatGPT, in the order they've been dragged into */}
        {!saving && tab !== 'history' && (
          <div ref={sectionsEl}>
          {sectionOrder.map((key, i) => {
            const row = sectionDrag.rowProps(key, i);
            return (
              <div key={key} {...row} data-section={key} className={`section ${row.className}`}>
                {sections[key]}
              </div>
            );
          })}
          <Backup />
          </div>
        )}
      </div>
    </div>
  );
}

/** A list's name, edited in place like a note's title. A list can't be left without a name: blank goes back. */
function ListName({ name, onRename }: { name: string; onRename: (name: string) => void }) {
  const [draft, setDraft] = useState(name);
  useEffect(() => setDraft(name), [name]);
  return (
    <input
      className="note-title"
      value={draft}
      aria-label={t('List name')}
      onChange={e => {
        setDraft(e.target.value);
        // Saved as typed (trimming now would swallow the space before the next word)
        if (e.target.value.trim()) onRename(e.target.value);
      }}
      onBlur={() => {
        if (name.trim() !== name) onRename(name.trim());
        setDraft(name.trim());
      }}
      onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()}
    />
  );
}

/** Picks the note that chosen verses go into, or a new one. */
function NotePicker({ count, notes, onPick, onClose }: {
  count: number;
  notes: Note[];
  onPick: (noteId: string | null) => void; // null = a new note
  onClose: () => void;
}) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={t('Add to a note')} onClick={e => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{n('Add the verse to a note', 'Add {n} verses to a note', count)}</h2>
          <button className="sheet-close" aria-label={t('Close')} onClick={onClose}>✕</button>
        </div>
        <ul className="sheet-list">
          <li>
            <button className="sheet-item new-chat" onClick={() => onPick(null)}>{t('+ New note')}</button>
          </li>
          {notes.map(n => (
            <li key={n.id}>
              <button className="sheet-item" onClick={() => onPick(n.id)}>{noteTitle(n)}</button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Save everything on this device to a file, or bring it back from one (another phone, or a new web address). */
function Backup() {
  const file = useRef<HTMLInputElement>(null);
  const save = () => {
    const url = URL.createObjectURL(new Blob([makeBackup(localStorage)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `voice-bible-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };
  const restore = async (picked: File | undefined) => {
    if (!picked) return;
    const text = await picked.text();
    try {
      const what = describeBackup(text);
      if (!confirm(t('Restore this backup{what}? It replaces the lists, notes and chats on this device.', { what: what ? ` (${what})` : '' }))) return;
      restoreBackup(text, localStorage);
      location.reload();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      if (file.current) file.current.value = '';
    }
  };
  return (
    <div className="backup">
      <h3 className="sheet-sub">{t('Backup')}</h3>
      <p className="voice-help">{t('Your lists, notes, chats and settings are kept only on this device. Save a backup file to keep them safe or move them to another phone. It includes your ChatGPT key, so keep the file private.')}</p>
      <div className="backup-actions">
        <button className="sheet-item" onClick={save}>{t('⇩ Save a backup')}</button>
        <button className="sheet-item" onClick={() => file.current?.click()}>{t('⇧ Restore from a backup')}</button>
      </div>
      <input ref={file} type="file" accept=".json,application/json" hidden onChange={e => restore(e.target.files?.[0])} />
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
      <div className="sheet" role="dialog" aria-modal="true" aria-label={t('Reading voice')} onClick={e => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{t(reader.language === 'es' ? 'Reading voice · Español' : 'Reading voice')}</h2>
          <button className="sheet-close" aria-label={t('Close')} onClick={onClose}>✕</button>
        </div>
        {RECORDED_VOICES.length > 0 && reader.language === 'en' && (
          <>
            <h3 className="sheet-sub">{t('Natural voices')}</h3>
            <ul className="sheet-list" role="radiogroup" aria-label={t('Natural voices')}>
              {RECORDED_VOICES.map(v => {
                const on = recordedVoice === v;
                return (
                  <li key={v.id} className={on ? 'on' : ''}>
                    <button className="sheet-item voice-item" role="radio" aria-checked={on} onClick={() => setVoice(`rec:${v.id}`)}>
                      <span className="check" aria-hidden>{on ? '✓' : ''}</span>
                      {v.name} <small>{describeRecorded(v)}</small>
                    </button>
                    <button className="sheet-x" aria-label={t('Hear {name}', { name: v.name })} onClick={() => preview(v.id)}>▶</button>
                  </li>
                );
              })}
            </ul>
            <p className="voice-help">{t('Recorded voices that sound human. They stream over the internet.')}</p>
          </>
        )}

        <h3 className="sheet-sub">{t('Device voices')}</h3>
        {!voices.length && (
          <p className="notice">
            {checking
              ? t('Looking for voices…')
              : t('This browser didn’t share its list of voices, so the app reads with your device’s default voice. If you added Voice Bible to your home screen, try opening it in Safari or Chrome instead.')}
          </p>
        )}
        <ul className="sheet-list" role="radiogroup">
          {voices.map(v => {
            const on = !recordedVoice && v === voice;
            return (
              <li key={v.voiceURI} className={on ? 'on' : ''}>
                <button className="sheet-item voice-item" role="radio" aria-checked={on} onClick={() => setVoice(v.voiceURI)}>
                  <span className="check" aria-hidden>{on ? '✓' : ''}</span>
                  {voiceName(v)} <small>{describeVoice(v).split(' · ').map(w => t(w)).join(' · ')}</small>
                </button>
                <button className="sheet-x" aria-label={t('Hear {name}', { name: voiceName(v) })} onClick={() => preview(v)}>▶</button>
              </li>
            );
          })}
        </ul>
        {voiceId && (
          <button className="sheet-link" onClick={() => setVoice('')}>{t('Use the default voice')}</button>
        )}
        <p className="voice-help">
          {t(hasMan ? 'Voices come from your device.' : 'No man’s voice was found on this device.')} {t('To add more voices and accents:')}
          <br />{t('iPhone: Settings → Accessibility → Spoken Content → Voices → English')}
          <br />{t('Android: Settings → Text-to-speech → Google → Install voice data → English')}
        </p>
      </div>
    </div>
  );
}

/** "John 3:16" (or "3:16" within a chapter) for the verse being read. */
function StopDetail({ reader, full }: { reader: ReturnType<typeof useReader>; full?: boolean }) {
  const c = reader.current;
  if (!c) return null;
  return <>{full ? `${bookName(c.book)} ` : ''}{c.chapter}:{c.verse}</>;
}

/** Repeat and speed on every play bar; ⋯ holds reading the reference first, and the voice. */
function PlayerControls({ reader }: { reader: ReturnType<typeof useReader> }) {
  const [more, setMore] = useState(false);
  const classic = useContext(ClassicContext);
  return (
    <>
      <button
        className={`repeat ${reader.repeat ? 'on' : ''}`}
        aria-pressed={reader.repeat}
        aria-label={t('Repeat')}
        title={t(reader.repeat ? 'Repeat is on' : 'Repeat is off')}
        onClick={() => reader.setRepeat(r => !r)}
      >
        ⟳
      </button>
      <button
        className="speed"
        aria-label={t('Reading speed {n} times. Tap to change', { n: reader.speed })}
        title={t('Reading speed')}
        onClick={() => reader.setSpeed(SPEEDS[(SPEEDS.indexOf(reader.speed) + 1) % SPEEDS.length])}
      >
        {reader.speed}×
      </button>
      {classic ? (
        <button
          className={`repeat ${reader.sayRefs ? 'on' : ''}`}
          aria-pressed={reader.sayRefs}
          aria-label={t('Read chapter and verse before each verse')}
          title={t(reader.sayRefs ? 'Reading chapter and verse' : 'Reading words only')}
          onClick={() => reader.setSayRefs(!reader.sayRefs)}
        >
          {t('Refs')}
        </button>
      ) : (
        <button className="speed" aria-label={t('More playback options')} onClick={() => setMore(true)}>⋯</button>
      )}
      {/* The play bar is see-through (backdrop-filter), which would trap a fixed sheet inside it */}
      {more && createPortal(
        <div className="sheet-backdrop" onClick={() => setMore(false)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-label={t('Playback')} onClick={e => e.stopPropagation()}>
            <div className="sheet-head">
              <h2>{t('Playback')}</h2>
              <button className="sheet-close" aria-label={t('Close')} onClick={() => setMore(false)}>✕</button>
            </div>
            <label className="set-row">
              <span>{t('Say the reference first')}<small className="set-sub">{t('“Psalm 23, verse 1” before each verse')}</small></span>
              <input type="checkbox" role="switch" className="switch" checked={reader.sayRefs} onChange={e => reader.setSayRefs(e.target.checked)} />
            </label>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
