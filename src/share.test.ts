import { describe, expect, it } from 'vitest';
import { decodeRefs, encodeRefs, sharedListInLink } from './share';
import type { VerseRef } from './useLibrary';

describe('shared list links', () => {
  it('writes runs of verses short and reads them back in the same order', () => {
    const refs: VerseRef[] = [[42, 3, 16], [42, 3, 17], [42, 3, 18], [42, 4, 1], [42, 4, 5], [0, 1, 1], [48, 6, 12]];
    const text = encodeRefs(refs);
    expect(text).toBe('43.3.16-18,4.1,5,1.1.1,49.6.12');
    expect(decodeRefs(text)).toEqual(refs);
  });

  it('skips anything it cannot read', () => {
    expect(decodeRefs('junk,43.3.16,,x.1,99.1.1')).toEqual([[42, 3, 16]]);
  });

  it('reads the name and verses from a link', () => {
    expect(sharedListInLink('#list=Armor%20of%20God&v=49.6.10-11')).toEqual({ name: 'Armor of God', verses: [[48, 6, 10], [48, 6, 11]] });
    expect(sharedListInLink('#list=Empty&v=')).toBeNull();
    expect(sharedListInLink('')).toBeNull();
  });
});
