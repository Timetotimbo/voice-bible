import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { bookName } from './bible/books';
import type { VerseHit } from './bible/search';
import { appendDictation } from './dictation';
import type { Chat } from './useChats';
import type { VerseList } from './useLibrary';
import type { Note } from './useNotes';

/** A note for thoughts and sermons: type, dictate (listening continuously), or bring in a list or a chat. */
export function NoteView({
  note, onChange, speechInput, listening, interim, onDictate, lists, chats, listText, onShare, findVerses, versesText,
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
  versesText: (verses: VerseHit[]) => string; // verses written out with their references
}) {
  const box = useRef<HTMLTextAreaElement>(null);
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
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [searched, setSearched] = useState(false);
  const key = (v: VerseHit) => `${v.book}-${v.chapter}-${v.verse}`;
  const shown = useMemo(() => found.slice(0, 60), [found]);
  // A reference opens its whole chapter: bring the verse asked for into view
  const pickList = useRef<HTMLUListElement>(null);
  useEffect(() => {
    pickList.current?.querySelector('label.on')?.scrollIntoView({ block: 'center' });
  }, [found]);
  // Always dictate onto the newest text, even while typing between phrases
  const textRef = useRef(note.text);
  textRef.current = note.text;

  useEffect(() => {
    speechInput.current = phrase => {
      // With Insert open, speaking fills in the verse search instead ("John three sixteen")
      if (insertingRef.current) return setQuery(q => `${q} ${phrase}`.trim());
      // Phrases can arrive together, before the note re-renders: build each on the one just added
      textRef.current = appendDictation(textRef.current, phrase);
      onChange({ text: textRef.current });
    };
    return () => {
      speechInput.current = null;
    };
  }, [speechInput, onChange]);

  // Keep the end in view while dictating
  useEffect(() => {
    if (listening && box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [note.text, interim, listening]);

  /** Puts a block of text where the cursor is (or at the end), on its own lines. */
  const insert = (block: string) => {
    const text = note.text;
    const at = Math.min(caret.current ?? text.length, text.length);
    const before = text.slice(0, at).replace(/\s*$/, '');
    const after = text.slice(at).replace(/^\s*/, '');
    const next = [before, block, after].filter(Boolean).join('\n\n');
    onChange({ text: next });
    // The cursor goes after what was inserted, so a second insert follows it
    caret.current = next.length - after.length;
    setInserting(false);
  };

  const search = () => {
    const q = query.trim();
    if (!q) return;
    const { verses, picked } = findVerses(q);
    setFound(verses);
    setChecked(new Set(picked.map(key)));
    setSearched(true);
  };
  const toggle = (v: VerseHit) =>
    setChecked(c => {
      const next = new Set(c);
      if (next.has(key(v))) next.delete(key(v));
      else next.add(key(v));
      return next;
    });
  const chosen = found.filter(v => checked.has(key(v)));
  const openInsert = () => {
    setQuery('');
    setFound([]);
    setChecked(new Set());
    setSearched(false);
    setInserting(true);
  };

  const chatText = (c: Chat) =>
    [`ChatGPT: ${c.title}`, ...c.messages.map(m => `${m.role === 'user' ? 'Me' : 'ChatGPT'}: ${m.content}`)].join('\n\n');

  return (
    <section className="note">
      <input className="note-title" placeholder="Title" value={note.title} onChange={e => onChange({ title: e.target.value })} aria-label="Title" />
      <div className="note-tools">
        <button
          className={`dictate ${listening ? 'on' : ''}`}
          aria-pressed={listening}
          aria-label={listening ? 'Stop dictating' : 'Dictate'}
          onClick={() => onDictate(!listening)}
        >
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z" />
          </svg>
          <span>{listening ? 'Listening' : 'Dictate'}</span>
        </button>
        <button onClick={openInsert}>Insert</button>
        <button onClick={() => onShare([note.title.trim(), note.text.trim()].filter(Boolean).join('\n\n'))} disabled={!note.text.trim()}>Share</button>
      </div>
      <textarea
        ref={box}
        className="note-text"
        placeholder="Write, or tap Dictate and speak. Say “new paragraph”, “period”, “comma”…"
        value={note.text}
        onChange={e => {
          onChange({ text: e.target.value });
          rememberCaret();
        }}
        onSelect={rememberCaret}
        onKeyUp={rememberCaret}
        onClick={rememberCaret}
        // Tapping Insert moves the focus away; the cursor's place is still known at that moment
        onBlur={rememberCaret}
        aria-label="Note"
      />
      {listening && <p className="live-line" aria-live="polite">{interim ? `…${interim}` : 'Listening…'}</p>}

      {inserting && (
        <div className="sheet-backdrop" onClick={() => setInserting(false)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-label="Insert into note" onClick={e => e.stopPropagation()}>
            <div className="sheet-head">
              <h2>Insert into note</h2>
              <button className="sheet-close" aria-label="Close" onClick={() => setInserting(false)}>✕</button>
            </div>
            <h3 className="sheet-sub">A verse</h3>
            <form
              className="new-list"
              onSubmit={e => {
                e.preventDefault();
                search();
              }}
            >
              <input
                type="search"
                placeholder="John 3:16, Psalm 23, or words"
                value={query}
                onChange={e => setQuery(e.target.value)}
                aria-label="Find a verse"
                autoFocus
              />
              <button type="submit" disabled={!query.trim()}>Find</button>
            </form>
            {searched && !found.length && <p className="notice">No verses found.</p>}
            {found.length > 0 && (
              <>
                <ul className="pick-verses" ref={pickList}>
                  {shown.map(v => (
                    <li key={key(v)}>
                      <label className={checked.has(key(v)) ? 'on' : ''}>
                        <input type="checkbox" checked={checked.has(key(v))} onChange={() => toggle(v)} />
                        <span>
                          <b>{bookName(v.book)} {v.chapter}:{v.verse}</b> {v.text}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
                {found.length > shown.length && <p className="notice">Showing the first {shown.length} of {found.length}. Add more words to narrow it.</p>}
                <button className="goto-open" disabled={!chosen.length} onClick={() => insert(versesText(chosen))}>
                  Insert {chosen.length || ''} verse{chosen.length === 1 ? '' : 's'}
                </button>
              </>
            )}

            <h3 className="sheet-sub">Lists</h3>
            {!lists.length && <p className="notice">No lists yet.</p>}
            <ul className="sheet-list">
              {lists.map(l => (
                <li key={l.id}>
                  <button className="sheet-item" onClick={() => insert(`${l.name}\n\n${listText(l)}`)}>
                    {l.name} <small>{l.verses.length}</small>
                  </button>
                </li>
              ))}
            </ul>
            <h3 className="sheet-sub">ChatGPT chats</h3>
            {!chats.length && <p className="notice">No chats yet.</p>}
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
