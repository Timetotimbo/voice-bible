import { useEffect, useMemo, useState } from 'react';
import { readExportFile, readPastedChat, type ImportedChat } from './chatImport';
import type { Chat } from './useChats';
import { n, t } from './i18n';

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
      if (!chats.length) throw new Error(t('No conversations found in this file.'));
      setFound(chats);
      setPicked(new Set());
    } catch (e) {
      setError(t((e as Error).message));
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
      <div className="sheet import-sheet" role="dialog" aria-modal="true" aria-label={t('Import from ChatGPT')} onClick={e => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{t('Import from ChatGPT')}</h2>
          <button className="sheet-close" aria-label={t('Close')} onClick={onClose}>✕</button>
        </div>

        {!found && !pasting && (
          <>
            <ol className="import-steps">
              <li>{t('In ChatGPT, open')} <b>{t('Settings › Data controls › Export data')}</b> {t('and confirm.')}</li>
              <li>{t('ChatGPT emails you a link. Download the')} <b>.zip</b> {t('file (it can take a few minutes to arrive).')}</li>
              <li>{t('Choose that file here, then pick the chats to bring over.')}</li>
            </ol>
            <label className={`goto-open file-pick ${reading ? 'busy' : ''}`}>
              {t(reading ? 'Reading…' : 'Choose ChatGPT export file')}
              <input type="file" accept=".zip,.json,application/zip,application/json" onChange={e => openFile(e.target.files?.[0])} disabled={reading} />
            </label>
            <button className="sheet-link" onClick={() => setPasting(true)}>{t('Or paste one conversation')}</button>
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
              {t('In ChatGPT, copy the conversation and paste it below. Turns marked “You said:” and “ChatGPT said:” are kept apart.')}
            </p>
            <input placeholder={t('Name (optional)')} value={pasteTitle} onChange={e => setPasteTitle(e.target.value)} aria-label={t('Chat name')} />
            <textarea rows={8} placeholder={t('Paste the conversation here')} value={pasted} onChange={e => setPasted(e.target.value)} aria-label={t('Conversation')} />
            <button type="submit" className="goto-open" disabled={!pasted.trim()}>{t('Import')}</button>
            <button type="button" className="sheet-link" onClick={() => setPasting(false)}>{t('Back')}</button>
          </form>
        )}

        {found && (
          <>
            <input className="import-filter" type="search" placeholder={t('Search {n} chats', { n: found.length })} value={filter} onChange={e => setFilter(e.target.value)} aria-label={t('Search chats')} />
            <div className="import-bar">
              <span>{t('{n} chosen', { n: picked.size })}</span>
              <button onClick={() => setPicked(new Set(shown.filter(c => !already.has(c.id)).map(c => c.id)))}>{t(filter ? 'Choose all shown' : 'Choose all')}</button>
              {picked.size > 0 && <button onClick={() => setPicked(new Set())}>{t('Clear')}</button>}
            </div>
            <ul className="sheet-list import-list">
              {shown.map(c => {
                const have = already.has(c.id);
                return (
                  <li key={c.id}>
                    <label className={`import-item ${have ? 'have' : ''}`}>
                      <input type="checkbox" checked={picked.has(c.id)} disabled={have} onChange={() => toggle(c.id)} />
                      <span className="import-title">{c.title}</span>
                      <small>{have ? t('already here') : `${t('{n} msgs', { n: c.messages.length })}${c.updated ? ` · ${new Date(c.updated).toLocaleDateString()}` : ''}`}</small>
                    </label>
                  </li>
                );
              })}
            </ul>
            {tooBig && <p className="notice error">{t('That’s more than this device can store. Choose fewer or shorter chats.')}</p>}
            {error && <p className="notice error">{error}</p>}
            <button className="goto-open" disabled={!picked.size || tooBig} onClick={() => onImport(chosen)}>
              {picked.size ? n('Import {n} chat', 'Import {n} chats', picked.size) : t('Import chats')}
            </button>
          </>
        )}
        {!found && error && <p className="notice error">{error}</p>}
      </div>
    </div>
  );
}
