import { describe, expect, it } from 'vitest';
import { insertAround, type VerseRef } from './useLibrary';

const ps = (v: number): VerseRef => [18, 36, v];
const other: VerseRef = [18, 40, 10];

describe('adding verses around a list verse', () => {
  it('puts them right beside it, in Bible order', () => {
    expect(insertAround([[0, 1, 1], ps(5), other], ps(5), [ps(6), ps(4)])).toEqual([[0, 1, 1], ps(4), ps(5), ps(6), other]);
  });

  it('merges with neighbours already there and skips verses already in the list', () => {
    const list = [ps(5), ps(6), other];
    expect(insertAround(list, ps(5), [ps(7), ps(6), ps(3)])).toEqual([ps(3), ps(5), ps(6), ps(7), other]);
  });

  it('ignores verses from other chapters and anchors not in the list', () => {
    expect(insertAround([ps(5), other], ps(5), [[18, 37, 1]])).toEqual([ps(5), other]);
    const list = [other];
    expect(insertAround(list, ps(5), [ps(4)])).toBe(list);
  });

  it('leaves the same chapter elsewhere in the list alone', () => {
    const list = [ps(5), other, ps(20)];
    expect(insertAround(list, ps(5), [ps(6)])).toEqual([ps(5), ps(6), other, ps(20)]);
  });
});
