import { describe, expect, it } from 'vitest';
import { merge } from './syncMerge';

const note = (id: string, text: string, updated = 1) => ({ id, title: '', text, updated });

describe('sync merge', () => {
  it('takes whichever side changed', () => {
    expect(merge([note('a', 'x')], [note('a', 'x')], [note('a', 'y')])).toEqual([note('a', 'y')]);
    expect(merge([note('a', 'x')], [note('a', 'y')], [note('a', 'x')])).toEqual([note('a', 'y')]);
  });

  it('keeps everything the first time (nothing agreed yet)', () => {
    expect(merge(undefined, [note('a', 'mine')], [note('b', 'theirs')])).toEqual([note('b', 'theirs'), note('a', 'mine')]);
  });

  it('merges notes changed on both devices, the newer edit winning', () => {
    const base = [note('a', 'a0'), note('b', 'b0')];
    const local = [note('a', 'a-here', 5), note('b', 'b0')];
    const remote = [note('a', 'a-there', 9), note('b', 'b-there', 3), note('c', 'new there')];
    expect(merge(base, local, remote)).toEqual([note('c', 'new there'), note('a', 'a-there', 9), note('b', 'b-there', 3)]);
  });

  it('deletes what one side deleted, unless the other edited it', () => {
    const base = [note('a', 'a0'), note('b', 'b0')];
    expect(merge(base, [note('a', 'a0'), note('x', 'new')], base)).toEqual([note('a', 'a0'), note('x', 'new')]);
    // deleted here, untouched there → gone
    expect(merge(base, [note('a', 'a1')], [note('a', 'a0'), note('b', 'b0')])).toEqual([note('a', 'a1')]);
    // deleted here, edited there → kept
    expect(merge(base, [note('a', 'a1')], [note('a', 'a0'), note('b', 'b-edit')])).toEqual([note('a', 'a1'), note('b', 'b-edit')]);
  });

  it('merges highlights key by key, and deletions', () => {
    const base = { '1.1.1': 'yellow', '1.1.2': 'blue' };
    const local = { '1.1.1': 'yellow', '1.1.3': 'pink' }; // removed 1.1.2, added 1.1.3
    const remote = { '1.1.1': 'green', '1.1.2': 'blue', '2.1.1': 'purple' };
    expect(merge(base, local, remote)).toEqual({ '1.1.1': 'green', '1.1.3': 'pink', '2.1.1': 'purple' });
  });

  it('merges a list of ids as a set', () => {
    expect(merge(['a', 'b'], ['a', 'c'], ['a', 'b', 'd'])).toEqual(['a', 'c', 'd']);
  });

  it('keeps this device’s version of anything else changed on both', () => {
    expect(merge({ id: 'year', done: [1] }, { id: 'year', done: [1, 2] }, { id: 'nt90', done: [] })).toEqual({ id: 'year', done: [1, 2] });
  });
});
