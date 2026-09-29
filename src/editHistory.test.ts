import { describe, expect, it } from 'vitest';
import { EditHistory } from './editHistory';

describe('undo and redo in a note', () => {
  it('takes a whole insert back out, and puts it back', () => {
    const h = new EditHistory();
    h.record('My notes', 'edit');
    const withChat = 'My notes\n\nChatGPT: a very long chat…';
    expect(h.undo(withChat)).toBe('My notes');
    expect(h.canUndo).toBe(false);
    expect(h.redo('My notes')).toBe(withChat);
    expect(h.canRedo).toBe(false);
  });

  it('groups a burst of typing into one step', () => {
    const h = new EditHistory();
    h.record('', 'typing', 1000);
    h.record('G', 'typing', 1200);
    h.record('Gr', 'typing', 1400);
    expect(h.undo('Gra')).toBe('');
    expect(h.canUndo).toBe(false);
  });

  it('starts a new step after a pause, or when typing runs long', () => {
    const h = new EditHistory();
    h.record('', 'typing', 0);
    h.record('Grace', 'typing', 5000); // after a pause
    expect(h.undo('Grace is')).toBe('Grace');
    expect(h.undo('Grace')).toBe('');
    const long = new EditHistory();
    for (let t = 0; t <= 9000; t += 500) long.record(`x${t}`, 'typing', t);
    expect(long.undo('end')).not.toBe('x0'); // split before the 8 seconds were up
  });

  it('forgets redo once something new is done', () => {
    const h = new EditHistory();
    h.record('a', 'edit');
    h.undo('ab');
    h.record('a', 'edit');
    expect(h.canRedo).toBe(false);
  });
});
