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

import { combineBackup } from './backup';
describe('combineBackup', () => {
  it('keeps everything from both devices', () => {
    const phone = store({
      lists: JSON.stringify([{ id: 'a', name: 'Gideon Wisdom', verses: [[6, 6, 12], [6, 6, 14]] }, { id: 'b', name: 'Only on phone', verses: [[0, 0, 1]] }]),
      notes: JSON.stringify([{ id: 'n1', title: 'Sermon', text: 'phone text', updated: 2 }, { id: 'n2', title: 'Phone note', text: 'x', updated: 1 }]),
      chats: JSON.stringify([{ id: 'c1', messages: [1] }]),
      theme: 'blue',
    });
    const computer = store({
      lists: JSON.stringify([{ id: 'zz', name: 'gideon wisdom', verses: [[6, 6, 14], [6, 7, 2]] }, { id: 'c', name: 'Only on computer', verses: [[42, 3, 16]] }]),
      notes: JSON.stringify([{ id: 'n1', title: 'Sermon', text: 'computer text', updated: 5 }, { id: 'n3', title: 'Computer note', text: 'y', updated: 3 }]),
      chats: JSON.stringify([{ id: 'c1', messages: [1, 2] }, { id: 'c2', messages: [] }]),
      theme: 'rose',
      speed: '1.25',
    });
    const added = combineBackup(makeBackup(computer), phone);
    const lists = JSON.parse(phone.getItem('lists')!);
    expect(lists.map((l: { name: string }) => l.name)).toEqual(['Gideon Wisdom', 'Only on phone', 'Only on computer']);
    expect(lists[0].verses).toEqual([[6, 6, 12], [6, 6, 14], [6, 7, 2]]);
    const notes = JSON.parse(phone.getItem('notes')!);
    expect(notes.map((x: { title: string; text: string }) => `${x.title}:${x.text}`).sort()).toEqual(['Computer note:y', 'Phone note:x', 'Sermon (other copy):phone text', 'Sermon:computer text']);
    expect(JSON.parse(phone.getItem('chats')!).map((c: { messages: unknown[] }) => c.messages.length)).toEqual([2, 0]);
    expect(phone.getItem('theme')).toBe('blue');
    expect(phone.getItem('speed')).toBe('1.25');
    expect(added).toEqual({ lists: 1, verses: 2, notes: 2, chats: 1 });
  });
});
