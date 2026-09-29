import { describe, expect, it } from 'vitest';
import { describeBackup, makeBackup, restoreBackup } from './backup';

/** A stand-in for localStorage. */
function store(init: Record<string, string> = {}): Storage {
  const m = new Map(Object.entries(init));
  return {
    get length() { return m.size; },
    key: i => [...m.keys()][i] ?? null,
    getItem: k => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: k => void m.delete(k),
    clear: () => m.clear(),
  };
}

describe('backup', () => {
  it('carries everything to an empty device', () => {
    const from = store({ notes: '[{"id":"1"}]', lists: '[]', chats: '[{},{}]', theme: 'rose' });
    const file = makeBackup(from);
    const to = store();
    expect(restoreBackup(file, to)).toBe(4);
    expect(to.getItem('notes')).toBe('[{"id":"1"}]');
    expect(to.getItem('theme')).toBe('rose');
    expect(describeBackup(file)).toBe('0 lists, 1 note, 2 chats');
  });

  it('refuses a file that isn’t a backup', () => {
    expect(() => restoreBackup('{"hello":1}', store())).toThrow(/isn’t a Voice Bible backup/);
    expect(() => restoreBackup('not json', store())).toThrow(/isn’t a Voice Bible backup/);
  });
});
