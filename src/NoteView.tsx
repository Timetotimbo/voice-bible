import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { appendDictation } from './dictation';
import type { Chat } from './useChats';
import type { VerseList } from './useLibrary';
import type { Note } from './useNotes';

/** A note for thoughts and sermons: type, dictate (listening continuously), or bring in a list or a chat. */
export function NoteView({ note, onChange, speechInput, listening, interim, onDictate, lists, chats, listText, onShare }: {
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
}) {
  const box = useRef<HTMLTextAreaElement>(null);
  const [inserting, setInserting] = useState(false);
  // Always dictate onto the newest text, even while typing between phrases
  const textRef = useRef(note.text);
  textRef.current = note.text;

  useEffect(() => {
    speechInput.current = phrase => onChange({ text: appendDictation(textRef.current, phrase) });
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
    const at = box.current && document.activeElement === box.current ? box.current.selectionStart : text.length;
    const before = text.slice(0, at).replace(/\s*$/, '');
    const after = text.slice(at).replace(/^\s*/, '');
    onChange({ text: [before, block, after].filter(Boolean).join('\n\n') });
    setInserting(false);
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
        <button onClick={() => setInserting(true)}>Insert</button>
        <button onClick={() => onShare([note.title.trim(), note.text.trim()].filter(Boolean).join('\n\n'))} disabled={!note.text.trim()}>Share</button>
      </div>
      <textarea
        ref={box}
        className="note-text"
        placeholder="Write, or tap Dictate and speak. Say “new paragraph”, “period”, “comma”…"
        value={note.text}
        onChange={e => onChange({ text: e.target.value })}
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
