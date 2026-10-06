import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { bookName } from './bible/books';
import type { VerseHit } from './bible/search';
import { insertDictation } from './dictation';
import { historyFor } from './editHistory';
import { paragraphAt, paragraphsOf } from './words';
import { n, t } from './i18n';
import type { Chat } from './useChats';
import type { VerseList } from './useLibrary';
import { noteTitle, type Note } from './useNotes';
import { RefCard, RefLayer, RefText, type RefPick } from './NoteRefs';
import { ListenBar, ReadingText, SpeakerIcon, type Listen, type Reader } from './ReadAloud';

/** A note for thoughts and sermons: type, dictate (listening continuously), or bring in a list or a chat. */
export function NoteView({
  note, onChange, speechInput, listening, interim, onDictate, lists, chats, listText, onShare, findVerses, chapterOf, versesText, reader, listen, onTeleprompter,
  refVerses, onOpenRef, translation,
}: {
  note: Note;
  onChange: (change: Partial<Pick<Note, 'title' | 'text'>>) => void;
  speechInput: MutableRefObject<((text: string) => void) | null>; // dictated phrases land here
  listening: boolean;
  interim: string; // words being recognised right now
  onDictate: (on: boolean) => void;
  lists: VerseList[];
  chats: Chat[];
  listText: (list: VerseList) => string; // a list's verses, written out with references
  onShare: (text: string) => void;
  // Looks up a reference or words, like the main search; `picked` are the verses a reference asked for
  findVerses: (query: string) => { verses: VerseHit[]; picked: VerseHit[] };
  chapterOf: (book: number, chapter: number) => VerseHit[]; // a whole chapter, to choose verses around a result
  versesText: (verses: VerseHit[]) => string; // verses written out with their references
  reader: Reader;
  listen: Listen;
  onTeleprompter: (title: string, text: string) => void; // opens it over the whole app, so a recording carries on elsewhere
  refVerses: (label: string) => VerseHit[]; // the verses a reference in the note names ("Philemon 1:9-10")
  onOpenRef: (label: string) => void; // shows that reference's chapter
  translation: string; // "KJV", for the verse card
}) {
  const box = useRef<HTMLTextAreaElement>(null);
  // References in the note: tapped (or pointed at) to show their verses; off while typing
  const [refPick, setRefPick] = useState<RefPick | null>(null);
  // Underlines pause only while keys are being pressed (on Android the box stays focused after the keyboard closes)
  const [typing, setTyping] = useState(false);
  const typingTimer = useRef(0);
  const typed = () => {
    setTyping(true);
    clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(() => setTyping(false), 1500);
  };
  const [inserting, setInserting] = useState(false);
  const insertingRef = useRef(inserting);
  insertingRef.current = inserting;
  // Where the cursor was in the note (opening Insert takes the focus away); null = the end
  const caret = useRef<number | null>(null);
  const rememberCaret = () => {
    if (box.current) caret.current = box.current.selectionStart;
  };
  // Finding a verse to insert
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<VerseHit[]>([]);
  // Chosen verses, kept while moving between the results and a chapter
  const [checked, setChecked] = useState<Map<string, VerseHit>>(new Map());
  // A result opened in its chapter (to see it in context and choose the verses around it)
  const [inChapter, setInChapter] = useState<{ verses: VerseHit[]; focus: string } | null>(null);
  const [searched, setSearched] = useState(false);
  const key = (v: VerseHit) => `${v.book}-${v.chapter}-${v.verse}`;
  const shown = useMemo(() => (inChapter ? inChapter.verses : found.slice(0, 60)), [found, inChapter]);
  // A reference opens its whole chapter: bring the verse asked for into view
  const pickList = useRef<HTMLUListElement>(null);
  useEffect(() => {
    const list = pickList.current;
    const el = (inChapter && list?.querySelector(`[data-key="${inChapter.focus}"]`)) || list?.querySelector('label.on');
    el?.scrollIntoView({ block: 'center' });
  }, [found, inChapter]);
  // Always dictate onto the newest text, even while typing between phrases
  const textRef = useRef(note.text);
  textRef.current = note.text;

  // Undo / redo: every change to the text goes through setText, which remembers what it was
  const history = historyFor(note.id);
  const [, redraw] = useState(0); // the buttons follow whether there's anything to undo or redo
  const setText = (next: string, kind: 'typing' | 'edit') => {
    if (next === textRef.current) return;
    history.record(textRef.current, kind);
    textRef.current = next;
    onChange({ text: next });
    redraw(n => n + 1);
  };
  const setTextRef = useRef(setText);
  setTextRef.current = setText;
  const step = (to: string | null) => {
    if (to === null) return;
    textRef.current = to;
    caret.current = null;
    onChange({ text: to });
    redraw(n => n + 1);
  };
  const undo = () => step(history.undo(textRef.current));
  const redo = () => step(history.redo(textRef.current));

  useEffect(() => {
    speechInput.current = phrase => {
      // With Insert open, speaking fills in the verse search instead ("John three sixteen")
      if (insertingRef.current) return setQuery(q => `${q} ${phrase}`.trim());
      // Phrases can arrive together, before the note re-renders: build each on the one just added.
      // They go where the cursor is (the end, if it hasn't been placed), and the cursor follows them.
      const text = textRef.current;
      const next = insertDictation(text, Math.min(caret.current ?? text.length, text.length), phrase);
      setTextRef.current(next.text, 'edit');
      caret.current = next.text.length === next.caret ? null : next.caret;
      placeCaret.current = true;
    };
    return () => {
      speechInput.current = null;
    };
  }, [speechInput, onChange]);

  // After dictating into the middle, put the cursor back after the new words (changing the text moves it to the end)
  const placeCaret = useRef(false);
  useLayoutEffect(() => {
    if (!placeCaret.current || !box.current) return;
    placeCaret.current = false;
    const at = caret.current ?? note.text.length;
    if (document.activeElement === box.current) box.current.setSelectionRange(at, at);
  }, [note.text]);

  // Keep the end in view while dictating there
  useEffect(() => {
    if (listening && box.current && caret.current === null) box.current.scrollTop = box.current.scrollHeight;
  }, [note.text, interim, listening]);

  /** Puts a block of text where the cursor is (or at the end), on its own lines. */
  const insert = (block: string) => {
    const text = note.text;
    const at = Math.min(caret.current ?? text.length, text.length);
    const before = text.slice(0, at).replace(/\s*$/, '');
    const after = text.slice(at).replace(/^\s*/, '');
    const next = [before, block, after].filter(Boolean).join('\n\n');
    setText(next, 'edit');
    // The cursor goes after what was inserted, so a second insert follows it
    caret.current = next.length - after.length;
    setInserting(false);
  };

  const search = () => {
    const q = query.trim();
    if (!q) return;
    const { verses, picked } = findVerses(q);
    setFound(verses);
    setInChapter(null);
    setChecked(c => {
      const next = new Map(c);
      picked.forEach(v => next.set(key(v), v));
      return next;
    });
    setSearched(true);
  };
  const toggle = (v: VerseHit) =>
    setChecked(c => {
      const next = new Map(c);
      if (next.has(key(v))) next.delete(key(v));
      else next.set(key(v), v);
      return next;
    });
  /** Open a search result in its chapter, with it chosen, to add the verses around it. */
  const openChapter = (v: VerseHit) => {
    setChecked(c => new Map(c).set(key(v), v));
    setInChapter({ verses: chapterOf(v.book, v.chapter), focus: key(v) });
  };
  // Everything chosen, in Bible order
  const chosen = [...checked.values()].sort((a, b) => a.book - b.book || a.chapter - b.chapter || a.verse - b.verse);
  // A reference search ("Psalm 73") already shows a chapter: tapping a verse chooses it there too
  const chapterList = !!inChapter || (found.length > 1 && found.every(v => v.book === found[0].book && v.chapter === found[0].chapter) && found.length === chapterOf(found[0].book, found[0].chapter).length);
  const openInsert = () => {
    setQuery('');
    setFound([]);
    setChecked(new Map());
    setInChapter(null);
    setSearched(false);
    setInserting(true);
  };

  // Reading aloud: the note shows as paragraphs, with the word being said marked; tap one to read from there
  const paragraphs = useMemo(() => paragraphsOf(note.text), [note.text]);
  const reading = reader.readingText;
  const readFrom = (i: number) => listen(paragraphs, noteTitle(note), i);
  const readingEl = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    readingEl.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [reader.textAt]);

  const chatText = (c: Chat) =>
    [`ChatGPT: ${c.title}`, ...c.messages.map(m => `${m.role === 'user' ? t('Me') : 'ChatGPT'}: ${m.content}`)].join('\n\n');

  return (
    <section className={`note ${reading ? 'has-player' : ''}`}>
      <input className="note-title" placeholder={t('Title')} value={note.title} onChange={e => onChange({ title: e.target.value })} aria-label={t('Title')} />
      <div className="note-tools">
        <button
          className={`dictate ${listening ? 'on' : ''}`}
          aria-pressed={listening}
          aria-label={t(listening ? 'Stop dictating' : 'Dictate')}
          onClick={() => {
            if (reading) reader.stop(); // the mic would hear the reading
            onDictate(!listening);
          }}
        >
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z" />
          </svg>
          <span>{t(listening ? 'Listening' : 'Dictate')}</span>
        </button>
        <button
          className={`undo listen ${reading ? 'on' : ''}`}
          aria-label={t(reading ? 'Stop reading aloud' : 'Read aloud')}
          title={t(reading ? 'Stop reading aloud' : 'Read aloud')}
          // From the paragraph the cursor is in; from the top if it's at the end or hasn't been placed
          onClick={() => {
            if (reading) return reader.stop();
            const at = caret.current;
            readFrom(at === null || at >= note.text.trimEnd().length ? 0 : paragraphAt(note.text, at));
          }}
          disabled={!reader.canReadText || (!reading && !paragraphs.length)}
        >
          <SpeakerIcon />
        </button>
        <button onClick={openInsert} disabled={reading}>{t('Insert')}</button>
        <button
          className="undo"
          aria-label={t('Teleprompter')}
          title={t('Teleprompter: read this note to the camera and record a video')}
          disabled={!note.text.trim() || !navigator.mediaDevices?.getUserMedia}
          onClick={() => {
            if (reading) reader.stop();
            if (listening) onDictate(false); // the camera needs the microphone
            onTeleprompter(note.title || noteTitle(note), note.text);
          }}
        >
          <svg className="cam-icon" viewBox="0 0 24 24" aria-hidden>
            <rect x="2.5" y="6.5" width="13" height="11" rx="2.5" />
            <path d="m15.5 10.5 6-3.5v10l-6-3.5" />
          </svg>
        </button>
        <button className="undo" aria-label={t('Undo')} title={t('Undo')} disabled={!history.canUndo} onClick={undo}>↶</button>
        <button className="undo" aria-label={t('Redo')} title={t('Redo')} disabled={!history.canRedo} onClick={redo}>↷</button>
        <button className="undo" aria-label={t('Share')} title={t('Share')} onClick={() => onShare([note.title.trim(), note.text.trim()].filter(Boolean).join('\n\n'))} disabled={!note.text.trim()}>
          <svg className="share-icon" viewBox="0 0 24 24" aria-hidden>
            <circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" />
            <path d="M8.2 10.8 15.8 6.2M8.2 13.2l7.6 4.6" />
          </svg>
        </button>
      </div>
      {reading ? (
        <div className="note-text note-reading" aria-live="off">
          {paragraphs.map((p, i) => (
            <p key={i} ref={i === reader.textAt ? readingEl : undefined} className={i === reader.textAt ? 'reading' : ''} onClick={() => readFrom(i)}>
              {i === reader.textAt && reader.word ? <ReadingText text={p} word={reader.word} /> : <RefText text={p} onPick={setRefPick} />}
            </p>
          ))}
        </div>
      ) : (
        <div className="note-box">
        <textarea
          ref={box}
          className="note-text"
          placeholder={t('Write, or tap Dictate and speak. Say “new paragraph”, “period”, “comma”…')}
          value={note.text}
          onChange={e => {
            setText(e.target.value, 'typing');
            rememberCaret();
            typed();
          }}
          onKeyDown={e => {
            // Ctrl/Cmd+Z undoes, Ctrl+Y or Ctrl/Cmd+Shift+Z redoes (the browser's own undo can't see inserts)
            const mod = e.ctrlKey || e.metaKey;
            if (mod && e.key.toLowerCase() === 'z') {
              e.preventDefault();
              if (e.shiftKey) redo();
              else undo();
            } else if (mod && e.key.toLowerCase() === 'y') {
              e.preventDefault();
              redo();
            }
          }}
          onSelect={rememberCaret}
          onKeyUp={rememberCaret}
          onClick={rememberCaret}
          // Tapping Insert moves the focus away; the cursor's place is still known at that moment
          onBlur={() => {
            rememberCaret();
            setTyping(false);
          }}
          aria-label={t('Note')}
        />
        <RefLayer text={note.text} box={box} onPick={setRefPick} editing={typing} />
        </div>
      )}
      {refPick && (
        <RefCard
          pick={refPick}
          verses={refVerses(refPick.label)}
          translation={translation}
          onClose={() => setRefPick(null)}
          onListen={verses => reader.play(verses)}
          reading={reader.playing && reader.current && reader.current.book >= 0 ? reader.current : null}
          onStop={reader.stop}
          onOpen={onOpenRef}
          onEdit={end => {
            const ta = box.current;
            if (!ta) return;
            ta.focus();
            ta.setSelectionRange(end, end);
            typed();
          }}
        />
      )}
      {reading && <ListenBar reader={reader} total={paragraphs.length} />}
      {listening && <p className="live-line" aria-live="polite">{interim ? `…${interim}` : t('Listening…')}</p>}

      {inserting && (
        <div className="sheet-backdrop" onClick={() => setInserting(false)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-label={t('Insert into note')} onClick={e => e.stopPropagation()}>
            <div className="sheet-head">
              <h2>{t('Insert into note')}</h2>
              <button className="sheet-close" aria-label={t('Close')} onClick={() => setInserting(false)}>✕</button>
            </div>
            <h3 className="sheet-sub">{t('A verse')}</h3>
            <form
              className="new-list"
              onSubmit={e => {
                e.preventDefault();
                search();
              }}
            >
              <input
                type="search"
                placeholder={t('John 3:16, Psalm 23, or words')}
                value={query}
                onChange={e => setQuery(e.target.value)}
                aria-label={t('Find a verse')}
                autoFocus
              />
              <button type="submit" disabled={!query.trim()}>{t('Find')}</button>
            </form>
            {searched && !found.length && <p className="notice">{t('No verses found.')}</p>}
            {inChapter && (
              <div className="pick-chapter-head">
                <button className="pick-back" onClick={() => setInChapter(null)}>{t('← Back to results')}</button>
                <b>{bookName(inChapter.verses[0]?.book ?? 0)} {inChapter.verses[0]?.chapter}</b>
              </div>
            )}
            {found.length > 0 && (
              <>
                {!chapterList && <p className="pick-tip">{t('Tap a verse to see its chapter and choose the verses around it, or tap its box to choose it.')}</p>}
                <ul className={`pick-verses ${inChapter ? 'tall' : ''}`} ref={pickList}>
                  {shown.map(v => (
                    <li key={key(v)} data-key={key(v)}>
                      {chapterList ? (
                        <label className={checked.has(key(v)) ? 'on' : ''}>
                          <input type="checkbox" checked={checked.has(key(v))} onChange={() => toggle(v)} />
                          <span>
                            <b>{inChapter ? v.verse : `${bookName(v.book)} ${v.chapter}:${v.verse}`}</b> {v.text}
                          </span>
                        </label>
                      ) : (
                        <div className={`pick-result ${checked.has(key(v)) ? 'on' : ''}`}>
                          <input type="checkbox" checked={checked.has(key(v))} onChange={() => toggle(v)} aria-label={t('Choose {ref}', { ref: `${bookName(v.book)} ${v.chapter}:${v.verse}` })} />
                          <button className="pick-open" onClick={() => openChapter(v)} title={t('See the chapter')}>
                            <b>{bookName(v.book)} {v.chapter}:{v.verse}</b> {v.text} <span className="pick-more">{t('Chapter ›')}</span>
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
                {!inChapter && found.length > shown.length && <p className="notice">{t('Showing the first {shown} of {n}. Add more words to narrow it.', { shown: shown.length, n: found.length })}</p>}
                <button className="goto-open" disabled={!chosen.length} onClick={() => insert(versesText(chosen))}>
                  {chosen.length ? n('Insert {n} verse', 'Insert {n} verses', chosen.length) : t('Insert verses')}
                </button>
              </>
            )}

            <h3 className="sheet-sub">{t('Verse Lists')}</h3>
            {!lists.length && <p className="notice">{t('No lists yet.')}</p>}
            <ul className="sheet-list">
              {lists.map(l => (
                <li key={l.id}>
                  <button className="sheet-item" onClick={() => insert(`${l.name}\n\n${listText(l)}`)}>
                    {l.name} <small>{l.verses.length}</small>
                  </button>
                </li>
              ))}
            </ul>
            <h3 className="sheet-sub">{t('ChatGPT chats')}</h3>
            {!chats.length && <p className="notice">{t('No chats yet.')}</p>}
            <ul className="sheet-list">
              {chats.map(c => (
                <li key={c.id}>
                  <button className="sheet-item" onClick={() => insert(chatText(c))}>{c.title}</button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}
