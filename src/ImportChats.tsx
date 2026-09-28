import { useEffect, useMemo, useState } from 'react';
import { readExportFile, readPastedChat, type ImportedChat } from './chatImport';
import type { Chat } from './useChats';

// Browsers keep about 5 million characters per site; lists and history share it, so leave room
const STORAGE_BUDGET = 4_500_000;

/** Brings ChatGPT conversations into the app, from ChatGPT's export file or a pasted conversation. */
export function ImportChats({ existing, onImport, onClose }: {
  existing: Chat[];
  onImport: (chats: ImportedChat[]) => void;
  onClose: () => void;
}) {
  const [found, setFound] = useState<ImportedChat[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState('');
  const [error, setError] = useState('');
  const [reading, setReading] = useState(false);
  const [pasting, setPasting] = useState(false);
  const [pasted, setPasted] = useState('');
  const [pasteTitle, setPasteTitle] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const already = useMemo(() => new Set(existing.map(c => c.id)), [existing]);
  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return (found ?? []).filter(c => !q || c.title.toLowerCase().includes(q));
  }, [found, filter]);

  const chosen = (found ?? []).filter(c => picked.has(c.id));
  // Would these still fit in the app's storage on this device?
  const used = JSON.stringify(existing).length + JSON.stringify(chosen).length;
  const tooBig = used > STORAGE_BUDGET;

  const openFile = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    setReading(true);
    try {
      const chats = await readExportFile(file);
      if (!chats.length) throw new Error('No conversations found in this file.');
      setFound(chats);
      setPicked(new Set());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setReading(false);
    }
  };

  const toggle = (id: string) =>
    setPicked(p => {
      const next = new Set(p);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet import-sheet" role="dialog" aria-modal="true" aria-label="Import from ChatGPT" onClick={e => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>Import from ChatGPT</h2>
          <button className="sheet-close" aria-label="Close" onClick={onClose}>✕</button>
        </div>

        {!found && !pasting && (
          <>
            <ol className="import-steps">
              <li>In ChatGPT, open <b>Settings › Data controls › Export data</b> and confirm.</li>
              <li>ChatGPT emails you a link. Download the <b>.zip</b> file (it can take a few minutes to arrive).</li>
              <li>Choose that file here, then pick the chats to bring over.</li>
            </ol>
            <label className={`goto-open file-pick ${reading ? 'busy' : ''}`}>
              {reading ? 'Reading…' : 'Choose ChatGPT export file'}
              <input type="file" accept=".zip,.json,application/zip,application/json" onChange={e => openFile(e.target.files?.[0])} disabled={reading} />
            </label>
            <button className="sheet-link" onClick={() => setPasting(true)}>Or paste one conversation</button>
          </>
        )}

        {pasting && (
          <form
            className="paste-chat"
            onSubmit={e => {
              e.preventDefault();
              const chat = readPastedChat(pasted, pasteTitle);
              if (chat) onImport([chat]);
            }}
          >
            <p className="notice">
              In ChatGPT, copy the conversation and paste it below. Turns marked “You said:” and “ChatGPT said:” are kept apart.
            </p>
            <input placeholder="Name (optional)" value={pasteTitle} onChange={e => setPasteTitle(e.target.value)} aria-label="Chat name" />
            <textarea rows={8} placeholder="Paste the conversation here" value={pasted} onChange={e => setPasted(e.target.value)} aria-label="Conversation" />
            <button type="submit" className="goto-open" disabled={!pasted.trim()}>Import</button>
            <button type="button" className="sheet-link" onClick={() => setPasting(false)}>Back</button>
          </form>
        )}

        {found && (
          <>
            <input className="import-filter" type="search" placeholder={`Search ${found.length} chats`} value={filter} onChange={e => setFilter(e.target.value)} aria-label="Search chats" />
            <div className="import-bar">
              <span>{picked.size} chosen</span>
              <button onClick={() => setPicked(new Set(shown.filter(c => !already.has(c.id)).map(c => c.id)))}>Choose all{filter && ' shown'}</button>
              {picked.size > 0 && <button onClick={() => setPicked(new Set())}>Clear</button>}
            </div>
            <ul className="sheet-list import-list">
              {shown.map(c => {
                const have = already.has(c.id);
                return (
                  <li key={c.id}>
                    <label className={`import-item ${have ? 'have' : ''}`}>
                      <input type="checkbox" checked={picked.has(c.id)} disabled={have} onChange={() => toggle(c.id)} />
                      <span className="import-title">{c.title}</span>
                      <small>{have ? 'already here' : `${c.messages.length} msgs${c.updated ? ` · ${new Date(c.updated).toLocaleDateString()}` : ''}`}</small>
                    </label>
                  </li>
                );
              })}
            </ul>
            {tooBig && <p className="notice error">That’s more than this device can store. Choose fewer or shorter chats.</p>}
            {error && <p className="notice error">{error}</p>}
            <button className="goto-open" disabled={!picked.size || tooBig} onClick={() => onImport(chosen)}>
              Import {picked.size || ''} chat{picked.size === 1 ? '' : 's'}
            </button>
          </>
        )}
        {!found && error && <p className="notice error">{error}</p>}
      </div>
    </div>
  );
}
