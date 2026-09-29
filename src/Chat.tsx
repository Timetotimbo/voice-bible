import { useEffect, useRef, useState, type FormEvent, type MutableRefObject, type ReactNode } from 'react';
import { BOOKS } from './bible/books';
import { parseReference, type BibleText, type Reference } from './bible/search';
import { ChatError, askChatGPT } from './openai';
import type { Chat as ChatData, ChatMessage, ChatSettings } from './useChats';
import { ListenBar, ReadingText, SpeakerIcon, type Listen, type Reader } from './ReadAloud';

// "Romans 8:28", "1 John 4:7-8", "Psalm 23" in an answer, to make them tappable
const NAMES = [...new Set([...BOOKS.map(b => b.replace(/^[123] /, '')), 'Psalm'])].sort((a, b) => b.length - a.length);
const REF = new RegExp(`\\b((?:[123] )?(?:${NAMES.join('|')}) \\d+(?::\\d+(?:[-–]\\d+)?)?)`, 'g');

function Linked({ text, bible, onOpenRef }: { text: string; bible: BibleText; onOpenRef: (ref: Reference) => void }) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(REF)) {
    const ref = parseReference(m[1].replace('–', '-'), bible);
    if (!ref) continue;
    parts.push(text.slice(last, m.index));
    parts.push(
      <button key={m.index} className="ref-link" onClick={() => onOpenRef(ref)}>
        {m[1]}
      </button>,
    );
    last = m.index! + m[1].length;
  }
  parts.push(text.slice(last));
  return <>{parts}</>;
}

function KeySetup({ settings, onSave, onCancel }: {
  settings: ChatSettings;
  onSave: (s: ChatSettings) => void;
  onCancel?: () => void;
}) {
  const [apiKey, setApiKey] = useState(settings.apiKey);
  const [model, setModel] = useState(settings.model);
  const save = (e: FormEvent) => {
    e.preventDefault();
    onSave({ apiKey: apiKey.trim(), model: model.trim() || settings.model });
  };
  return (
    <form className="key-setup" onSubmit={save}>
      <h3>Connect ChatGPT</h3>
      <p>
        Paste your OpenAI API key. It’s saved only on this device and sent only to OpenAI. Make one at{' '}
        <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer">platform.openai.com/api-keys</a>.
      </p>
      <label>
        API key
        <input type="password" autoComplete="off" placeholder="sk-…" value={apiKey} onChange={e => setApiKey(e.target.value)} />
      </label>
      <label>
        Model
        <input value={model} onChange={e => setModel(e.target.value)} />
      </label>
      <div className="key-actions">
        <button type="submit" className="goto-open" disabled={!apiKey.trim()}>Save</button>
        {settings.apiKey && (
          <button type="button" className="sheet-link" onClick={() => onSave({ ...settings, apiKey: '' })}>Remove key from this device</button>
        )}
        {onCancel && <button type="button" className="sheet-link" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}

/** A ChatGPT conversation about the Bible. */
export function ChatView({ chat, bible, settings, setSettings, setMessages, onOpenRef, speechInput, reader, listen }: {
  chat: ChatData;
  bible: BibleText;
  settings: ChatSettings;
  setSettings: (s: ChatSettings) => void;
  setMessages: (id: string, messages: ChatMessage[]) => void;
  onOpenRef: (ref: Reference) => void;
  speechInput: MutableRefObject<((text: string) => void) | null>; // spoken words land in the box
  reader: Reader;
  listen: Listen;
}) {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [editingKey, setEditingKey] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const last = chat.messages[chat.messages.length - 1]?.content;
  const empty = !chat.messages.length;
  // Reading aloud: one message after another, with the word being said marked; tap a message to read from there
  const reading = reader.readingText;
  const readFrom = (i: number) => listen(chat.messages.map(m => m.content), chat.title, i);
  const readingEl = useRef<HTMLLIElement>(null);
  useEffect(() => {
    readingEl.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [reader.textAt]);

  useEffect(() => {
    if (!reading) end.current?.scrollIntoView({ block: 'end' });
  }, [chat.messages.length, last]);
  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => {
    speechInput.current = text => setDraft(d => (d.trim() ? `${d.trim()} ${text}` : text));
    return () => {
      speechInput.current = null;
    };
  }, [speechInput]);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    const asked: ChatMessage[] = [...chat.messages, { role: 'user', content: text }];
    setDraft('');
    setError('');
    setMessages(chat.id, asked);
    setBusy(true);
    abort.current = new AbortController();
    let answered = false;
    try {
      await askChatGPT(settings.apiKey, settings.model, asked, soFar => {
        answered = true;
        setMessages(chat.id, [...asked, { role: 'assistant', content: soFar }]);
      }, abort.current.signal);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setError(err instanceof ChatError ? err.message : 'Something went wrong. Try again.');
      // Nothing came back: take the question out of the chat and put it back in the box to send again
      if (!answered) {
        setMessages(chat.id, chat.messages);
        setDraft(text);
      }
    } finally {
      setBusy(false);
      abort.current = null;
    }
  };

  if (!settings.apiKey || editingKey) {
    return (
      <section className="chat">
        <KeySetup
          settings={settings}
          onSave={s => {
            setSettings(s);
            setEditingKey(false);
          }}
          onCancel={settings.apiKey ? () => setEditingKey(false) : undefined}
        />
      </section>
    );
  }

  return (
    <section className="chat">
      <div className="chat-head">
        <h2 className="result-title">{chat.title}</h2>
        <button
          className={`listen ${reading ? 'on' : ''}`}
          aria-label={reading ? 'Stop reading aloud' : 'Read aloud'}
          title={reading ? 'Stop reading aloud' : 'Read aloud'}
          onClick={() => (reading ? reader.stop() : readFrom(0))}
          disabled={!reader.canReadText || empty || busy}
        >
          <SpeakerIcon />
        </button>
        <button className="sheet-link" onClick={() => setEditingKey(true)}>API key</button>
      </div>
      {empty && (
        <p className="notice">Ask anything about the Bible, like “What does the Bible say about fear?” or “Explain Romans 8:28”. Verse references in answers open when tapped.</p>
      )}
      <ol className="messages">
        {chat.messages.map((m, i) => {
          const now = reading && i === reader.textAt;
          return (
            <li
              key={i}
              ref={now ? readingEl : undefined}
              className={`bubble ${m.role} ${now ? 'reading' : ''}`}
              onClick={reading ? () => readFrom(i) : undefined}
            >
              {now && reader.word ? (
                <ReadingText text={m.content} word={reader.word} />
              ) : m.role === 'assistant' && !reading ? (
                <Linked text={m.content} bible={bible} onOpenRef={onOpenRef} />
              ) : (
                m.content
              )}
            </li>
          );
        })}
        {busy && chat.messages[chat.messages.length - 1]?.role === 'user' && <li className="bubble assistant thinking">…</li>}
      </ol>
      {error && <p className="notice error">{error}</p>}
      <div ref={end} />
      {reading ? <ListenBar reader={reader} total={chat.messages.length} /> : (
        <form className="composer" onSubmit={send}>
          <textarea
            rows={1}
            placeholder="Ask ChatGPT, or speak…"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) send(e);
            }}
          />
          {busy ? (
            <button type="button" onClick={() => abort.current?.abort()}>Stop</button>
          ) : (
            <button type="submit" disabled={!draft.trim()}>Send</button>
          )}
        </form>
      )}
    </section>
  );
}
