import { describe, expect, it } from 'vitest';
import { dropTarget, noteRows, type Note } from './useNotes';

const note = (id: string, extra: Partial<Note> = {}): Note => ({ id, title: id, text: '', updated: 0, ...extra });
const ids = (notes: Note[]) => noteRows(notes).map(r => (r.child ? `  ${r.note.id}` : r.note.id));

describe('noteRows', () => {
  it('shows notes under the note they are tucked under', () => {
    expect(ids([note('a'), note('b'), note('a1', { parent: 'a' }), note('c'), note('a2', { parent: 'a' })])).toEqual(['a', '  a1', '  a2', 'b', 'c']);
  });
  it('hides the notes under a folded note, and counts them', () => {
    const rows = noteRows([note('a', { collapsed: true }), note('a1', { parent: 'a' }), note('b')]);
    expect(rows.map(r => r.note.id)).toEqual(['a', 'b']);
    expect(rows[0].children).toBe(1);
  });
  it('shows a note at the top level when its parent is missing', () => {
    expect(ids([note('a1', { parent: 'gone' }), note('b')])).toEqual(['a1', 'b']);
  });
});

describe('dropTarget', () => {
  const rows = noteRows([note('a'), note('a1', { parent: 'a' }), note('a2', { parent: 'a' }), note('b'), note('b1', { parent: 'b' })]);
  // a, a1, a2, b, b1
  it('swaps places with a note at the same level', () => {
    expect(dropTarget(rows, 'b', 0)).toBe('a');
    expect(dropTarget(rows, 'a2', 1)).toBe('a1');
  });
  it('lands a top-level note dropped on a tucked-in note at that note’s parent', () => {
    expect(dropTarget(rows, 'a', 4)).toBe('b');
  });
  it('keeps a tucked-in note within its own group', () => {
    expect(dropTarget(rows, 'a1', 4)).toBe('a2');
    expect(dropTarget(rows, 'b1', 0)).toBe('b1');
  });
});
