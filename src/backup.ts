import { n, t } from './i18n';

/**
 * Everything the app keeps on this device (lists, notes, chats, the ChatGPT key, settings) as one file, to
 * keep safe or to carry to another phone or a new web address, where the browser starts out empty.
 */
const APP = 'voice-bible';

export function makeBackup(storage: Storage): string {
  const data: Record<string, string> = {};
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key !== null) data[key] = storage.getItem(key) ?? '';
  }
  return JSON.stringify({ app: APP, saved: new Date().toISOString(), data });
}

/** The entries of a backup file (throws if it isn’t one). */
export function readBackup(text: string): [string, string][] {
  let backup: { app?: string; data?: Record<string, unknown> };
  try {
    backup = JSON.parse(text);
  } catch {
    throw new Error(t('That file isn’t a Voice Bible backup.'));
  }
  if (backup?.app !== APP || !backup.data || typeof backup.data !== 'object') throw new Error(t('That file isn’t a Voice Bible backup.'));
  return Object.entries(backup.data).filter((e): e is [string, string] => typeof e[1] === 'string');
}

/** Puts a backup's contents on this device, replacing what's here under the same names. Returns how many it restored. */
export function restoreBackup(text: string, storage: Storage): number {
  const entries = readBackup(text);
  for (const [key, value] of entries) storage.setItem(key, value);
  return entries.length;
}

type List = { id: string; name: string; verses: [number, number, number][] };
type Note = { id: string; title: string; text: string; updated: number };
type Chat = { id: string; messages?: unknown[]; updated?: number };
const parse = <T,>(v: string | null | undefined): T[] => {
  try {
    const x = JSON.parse(v ?? '[]');
    return Array.isArray(x) ? x : [];
  } catch {
    return [];
  }
};

/**
 * Adds a backup to what's on this device, losing nothing: lists with the same name (or the same list) get every
 * verse from both; notes and chats that are only on one side are kept; a note changed on both devices is kept in
 * both versions. Settings stay as they are here (the backup's fill in only what this device doesn't have).
 * Returns how much it added.
 */
export function combineBackup(text: string, storage: Storage): { lists: number; verses: number; notes: number; chats: number } {
  const theirs = new Map(readBackup(text));
  const added = { lists: 0, verses: 0, notes: 0, chats: 0 };

  // Verse lists: matched by id, else by name
  const lists = parse<List>(storage.getItem('lists'));
  for (const l of parse<List>(theirs.get('lists'))) {
    const mine = lists.find(m => m.id === l.id) ?? lists.find(m => m.name.trim().toLowerCase() === l.name.trim().toLowerCase());
    if (!mine) {
      lists.push(l);
      added.lists++;
      added.verses += l.verses.length;
      continue;
    }
    const have = new Set(mine.verses.map(v => v.join(':')));
    for (const v of l.verses) if (!have.has(v.join(':'))) { mine.verses.push(v); have.add(v.join(':')); added.verses++; }
  }

  // Notes: by id; the same note changed on both devices keeps both versions
  const notes = parse<Note>(storage.getItem('notes'));
  for (const n of parse<Note>(theirs.get('notes'))) {
    const mine = notes.find(m => m.id === n.id);
    if (!mine) {
      if (notes.some(m => m.text === n.text && m.title === n.title)) continue; // the same note under another id
      notes.push(n);
      added.notes++;
    } else if (mine.text !== n.text || mine.title !== n.title) {
      const [newer, older] = mine.updated >= n.updated ? [{ ...mine }, { ...n }] : [{ ...n }, { ...mine }];
      Object.assign(mine, newer);
      if (!newer.text.includes(older.text)) {
        notes.push({ ...older, id: `${older.id}-copy-${Date.now().toString(36)}`, title: `${older.title || t('Note')} ${t('(other copy)')}` });
        added.notes++;
      }
    }
  }
  notes.sort((a, b) => b.updated - a.updated);

  // Chats: by id; the one with more messages wins
  const chats = parse<Chat>(storage.getItem('chats'));
  for (const c of parse<Chat>(theirs.get('chats'))) {
    const i = chats.findIndex(m => m.id === c.id);
    if (i < 0) { chats.push(c); added.chats++; }
    else if ((c.messages?.length ?? 0) > (chats[i].messages?.length ?? 0)) chats[i] = c;
  }

  storage.setItem('lists', JSON.stringify(lists));
  storage.setItem('notes', JSON.stringify(notes));
  storage.setItem('chats', JSON.stringify(chats));
  // Anything else (settings, the ChatGPT key…): only what this device doesn't have yet
  for (const [key, value] of theirs) if (!['lists', 'notes', 'chats'].includes(key) && storage.getItem(key) === null) storage.setItem(key, value);
  return added;
}

/** What a backup holds, to show before restoring: "12 lists, 3 notes, 2 chats". */
export function describeBackup(text: string): string {
  try {
    const data = JSON.parse(text)?.data ?? {};
    const count = (key: string) => {
      try {
        const v = JSON.parse(data[key] ?? '[]');
        return Array.isArray(v) ? v.length : 0;
      } catch {
        return 0;
      }
    };
    return [n('{n} list', '{n} lists', count('lists')), n('{n} note', '{n} notes', count('notes')), n('{n} chat', '{n} chats', count('chats'))].join(', ');
  } catch {
    return '';
  }
}
