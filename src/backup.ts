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

/** Puts a backup's contents on this device, replacing what's here under the same names. Returns how many it restored. */
export function restoreBackup(text: string, storage: Storage): number {
  let backup: { app?: string; data?: Record<string, unknown> };
  try {
    backup = JSON.parse(text);
  } catch {
    throw new Error('That file isn’t a Voice Bible backup.');
  }
  if (backup?.app !== APP || !backup.data || typeof backup.data !== 'object') throw new Error('That file isn’t a Voice Bible backup.');
  const entries = Object.entries(backup.data).filter((e): e is [string, string] => typeof e[1] === 'string');
  for (const [key, value] of entries) storage.setItem(key, value);
  return entries.length;
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
    const n = (k: number, one: string) => `${k} ${one}${k === 1 ? '' : 's'}`;
    return [n(count('lists'), 'list'), n(count('notes'), 'note'), n(count('chats'), 'chat')].join(', ');
  } catch {
    return '';
  }
}
